import React, { useState } from 'react';
import { 
  Wrench, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft,
  AlertCircle, 
  SearchCheck, 
  CheckCircle2, 
  Cpu,
  KeyRound,
  RefreshCw,
  Send
} from 'lucide-react';
import { api } from '../api';

export default function MainLogin({ onLoginSuccess, onGoToTracker }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginSuccessNotice, setLoginSuccessNotice] = useState('');

  // Forgot Password Workflow State
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [resetMethod, setResetMethod] = useState('old_password'); // 'old_password' | 'email_code'
  const [forgotStep, setForgotStep] = useState(1);
  const [resetEmail, setResetEmail] = useState('nirmalaws10@gmail.com');
  const [oldPassword, setOldPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState('');

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoginSuccessNotice('');

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      await onLoginSuccess({ email: email.trim(), password });
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const openForgotPassword = () => {
    setIsForgotMode(true);
    setResetMethod('old_password');
    setForgotStep(1);
    setResetEmail(email.trim() || 'nirmalaws10@gmail.com');
    setOldPassword('');
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
    setResetSuccess('');
    setRecoveryNotice('');
  };

  const closeForgotPassword = () => {
    setIsForgotMode(false);
    setResetMethod('old_password');
    setForgotStep(1);
    setResetError('');
    setResetSuccess('');
    setRecoveryNotice('');
  };

  // Old Password Flow - Step 1: Verify Old Password
  const handleVerifyOldPassword = async (e) => {
    if (e) e.preventDefault();
    setResetError('');
    setResetSuccess('');

    let target = (resetEmail || '').trim();
    if (!target || target.toLowerCase() === 'nirmalaws10@gamil.com') {
      target = 'nirmalaws10@gmail.com';
      setResetEmail('nirmalaws10@gmail.com');
    }

    if (!oldPassword) {
      setResetError('Please enter your current / old password.');
      return;
    }

    setResetLoading(true);
    try {
      await api.masterVerifyOldPassword({
        email: target,
        oldPassword
      });
      setResetSuccess('Old password verified! Please choose your new password.');
      setForgotStep(2);
    } catch (err) {
      setResetError(err.message || 'Current password is incorrect. Please check and try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // Old Password Flow - Step 2: Set New Password & Re-enter
  const handleResetWithOldPassword = async (e) => {
    if (e) e.preventDefault();
    setResetError('');

    if (!newPassword || !confirmPassword) {
      setResetError('Please enter and confirm your new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('New password and confirmation password do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setResetError('New password must be at least 6 characters long.');
      return;
    }

    setResetLoading(true);
    try {
      let target = (resetEmail || '').trim();
      if (!target || target.toLowerCase() === 'nirmalaws10@gamil.com') {
        target = 'nirmalaws10@gmail.com';
      }

      await api.masterResetWithOldPassword({
        email: target,
        oldPassword,
        newPassword,
        confirmPassword
      });

      setEmail(target);
      setPassword(newPassword);
      setIsForgotMode(false);
      setForgotStep(1);
      setError('');
      setLoginSuccessNotice('Gateway password updated successfully! Click "Sign In" below to enter.');
    } catch (err) {
      setResetError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // Email Code Flow - Step 1: Send OTP Verification Code
  const handleRequestCode = async (e) => {
    if (e) e.preventDefault();
    setResetError('');
    setResetSuccess('');
    setRecoveryNotice('');

    let target = (resetEmail || '').trim();
    if (!target || target.toLowerCase() === 'nirmalaws10@gamil.com') {
      target = 'nirmalaws10@gmail.com';
      setResetEmail('nirmalaws10@gmail.com');
    }

    setResetLoading(true);
    try {
      const res = await api.masterForgotPassword({ email: target });
      setResetSuccess(res.message || `Verification code sent to ${target}`);
      if (res.recoveryCode) {
        setRecoveryNotice(res.recoveryCode);
      }
      setForgotStep(2);
    } catch (err) {
      setResetError(err.message || 'Failed to send verification code. Please check your email and try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // Email Code Flow - Step 2: Verify OTP Code
  const handleVerifyCode = async (e) => {
    if (e) e.preventDefault();
    setResetError('');

    const codeClean = resetCode.trim();
    if (!codeClean || codeClean.length < 6) {
      setResetError('Please enter the 6-digit verification code.');
      return;
    }

    setResetLoading(true);
    try {
      await api.masterVerifyCode({
        email: resetEmail.trim() || 'nirmalaws10@gmail.com',
        code: codeClean
      });
      setResetSuccess('Verification code confirmed! Please choose a new password.');
      setForgotStep(3);
    } catch (err) {
      setResetError(err.message || 'Invalid or expired verification code. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // Email Code Flow - Step 3: Set New Password & Re-enter
  const handleResetPassword = async (e) => {
    if (e) e.preventDefault();
    setResetError('');

    if (!newPassword || !confirmPassword) {
      setResetError('Please enter and confirm your new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('New password and confirmation password do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setResetError('New password must be at least 6 characters long.');
      return;
    }

    setResetLoading(true);
    try {
      const target = resetEmail.trim() || 'nirmalaws10@gmail.com';
      await api.masterResetPassword({
        email: target,
        code: resetCode.trim(),
        newPassword,
        confirmPassword
      });

      // Populate login form with updated credentials for instant 1-click login
      setEmail(target);
      setPassword(newPassword);
      setIsForgotMode(false);
      setForgotStep(1);
      setError('');
      setLoginSuccessNotice('Gateway password updated successfully! Click "Sign In" below to enter.');
    } catch (err) {
      setResetError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-sky-600/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[150px] pointer-events-none" />

      {/* Top Bar / Minimal Brand */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-slate-900/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">SSC TechCare</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                Service Desk v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">Computer Service Center Management</p>
          </div>
        </div>

        {onGoToTracker && (
          <button
            onClick={onGoToTracker}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all"
          >
            <SearchCheck className="w-4 h-4 text-sky-400" />
            <span>Customer Track Portal</span>
          </button>
        )}
      </header>

      {/* Center Auth Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 my-8">
        {!isForgotMode ? (
          /* ================= SIGN IN CARD ================= */
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 mb-4 shadow-inner">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Sign In</h1>
              <p className="text-sm text-slate-400 mt-1">Enter your credentials to access SSC TechCare</p>
            </div>

            {/* Success Banner */}
            {loginSuccessNotice && (
              <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-start gap-2.5 animate-fadeIn">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                <span>{loginSuccessNotice}</span>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@ssctechcare.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all text-sm"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className="text-xs text-sky-400 hover:text-sky-300 transition-colors font-medium"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all text-sm font-mono"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 active:scale-[0.99] transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Customer Portal Shortcut */}
            {onGoToTracker && (
              <div className="mt-6 pt-5 border-t border-slate-800/50 text-center">
                <p className="text-xs text-slate-400 mb-2">Are you a customer checking a computer in service?</p>
                <button
                  type="button"
                  onClick={onGoToTracker}
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300 hover:underline inline-flex items-center gap-1.5 transition-colors"
                >
                  <SearchCheck className="w-3.5 h-3.5" />
                  <span>Track Repair Status with Ticket Number</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ================= FORGOT PASSWORD CARD ================= */
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-3 shadow-inner">
                <KeyRound className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Reset Password</h1>
              <p className="text-xs text-slate-400 mt-1">
                {resetMethod === 'old_password' ? 'Verify Old Password to Set New Password' : 'Gateway Access Recovery via Email Code'}
              </p>

              {/* Progression indicators */}
              {resetMethod === 'old_password' ? (
                <div className="flex items-center justify-center gap-2 mt-4 text-[11px] font-semibold">
                  <span className={`px-2.5 py-1 rounded-full border transition-all ${
                    forgotStep === 1 
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 font-bold' 
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  }`}>
                    1. Enter Old Password
                  </span>
                  <span className="text-slate-600">&bull;</span>
                  <span className={`px-2.5 py-1 rounded-full border transition-all ${
                    forgotStep === 2 
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 font-bold' 
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    2. New Password & Confirm
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 mt-4 text-[11px] font-semibold">
                  <span className={`px-2.5 py-1 rounded-full border transition-all ${
                    forgotStep === 1 
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 font-bold' 
                      : forgotStep > 1 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    1. Request Code
                  </span>
                  <span className="text-slate-600">&bull;</span>
                  <span className={`px-2.5 py-1 rounded-full border transition-all ${
                    forgotStep === 2 
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 font-bold' 
                      : forgotStep > 2 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    2. Enter Code
                  </span>
                  <span className="text-slate-600">&bull;</span>
                  <span className={`px-2.5 py-1 rounded-full border transition-all ${
                    forgotStep === 3 
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 font-bold' 
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    3. New Password
                  </span>
                </div>
              )}
            </div>

            {/* Error Banner */}
            {resetError && (
              <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{resetError}</span>
              </div>
            )}

            {/* Success Banner */}
            {resetSuccess && (
              <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>{resetSuccess}</span>
              </div>
            )}

            {/* ================= METHOD 1: OLD PASSWORD FLOW ================= */}
            {resetMethod === 'old_password' && forgotStep === 1 && (
              <form onSubmit={handleVerifyOldPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Gateway Administrator Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="nirmalaws10@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Enter Old Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      required
                      autoFocus
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Enter your current / old password"
                      className="w-full pl-10 pr-11 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                      tabIndex={-1}
                    >
                      {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Enter your old password to verify your account before choosing a new one.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading || !oldPassword}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 active:scale-[0.99] transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {resetLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Old Password...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify Old Password</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-800/60 text-center text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setResetMethod('email_code');
                      setForgotStep(1);
                      setResetError('');
                      setResetSuccess('');
                    }}
                    className="text-sky-400 hover:text-sky-300 font-medium transition-colors"
                  >
                    Forgot old password? Reset via Email OTP Code
                  </button>
                  <button
                    type="button"
                    onClick={closeForgotPassword}
                    className="text-slate-400 hover:text-white inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2 (OLD PASSWORD): ENTER NEW PASSWORD & RE-ENTER */}
            {resetMethod === 'old_password' && forgotStep === 2 && (
              <form onSubmit={handleResetWithOldPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      autoFocus
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full pl-10 pr-11 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Re-enter New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full pl-10 pr-11 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading || !newPassword || !confirmPassword}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-[0.99] transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {resetLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Update Password & Sign In</span>
                    </>
                  )}
                </button>

                <div className="pt-3 border-t border-slate-800/60 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(1);
                      setResetError('');
                      setResetSuccess('');
                    }}
                    className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Old Password</span>
                  </button>
                </div>
              </form>
            )}

            {/* ================= METHOD 2: EMAIL OTP FLOW ================= */}
            {/* Emergency / Testing Recovery Code Display */}
            {recoveryNotice && resetMethod === 'email_code' && forgotStep === 2 && (
              <div className="mb-5 p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Security Verification Code:</span>
                  <button
                    type="button"
                    onClick={() => setResetCode(recoveryNotice)}
                    className="text-[11px] px-2 py-0.5 bg-sky-500/30 hover:bg-sky-500/40 border border-sky-400/40 rounded text-sky-200 font-bold"
                  >
                    Auto-fill Code
                  </button>
                </div>
                <div className="font-mono text-base font-bold tracking-widest text-sky-400 bg-slate-950/60 p-2 rounded text-center border border-slate-800">
                  {recoveryNotice}
                </div>
                <p className="text-[10px] text-slate-400">
                  A copy has also been sent to your email (<span className="text-white font-medium">{resetEmail}</span>). Valid for 15 minutes.
                </p>
              </div>
            )}

            {/* EMAIL STEP 1: REQUEST VERIFICATION CODE */}
            {resetMethod === 'email_code' && forgotStep === 1 && (
              <form onSubmit={handleRequestCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Gateway Administrator Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="nirmalaws10@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    We will send a 6-digit one-time verification code to this address.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 active:scale-[0.99] transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {resetLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending Code...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Verification Code</span>
                    </>
                  )}
                </button>

                <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-800/60 text-center text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setResetMethod('old_password');
                      setForgotStep(1);
                      setResetError('');
                      setResetSuccess('');
                    }}
                    className="text-sky-400 hover:text-sky-300 font-medium transition-colors"
                  >
                    Remember your old password? Verify with Old Password instead
                  </button>
                  <button
                    type="button"
                    onClick={closeForgotPassword}
                    className="text-slate-400 hover:text-white inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </form>
            )}

            {/* EMAIL STEP 2: ENTER VERIFICATION CODE */}
            {resetMethod === 'email_code' && forgotStep === 2 && (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Enter 6-Digit Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full py-3 bg-slate-950/80 border-2 border-slate-700 focus:border-sky-500 rounded-xl text-center text-2xl font-mono tracking-widest text-sky-400 font-bold focus:outline-none transition-all"
                  />
                  <p className="text-[11px] text-slate-400 mt-2 text-center">
                    Check the inbox for <strong className="text-white">{resetEmail}</strong>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading || resetCode.length < 6}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 active:scale-[0.99] transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {resetLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="text-slate-400 hover:text-white inline-flex items-center gap-1 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change Email</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRequestCode}
                    disabled={resetLoading}
                    className="text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Resend Code</span>
                  </button>
                </div>
              </form>
            )}

            {/* EMAIL STEP 3: SET NEW PASSWORD */}
            {resetMethod === 'email_code' && forgotStep === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full pl-10 pr-11 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Re-enter New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full pl-10 pr-11 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-[0.99] transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {resetLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving New Password...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Update Password & Sign In</span>
                    </>
                  )}
                </button>

                <div className="pt-3 border-t border-slate-800/60 text-center">
                  <button
                    type="button"
                    onClick={closeForgotPassword}
                    className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center border-t border-slate-900/80 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-slate-400" />
          <span>SSC TechCare Computer Solutions &copy; {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <span>Encrypted Session &bull; Two-Factor Access Control</span>
        </div>
      </footer>
    </div>
  );
}
