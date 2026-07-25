import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Layers, Scissors, Grid, Edit3, Repeat, ShieldAlert,
  ArrowRight, Sparkles, MessageSquare, FileText, Zap, Shield
} from 'lucide-react';

const tools = [
  {
    title: 'Chat with PDF',
    description: 'Ask questions and get instant answers from any PDF using AI.',
    path: '/chat-pdf',
    icon: MessageSquare,
    gradient: 'from-purple-600/25 via-indigo-600/15 to-transparent',
    border: 'hover:border-purple-500/60',
    glow: 'hover:shadow-purple-500/10',
    iconBg: 'bg-purple-500/15 border-purple-500/20',
    iconColor: 'text-purple-400',
    badge: 'AI',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  },
  {
    title: 'AI Summary',
    description: 'Extract key insights and generate structured summaries instantly.',
    path: '/summarize',
    icon: Sparkles,
    gradient: 'from-cyan-600/25 via-teal-600/15 to-transparent',
    border: 'hover:border-cyan-500/60',
    glow: 'hover:shadow-cyan-500/10',
    iconBg: 'bg-cyan-500/15 border-cyan-500/20',
    iconColor: 'text-cyan-400',
    badge: 'AI',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  },
  {
    title: 'Edit PDF',
    description: 'Overlay text, images, signatures, and shapes on any page.',
    path: '/edit',
    icon: Edit3,
    gradient: 'from-violet-600/25 via-purple-600/15 to-transparent',
    border: 'hover:border-violet-500/60',
    glow: 'hover:shadow-violet-500/10',
    iconBg: 'bg-violet-500/15 border-violet-500/20',
    iconColor: 'text-violet-400',
  },
  {
    title: 'Secure PDF',
    description: 'Encrypt with AES-256 password protection or remove existing locks.',
    path: '/secure',
    icon: ShieldAlert,
    gradient: 'from-red-600/25 via-orange-600/15 to-transparent',
    border: 'hover:border-red-500/60',
    glow: 'hover:shadow-red-500/10',
    iconBg: 'bg-red-500/15 border-red-500/20',
    iconColor: 'text-red-400',
  },
  {
    title: 'Organize PDF',
    description: 'Reorder, rotate, or delete pages using interactive thumbnails.',
    path: '/organize',
    icon: Grid,
    gradient: 'from-emerald-600/25 via-teal-600/15 to-transparent',
    border: 'hover:border-emerald-500/60',
    glow: 'hover:shadow-emerald-500/10',
    iconBg: 'bg-emerald-500/15 border-emerald-500/20',
    iconColor: 'text-emerald-400',
  },
  {
    title: 'Convert PDF',
    description: 'Convert between PDF and Word DOCX with preserved formatting.',
    path: '/convert',
    icon: Repeat,
    gradient: 'from-amber-600/25 via-orange-600/15 to-transparent',
    border: 'hover:border-amber-500/60',
    glow: 'hover:shadow-amber-500/10',
    iconBg: 'bg-amber-500/15 border-amber-500/20',
    iconColor: 'text-amber-400',
  },
  {
    title: 'Merge PDF',
    description: 'Combine multiple PDFs into one cohesive document in any order.',
    path: '/merge',
    icon: Layers,
    gradient: 'from-blue-600/25 via-indigo-600/15 to-transparent',
    border: 'hover:border-blue-500/60',
    glow: 'hover:shadow-blue-500/10',
    iconBg: 'bg-blue-500/15 border-blue-500/20',
    iconColor: 'text-blue-400',
  },
  {
    title: 'Split PDF',
    description: 'Extract specific pages or ranges and download them separately.',
    path: '/split',
    icon: Scissors,
    gradient: 'from-pink-600/25 via-rose-600/15 to-transparent',
    border: 'hover:border-pink-500/60',
    glow: 'hover:shadow-pink-500/10',
    iconBg: 'bg-pink-500/15 border-pink-500/20',
    iconColor: 'text-pink-400',
  },
];

const stats = [
  { icon: FileText, label: 'PDF Tools', value: '8' },
  { icon: Zap, label: 'Server-Side Processing', value: '100%' },
  { icon: Shield, label: 'Encryption Standard', value: 'AES-256' },
  { icon: Sparkles, label: 'AI Powered', value: 'Gemini' },
];

export default function Dashboard() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 50); return () => clearTimeout(t); }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative">

      {/* Background ambient glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-600/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-0 w-[400px] h-[400px] bg-indigo-600/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-purple-600/6 rounded-full blur-[120px] pointer-events-none" />

      {/* Hero */}
      <div
        className={`text-center max-w-3xl mx-auto mb-12 relative z-10 transition-all duration-700 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full border border-brand-500/25 bg-brand-500/8 text-brand-300 text-xs font-medium mb-6 backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Professional PDF Toolkit · Powered by Gemini AI</span>
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-5 leading-[1.08]">
          Forge Your Documents
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-brand-300 to-indigo-300">
            into Perfect Form
          </span>
        </h1>

        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
          A lightning-fast, secure, and beautiful toolkit to edit, convert, protect, and
          intelligently analyse your PDF documents — all from one place.
        </p>
      </div>

      {/* Stats row */}
      <div
        className={`grid grid-cols-2 md:grid-cols-4 gap-3 mb-14 relative z-10 transition-all duration-700 delay-100 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-brand-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{s.value}</p>
                <p className="text-[11px] text-slate-500 truncate">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tools grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 relative z-10">
        {tools.map((tool, index) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.path}
              to={tool.path}
              className={`group relative rounded-2xl p-6 flex flex-col justify-between
                border border-white/[0.07] ${tool.border}
                bg-gradient-to-br ${tool.gradient}
                bg-slate-950/60 backdrop-blur-sm
                shadow-lg ${tool.glow} hover:shadow-xl
                transition-all duration-300 hover:-translate-y-0.5
              `}
              style={{
                transitionDelay: visible ? `${index * 40}ms` : '0ms',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(12px)',
                transition: `opacity 0.5s ease ${index * 40}ms, transform 0.5s ease ${index * 40}ms, border-color 0.3s, box-shadow 0.3s, translate 0.2s`,
              }}
            >
              {/* Top row: icon + badge */}
              <div className="flex items-start justify-between mb-5">
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${tool.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-5 h-5 ${tool.iconColor}`} />
                </div>
                {tool.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wider uppercase ${tool.badgeColor}`}>
                    {tool.badge}
                  </span>
                )}
              </div>

              <div className="flex-1">
                <h3 className="text-base font-bold text-white mb-2 tracking-wide group-hover:text-brand-200 transition-colors duration-200">
                  {tool.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-5 group-hover:text-slate-300 transition-colors duration-200">
                  {tool.description}
                </p>
              </div>

              <div className="flex items-center text-xs font-semibold text-slate-500 group-hover:text-brand-300 transition-all duration-200">
                <span>Open Tool</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform duration-200" />
              </div>

              {/* Subtle inner shine on hover */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-white/[0.03] to-transparent" />
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-20 flex flex-col items-center gap-3">
        <div className="w-48 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <p className="text-[11px] tracking-widest uppercase text-slate-600 font-medium select-none">
          Made with <span className="text-brand-500/60 mx-0.5">♥</span> by{' '}
          <span className="text-brand-400/60 font-semibold">blckspidey</span>
        </p>
      </div>
    </div>
  );
}
