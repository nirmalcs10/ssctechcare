const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'server', 'data', 'ssctechcare.sqlite');
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');
const D1_DATABASE_NAME = 'ssctechcare-db';

const TABLES = [
  'settings',
  'customers',
  'technicians',
  'inventory',
  'tickets',
  'ticket_parts',
  'timeline_logs',
  'invoices',
  'users',
  'user_sessions',
  'master_accounts',
  'master_sessions'
];

const CLEAR_ORDER = [
  'timeline_logs',
  'ticket_parts',
  'invoices',
  'tickets',
  'customers',
  'user_sessions',
  'master_sessions',
  'inventory',
  'technicians',
  'users',
  'master_accounts',
  'settings'
];

const INSERT_ORDER = [
  'settings',
  'master_accounts',
  'users',
  'technicians',
  'inventory',
  'customers',
  'tickets',
  'ticket_parts',
  'timeline_logs',
  'invoices',
  'master_sessions',
  'user_sessions'
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function exportD1ToSql(outputPath) {
  ensureDir(path.dirname(outputPath));
  console.log(`🌐 Fetching snapshot from Cloudflare D1 remote (${D1_DATABASE_NAME})...`);
  const cmd = `npx wrangler d1 export ${D1_DATABASE_NAME} --remote --output="${outputPath}" --skip-confirmation`;
  execSync(cmd, { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: 'inherit' });
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Failed to export D1 to ${outputPath}`);
  }
}

function getRemoteDbSnapshot() {
  ensureDir(BACKUPS_DIR);
  const tempExportPath = path.join(BACKUPS_DIR, `d1_temp_snapshot_${Date.now()}.sql`);
  try {
    exportD1ToSql(tempExportPath);
    const sql = fs.readFileSync(tempExportPath, 'utf8');
    const memDb = new DatabaseSync(':memory:');
    memDb.exec(sql);
    return { memDb, tempExportPath };
  } catch (err) {
    if (fs.existsSync(tempExportPath)) {
      try { fs.unlinkSync(tempExportPath); } catch (e) {}
    }
    throw err;
  }
}

async function getStatus() {
  console.log('\n📊 Comparing Local SQLite vs Cloudflare D1 Remote...\n');
  const localDb = new DatabaseSync(DB_PATH);
  const { memDb, tempExportPath } = getRemoteDbSnapshot();

  console.log('┌──────────────────┬───────────────────┬────────────────────┬──────────────┐');
  console.log('│ Table Name       │ Local SQLite Rows │ Cloudflare D1 Rows │ Sync Status  │');
  console.log('├──────────────────┼───────────────────┼────────────────────┼──────────────┤');

  let hasDiff = false;
  const diffs = [];

  for (const table of TABLES) {
    let localCount = 0;
    try {
      localCount = localDb.prepare(`SELECT count(*) as c FROM "${table}"`).get().c;
    } catch (e) {
      localCount = 'Err';
    }

    let remoteCount = 0;
    try {
      remoteCount = memDb.prepare(`SELECT count(*) as c FROM "${table}"`).get().c;
    } catch (e) {
      remoteCount = 'Err';
    }

    const match = localCount === remoteCount;
    if (!match) {
      hasDiff = true;
      diffs.push(table);
    }
    const statusText = match ? '✅ In Sync' : '⚠️ Diff';
    console.log(
      `│ ${table.padEnd(16)} │ ${String(localCount).padEnd(17)} │ ${String(remoteCount).padEnd(18)} │ ${statusText.padEnd(12)} │`
    );
  }
  console.log('└──────────────────┴───────────────────┴────────────────────┴──────────────┘\n');

  if (diffs.length > 0) {
    console.log(`⚠️ Differences detected in ${diffs.length} table(s): ${diffs.join(', ')}`);
    for (const table of diffs) {
      if (['users', 'inventory', 'settings', 'technicians', 'master_accounts'].includes(table)) {
        console.log(`\n--- Details for '${table}' ---`);
        const localRows = localDb.prepare(`SELECT * FROM "${table}"`).all();
        const remoteRows = memDb.prepare(`SELECT * FROM "${table}"`).all();
        console.log(`Local (${localRows.length}):`, localRows.map(r => r.name || r.username || r.email || r.shop_name || r.id));
        console.log(`Remote (${remoteRows.length}):`, remoteRows.map(r => r.name || r.username || r.email || r.shop_name || r.id));
      }
    }
  } else {
    console.log('✨ All tables are 100% in sync between Local SQLite and Cloudflare D1 Remote!\n');
  }

  localDb.close();
  memDb.close();

  // Cleanup temp snapshot
  if (fs.existsSync(tempExportPath)) {
    try { fs.unlinkSync(tempExportPath); } catch (e) {}
  }

  return hasDiff;
}

async function pullFromD1() {
  console.log('\n============================================================');
  console.log('📥 PULL: Synchronizing Cloudflare D1 Remote ➔ Local SQLite');
  console.log('============================================================\n');

  ensureDir(BACKUPS_DIR);
  const timestamp = Date.now();

  // 1. Backup existing local SQLite
  const localBackupPath = path.join(BACKUPS_DIR, `local_backup_before_pull_${timestamp}.sqlite`);
  fs.copyFileSync(DB_PATH, localBackupPath);
  console.log(`💾 Step 1/3: Local database backed up to:`);
  console.log(`   ${localBackupPath}\n`);

  // 2. Export D1 to SQL file
  const d1ExportPath = path.join(BACKUPS_DIR, `d1_latest_export_${timestamp}.sql`);
  console.log('🌐 Step 2/3: Exporting Cloudflare D1 snapshot...');
  exportD1ToSql(d1ExportPath);
  console.log(`   Snapshot saved to: ${d1ExportPath}\n`);

  // 3. Apply D1 SQL directly to local SQLite
  console.log('🔄 Step 3/3: Applying Cloudflare D1 data into Local SQLite...');
  const d1Sql = fs.readFileSync(d1ExportPath, 'utf8');
  const lines = d1Sql.split('\n');
  const insertStatements = lines.filter(l => l.startsWith('INSERT INTO'));

  const localDb = new DatabaseSync(DB_PATH);
  localDb.exec('PRAGMA foreign_keys = OFF;');
  localDb.exec('BEGIN TRANSACTION;');

  try {
    for (const table of CLEAR_ORDER) {
      localDb.exec(`DELETE FROM "${table}";`);
    }
    localDb.exec('DELETE FROM sqlite_sequence;');

    for (const stmt of insertStatements) {
      localDb.exec(stmt);
    }

    localDb.exec('COMMIT;');
    localDb.exec('PRAGMA foreign_keys = ON;');
    localDb.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch (err) {
    localDb.exec('ROLLBACK;');
    throw err;
  } finally {
    localDb.close();
  }

  console.log('✅ Pull completed successfully!\n');
  await getStatus();
}

async function pushToD1() {
  console.log('\n============================================================');
  console.log('📤 PUSH: Synchronizing Local SQLite ➔ Cloudflare D1 Remote');
  console.log('============================================================\n');

  ensureDir(BACKUPS_DIR);
  const timestamp = Date.now();

  // 1. Remote safety backup before pushing
  const remoteBackupPath = path.join(BACKUPS_DIR, `d1_backup_before_push_${timestamp}.sql`);
  console.log('🌐 Step 1/3: Creating remote safety backup before push...');
  exportD1ToSql(remoteBackupPath);
  console.log(`   Remote backup saved to: ${remoteBackupPath}\n`);

  // 2. Generate SQL from local SQLite
  console.log('📝 Step 2/3: Generating SQL migration from Local SQLite...');
  const localDb = new DatabaseSync(DB_PATH);

  let sql = 'PRAGMA defer_foreign_keys = TRUE;\n\n';

  for (const table of CLEAR_ORDER) {
    sql += `DELETE FROM "${table}";\n`;
  }
  sql += '\n';

  for (const table of INSERT_ORDER) {
    const rows = localDb.prepare(`SELECT * FROM "${table}"`).all();
    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);
      const quotedCols = columns.map(c => `"${c}"`).join(', ');

      for (const row of rows) {
        const valList = columns.map(col => {
          const v = row[col];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return v;
          return `'${String(v).replace(/'/g, "''")}'`;
        });
        sql += `INSERT INTO "${table}" (${quotedCols}) VALUES (${valList.join(', ')});\n`;
      }
      sql += '\n';
    }
  }

  // Restore sqlite_sequence
  try {
    const sequences = localDb.prepare('SELECT name, seq FROM sqlite_sequence').all();
    sql += 'DELETE FROM sqlite_sequence;\n';
    for (const s of sequences) {
      sql += `INSERT INTO "sqlite_sequence" ("name", "seq") VALUES ('${s.name}', ${s.seq});\n`;
    }
    sql += '\n';
  } catch (e) {}

  localDb.close();

  const migrationFilePath = path.join(BACKUPS_DIR, `local_push_migration_${timestamp}.sql`);
  fs.writeFileSync(migrationFilePath, sql, 'utf8');
  console.log(`   Migration script written to: ${migrationFilePath}\n`);

  // 3. Execute on Cloudflare D1
  console.log('🚀 Step 3/3: Executing migration on Cloudflare D1 Remote...');
  const cmd = `npx wrangler d1 execute ${D1_DATABASE_NAME} --remote --file="${migrationFilePath}" -y`;
  execSync(cmd, { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: 'inherit' });

  console.log('\n✅ Push completed successfully!\n');
  await getStatus();
}

async function main() {
  const arg = process.argv[2] || '--status';

  if (arg === '--status') {
    await getStatus();
  } else if (arg === '--pull') {
    await pullFromD1();
  } else if (arg === '--push') {
    await pushToD1();
  } else {
    console.log('SSC TechCare Database Synchronization Utility');
    console.log('Usage:');
    console.log('  node scripts/sync_db.js --status  (Compare Local SQLite vs Remote D1)');
    console.log('  node scripts/sync_db.js --pull    (Pull Cloudflare D1 ➔ Local SQLite)');
    console.log('  node scripts/sync_db.js --push    (Push Local SQLite ➔ Cloudflare D1)');
  }
}

main().catch(err => {
  console.error('\n❌ Operation failed:', err.message);
  process.exit(1);
});
