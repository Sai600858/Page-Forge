import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Layers, Scissors, Grid, Edit3, Repeat, ShieldAlert,
  Menu, X, LogIn, LogOut, Clock, ChevronDown, Sparkles, MessageSquare, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logoSrc from '../assets/Page-Forge_logo-Photoroom.png';

const pagesItems = [
  { path: '/organize', name: 'Organize', icon: Grid },
  { path: '/merge',    name: 'Merge',    icon: Layers },
  { path: '/split',    name: 'Split',    icon: Scissors },
];

const aiItems = [
  { path: '/chat-pdf',  name: 'Chat with PDF', icon: MessageSquare },
  { path: '/summarize', name: 'AI Summary',     icon: Sparkles },
];

export default function Navbar() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, logout } = useAuth();

  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [aiMenuOpen,   setAiMenuOpen]   = useState(false);
  const [pagesOpen,    setPagesOpen]    = useState(false);

  const userMenuRef = useRef(null);
  const aiMenuRef   = useRef(null);
  const pagesRef    = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
      if (aiMenuRef.current   && !aiMenuRef.current.contains(e.target))   setAiMenuOpen(false);
      if (pagesRef.current    && !pagesRef.current.contains(e.target))    setPagesOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false);
    navigate('/');
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const linkCls = (active) =>
    `flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
      active
        ? 'bg-brand-500/20 text-brand-300 border-brand-500/30'
        : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
    }`;

  const dropdownBtnCls = (active) =>
    `flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
      active
        ? 'bg-brand-500/20 text-brand-300 border-brand-500/30'
        : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
    }`;

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-md shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center space-x-1 group flex-shrink-0" onClick={() => setMobileOpen(false)}>
            <img
              src={logoSrc}
              alt="Page Forge"
              className="w-16 h-16 object-contain drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] group-hover:drop-shadow-[0_0_12px_rgba(168,85,247,0.8)] transition-all duration-300"
            />
            <span className="text-lg font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-brand-100 to-brand-400 group-hover:to-brand-300 transition-all duration-300 uppercase">
              Page Forge
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center space-x-1">

            {/* Edit */}
            <Link to="/edit" className={linkCls(location.pathname === '/edit')}>
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </Link>

            {/* Pages dropdown: Organize / Merge / Split */}
            <div className="relative" ref={pagesRef}>
              <button
                onClick={() => setPagesOpen(v => !v)}
                className={dropdownBtnCls(pagesItems.some(i => i.path === location.pathname))}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Pages</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${pagesOpen ? 'rotate-180' : ''}`} />
              </button>
              {pagesOpen && (
                <div className="absolute top-full left-0 mt-2 w-44 glass-panel rounded-xl border border-white/10 shadow-xl py-1 z-50">
                  {pagesItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setPagesOpen(false)}
                        className="flex items-center space-x-2.5 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                      >
                        <Icon className="w-4 h-4 text-brand-400" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Secure */}
            <Link to="/secure" className={linkCls(location.pathname === '/secure')}>
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Secure</span>
            </Link>

            {/* Convert */}
            <Link to="/convert" className={linkCls(location.pathname === '/convert')}>
              <Repeat className="w-3.5 h-3.5" />
              <span>Convert</span>
            </Link>

            {/* AI Dropdown */}
            <div className="relative" ref={aiMenuRef}>
              <button
                onClick={() => setAiMenuOpen(v => !v)}
                className={dropdownBtnCls(aiItems.some(i => i.path === location.pathname))}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${aiMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {aiMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 glass-panel rounded-xl border border-white/10 shadow-xl py-1 z-50">
                  {aiItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setAiMenuOpen(false)}
                        className="flex items-center space-x-2.5 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                      >
                        <Icon className="w-4 h-4 text-brand-400" />
                        <span>{item.name}</span>
                        {!user && <Lock className="ml-auto w-3 h-3 text-slate-500" />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: History + Auth */}
          <div className="hidden md:flex items-center space-x-2">

            {/* History icon (only when logged in) */}
            {user && (
              <Link
                to="/history"
                title="History"
                className={`p-2 rounded-lg transition-all duration-200 border ${
                  location.pathname === '/history'
                    ? 'bg-brand-500/20 text-brand-300 border-brand-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
                }`}
              >
                <Clock className="w-4 h-4" />
              </Link>
            )}

            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  id="user-menu-btn"
                  onClick={() => setUserMenuOpen(v => !v)}
                  className="w-9 h-9 rounded-full border border-white/10 hover:border-brand-500/30 bg-white/5 hover:bg-white/8 transition-all duration-200 flex items-center justify-center overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  aria-label="User Menu"
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white uppercase">
                      {initials}
                    </div>
                  )}
                </button>

                {userMenuOpen && (
                  <div className="absolute top-full right-0 mt-3 w-64 glass-panel rounded-2xl border border-white/10 shadow-2xl p-4 z-50 bg-slate-950/95 backdrop-blur-xl">
                    <div className="flex flex-col items-center text-center pb-4 border-b border-white/5">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-brand-500/30 mb-2.5" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center text-sm font-bold text-white mb-2.5 uppercase ring-2 ring-brand-500/30">
                          {initials}
                        </div>
                      )}
                      <h3 className="text-sm font-semibold text-white truncate max-w-[210px]">{user.name || 'User'}</h3>
                      <p className="text-xs text-slate-500 truncate max-w-[210px] mt-0.5">{user.email}</p>
                    </div>
                    <div className="pt-2">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-150 font-medium"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  id="navbar-login-btn"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  id="navbar-register-btn"
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-lg shadow-brand-900/40 glow-brand"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(prev => !prev)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 bg-slate-950/95 backdrop-blur-md">
          <div className="px-4 py-3 space-y-1">

            <Link to="/edit" onClick={() => setMobileOpen(false)} className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${location.pathname === '/edit' ? 'bg-brand-500/20 text-brand-300' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <Edit3 className="w-4 h-4" /><span>Edit</span>
            </Link>

            <div className="border-t border-white/5 pt-2 mt-2">
              <p className="text-xs text-slate-600 uppercase tracking-wider px-4 py-1">Pages</p>
              {pagesItems.map(item => {
                const Icon = item.icon;
                return (
                  <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${location.pathname === item.path ? 'bg-brand-500/20 text-brand-300' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                    <Icon className="w-4 h-4" /><span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            <Link to="/secure" onClick={() => setMobileOpen(false)} className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${location.pathname === '/secure' ? 'bg-brand-500/20 text-brand-300' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <ShieldAlert className="w-4 h-4" /><span>Secure</span>
            </Link>

            <Link to="/convert" onClick={() => setMobileOpen(false)} className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${location.pathname === '/convert' ? 'bg-brand-500/20 text-brand-300' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <Repeat className="w-4 h-4" /><span>Convert</span>
            </Link>

            <div className="border-t border-white/5 pt-2 mt-2">
              <p className="text-xs text-slate-600 uppercase tracking-wider px-4 py-1">AI Tools</p>
              {aiItems.map(item => {
                const Icon = item.icon;
                return (
                  <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                    className="flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all">
                    <Icon className="w-4 h-4 text-brand-400" /><span>{item.name}</span>
                    {!user && <Lock className="ml-auto w-3.5 h-3.5 text-slate-500" />}
                  </Link>
                );
              })}
            </div>

            <div className="border-t border-white/5 pt-2 mt-2">
              {user ? (
                <>
                  <div className="flex items-center space-x-3 px-4 py-3">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-sm font-bold text-white">{initials}</div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-white">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <Link to="/history" onClick={() => setMobileOpen(false)}
                    className="flex items-center space-x-3 px-4 py-3 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">
                    <Clock className="w-4 h-4" /><span>History</span>
                  </Link>
                  <button onClick={() => { handleLogout(); setMobileOpen(false); }}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/5 transition-all">
                    <LogOut className="w-4 h-4" /><span>Sign Out</span>
                  </button>
                </>
              ) : (
                <div className="space-y-2 px-1 pb-2">
                  <Link to="/login" onClick={() => setMobileOpen(false)}
                    className="block w-full text-center px-4 py-2.5 rounded-xl text-sm font-medium border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition-all">
                    Sign In
                  </Link>
                  <Link to="/register" onClick={() => setMobileOpen(false)}
                    className="block w-full text-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all">
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
