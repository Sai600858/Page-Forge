import React, { useState } from 'react';
import { convertWordToPdf, convertPdfToWord, downloadBlob } from '../services/api';
import DropZone from '../components/DropZone';
import { File, FileText, Repeat, Loader2, ArrowRightLeft, CheckCircle2, Trash2, AlertCircle } from 'lucide-react';

export default function ConvertPDF() {
  const [activeTab, setActiveTab] = useState('wordToPdf');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleFiles = (incoming) => {
    const f = incoming[0];
    if (!f) return;
    const name = f.name.toLowerCase();
    if (activeTab === 'wordToPdf' && !name.endsWith('.docx')) {
      setError('Only .docx Word documents are accepted for this conversion.');
      return;
    }
    if (activeTab === 'pdfToWord' && !name.endsWith('.pdf')) {
      setError('Only .pdf files are accepted for this conversion.');
      return;
    }
    setError(null);
    setSuccess(false);
    setFile(f);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFile(null);
    setError(null);
    setSuccess(false);
  };

  const handleConvert = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      if (activeTab === 'wordToPdf') {
        const response = await convertWordToPdf(file);
        downloadBlob(response, file.name.replace(/\.docx$/i, '.pdf'));
      } else {
        const response = await convertPdfToWord(file);
        downloadBlob(response, file.name.replace(/\.pdf$/i, '.docx'));
      }
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Conversion failed. Please check the file and try again.');
    } finally {
      setLoading(false);
    }
  };

  const isWordToPdf = activeTab === 'wordToPdf';

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 text-left">
      {/* Header */}
      <div className="mb-8 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
          <Repeat className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Convert Document</h1>
          <p className="text-slate-400 text-sm">Convert between Word and PDF formats with high fidelity.</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex space-x-1 mb-8 p-1 rounded-xl bg-slate-900/60 border border-white/5 w-fit">
        {[
          { id: 'wordToPdf', label: 'Word → PDF' },
          { id: 'pdfToWord', label: 'PDF → Word' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Upload panel */}
        <div className="md:col-span-2 space-y-4">
          {!file ? (
            <DropZone
              accept={isWordToPdf ? '.docx' : '.pdf'}
              onFiles={handleFiles}
              label={isWordToPdf ? 'Upload Word File' : 'Upload PDF File'}
              subLabel={isWordToPdf ? '.docx format only' : '.pdf format only'}
            />
          ) : (
            <div className="rounded-xl border border-white/5 bg-slate-900/40 p-5 space-y-4">
              <p className="text-xs font-semibold text-brand-300 uppercase tracking-wider">Selected File</p>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-white/5 bg-slate-950/60">
                {isWordToPdf
                  ? <FileText className="w-7 h-7 text-blue-400 flex-shrink-0 mt-0.5" />
                  : <File className="w-7 h-7 text-brand-400 flex-shrink-0 mt-0.5" />
                }
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate" title={file.name}>{file.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button
                onClick={() => { setFile(null); setError(null); setSuccess(false); }}
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
              <span>Converted file downloaded!</span>
            </div>
          )}
        </div>

        {/* Info + action */}
        <div className="md:col-span-3 flex flex-col gap-4">
          <div className="rounded-xl border border-white/5 bg-slate-900/40 p-6 flex-1">
            <h2 className="text-sm font-semibold text-white mb-5">Conversion Pipeline</h2>

            {/* Visual pipeline */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className={`px-4 py-2 rounded-xl font-bold text-sm border ${
                isWordToPdf ? 'bg-blue-500/15 border-blue-500/30 text-blue-300' : 'bg-brand-500/15 border-brand-500/30 text-brand-300'
              }`}>
                {isWordToPdf ? 'DOCX' : 'PDF'}
              </div>
              <ArrowRightLeft className={`w-5 h-5 ${isWordToPdf ? 'text-blue-400' : 'text-amber-400'}`} />
              <div className={`px-4 py-2 rounded-xl font-bold text-sm border ${
                isWordToPdf ? 'bg-brand-500/15 border-brand-500/30 text-brand-300' : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              }`}>
                {isWordToPdf ? 'PDF' : 'DOCX'}
              </div>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              {isWordToPdf
                ? 'Page Forge uses Microsoft Word COM automation on the server to compile your document into a high-fidelity PDF — preserving exact fonts, tables, headers, footers, and page margins.'
                : 'Page Forge parses the PDF text layer and packages the content into structured Word paragraphs. Complex multi-column layouts will render as sequential flowing text.'
              }
            </p>

            <div className="text-[11px] text-slate-600 pt-4 border-t border-white/5">
              ✦ All files are automatically deleted from the server immediately after download.
            </div>
          </div>

          {/* Convert button */}
          <button
            id="btn-convert"
            onClick={handleConvert}
            disabled={!file || loading}
            className="w-full inline-flex items-center justify-center py-3.5 text-sm font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl hover:from-brand-500 hover:to-brand-600 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none transition-all duration-300 shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 hover:-translate-y-0.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Converting…
              </>
            ) : (
              `Convert to ${isWordToPdf ? 'PDF' : 'Word'}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
