import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { splitPDF, downloadBlob } from '../services/api';
import DropZone from '../components/DropZone';
import { File, Scissors, Loader2, Info, CheckCircle2, Trash2 } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function SplitPDF() {
  const [file, setFile] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [splitPages, setSplitPages] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!file) {
      setTotalPages(0);
      return;
    }
    const loadPdf = async () => {
      try {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
        setTotalPages(pdf.numPages);
      } catch (err) {
        console.error(err);
        setError('Failed to parse PDF.');
        setFile(null);
      }
    };
    loadPdf();
  }, [file]);

  const handleFiles = (incoming) => {
    const pdf = incoming.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdf) { setError('Only PDF files are accepted.'); return; }
    setError(null);
    setSuccess(false);
    setFile(pdf);
  };

  const handleSplit = async () => {
    if (!file) { setError('Please upload a PDF file first.'); return; }
    if (!splitPages.trim()) { setError('Please specify at least one page range.'); return; }
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const response = await splitPDF(file, splitPages);
      downloadBlob(response, 'split_results.zip');
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to split the PDF. Check your page ranges.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 text-left">
      {/* Header */}
      <div className="mb-8 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center border border-pink-500/30">
          <Scissors className="w-5 h-5 text-pink-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Split PDF</h1>
          <p className="text-slate-400 text-sm">Extract page ranges or individual pages into separate files.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Upload panel */}
        <div className="md:col-span-2 space-y-4">
          {!file ? (
            <DropZone
              accept=".pdf"
              onFiles={handleFiles}
              label="Upload PDF File"
              subLabel="Single PDF only"
            />
          ) : (
            <div className="rounded-xl border border-white/5 bg-slate-900/40 p-5 space-y-4">
              <p className="text-xs font-semibold text-brand-300 uppercase tracking-wider">Selected File</p>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-white/5 bg-slate-950/60">
                <File className="w-7 h-7 text-brand-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate" title={file.name}>{file.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(2)} MB • {totalPages ? `${totalPages} page${totalPages !== 1 ? 's' : ''}` : 'Loading...'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setFile(null); setSplitPages(''); setError(null); setSuccess(false); }}
                className="w-full flex items-center justify-center space-x-1.5 py-2 text-xs font-medium text-red-400 hover:text-red-300 border border-red-500/15 hover:border-red-500/30 rounded-lg hover:bg-red-500/5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove file</span>
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-start space-x-2">
              <span className="mt-0.5 flex-shrink-0">⚠</span>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Split file(s) downloaded successfully!</span>
            </div>
          )}
        </div>

        {/* Config + action */}
        <div className="md:col-span-3 flex flex-col gap-4">
          <div className="rounded-xl border border-white/5 bg-slate-900/40 p-5 flex-1 space-y-5">
            <h2 className="text-sm font-semibold text-white">Split Configuration</h2>

            {/* Range input */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Page Ranges {totalPages > 0 && <span className="text-brand-400 ml-1">(Total: {totalPages} page{totalPages !== 1 ? 's' : ''})</span>}
              </label>
              <input
                id="input-split-ranges"
                type="text"
                placeholder="e.g.  1-3, 5, 7-10"
                disabled={!file}
                value={splitPages}
                onChange={(e) => setSplitPages(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSplit()}
                className="w-full px-4 py-3 bg-slate-950/60 border border-white/5 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              />
            </div>

            {/* Info box */}
            <div className="flex items-start space-x-3 p-4 rounded-xl bg-brand-500/5 border border-brand-500/10">
              <Info className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-400 leading-relaxed space-y-1.5">
                <p className="font-semibold text-brand-300">How page ranges work</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Separate ranges with commas — each becomes a separate output file</li>
                  <li><code className="text-brand-300">1-3</code> extracts pages 1, 2 and 3 into one file</li>
                  <li><code className="text-brand-300">5</code> extracts only page 5</li>
                  <li>Multiple ranges produce a <strong className="text-white">ZIP archive</strong></li>
                  <li>A single range produces a single <strong className="text-white">PDF</strong></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Split button */}
          <button
            id="btn-split"
            onClick={handleSplit}
            disabled={!file || !splitPages.trim() || loading}
            className="w-full inline-flex items-center justify-center py-3.5 text-sm font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl hover:from-brand-500 hover:to-brand-600 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none transition-all duration-300 shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 hover:-translate-y-0.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Splitting…
              </>
            ) : (
              'Split PDF'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
