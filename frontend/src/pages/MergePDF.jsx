import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { mergePDFs, downloadBlob } from '../services/api';
import DropZone from '../components/DropZone';
import { File, ArrowLeft, ArrowRight, Trash2, Layers, Loader2, CheckCircle2 } from 'lucide-react';

// Configure PDFJS Local Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Thumbnail Renderer sub-component for isolation and cleanup safety
function PdfThumbnail({ file }) {
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState(false);
  const canvasRef = React.useRef(null);

  useEffect(() => {
    let active = true;
    const render = async () => {
      if (!canvasRef.current) return;
      setRendering(true);
      setError(false);
      try {
        const buf = await file.arrayBuffer();
        if (!active) return;
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
        if (!active) return;
        const page = await pdf.getPage(1);
        if (!active) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        // Target rendering height of 150px
        const desiredHeight = 150;
        const vp1 = page.getViewport({ scale: 1.0 });
        const scale = desiredHeight / vp1.height;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;
      } catch (err) {
        console.error('Thumbnail render error:', err);
        if (active) setError(true);
      } finally {
        if (active) setRendering(false);
      }
    };

    render();
    return () => {
      active = false;
    };
  }, [file]);

  return (
    <div className="relative w-24 h-32 flex items-center justify-center bg-slate-900/40 rounded overflow-hidden">
      {rendering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/85 z-10">
          <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
          <span className="text-[9px] text-slate-500">Loading...</span>
        </div>
      )}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-red-400 text-center px-1 bg-red-500/10">
          Preview unavailable
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className="shadow-md rounded max-h-[150px] max-w-full pointer-events-none bg-white transition-opacity duration-300"
          style={{ opacity: rendering ? 0 : 1 }}
        />
      )}
    </div>
  );
}

export default function MergePDF() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleFiles = (incoming) => {
    const pdfs = incoming.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      setError('Only PDF files are accepted.');
      return;
    }
    setError(null);
    setSuccess(false);

    // Map raw file objects to custom item structure with unique IDs
    const formatted = pdfs.map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      name: f.name,
      size: f.size,
    }));

    setFiles((prev) => [...prev, ...formatted]);
  };

  const moveFile = (index, dir) => {
    const next = [...files];
    const target = dir === 'up' ? index - 1 : index + 1;
    if (target >= 0 && target < files.length) {
      [next[index], next[target]] = [next[target], next[index]];
      setFiles(next);
    }
  };

  const removeFile = (index) => setFiles((prev) => prev.filter((_, i) => i !== index));
  const clearAll = () => { setFiles([]); setError(null); setSuccess(false); };

  const handleMerge = async () => {
    if (files.length < 2) { setError('Add at least 2 PDF files to merge.'); return; }
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const rawFiles = files.map((f) => f.file);
      const response = await mergePDFs(rawFiles);
      downloadBlob(response, 'merged_document.pdf');
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to merge PDFs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Drag-and-drop handlers
  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    e.currentTarget.classList.add('opacity-40');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('opacity-40');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    const dragIndexStr = e.dataTransfer.getData('text/plain');
    if (dragIndexStr === '') return;
    const dragIndex = parseInt(dragIndexStr, 10);
    if (dragIndex === targetIndex) return;

    setFiles((prev) => {
      const next = [...prev];
      const [movedItem] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, movedItem);
      return next;
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 text-left">
      {/* Page header */}
      <div className="mb-8 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
          <Layers className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Merge PDF</h1>
          <p className="text-slate-400 text-sm">Combine multiple PDF files into one. Drag and drop cards to reorder.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Upload panel */}
        <div className="lg:col-span-4 space-y-4">
          <DropZone
            accept=".pdf"
            multiple
            onFiles={handleFiles}
            label="Add PDF Files"
            subLabel="PDF files only — drag multiple at once"
            className="min-h-[250px]"
          />

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-start space-x-2">
              <span className="mt-0.5 flex-shrink-0">⚠</span>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Merged PDF downloaded successfully!</span>
            </div>
          )}
        </div>

        {/* Workspace Card Grid */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="flex-1 rounded-xl border border-white/5 bg-slate-900/40 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold text-white">
                Sequence list
                <span className="ml-2 text-xs text-slate-500 font-normal">{files.length} file{files.length !== 1 ? 's' : ''}</span>
              </h2>
              {files.length > 0 && (
                <button onClick={clearAll} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
                  Clear all
                </button>
              )}
            </div>

            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                <File className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-xs">No files added yet</p>
                <p className="text-xs mt-1 opacity-60">Upload from the panel on the left</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto pr-1">
                {files.map((file, idx) => (
                  <div
                    key={file.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, idx)}
                    className="relative rounded-xl border border-white/5 bg-slate-950/60 hover:border-brand-500/30 hover:shadow-brand-500/5 transition-all cursor-grab active:cursor-grabbing flex flex-col justify-between p-3 min-h-[240px] group"
                  >
                    {/* Top Action Bar */}
                    <div className="flex items-center justify-between w-full mb-2">
                      <span className="w-5 h-5 rounded-md bg-brand-500/20 text-brand-300 text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                        className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* PDF Visual Thumbnail Preview */}
                    <div className="flex-1 flex items-center justify-center bg-slate-900/40 rounded-lg p-2 min-h-[140px] mb-2 overflow-hidden border border-white/5">
                      <PdfThumbnail file={file.file} />
                    </div>

                    {/* File Details */}
                    <div className="w-full text-center space-y-0.5">
                      <p className="text-[11px] text-white font-medium truncate px-1" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-[9px] text-slate-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    {/* Quick Button Reorder Actions */}
                    <div
                      className="flex justify-center space-x-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onDragStart={(e) => e.stopPropagation()}
                      draggable="false"
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); moveFile(idx, 'up'); }}
                        disabled={idx === 0}
                        className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed"
                        title="Move Left"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveFile(idx, 'down'); }}
                        disabled={idx === files.length - 1}
                        className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed"
                        title="Move Right"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Trigger */}
          <button
            id="btn-merge"
            onClick={handleMerge}
            disabled={files.length < 2 || loading}
            className="w-full inline-flex items-center justify-center py-3.5 text-sm font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl hover:from-brand-500 hover:to-brand-600 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none transition-all duration-300 shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 hover:-translate-y-0.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Merging…
              </>
            ) : (
              `Merge ${files.length > 1 ? `${files.length} PDFs` : 'PDFs'}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
