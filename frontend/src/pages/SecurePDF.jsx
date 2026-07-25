import React, { useState } from 'react';
import { protectPDF, unlockPDF, downloadBlob } from '../services/api';
import DropZone from '../components/DropZone';
import { File, ShieldAlert, Key, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, Trash2, Lock, Unlock } from 'lucide-react';

export default function SecurePDF() {
  const [activeTab, setActiveTab] = useState('protect');
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleFiles = (incoming) => {
    const pdf = incoming.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdf) { setError('Only PDF files are accepted.'); return; }
    setError(null);
    setSuccess(false);
    setFile(pdf);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFile(null);
    setPassword('');
    setError(null);
    setSuccess(false);
  };

  const handleAction = async () => {
    if (!file) return;
    if (!password.trim()) { setError('Please enter a password.'); return; }
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      if (activeTab === 'protect') {
        const response = await protectPDF(file, password);
        downloadBlob(response, file.name.replace(/\.pdf$/i, '_secured.pdf'));
      } else {
        const response = await unlockPDF(file, password);
        downloadBlob(response, file.name.replace(/\.pdf$/i, '_unlocked.pdf'));
      }
      setSuccess(true);
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.error || (
        activeTab === 'protect'
          ? 'Failed to encrypt the PDF.'
          : 'Incorrect password or the file is not encrypted.'
      ));
    } finally {
      setLoading(false);
    }
  };

  const isProtect = activeTab === 'protect';

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 text-left">
      {/* Header */}
      <div className="mb-8 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
          <ShieldAlert className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Secure PDF</h1>
          <p className="text-slate-400 text-sm">Add or remove password protection on your PDF documents.</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex space-x-1 mb-8 p-1 rounded-xl bg-slate-900/60 border border-white/5 w-fit">
        {[
          { id: 'protect', label: 'Add Password', icon: Lock },
          { id: 'unlock',  label: 'Remove Password', icon: Unlock },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Upload panel */}
        <div className="md:col-span-2 space-y-4">
          {!file ? (
            <DropZone
              accept=".pdf"
              onFiles={handleFiles}
              label="Upload PDF File"
              subLabel=".pdf format only"
            />
          ) : (
            <div className="rounded-xl border border-white/5 bg-slate-900/40 p-5 space-y-4">
              <p className="text-xs font-semibold text-brand-300 uppercase tracking-wider">Selected File</p>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-white/5 bg-slate-950/60">
                <File className="w-7 h-7 text-brand-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate" title={file.name}>{file.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button
                onClick={() => { setFile(null); setPassword(''); setError(null); setSuccess(false); }}
                className="w-full flex items-center justify-center space-x-1.5 py-2 text-xs font-medium text-red-400 hover:text-red-300 border border-red-500/15 hover:border-red-500/30 rounded-lg hover:bg-red-500/5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove file</span>
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{isProtect ? 'PDF encrypted and downloaded!' : 'PDF password removed and downloaded!'}</span>
            </div>
          )}
        </div>
 
        {/* Password + info + action */}
        <div className="md:col-span-3 flex flex-col gap-4">
          <div className="rounded-xl border border-white/5 bg-slate-900/40 p-6 flex-1 space-y-5">
            <h2 className="text-sm font-semibold text-white">Security Credentials</h2>
 
            {/* Password input */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                {isProtect ? 'Set Password' : 'Enter Known Password'}
              </label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  id="input-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isProtect ? 'Choose a strong password…' : 'Enter the known password…'}
                  disabled={!file}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAction()}
                  className="w-full pl-10 pr-12 py-3 bg-slate-950/60 border border-white/5 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                />
                <button
                  type="button"
                  disabled={!file}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-slate-500 hover:text-white disabled:opacity-30 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
 
            {/* Info */}
            <div className="flex items-start space-x-3 p-4 rounded-xl bg-red-500/5 border border-red-500/10">
              <ShieldAlert className="w-4 h-4 text-red-400/70 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400 leading-relaxed">
                {isProtect
                  ? 'Your PDF will be encrypted with the password you choose. Anyone opening the file will be prompted to enter this password. Store it somewhere safe — it cannot be recovered.'
                  : 'Enter the exact known password used to protect this PDF. If correct, the output will be a clean PDF with the password protection removed.'
                }
              </p>
            </div>
 
            <p className="text-[11px] text-slate-600 pt-2 border-t border-white/5">
              ✦ Files are never stored — all processing is ephemeral and server-side.
            </p>
          </div>
 
          {/* Action button */}
          <button
            id="btn-secure"
            onClick={handleAction}
            disabled={!file || !password.trim() || loading}
            className="w-full inline-flex items-center justify-center py-3.5 text-sm font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl hover:from-brand-500 hover:to-brand-600 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none transition-all duration-300 shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 hover:-translate-y-0.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isProtect ? 'Encrypting…' : 'Removing Password…'}
              </>
            ) : (
              isProtect ? 'Encrypt PDF' : 'Remove Password'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
