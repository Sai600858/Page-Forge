import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './layouts/Navbar';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// ─── Public Pages ─────────────────────────────────────────────────────────────
const Dashboard   = lazy(() => import('./pages/Dashboard'));
const MergePDF    = lazy(() => import('./pages/MergePDF'));
const SplitPDF    = lazy(() => import('./pages/SplitPDF'));
const OrganizePDF = lazy(() => import('./pages/OrganizePDF'));
const EditPDF     = lazy(() => import('./pages/EditPDF'));
const ConvertPDF  = lazy(() => import('./pages/ConvertPDF'));
const NotFound    = lazy(() => import('./pages/NotFound'));

// ─── Auth Pages ───────────────────────────────────────────────────────────────
const Login    = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));

// ─── Protected Pages ──────────────────────────────────────────────────────────
const History      = lazy(() => import('./pages/History'));
const ChatPDF      = lazy(() => import('./pages/ChatPDF'));
const Summarize    = lazy(() => import('./pages/Summarize'));
const SecurePDF   = lazy(() => import('./pages/SecurePDF'));

/** Full-screen loading skeleton shown during lazy chunk download */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center space-y-4 text-slate-500">
        <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        <span className="text-xs tracking-widest uppercase">Loading…</span>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 selection:bg-brand-500/30 selection:text-brand-200">
          {/* Glowing rainbow top bar */}
          <div className="h-0.5 w-full bg-gradient-to-r from-brand-600 via-indigo-500 to-pink-500" />

          <Navbar />

          <main className="flex-grow">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* ── Public ── */}
                <Route path="/"         element={<Dashboard />} />
                <Route path="/merge"    element={<MergePDF />} />
                <Route path="/split"    element={<SplitPDF />} />
                <Route path="/organize" element={<OrganizePDF />} />
                <Route path="/edit"     element={<EditPDF />} />
                <Route path="/convert"  element={<ConvertPDF />} />


                {/* ── Auth ── */}
                <Route path="/login"    element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* ── Protected ── */}
                <Route path="/history"   element={<ProtectedRoute><History /></ProtectedRoute>} />
                <Route path="/chat-pdf"  element={<ProtectedRoute><ChatPDF /></ProtectedRoute>} />
                <Route path="/summarize" element={<ProtectedRoute><Summarize /></ProtectedRoute>} />
                <Route path="/secure"    element={<ProtectedRoute><SecurePDF /></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>

          <footer className="py-8 border-t border-white/5 bg-slate-950 text-center text-xs text-slate-600">
            <div className="max-w-7xl mx-auto px-4">
              <p className="mb-1">
                <span className="text-slate-400 font-semibold">PAGE FORGE</span>
                {' '}© {new Date().getFullYear()} — AI-powered document toolkit
              </p>
              <p className="opacity-50">React · Tailwind CSS v4 · Node.js · Gemini AI · Neon PostgreSQL</p>
            </div>
          </footer>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
