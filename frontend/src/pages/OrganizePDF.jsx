/**
 * @file OrganizePDF.jsx
 * @description PDF page management page that supports visual layout restructuring.
 * Features:
 * - Drag-and-drop page reordering
 * - Page rotations (90 degrees steps)
 * - Blank page insertions
 * - Page deletions
 * - Action undo stack (history tracking)
 */

import React, { useState, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { organizePDF, downloadBlob } from '../services/api';
import DropZone from '../components/DropZone';
import {
  Grid, RotateCw, Trash2, Plus, ArrowLeft, ArrowRight,
  Loader2, CheckCircle2, AlertCircle, CornerUpLeft, Download
} from 'lucide-react';

// Configure PDFJS Local Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function OrganizePDF() {
  /* ────────────────────────────────────────────────────────────────────────
   * 1. STATE MANAGEMENT
   * ────────────────────────────────────────────────────────────────────── */
  
  // File & Document References
  const [file, setFile]         = useState(null);
  const [pdfRef, setPdfRef]     = useState(null);
  const [pages, setPages]       = useState([]);
  const [totalPages, setTotalPages] = useState(0);

  // Undo History Tracking
  const [history, setHistory]   = useState([]);

  // UI States (Loading, Rendering, Messages)
  const [loading, setLoading]   = useState(false);
  const [rendering, setRendering] = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState(null);

  /* ────────────────────────────────────────────────────────────────────────
   * 2. HISTORY / UNDO PIPELINE
   * ────────────────────────────────────────────────────────────────────── */

  /**
   * Saves the current page configuration to the history state stack.
   * Keeps a maximum of 20 undo steps.
   */
  const saveHistory = useCallback((current) => {
    setHistory((h) => [...h.slice(-19), current.map((p) => ({ ...p }))]);
  }, []);

  /**
   * Restores the previous page configuration from the history stack.
   */
  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setPages(prev);
    setHistory((h) => h.slice(0, -1));
  };

  /* ────────────────────────────────────────────────────────────────────────
   * 3. PDF RENDERING ENGINE
   * ────────────────────────────────────────────────────────────────────── */

  /**
   * Loads the PDF and initializes the page sequence.
   */
  useEffect(() => {
    if (!file) {
      setPages([]);
      setTotalPages(0);
      setPdfRef(null);
      return;
    }

    const load = async () => {
      setRendering(true);
      setError(null);
      setSuccess(false);
      try {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
        setPdfRef(pdf);
        setTotalPages(pdf.numPages);
        const init = Array.from({ length: pdf.numPages }, (_, i) => ({
          id: `src-${i}-${Date.now()}`,
          type: 'source',
          originalIndex: i,
          rotation: 0,
        }));
        setPages(init);
        setHistory([]);
      } catch (e) {
        console.error(e);
        setError('Failed to load PDF. It may be corrupted or password-protected.');
        setFile(null);
      } finally {
        setRendering(false);
      }
    };
    load();
  }, [file]);

  /**
   * Automatically renders thumbnails for non-blank pages when pages change.
   */
  useEffect(() => {
    if (pdfRef && pages.length > 0) {
      renderThumbs(pdfRef, pages);
    }
  }, [pages, pdfRef]);

  /**
   * Renders the thumbnails on canvas elements.
   * Uses setTimeout to ensure the React virtual DOM commits the canvas nodes first.
   */
  const renderThumbs = async (pdf, list) => {
    await new Promise((r) => setTimeout(r, 120));
    for (const p of list) {
      if (p.type === 'blank') continue;
      try {
        const page = await pdf.getPage(p.originalIndex + 1);
        const canvas = document.getElementById(`thumb-${p.id}`);
        if (!canvas) continue;
        const vp = page.getViewport({ scale: 0.28 });
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      } catch {
        /* Ignore non-fatal page rendering errors */
      }
    }
  };

  /* ────────────────────────────────────────────────────────────────────────
   * 4. DRAG AND DROP REORDERING HANDLERS
   * ────────────────────────────────────────────────────────────────────── */

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

    saveHistory(pages);
    setPages((prev) => {
      const next = [...prev];
      const [movedItem] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, movedItem);
      return next;
    });
  };

  /* ────────────────────────────────────────────────────────────────────────
   * 5. PAGE OPERATION MUTATIONS
   * ────────────────────────────────────────────────────────────────────── */

  const rotate = (idx) => {
    saveHistory(pages);
    setPages((p) => p.map((pg, i) =>
      i === idx ? { ...pg, rotation: (pg.rotation + 90) % 360 } : pg
    ));
  };

  const remove = (idx) => {
    saveHistory(pages);
    setPages((p) => p.filter((_, i) => i !== idx));
  };

  const insertBlank = (afterIdx) => {
    saveHistory(pages);
    const blank = { id: `blank-${Date.now()}`, type: 'blank', originalIndex: -1, rotation: 0 };
    setPages((p) => {
      const next = [...p];
      next.splice(afterIdx + 1, 0, blank);
      return next;
    });
  };

  const move = (idx, dir) => {
    const target = dir === 'left' ? idx - 1 : idx + 1;
    if (target < 0 || target >= pages.length) return;
    saveHistory(pages);
    setPages((p) => {
      const next = [...p];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  /* ────────────────────────────────────────────────────────────────────────
   * 6. SUBMISSION / DOWNLOAD PIPELINE
   * ────────────────────────────────────────────────────────────────────── */

  const applyChanges = async () => {
    if (!file || pages.length === 0) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    const ops = [];

    // 1. Gather deleted pages
    const kept = pages.filter((p) => p.type === 'source').map((p) => p.originalIndex);
    const deleted = Array.from({ length: totalPages }, (_, i) => i).filter((i) => !kept.includes(i));
    if (deleted.length) ops.push({ type: 'delete', pages: deleted.map((i) => i + 1) });

    // 2. Gather reordering operations
    const remaining = Array.from({ length: totalPages }, (_, i) => i).filter((i) => kept.includes(i));
    const order = pages.filter((p) => p.type === 'source').map((p) => remaining.indexOf(p.originalIndex) + 1);
    if (order.some((v, i) => v !== i + 1)) ops.push({ type: 'reorder', order });

    // 3. Gather page rotation operations
    pages.filter((p) => p.type === 'source').forEach((p, i) => {
      if (p.rotation !== 0) ops.push({ type: 'rotate', page: i + 1, angle: p.rotation });
    });

    // 4. Gather blank page insertion operations
    let offset = 0;
    pages.forEach((p, finalIdx) => {
      if (p.type === 'blank') {
        const pos = finalIdx === 0 ? 'before' : 'after';
        const ref = finalIdx === 0 ? 1 : finalIdx;
        ops.push({ type: 'blank', position: pos, page: ref + offset });
        offset++;
      }
    });

    try {
      const resp = await organizePDF(file, ops);
      downloadBlob(resp, `${file.name.replace('.pdf', '')}_organized.pdf`);
      setSuccess(true);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to organize PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFiles = (incoming) => {
    const pdf = incoming.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdf) {
      setError('Only PDF files are accepted.');
      return;
    }
    setFile(pdf);
  };

  /* ────────────────────────────────────────────────────────────────────────
   * 7. COMPONENT VIEW
   * ────────────────────────────────────────────────────────────────────── */

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 text-left">
      {/* Page Header section */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
            <Grid className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Organize PDF</h1>
            <p className="text-slate-400 text-sm">Rotate, reorder, delete, or insert blank pages visually.</p>
          </div>
        </div>

        {/* Global Toolbar buttons */}
        {file && (
          <div className="flex items-center gap-3">
            <button
              onClick={undo}
              disabled={history.length === 0}
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Undo last action"
            >
              <CornerUpLeft className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>

            <button
              onClick={() => insertBlank(pages.length - 1)}
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Blank</span>
            </button>

            <button
              id="btn-organize"
              onClick={applyChanges}
              disabled={loading || rendering || pages.length === 0}
              className="flex items-center space-x-2 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-lg hover:from-brand-500 hover:to-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-brand-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Applying…</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Apply & Download</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setFile(null);
                setError(null);
                setSuccess(false);
                setHistory([]);
              }}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-red-500/15 text-red-400 hover:text-red-300 hover:bg-red-500/5 hover:border-red-500/30 transition-all"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* User Feedback Alerts */}
      {error && (
        <div className="mb-6 flex items-start space-x-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-6 flex items-center space-x-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>Organized PDF downloaded successfully!</span>
        </div>
      )}

      {/* Main Content Workspace */}
      {!file ? (
        <div className="max-w-lg mx-auto">
          <DropZone
            accept=".pdf"
            onFiles={handleFiles}
            label="Upload PDF Document"
            subLabel="Renders a visual thumbnail manager for all pages"
            className="min-h-[280px]"
          />
        </div>
      ) : (
        <>
          {/* File Metadata Info Bar */}
          <div className="mb-6 flex items-center justify-between px-4 py-3 rounded-xl border border-white/5 bg-slate-900/40 text-xs text-slate-400">
            <span>
              <span className="text-white font-semibold">{file.name}</span> —{' '}
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </span>
            <span>
              <span className="text-white font-semibold">{pages.length}</span> pages
              {history.length > 0 && (
                <span className="ml-3 text-brand-400">
                  {history.length} unsaved change{history.length !== 1 ? 's' : ''}
                </span>
              )}
            </span>
          </div>

          {/* Thumbnail Manager Grid */}
          {rendering ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
              <Loader2 className="w-10 h-10 animate-spin text-brand-400 mb-4" />
              <p className="text-sm">Rendering page thumbnails…</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
              {pages.map((page, idx) => (
                <div
                  key={page.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, idx)}
                  className="rounded-xl border border-white/5 bg-slate-950/70 flex flex-col overflow-hidden shadow-lg hover:border-brand-500/30 hover:shadow-brand-500/5 transition-all cursor-grab active:cursor-grabbing group"
                >
                  {/* Visual Page Preview */}
                  <div className="relative flex items-center justify-center bg-slate-900/50 p-3 min-h-[140px] border-b border-white/5">
                    {page.type === 'blank' ? (
                      <div
                        className="w-20 h-28 bg-white rounded shadow-md flex items-center justify-center text-[9px] text-slate-400 font-semibold tracking-widest transition-transform duration-300 pointer-events-none"
                        style={{ transform: `rotate(${page.rotation}deg)` }}
                      >
                        BLANK
                      </div>
                    ) : (
                      <canvas
                        id={`thumb-${page.id}`}
                        className="max-w-full max-h-32 shadow-md rounded transition-transform duration-300 pointer-events-none"
                        style={{ transform: `rotate(${page.rotation}deg)` }}
                      />
                    )}

                    {/* Page Badges */}
                    <span className="absolute top-2 left-2 text-[10px] font-bold text-slate-400 bg-slate-900/80 border border-white/5 px-1.5 py-0.5 rounded">
                      {idx + 1}
                    </span>
                    {page.rotation !== 0 && (
                      <span className="absolute top-2 right-2 text-[10px] text-brand-400 bg-slate-900/80 border border-brand-500/20 px-1.5 py-0.5 rounded">
                        {page.rotation}°
                      </span>
                    )}
                  </div>

                  {/* Individual Page Actions */}
                  <div
                    className="flex items-center justify-between px-1.5 py-1.5 bg-slate-950"
                    onDragStart={(e) => e.stopPropagation()}
                    draggable="false"
                  >
                    <div className="flex">
                      <button
                        onClick={() => move(idx, 'left')}
                        disabled={idx === 0}
                        className="p-1 rounded text-slate-600 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Move left"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => move(idx, 'right')}
                        disabled={idx === pages.length - 1}
                        className="p-1 rounded text-slate-600 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Move right"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex">
                      <button
                        onClick={() => rotate(idx)}
                        className="p-1 rounded text-slate-500 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
                        title="Rotate 90°"
                      >
                        <RotateCw className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => insertBlank(idx)}
                        className="p-1 rounded text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        title="Insert blank page after"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => remove(idx)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete page"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
