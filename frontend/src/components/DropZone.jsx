import React from 'react';
import { Upload } from 'lucide-react';

/**
 * Reusable drop-zone component.
 *
 * Props:
 *  - accept        {string}    MIME/extension filter for the file input (e.g. ".pdf" or ".pdf,.docx")
 *  - multiple      {boolean}   Whether multiple files can be selected
 *  - onFiles       {function}  Called with an array of File objects
 *  - label         {string}    Primary label text
 *  - subLabel      {string}    Secondary hint text
 *  - className     {string}    Extra classes for the outer element
 */
export default function DropZone({ accept = '.pdf', multiple = false, onFiles, label = 'Upload File', subLabel, className = '' }) {
  const handleChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-brand-500/60', 'bg-slate-900/60');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-brand-500/60', 'bg-slate-900/60');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('border-brand-500/60', 'bg-slate-900/60');
  };

  return (
    <label
      className={`relative flex flex-col items-center justify-center gap-4 p-8 rounded-xl border-2 border-dashed border-white/10 bg-slate-900/30 cursor-pointer transition-all duration-300 hover:border-brand-500/40 hover:bg-slate-900/50 group text-center min-h-[220px] ${className}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="w-14 h-14 rounded-2xl bg-dark-900/80 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
        <Upload className="w-7 h-7 text-slate-500 group-hover:text-brand-400 transition-colors duration-300" />
      </div>

      <div>
        <p className="text-sm font-semibold text-white mb-1">{label}</p>
        {subLabel && <p className="text-xs text-slate-500">{subLabel}</p>}
        <p className="text-xs text-slate-600 mt-2">or drag & drop here</p>
      </div>

      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
      />
    </label>
  );
}
