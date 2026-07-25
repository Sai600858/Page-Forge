import React from 'react';
import { Link } from 'react-router-dom';
import { FileSearch, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      {/* Ambient glow */}
      <div className="absolute w-72 h-72 bg-brand-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse-slow"></div>

      {/* Icon */}
      <div className="relative z-10 mb-8">
        <div className="w-24 h-24 rounded-3xl bg-dark-900/80 border border-white/5 flex items-center justify-center mx-auto shadow-2xl">
          <FileSearch className="w-12 h-12 text-brand-400" />
        </div>
      </div>

      {/* Text */}
      <div className="relative z-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-400 mb-3">
          404 — Page Not Found
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
          Lost in the Forge
        </h1>
        <p className="text-slate-400 text-base max-w-sm mx-auto mb-10 leading-relaxed">
          This page doesn't exist. Head back to the dashboard and pick a tool to get started.
        </p>

        <Link
          to="/"
          className="inline-flex items-center space-x-2 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl hover:from-brand-500 hover:to-brand-600 transition-all duration-300 shadow-md shadow-brand-500/20 hover:shadow-brand-500/40 hover:-translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
