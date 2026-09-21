import React, { useState, useEffect } from 'react';
import { 
  User, 
  Building, 
  Database, 
  Palette, 
  Globe, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Download, 
  Upload, 
  KeyRound, 
  UserPlus, 
  Lock, 
  Trash2, 
  Power,
  RefreshCw,
  HardDrive,
  Clock,
  Layers,
  Check,
  Calendar,
  Eye,
  EyeOff
} from 'lucide-react';
import { api } from '../api';
import { applyAppearance, getSavedAppearance } from '../utils/theme';
import { useTranslation } from '../utils/i18n';
import { useComputerClock } from '../utils/date';

export default function Settings({ currentUser }) {
  const { t, setLanguage: setGlobalLanguage, lang: currentLang } = useTranslation();
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Tab 1: Account & Password State
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [newStaffModal, setNewStaffModal] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'technician'
  });
  const [visiblePasswords, setVisiblePasswords] = useState({});

  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Tab 2: Service Center Identity State
  const [settings, setSettings] = useState({
    shop_name: '',
    shop_phone: '',
    shop_email: '',
    shop_address: '',
    tax_rate: 18.0,
    currency_symbol: '₹',
    terms_conditions: ''
  });

  // Tab 3: Backup & Restore State
  const [systemStats, setSystemStats] = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [selectedBackupFile, setSelectedBackupFile] = useState(null);

  // Tab 4: Appearance State
  const [appearance, setAppearance] = useState(getSavedAppearance);

  // Tab 5: Language & Region State
  const [languageSettings, setLanguageSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('ssc_locale');
      return saved ? JSON.parse(saved) : {
        language: 'en',
        dateFormat: 'DD/MM/YYYY hh:mm A',
        currencyFormat: 'in'
      };
    } catch {
      return { language: 'en', dateFormat: 'DD/MM/YYYY hh:mm A', currencyFormat: 'in' };
    }
  });

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [shopData, stats] = await Promise.all([
        api.getSettings().catch(() => ({})),
        api.getSystemStats().catch(() => null)
      ]);
      setSettings(shopData || {});
      setSystemStats(stats);

      if (currentUser?.role === 'admin') {
        const users = await api.getUsers().catch(() => []);
        setStaffList(users);
      }
    } catch (err) {
      console.error('Failed to load settings data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if ((activeTab === 'identity' || activeTab === 'backup') && currentUser?.role !== 'admin') {
      setActiveTab('account');
    }
  }, [currentUser, activeTab]);

  const showToast = (msg) => {
    setSavedSuccess(msg);
    setErrorMessage('');
    setTimeout(() => setSavedSuccess(''), 4000);
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setSavedSuccess('');
    setTimeout(() => setErrorMessage(''), 5000);
  };

  // 1. Password Change Handler
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showError('New passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      showError('New password must be at least 6 characters long');
      return;
    }

    setPasswordLoading(true);
    try {
      await api.changePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword
      });
      showToast('Password successfully changed!');
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showError(err.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Staff User Management Handlers (Admin only)
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    try {
      await api.createUser(newStaffForm);
      showToast(`User ${newStaffForm.username} created successfully!`);
      setNewStaffModal(false);
      setNewStaffForm({ username: '', password: '', fullName: '', role: 'technician' });
      const users = await api.getUsers();
      setStaffList(users);
    } catch (err) {
      showError(err.message || 'Failed to create staff account');
    }
  };

  const handleToggleUser = async (user) => {
    if (user.id === currentUser?.id) {
      showError('You cannot deactivate your own account.');
      return;
    }
    try {
      await api.toggleUserStatus(user.id);
      showToast(`Status updated for ${user.username}`);
      const users = await api.getUsers();
      setStaffList(users);
    } catch (err) {
      showError(err.message || 'Failed to toggle status');
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.id === currentUser?.id) {
      showError('You cannot delete your own account.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete staff user "${user.username}"?`)) return;
    try {
      await api.deleteUser(user.id);
      showToast(`User ${user.username} deleted.`);
      const users = await api.getUsers();
      setStaffList(users);
    } catch (err) {
      showError(err.message || 'Failed to delete user');
    }
  };

  // 2. Identity Save Handler
  const handleSaveIdentity = async (e) => {
    e.preventDefault();
    try {
      await api.updateSettings(settings);
      showToast('Service center identity and billing configuration saved!');
    } catch (err) {
      showError('Failed to save settings: ' + err.message);
    }
  };

  // 3. Backup & Restore Handlers
  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    try {
      await api.downloadBackup();
      showToast('Database snapshot (.json) successfully downloaded!');
    } catch (err) {
      showError(err.message || 'Failed to download backup snapshot');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.endsWith('.db') || file.name.endsWith('.sqlite')) {
      showError('Please select the .json snapshot file (e.g. SSC_TechCare_Backup_*.json) downloaded from this system. Raw .db binary files cannot be restored directly through the browser.');
      e.target.value = '';
      return;
    }
    if (!file.name.endsWith('.json')) {
      showError('Please select a valid database snapshot file (.json)');
      e.target.value = '';
      return;
    }
    setSelectedBackupFile(file);
    setRestoreConfirmOpen(true);
    e.target.value = '';
  };

  const executeRestore = async () => {
    if (!selectedBackupFile) return;
    setRestoreLoading(true);
    try {
      await api.restoreBackup(selectedBackupFile);
      showToast('Database restored successfully! Reloading data...');
      setRestoreConfirmOpen(false);
      setSelectedBackupFile(null);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      showError(err.message || 'Restore failed');
    } finally {
      setRestoreLoading(false);
    }
  };

  // 4. Appearance Save
  const handleUpdateAppearance = (key, val) => {
    const updated = { ...appearance, [key]: val };
    setAppearance(updated);
    applyAppearance(updated);
    showToast(`Appearance updated: ${key} is now ${val}`);
  };

  // 5. Language Save
  const handleUpdateLocale = (key, val) => {
    const updated = { ...languageSettings, [key]: val };
    setLanguageSettings(updated);
    localStorage.setItem('ssc_locale', JSON.stringify(updated));
    if (key === 'language') {
      setGlobalLanguage(val);
    }
    showToast('Language and regional settings updated!');
  };

  // 6. Computer Clock Sync Handler
  const clock = useComputerClock();
  const [syncVerifying, setSyncVerifying] = useState(false);

  const handleVerifyClockSync = async () => {
    setSyncVerifying(true);
    try {
      const stats = await api.getSystemStats();
      if (stats.systemTime?.localTime) {
        showToast(`Clock in Sync! Server SQLite Time: ${stats.systemTime.localTime} | Computer Time: ${clock.timeString}`);
      } else {
        showToast(`Computer Clock Active: ${clock.fullString}`);
      }
    } catch {
      showError('Could not verify clock sync with server');
    } finally {
      setSyncVerifying(false);
    }
  };

  const allTabs = [
    { id: 'account', label: t('account'), icon: User, desc: t('accountDesc') },
    { id: 'identity', label: t('identity'), icon: Building, desc: t('identityDesc'), adminOnly: true },
    { id: 'backup', label: t('backup'), icon: Database, desc: t('backupDesc'), adminOnly: true },
    { id: 'appearance', label: t('appearance'), icon: Palette, desc: t('appearanceDesc') },
    { id: 'language', label: t('language'), icon: Globe, desc: t('languageDesc') }
  ];

  const tabs = allTabs.filter(tab => !tab.adminOnly || currentUser?.role === 'admin');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-3 text-sky-400" />
        <span>Loading Settings Hub...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('systemSettings')}</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {t('systemSettingsDesc')}
        </p>
      </div>

      {/* Global Alerts */}
      {savedSuccess && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-700 text-emerald-300 rounded-2xl text-xs flex items-center gap-2.5 animate-fadeIn shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{savedSuccess}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 bg-rose-950/80 border border-rose-700 text-rose-300 rounded-2xl text-xs flex items-center gap-2.5 animate-fadeIn shadow-lg">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Modern Tab Bar */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 ${tabs.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col sm:flex-row items-center sm:items-start gap-2.5 p-3 rounded-xl transition-all text-left ${
                isActive
                  ? 'bg-slate-800 text-white shadow-md border border-slate-700/80'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${isActive ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800/80 text-slate-400'}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="overflow-hidden text-center sm:text-left">
                <div className={`text-xs font-bold truncate ${isActive ? 'text-sky-400' : 'text-slate-200'}`}>
                  {tab.label}
                </div>
                <div className="text-[11px] text-slate-400 hidden xl:block truncate">
                  {tab.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ACCOUNT & SECURITY */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          {/* Current User Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-sky-500/20">
                {currentUser?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{currentUser?.fullName || currentUser?.username}</h2>
                  <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                    {currentUser?.role || 'Staff'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">@{currentUser?.username}</p>
              </div>
            </div>
            <div className="text-xs text-slate-400 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-6 space-y-1">
              <div><span className="text-slate-400">Access Level:</span> <span className="font-semibold text-slate-200 uppercase">{currentUser?.role}</span></div>
              <div><span className="text-slate-400">Session Status:</span> <span className="text-emerald-400 font-semibold">Active & Secured</span></div>
            </div>
          </div>

          {/* Change Password Form (Admin only) */}
          {currentUser?.role === 'admin' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <KeyRound className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Change Password</h3>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Current Password *</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.oldPassword}
                    onChange={e => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">New Password *</label>
                    <input
                      type="password"
                      required
                      value={passwordForm.newPassword}
                      onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="At least 6 characters"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Confirm New Password *</label>
                    <input
                      type="password"
                      required
                      value={passwordForm.confirmPassword}
                      onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      placeholder="Re-enter new password"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 transition-all shadow-md shadow-sky-600/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {passwordLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>Update Password</span>
                </button>
              </form>
            </div>
          )}

          {/* Admin Staff User Management */}
          {currentUser?.role === 'admin' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Staff & User Management</h3>
                    <p className="text-xs text-slate-400">Manage login credentials for service desk technicians and staff</p>
                  </div>
                </div>
                <button
                  onClick={() => setNewStaffModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 shadow-md transition-all active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Staff User</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3">Staff Member</th>
                      <th className="p-3">Username</th>
                      <th className="p-3">Password</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Last Login</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {staffList.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-850/40">
                        <td className="p-3 font-semibold text-white">{user.full_name}</td>
                        <td className="p-3 font-mono text-slate-300">@{user.username}</td>
                        <td className="p-3">
                          <div className="inline-flex items-center gap-2 bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-800">
                            <span className={`font-mono text-xs ${visiblePasswords[user.id] ? 'text-amber-300 font-bold' : 'text-slate-400 tracking-wider'}`}>
                              {visiblePasswords[user.id] ? (user.plain_password || '******') : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(user.id)}
                              className="text-slate-500 hover:text-sky-400 transition-colors ml-0.5"
                              title={visiblePasswords[user.id] ? 'Hide password' : 'Show password'}
                            >
                              {visiblePasswords[user.id] ? (
                                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                            user.role === 'admin' ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' :
                            user.role === 'technician' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                            'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${user.is_active ? 'text-emerald-400' : 'text-slate-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">
                          {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                        </td>
                        <td className="p-3 text-right">
                          {user.id !== currentUser?.id && user.id !== 1 && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleToggleUser(user)}
                                title={user.is_active ? 'Deactivate account' : 'Activate account'}
                                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                                  user.is_active ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                                }`}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user)}
                                title="Delete user"
                                className="p-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SERVICE CENTER IDENTITY (ADMIN ONLY) */}
      {activeTab === 'identity' && currentUser?.role === 'admin' && (
        <form onSubmit={handleSaveIdentity} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
            <Building className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="text-base font-bold text-white">Workshop & Brand Identity</h3>
              <p className="text-xs text-slate-400">Information printed on customer A4 job sheets, estimate slips, and tax invoices</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Service Center / Legal Name *</label>
              <input
                type="text"
                required
                value={settings.shop_name}
                onChange={e => setSettings({ ...settings, shop_name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Helpline / WhatsApp Phone *</label>
                <input
                  type="text"
                  required
                  value={settings.shop_phone}
                  onChange={e => setSettings({ ...settings, shop_phone: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Customer Support Email *</label>
                <input
                  type="email"
                  required
                  value={settings.shop_email}
                  onChange={e => setSettings({ ...settings, shop_email: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Physical Address & Workshop Facility *</label>
              <textarea
                rows={2}
                required
                value={settings.shop_address}
                onChange={e => setSettings({ ...settings, shop_address: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
              />
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-3">
              Taxation & Currency Formatting
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Default Tax / GST Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.tax_rate}
                  onChange={e => setSettings({ ...settings, tax_rate: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={settings.currency_symbol}
                  onChange={e => setSettings({ ...settings, currency_symbol: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-2">
              Legal Terms, Customer Agreement & Warranty Conditions
            </h4>
            <p className="text-[11px] text-slate-400 mb-3">These terms are printed on the physical Job Intake Sheet and final Tax Invoice.</p>
            <textarea
              rows={5}
              value={settings.terms_conditions}
              onChange={e => setSettings({ ...settings, terms_conditions: e.target.value })}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs leading-relaxed font-sans"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-sky-500/20 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save Service Center Identity</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: BACKUP AND RESTORE (Admin only) */}
      {activeTab === 'backup' && currentUser?.role === 'admin' && (
        <div className="space-y-6">
          {/* Storage & Record Metrics */}
          {systemStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-2 text-sky-400 mb-1">
                  <HardDrive className="w-4 h-4" />
                  <span className="text-xs font-medium">Database File Size</span>
                </div>
                <div className="text-xl font-bold text-white">{systemStats.dbSizeFormatted}</div>
                <div className="text-[10px] text-slate-400">SQLite 3 (WAL mode)</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-2 text-amber-400 mb-1">
                  <Layers className="w-4 h-4" />
                  <span className="text-xs font-medium">Total Repair Tickets</span>
                </div>
                <div className="text-xl font-bold text-white">{systemStats.recordCounts?.tickets || 0}</div>
                <div className="text-[10px] text-slate-400">All intake records</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-2 text-emerald-400 mb-1">
                  <User className="w-4 h-4" />
                  <span className="text-xs font-medium">Customers Registered</span>
                </div>
                <div className="text-xl font-bold text-white">{systemStats.recordCounts?.customers || 0}</div>
                <div className="text-[10px] text-slate-400">Unique phone directory</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-2 text-indigo-400 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-medium">Server Uptime</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {Math.floor((systemStats.uptime || 0) / 60)} min
                </div>
                <div className="text-[10px] text-slate-400">Node {systemStats.nodeVersion}</div>
              </div>
            </div>
          )}

          {/* Backup Action Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sky-400">
                  <Download className="w-5 h-5" />
                  <h3 className="text-base font-bold text-white">Download Live Database Snapshot</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  Download a complete structured JSON snapshot (<code className="text-slate-300 font-mono">.json</code> format) containing all customer profiles, repair histories, inventory levels, billing records, and settings.
                </p>
              </div>

              <button
                onClick={handleDownloadBackup}
                disabled={backupLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-500/20 transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                {backupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Download Snapshot (.json)</span>
              </button>
            </div>
          </div>

          {/* Restore Action Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-amber-400">
                  <Upload className="w-5 h-5" />
                  <h3 className="text-base font-bold text-white">Restore Database from Backup</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  Upload a previously downloaded <code className="text-slate-300 font-mono">.json</code> snapshot file to restore your database records, inventory parts, tickets, and invoices.
                </p>
              </div>

              <div>
                <input
                  type="file"
                  id="dbRestoreInput"
                  accept=".json,.db,.sqlite"
                  onChange={handleRestoreFileSelected}
                  className="hidden"
                />
                <label
                  htmlFor="dbRestoreInput"
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-amber-500/50 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-amber-400" />
                  <span>Choose Backup File (.json)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Restore Confirmation Modal */}
          {restoreConfirmOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                <div className="flex items-center gap-3 text-amber-400">
                  <AlertCircle className="w-6 h-6" />
                  <h4 className="text-base font-bold text-white">Confirm Database Restore</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  You are about to restore database from <strong className="text-white">{selectedBackupFile?.name}</strong>. 
                  This will replace all current tables with the uploaded file contents. 
                  A safety pre-restore backup will be created on the server automatically.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => { setRestoreConfirmOpen(false); setSelectedBackupFile(null); }}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeRestore}
                    disabled={restoreLoading}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 transition-all flex items-center gap-2"
                  >
                    {restoreLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>Confirm & Restore</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: APPEARANCE */}
      {activeTab === 'appearance' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
            <Palette className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="text-base font-bold text-white">Appearance & Display Preferences</h3>
              <p className="text-xs text-slate-400">Personalize workspace contrast, accent palette, and layout density</p>
            </div>
          </div>

          {/* Theme Presets */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
              Theme Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { id: 'cyberpunk', name: 'Cyberpunk Slate', desc: 'Dark slate with vibrant cyan/sky glow', color: 'bg-slate-900 border-sky-500/50' },
                { id: 'midnight', name: 'Midnight Indigo', desc: 'Deep navy blue with purple accents', color: 'bg-indigo-950 border-indigo-500/50' },
                { id: 'obsidian', name: 'Obsidian Graphite', desc: 'Deep black for OLED & high contrast', color: 'bg-neutral-950 border-neutral-700' },
                { id: 'emerald', name: 'Emerald Matrix', desc: 'Dark forest green with vibrant matrix glow', color: 'bg-emerald-950 border-emerald-500/50' }
              ].map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => handleUpdateAppearance('theme', theme.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    appearance.theme === theme.id
                      ? 'border-sky-500 ring-2 ring-sky-500/20 bg-slate-800/80'
                      : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white">{theme.name}</span>
                    {appearance.theme === theme.id && <Check className="w-4 h-4 text-sky-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400">{theme.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color */}
          <div className="border-t border-slate-800 pt-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
              Primary Accent Palette
            </label>
            <div className="flex flex-wrap gap-3">
              {[
                { id: 'sky', label: 'Sky Cyan', bg: 'bg-sky-500' },
                { id: 'emerald', label: 'Emerald Green', bg: 'bg-emerald-500' },
                { id: 'amber', label: 'Amber Gold', bg: 'bg-amber-500' },
                { id: 'indigo', label: 'Indigo Violet', bg: 'bg-indigo-500' },
                { id: 'rose', label: 'Neon Rose', bg: 'bg-rose-500' }
              ].map((accent) => (
                <button
                  key={accent.id}
                  onClick={() => handleUpdateAppearance('accent', accent.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                    appearance.accent === accent.id
                      ? 'border-white/50 bg-slate-800 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full ${accent.bg} shadow-sm`} />
                  <span>{accent.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interface Density */}
          <div className="border-t border-slate-800 pt-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
              Workbench Layout Density
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
              <button
                onClick={() => handleUpdateAppearance('density', 'comfortable')}
                className={`p-3 rounded-xl border text-left text-xs transition-all ${
                  appearance.density === 'comfortable'
                    ? 'border-sky-500 bg-slate-800 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400'
                }`}
              >
                <div className="font-bold">Comfortable (Standard)</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Spacious touch targets & standard padding</div>
              </button>

              <button
                onClick={() => handleUpdateAppearance('density', 'compact')}
                className={`p-3 rounded-xl border text-left text-xs transition-all ${
                  appearance.density === 'compact'
                    ? 'border-sky-500 bg-slate-800 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400'
                }`}
              >
                <div className="font-bold">Compact (High Density)</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Maximized information display for busy desks</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: LANGUAGE & REGIONAL */}
      {activeTab === 'language' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
            <Globe className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="text-base font-bold text-white">Language & Regional Preferences</h3>
              <p className="text-xs text-slate-400">Localization, calendar date formats, and numerical displays</p>
            </div>
          </div>

          <div className="space-y-6 max-w-xl">
            {/* Primary Language */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                {t('primaryLanguage')}
              </label>
              <select
                value={currentLang || languageSettings.language}
                onChange={e => handleUpdateLocale('language', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-sky-500"
              >
                <option value="en">English (United States & International)</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="es">Español (Spanish)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Service portal UI headers and printed job card titles adapt to your preferred language.
              </p>
            </div>

            {/* Date Format */}
            <div className="border-t border-slate-800 pt-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                {t('dateFormat')}
              </label>
              <select
                value={languageSettings.dateFormat}
                onChange={e => handleUpdateLocale('dateFormat', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono focus:border-sky-500"
              >
                <option value="DD/MM/YYYY hh:mm A">DD/MM/YYYY hh:mm A (e.g. 14/09/2026 04:15 PM)</option>
                <option value="YYYY-MM-DD HH:mm">YYYY-MM-DD HH:mm (e.g. 2026-09-14 16:15)</option>
                <option value="MM/DD/YYYY hh:mm A">MM/DD/YYYY hh:mm A (e.g. 09/14/2026 04:15 PM)</option>
              </select>
            </div>

            {/* Currency Numbering System */}
            <div className="border-t border-slate-800 pt-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Currency & Number System
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleUpdateLocale('currencyFormat', 'in')}
                  className={`p-3 rounded-xl border text-left text-xs transition-all ${
                    languageSettings.currencyFormat === 'in'
                      ? 'border-sky-500 bg-slate-800 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  <div className="font-bold">Indian Lakhs / Crores</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-mono">₹ 1,50,000.00</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateLocale('currencyFormat', 'intl')}
                  className={`p-3 rounded-xl border text-left text-xs transition-all ${
                    languageSettings.currencyFormat === 'intl'
                      ? 'border-sky-500 bg-slate-800 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  <div className="font-bold">International Millions</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-mono">₹ 150,000.00</div>
                </button>
              </div>
            </div>

            {/* Computer System Clock Synchronization */}
            <div className="border-t border-slate-800 pt-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Computer System Clock Synchronization
                </label>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active & Synchronized
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                      Current Computer Time
                    </span>
                    <div className="text-xl font-mono font-bold text-white flex items-center gap-2">
                      <span className="text-emerald-400">{clock.timeString}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      Computer Calendar Date
                    </span>
                    <div className="text-sm font-mono font-semibold text-slate-200">
                      {clock.weekday}, {clock.dateString}
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
                  <div className="space-y-0.5">
                    <div>
                      <span className="text-slate-400">System Timezone:</span>{' '}
                      <span className="text-slate-300 font-mono font-semibold">{clock.timeZone}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Repair tickets, timeline audit logs, and invoice receipts automatically record and synchronize with your computer clock.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleVerifyClockSync}
                    disabled={syncVerifying}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-center active:scale-95"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncVerifying ? 'animate-spin' : ''}`} />
                    <span>Verify Clock Sync</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Staff User */}
      {newStaffModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <UserPlus className="w-4 h-4" />
                <span>Create Staff User</span>
              </div>
              <button
                onClick={() => setNewStaffModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newStaffForm.fullName}
                  onChange={e => setNewStaffForm({ ...newStaffForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Username *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ramesh or tech2"
                  value={newStaffForm.username}
                  onChange={e => setNewStaffForm({ ...newStaffForm, username: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={newStaffForm.password}
                  onChange={e => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Assigned Role *</label>
                <select
                  value={newStaffForm.role}
                  onChange={e => setNewStaffForm({ ...newStaffForm, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                >
                  <option value="technician">Technician (Diagnosis, Parts, Bench)</option>
                  <option value="frontdesk">Front Desk / Reception (Intake, Billing)</option>
                  <option value="admin">Administrator (Full Access & Settings)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewStaffModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-white font-bold bg-sky-600 hover:bg-sky-500 shadow-md shadow-sky-600/20"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
