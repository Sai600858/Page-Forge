import React from 'react';

/**
 * Reusable page header for all tool pages.
 * Renders an icon badge, title, subtitle, and ambient background glow.
 *
 * Props:
 *  icon        – Lucide icon component
 *  iconColor   – Tailwind text color class  (e.g. 'text-blue-400')
 *  iconBg      – Tailwind bg/border classes (e.g. 'bg-blue-500/15 border-blue-500/25')
 *  glowColor   – Tailwind bg color for ambient orb (e.g. 'bg-blue-500/10')
 *  accentColor – Tailwind bg for the top accent line (e.g. 'from-blue-500 to-indigo-500')
 *  title       – string
 *  subtitle    – string
 *  badge       – optional label string (e.g. 'AI Powered')
 *  badgeColor  – optional Tailwind classes for the badge
 */
export default function PageHeader({
  icon: Icon,
  iconColor   = 'text-brand-400',
  iconBg      = 'bg-brand-500/15 border-brand-500/25',
  glowColor   = 'bg-brand-500/10',
  accentColor = 'from-brand-500 to-indigo-500',
  title,
  subtitle,
  badge,
  badgeColor  = 'bg-brand-500/15 text-brand-300 border-brand-500/25',
}) {
  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl border border-white/[0.06] bg-slate-950/60 backdrop-blur-sm px-6 pt-5 pb-6">
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${accentColor} opacity-60`} />

      {/* Ambient glow orb */}
      <div className={`absolute -top-10 -right-10 w-48 h-48 ${glowColor} rounded-full blur-3xl pointer-events-none`} />

      <div className="relative flex items-start space-x-4">
        {/* Icon badge */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center mt-0.5 ${iconBg}`}>
          {Icon && <Icon className={`w-6 h-6 ${iconColor}`} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
            {badge && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badgeColor}`}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-slate-400 text-sm leading-relaxed">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
