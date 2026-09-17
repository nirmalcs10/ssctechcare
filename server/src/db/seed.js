const db = require('./database');

async function seedData() {
  console.log('Seeding Computer Service Center database...');

  // 1. Technicians
  const insertTech = db.prepare(`
    INSERT INTO technicians (name, phone, email, specialization, status)
    VALUES (@name, @phone, @email, @specialization, @status)
  `);

  const existingTechs = db.prepare('SELECT COUNT(*) as count FROM technicians').get();
  if (existingTechs.count === 0) {
    const techs = [
      { name: 'Amit Sharma', phone: '+91 98230 11223', email: 'amit@ssctechcare.com', specialization: 'Chip Level / Motherboard & Micro-soldering', status: 'Active' },
      { name: 'Rajesh Varma', phone: '+91 98450 33445', email: 'rajesh@ssctechcare.com', specialization: 'Display Panels, Hinges & Body Fabrication', status: 'Active' },
      { name: 'Priya Nair', phone: '+91 98710 55667', email: 'priya@ssctechcare.com', specialization: 'Storage Upgrades, OS & Data Recovery', status: 'Active' },
      { name: 'Karan Patel', phone: '+91 98990 77889', email: 'karan@ssctechcare.com', specialization: 'Gaming Rigs, Thermals & PSU Diagnostics', status: 'Active' }
    ];
    for (const t of techs) await insertTech.run(t);
    console.log('✓ Technicians seeded');
  }

  // 2. Customers
  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, phone, alt_phone, email, address, notes)
    VALUES (@name, @phone, @alt_phone, @email, @address, @notes)
  `);

  const existingCustomers = db.prepare('SELECT COUNT(*) as count FROM customers').get();
  if (existingCustomers.count === 0) {
    const customers = [
      { name: 'Vikram Malhotra', phone: '9811223344', alt_phone: '9811223345', email: 'vikram.m@gmail.com', address: 'Flat 402, Green Glen Heights, Bellandur', notes: 'Prefers WhatsApp updates' },
      { name: 'Ananya Deshmukh', phone: '9822334455', alt_phone: '', email: 'ananya.d@outlook.com', address: 'Plot 18, 4th Cross, Koramangala 5th Block', notes: 'Corporate client (Design Studio)' },
      { name: 'Rohit Kulkarni', phone: '9833445566', alt_phone: '9833445599', email: 'rohit.k@gmail.com', address: 'Villa 12, Palm Meadows, Whitefield', notes: 'Frequent customer, handles gently' },
      { name: 'Sanjay Reddy', phone: '9844556677', alt_phone: '', email: 'sanjay.reddy@techhub.in', address: '22/A, HSR Layout Sector 2', notes: 'Urgent turnaround required for work rig' },
      { name: 'Meera Iyer', phone: '9855667788', alt_phone: '', email: 'meera.iyer@gmail.com', address: '104, Indiranagar 100ft Road', notes: 'College student, budget conscious' },
      { name: 'David Fernandez', phone: '9866778899', alt_phone: '9866778800', email: 'david.f@musicprod.net', address: 'Penthouse 3, MG Road Residency', notes: 'High-end audio editing workstation' }
    ];
    for (const c of customers) await insertCustomer.run(c);
    console.log('✓ Customers seeded');
  }

  // 3. Inventory / Spare Parts
  const insertInventory = db.prepare(`
    INSERT INTO inventory (sku, name, category, brand_compat, cost_price, selling_price, stock_quantity, min_threshold, location)
    VALUES (@sku, @name, @category, @brand_compat, @cost_price, @selling_price, @stock_quantity, @min_threshold, @location)
  `);

  const existingInventory = db.prepare('SELECT COUNT(*) as count FROM inventory').get();
  if (existingInventory.count === 0) {
    const inventoryItems = [
      { sku: 'RAM-D4-8GB', name: 'Crucial 8GB DDR4 3200MHz SODIMM Laptop RAM', category: 'RAM', brand_compat: 'Universal (Dell, HP, Lenovo, Acer)', cost_price: 1200, selling_price: 1850, stock_quantity: 14, min_threshold: 4, location: 'Bin A-1' },
      { sku: 'RAM-D4-16GB', name: 'Kingston Fury 16GB DDR4 3200MHz SODIMM Laptop RAM', category: 'RAM', brand_compat: 'Universal', cost_price: 2400, selling_price: 3400, stock_quantity: 8, min_threshold: 3, location: 'Bin A-2' },
      { sku: 'RAM-D5-16GB', name: 'Corsair Vengeance 16GB DDR5 4800MHz SODIMM', category: 'RAM', brand_compat: 'Gen 12+ Laptops', cost_price: 3600, selling_price: 4950, stock_quantity: 5, min_threshold: 2, location: 'Bin A-3' },
      { sku: 'SSD-NVME-500', name: 'Crucial P3 500GB M.2 NVMe PCIe 3.0 SSD', category: 'Storage', brand_compat: 'Universal M.2', cost_price: 2200, selling_price: 3200, stock_quantity: 12, min_threshold: 5, location: 'Bin B-1' },
      { sku: 'SSD-NVME-1TB', name: 'Samsung 980 Pro 1TB Gen4 NVMe SSD with Heatsink', category: 'Storage', brand_compat: 'PCIe 4.0 Desktops/Laptops', cost_price: 5800, selling_price: 7900, stock_quantity: 6, min_threshold: 3, location: 'Bin B-2' },
      { sku: 'DISP-156-FHD', name: '15.6" Slim 30-Pin FHD (1920x1080) IPS Matte Screen', category: 'Display', brand_compat: 'Dell, HP, Lenovo, Asus 15.6"', cost_price: 3800, selling_price: 5500, stock_quantity: 4, min_threshold: 2, location: 'Rack Display-1' },
      { sku: 'DISP-140-FHD', name: '14.0" Slim 30-Pin FHD IPS Anti-Glare Screen', category: 'Display', brand_compat: 'ThinkPad, Latitude, EliteBook 14"', cost_price: 3500, selling_price: 5200, stock_quantity: 3, min_threshold: 2, location: 'Rack Display-2' },
      { sku: 'BAT-DELL-5570', name: 'Dell 42Wh 3-Cell Original Battery (WDX0R)', category: 'Battery', brand_compat: 'Dell Inspiron 5570 / 5370 / Vostro 5471', cost_price: 2200, selling_price: 3400, stock_quantity: 2, min_threshold: 3, location: 'Shelf C-1' }, // Low stock!
      { sku: 'BAT-TP-T480', name: 'Lenovo ThinkPad T480 External 61++ 72Wh Battery', category: 'Battery', brand_compat: 'Lenovo ThinkPad T480 / T470 / T580', cost_price: 2600, selling_price: 3900, stock_quantity: 3, min_threshold: 2, location: 'Shelf C-2' },
      { sku: 'THM-MX4-4G', name: 'Arctic MX-4 High Performance Thermal Paste (4g)', category: 'Thermal Paste', brand_compat: 'All CPUs & GPUs', cost_price: 450, selling_price: 750, stock_quantity: 18, min_threshold: 5, location: 'Drawer Tools' },
      { sku: 'CHG-DEL-65W', name: 'Dell 65W Original Type-C AC Power Adapter', category: 'Accessories & Cables', brand_compat: 'Dell XPS, Latitude, Inspiron Type-C', cost_price: 1300, selling_price: 1950, stock_quantity: 7, min_threshold: 3, location: 'Shelf D-1' },
      { sku: 'CHG-HP-65W', name: 'HP 65W Blue Pin Smart AC Adapter', category: 'Accessories & Cables', brand_compat: 'HP Pavilion, Envy, ProBook', cost_price: 950, selling_price: 1600, stock_quantity: 9, min_threshold: 3, location: 'Shelf D-2' },
      { sku: 'PSU-650W-BR', name: 'DeepCool PK650D 650W 80 Plus Bronze Power Supply', category: 'Power Supply', brand_compat: 'ATX Gaming & Workstation PCs', cost_price: 3400, selling_price: 4600, stock_quantity: 4, min_threshold: 2, location: 'Rack PSU' },
      { sku: 'FAN-ASUS-ROG', name: 'Asus ROG Strix G15 Dual CPU+GPU Replacement Fan Set', category: 'Cooling & Fan', brand_compat: 'Asus ROG G512 / G531 series', cost_price: 1400, selling_price: 2300, stock_quantity: 2, min_threshold: 2, location: 'Bin C-3' },
      { sku: 'HINGE-UNIV-SET', name: 'Universal Brass Insert & Epoxy Hinge Repair Kit', category: 'Motherboard & ICs', brand_compat: 'All cracked laptop chassis hinges', cost_price: 300, selling_price: 800, stock_quantity: 15, min_threshold: 4, location: 'Drawer Bench' }
    ];
    for (const item of inventoryItems) await insertInventory.run(item);
    console.log('✓ Inventory seeded');
  }

  // 4. Tickets
  const insertTicket = db.prepare(`
    INSERT INTO tickets (
      ticket_number, customer_id, device_type, brand, model, serial_number, device_password,
      accessories, physical_condition, inspection_checklist, problem_description,
      diagnosis_notes, internal_notes, priority, status, technician_id,
      estimated_cost, estimated_delivery, customer_approved, advance_paid, created_at, updated_at
    ) VALUES (
      @ticket_number, @customer_id, @device_type, @brand, @model, @serial_number, @device_password,
      @accessories, @physical_condition, @inspection_checklist, @problem_description,
      @diagnosis_notes, @internal_notes, @priority, @status, @technician_id,
      @estimated_cost, @estimated_delivery, @customer_approved, @advance_paid, @created_at, @updated_at
    )
  `);

  const insertTicketPart = db.prepare(`
    INSERT INTO ticket_parts (ticket_id, inventory_id, part_name, quantity, unit_price, total_price)
    VALUES (@ticket_id, @inventory_id, @part_name, @quantity, @unit_price, @total_price)
  `);

  const insertTimeline = db.prepare(`
    INSERT INTO timeline_logs (ticket_id, action, description, actor, created_at)
    VALUES (@ticket_id, @action, @description, @actor, @created_at)
  `);

  const existingTickets = db.prepare('SELECT COUNT(*) as count FROM tickets').get();
  if (existingTickets.count === 0) {
    // Ticket 1: In Repair (Dell XPS Screen & Hinge)
    const t1 = await insertTicket.run({
      ticket_number: 'REP-2026-0001',
      customer_id: 1,
      device_type: 'Laptop',
      brand: 'Dell',
      model: 'XPS 15 9500',
      serial_number: '8XYZ192',
      device_password: 'PIN: 1478',
      accessories: JSON.stringify(['Power Adapter / Charger', 'Laptop Sleeve']),
      physical_condition: JSON.stringify(['Left hinge popped open', 'Corner casing hairline crack']),
      inspection_checklist: JSON.stringify({
        powerState: 'Powers On',
        display: 'Flickering / Lines across middle',
        keyboard: 'Working fine',
        trackpad: 'Working fine',
        ports: 'Thunderbolt ports tested OK',
        battery: 'Healthy (84% capacity)',
        thermals: 'Normal',
        smartHealth: 'SSD Good (98%)'
      }),
      problem_description: 'Dropped laptop while closing bag. Left hinge broken and display has horizontal colored lines when moved past 90 degrees.',
      diagnosis_notes: 'EDP display ribbon flex damaged by broken hinge bracket. Panel needs replacement + hinge anchoring with brass thread inserts.',
      internal_notes: 'Tested motherboard output via external HDMI: clean signal. Motherboard unharmed.',
      priority: 'High',
      status: 'IN_REPAIR',
      technician_id: 2, // Rajesh
      estimated_cost: 6500,
      estimated_delivery: '2026-09-16',
      customer_approved: 1,
      advance_paid: 2000,
      created_at: '2026-09-13 10:15:00',
      updated_at: '2026-09-14 11:30:00'
    });

    const t1Id = t1.lastInsertRowid;
    await insertTicketPart.run({ ticket_id: t1Id, inventory_id: 6, part_name: '15.6" Slim 30-Pin FHD IPS Matte Screen', quantity: 1, unit_price: 5500, total_price: 5500 });
    await insertTicketPart.run({ ticket_id: t1Id, inventory_id: 15, part_name: 'Universal Brass Insert & Epoxy Hinge Repair Kit', quantity: 1, unit_price: 800, total_price: 800 });

    await insertTimeline.run({ ticket_id: t1Id, action: 'Ticket Created', description: 'Device checked in at front desk with charger and sleeve.', actor: 'Front Desk', created_at: '2026-09-13 10:15:00' });
    await insertTimeline.run({ ticket_id: t1Id, action: 'Assigned', description: 'Assigned to Rajesh Varma for body & display repair.', actor: 'System', created_at: '2026-09-13 11:00:00' });
    await insertTimeline.run({ ticket_id: t1Id, action: 'Quotation Approved', description: 'Customer approved estimate of ₹6,500. Advance ₹2,000 received via UPI.', actor: 'Rajesh Varma', created_at: '2026-09-13 14:20:00' });
    await insertTimeline.run({ ticket_id: t1Id, action: 'Repair Started', description: 'Display disassembled; brass hinge mount curing with high-strength epoxy resin.', actor: 'Rajesh Varma', created_at: '2026-09-14 11:30:00' });

    // Ticket 2: In Diagnosis (MacBook Air Liquid Spill)
    const t2 = await insertTicket.run({
      ticket_number: 'REP-2026-0002',
      customer_id: 2,
      device_type: 'MacBook',
      brand: 'Apple',
      model: 'MacBook Air M1 2020 (A2337)',
      serial_number: 'FVFXG47JQ6L4',
      device_password: 'Pass: studio2024',
      accessories: JSON.stringify(['USB-C Original Charger']),
      physical_condition: JSON.stringify(['Coffee stains near bottom vent', 'Sticky spacebar']),
      inspection_checklist: JSON.stringify({
        powerState: 'No Power / Dead',
        display: 'Untested (Device dead)',
        keyboard: 'Keycaps sticky',
        trackpad: 'Click feeling dull',
        ports: 'USB-C drawing 5V 0.02A (not switching to 20V)',
        battery: 'Unknown',
        thermals: 'Cold',
        smartHealth: 'N/A'
      }),
      problem_description: 'Spilled coffee over keyboard 2 days ago. Shut off immediately. Customer tried drying it with hair dryer. Will not turn on.',
      diagnosis_notes: 'Under microscope: corrosion around CD3217 USB-C controller chips and PPBUS_G3H power rail. Ultrasonic board bath required before micro-soldering.',
      internal_notes: 'Client has important design files not backed up to iCloud. Advise priority on data safety.',
      priority: 'Urgent',
      status: 'IN_DIAGNOSIS',
      technician_id: 1, // Amit
      estimated_cost: 7500,
      estimated_delivery: '2026-09-17',
      customer_approved: 0,
      advance_paid: 1000,
      created_at: '2026-09-14 09:30:00',
      updated_at: '2026-09-14 11:45:00'
    });

    const t2Id = t2.lastInsertRowid;
    await insertTimeline.run({ ticket_id: t2Id, action: 'Ticket Created', description: 'Urgent intake: Coffee liquid spill on MacBook Air M1.', actor: 'Front Desk', created_at: '2026-09-14 09:30:00' });
    await insertTimeline.run({ ticket_id: t2Id, action: 'Diagnostic In Progress', description: 'Motherboard removed; inspecting power rails under microscope.', actor: 'Amit Sharma', created_at: '2026-09-14 11:45:00' });

    // Ticket 3: Testing / QC (Lenovo ThinkPad SSD & RAM Upgrade)
    const t3 = await insertTicket.run({
      ticket_number: 'REP-2026-0003',
      customer_id: 3,
      device_type: 'Laptop',
      brand: 'Lenovo',
      model: 'ThinkPad T480',
      serial_number: 'PF1K9L02',
      device_password: 'Windows PIN: 9988',
      accessories: JSON.stringify(['Power Adapter / Charger']),
      physical_condition: JSON.stringify(['Normal wear & tear', 'Rubber feet intact']),
      inspection_checklist: JSON.stringify({
        powerState: 'Powers On',
        display: 'OK',
        keyboard: 'Trackpoint and keyboard working',
        trackpad: 'OK',
        ports: 'All USB & HDMI working',
        battery: 'Both internal & external batteries tested OK',
        thermals: 'Dust accumulation in heatsink fin stack',
        smartHealth: 'Old mechanical HDD showing 42% health with bad sectors'
      }),
      problem_description: 'Takes 10 minutes to boot into Windows. Task manager constantly shows 100% disk usage. Wants SSD upgrade and memory expansion.',
      diagnosis_notes: 'Replaced failing mechanical HDD with 1TB NVMe Gen4 SSD. Upgraded from 8GB to 24GB RAM. Performed thermal repaste with Arctic MX-4.',
      internal_notes: 'Cloned old drive data to secondary partition; fresh Windows 11 Pro installed with OEM digital license.',
      priority: 'Normal',
      status: 'TESTING_QC',
      technician_id: 3, // Priya
      estimated_cost: 10500,
      estimated_delivery: '2026-09-14',
      customer_approved: 1,
      advance_paid: 5000,
      created_at: '2026-09-12 11:20:00',
      updated_at: '2026-09-14 12:00:00'
    });

    const t3Id = t3.lastInsertRowid;
    await insertTicketPart.run({ ticket_id: t3Id, inventory_id: 5, part_name: 'Samsung 980 Pro 1TB Gen4 NVMe SSD with Heatsink', quantity: 1, unit_price: 7900, total_price: 7900 });
    await insertTicketPart.run({ ticket_id: t3Id, inventory_id: 2, part_name: 'Kingston Fury 16GB DDR4 3200MHz SODIMM Laptop RAM', quantity: 1, unit_price: 3400, total_price: 3400 });
    await insertTicketPart.run({ ticket_id: t3Id, inventory_id: 10, part_name: 'Arctic MX-4 High Performance Thermal Paste (4g)', quantity: 1, unit_price: 350, total_price: 350 });

    await insertTimeline.run({ ticket_id: t3Id, action: 'Ticket Created', description: 'Customer dropped laptop for SSD & RAM performance overhaul.', actor: 'Front Desk', created_at: '2026-09-12 11:20:00' });
    await insertTimeline.run({ ticket_id: t3Id, action: 'Customer Approved', description: 'Customer approved 1TB Samsung 980 Pro + 16GB RAM upgrade.', actor: 'Priya Nair', created_at: '2026-09-12 15:10:00' });
    await insertTimeline.run({ ticket_id: t3Id, action: 'Hardware Installed', description: 'Installed SSD, RAM, and fresh Windows 11 OS.', actor: 'Priya Nair', created_at: '2026-09-13 17:30:00' });
    await insertTimeline.run({ ticket_id: t3Id, action: 'QC Burn-in Test', description: 'Running MemTest86 and CrystalDiskMark benchmark. Boot time down to 9 seconds!', actor: 'Priya Nair', created_at: '2026-09-14 12:00:00' });

    // Ticket 4: Ready For Pickup (Custom Gaming PC Overheating)
    const t4 = await insertTicket.run({
      ticket_number: 'REP-2026-0004',
      customer_id: 4,
      device_type: 'Gaming Rig',
      brand: 'Custom Build',
      model: 'Ryzen 7 5800X / RTX 3080 Tower',
      serial_number: 'DIY-RIG-2023',
      device_password: 'No password',
      accessories: JSON.stringify(['Power Cord', 'DisplayPort Cable']),
      physical_condition: JSON.stringify(['Tempered glass clean', 'Cabinet heavy']),
      inspection_checklist: JSON.stringify({
        powerState: 'Powers On',
        display: 'Output via GPU DisplayPort OK',
        keyboard: 'N/A (Desktop)',
        trackpad: 'N/A',
        ports: 'Front USB & Audio jacks working',
        battery: 'N/A',
        thermals: 'Initial: CPU 98°C at idle, GPU 91°C',
        smartHealth: 'Crucial P5 NVMe SSD 96% Good'
      }),
      problem_description: 'PC randomly shuts down or freezes during gaming (Valorant / Cyberpunk). Loud jet engine fan sounds.',
      diagnosis_notes: 'AIO liquid cooler pump had failed (dead impeller) and old thermal paste was dried like concrete. Replaced with DeepCool air cooling + new DeepCool 650W PSU.',
      internal_notes: 'Stress tested with Prime95 and FurMark for 2 hours. Max CPU temperature under 100% load is now 68°C.',
      priority: 'High',
      status: 'READY_FOR_PICKUP',
      technician_id: 4, // Karan
      estimated_cost: 6200,
      estimated_delivery: '2026-09-14',
      customer_approved: 1,
      advance_paid: 2000,
      created_at: '2026-09-11 16:45:00',
      updated_at: '2026-09-14 10:15:00'
    });

    const t4Id = t4.lastInsertRowid;
    await insertTicketPart.run({ ticket_id: t4Id, inventory_id: 13, part_name: 'DeepCool PK650D 650W 80 Plus Bronze Power Supply', quantity: 1, unit_price: 4600, total_price: 4600 });
    await insertTicketPart.run({ ticket_id: t4Id, inventory_id: 10, part_name: 'Arctic MX-4 High Performance Thermal Paste (4g)', quantity: 1, unit_price: 750, total_price: 750 });

    await insertTimeline.run({ ticket_id: t4Id, action: 'Ticket Created', description: 'Gaming desktop intake for severe overheating & sudden shutdown.', actor: 'Front Desk', created_at: '2026-09-11 16:45:00' });
    await insertTimeline.run({ ticket_id: t4Id, action: 'Parts Replaced', description: 'Replaced PSU and repasted CPU/GPU with MX-4.', actor: 'Karan Patel', created_at: '2026-09-13 16:00:00' });
    await insertTimeline.run({ ticket_id: t4Id, action: 'QC Passed', description: '2hr stress benchmark passed without crash. Rig runs quiet and cold.', actor: 'Karan Patel', created_at: '2026-09-14 09:30:00' });
    await insertTimeline.run({ ticket_id: t4Id, action: 'Ready for Pickup', description: 'SMS notification sent to customer Sanjay Reddy.', actor: 'System', created_at: '2026-09-14 10:15:00' });

    // Ticket 5: Quotation Pending (HP Pavilion Battery Swelling)
    const t5 = await insertTicket.run({
      ticket_number: 'REP-2026-0005',
      customer_id: 5,
      device_type: 'Laptop',
      brand: 'HP',
      model: 'Pavilion 15-cs3000',
      serial_number: '5CD9423XYZ',
      device_password: 'PIN: 2580',
      accessories: JSON.stringify(['HP 65W Blue Pin Charger']),
      physical_condition: JSON.stringify(['Trackpad lifted by ~3mm due to swollen battery']),
      inspection_checklist: JSON.stringify({
        powerState: 'Powers On only with charger plugged in',
        display: 'OK',
        keyboard: 'OK',
        trackpad: 'Hard to click due to swelling underneath',
        ports: 'All working',
        battery: 'Severely swollen battery, high fire risk',
        thermals: 'Warm',
        smartHealth: 'Good'
      }),
      problem_description: 'Trackpad started pushing upward. Battery discharges from 100% to 0% in 5 minutes.',
      diagnosis_notes: 'Battery cells bloated. Advised immediate removal. Need replacement HP HT03XL compatible battery.',
      internal_notes: 'Removed swollen battery safely into fireproof pouch. Laptop works on adapter.',
      priority: 'Normal',
      status: 'QUOTATION_PENDING',
      technician_id: 2, // Rajesh
      estimated_cost: 3200,
      estimated_delivery: '2026-09-16',
      customer_approved: 0,
      advance_paid: 0,
      created_at: '2026-09-14 10:00:00',
      updated_at: '2026-09-14 11:10:00'
    });

    const t5Id = t5.lastInsertRowid;
    await insertTimeline.run({ ticket_id: t5Id, action: 'Ticket Created', description: 'Intake: Swollen battery lifting trackpad.', actor: 'Front Desk', created_at: '2026-09-14 10:00:00' });
    await insertTimeline.run({ ticket_id: t5Id, action: 'Diagnosed', description: 'Swollen pack isolated safely. Quotation sent to Meera Iyer.', actor: 'Rajesh Varma', created_at: '2026-09-14 11:10:00' });

    // Ticket 6: Delivered with Invoice (Asus ROG Strix Fan replacement)
    const t6 = await insertTicket.run({
      ticket_number: 'REP-2026-0006',
      customer_id: 6,
      device_type: 'Laptop',
      brand: 'Asus',
      model: 'ROG Strix G15 (G512LV)',
      serial_number: 'M3NRCX0189',
      device_password: 'PIN: 0000',
      accessories: JSON.stringify(['Original 230W Power Brick', 'Asus Backpack']),
      physical_condition: JSON.stringify(['No physical scratches', 'RGB lightbar functioning']),
      inspection_checklist: JSON.stringify({
        powerState: 'Powers On',
        display: '144Hz IPS OK',
        keyboard: 'Per-key RGB working',
        trackpad: 'OK',
        ports: 'OK',
        battery: '78% health',
        thermals: 'GPU fan bearing seized; thermal throttle reached 95°C',
        smartHealth: '1TB Intel NVMe SSD 100% health'
      }),
      problem_description: 'High pitched grinding noise from right fan followed by FPS drops in Ableton and Premier Pro.',
      diagnosis_notes: 'Replaced dual CPU/GPU fan assembly with brand new OEM units. Applied thermal grizzly paste.',
      internal_notes: 'Job completed smoothly. Customer pleased with turnaround.',
      priority: 'High',
      status: 'DELIVERED',
      technician_id: 4, // Karan
      estimated_cost: 3500,
      estimated_delivery: '2026-09-12',
      customer_approved: 1,
      advance_paid: 1000,
      created_at: '2026-09-10 14:00:00',
      updated_at: '2026-09-12 18:30:00'
    });

    const t6Id = t6.lastInsertRowid;
    await insertTicketPart.run({ ticket_id: t6Id, inventory_id: 14, part_name: 'Asus ROG Strix G15 Dual CPU+GPU Replacement Fan Set', quantity: 1, unit_price: 2300, total_price: 2300 });

    await insertTimeline.run({ ticket_id: t6Id, action: 'Ticket Created', description: 'Intake: Fan grinding noise on Asus ROG.', actor: 'Front Desk', created_at: '2026-09-10 14:00:00' });
    await insertTimeline.run({ ticket_id: t6Id, action: 'Parts Installed', description: 'Installed brand new OEM fans and replaced thermal paste.', actor: 'Karan Patel', created_at: '2026-09-11 16:30:00' });
    await insertTimeline.run({ ticket_id: t6Id, action: 'Delivered', description: 'Delivered to David Fernandez. Final payment received via UPI.', actor: 'Front Desk', created_at: '2026-09-12 18:30:00' });

    // Seed an Invoice for Ticket 6
    const insertInvoice = db.prepare(`
      INSERT INTO invoices (
        invoice_number, ticket_id, customer_id, labor_charges, parts_total, subtotal,
        tax_rate, tax_amount, discount, grand_total, advance_deducted, amount_paid,
        balance_due, payment_method, payment_status, notes, created_at
      ) VALUES (
        @invoice_number, @ticket_id, @customer_id, @labor_charges, @parts_total, @subtotal,
        @tax_rate, @tax_amount, @discount, @grand_total, @advance_deducted, @amount_paid,
        @balance_due, @payment_method, @payment_status, @notes, @created_at
      )
    `);

    await insertInvoice.run({
      invoice_number: 'INV-2026-0001',
      ticket_id: t6Id,
      customer_id: 6,
      labor_charges: 1200,
      parts_total: 2300,
      subtotal: 3500,
      tax_rate: 18.0,
      tax_amount: 630,
      discount: 130,
      grand_total: 4000,
      advance_deducted: 1000,
      amount_paid: 4000,
      balance_due: 0,
      payment_method: 'UPI / QR',
      payment_status: 'Paid',
      notes: '30-day warranty on replaced fan hardware.',
      created_at: '2026-09-12 18:30:00'
    });

    console.log('✓ Tickets, Parts, Invoices, and Timelines seeded');
  }

  console.log('Database seeding completed successfully!');
}

seedData().then(() => { if (require.main === module) process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
