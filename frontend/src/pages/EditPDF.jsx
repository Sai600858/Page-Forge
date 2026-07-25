/**
 * @file EditPDF.jsx
 * @description PDF layout editor allowing users to interactively overlay text,
 * shapes, signatures, and images onto PDF pages.
 * Features:
 * - PDF page rendering on high-fidelity HTML5 canvas
 * - On-canvas overlay dragging and real-time resizing (corners/endpoints)
 * - Sidebar numeric coordinates/properties panel (Font size, Text, Width, Height, Radius, Colors)
 * - Freehand signature canvas drawing & embedding
 * - Custom local image embedding
 * - Element layers listing & dynamic element removal
 */

import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
// react-signature-canvas removed — replaced with native canvas pad (React 19 compatible)
import { editPDF, downloadBlob } from '../services/api';
import { 
  Upload, File, Edit3, Type, Square, Image, PenTool, 
  Trash2, ChevronLeft, ChevronRight, Loader2, Sparkles, Check, X
} from 'lucide-react';

// Configure PDFJS Local Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function EditPDF() {
  /* ────────────────────────────────────────────────────────────────────────
   * 1. CONSTANTS & SYSTEM CONFIGURATION
   * ────────────────────────────────────────────────────────────────────── */
  const EDITOR_SCALE = 1.3; // Default render zoom scale for the on-screen canvas

  /* ────────────────────────────────────────────────────────────────────────
   * 2. STATE MANAGEMENT
   * ────────────────────────────────────────────────────────────────────── */
  
  // Document State
  const [file, setFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageInputVal, setPageInputVal] = useState('1');
  const [pageDimensions, setPageDimensions] = useState({});
  const [placementCoords, setPlacementCoords] = useState(null); // { x, y, page }
  
  // Active Tool & Selection State
  const [tool, setTool] = useState('select'); // select, text, shape, image, signature
  const [elements, setElements] = useState([]); // All overlay elements placed across the document pages
  const [selectedElId, setSelectedElId] = useState(null); // Currently selected overlay element ID
  
  // New Element Configuration Defaults
  const [textColor, setTextColor] = useState('#8b5cf6');
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState('Helvetica');
  const [shapeType, setShapeType] = useState('rectangle');
  const [shapeThickness, setShapeThickness] = useState(3);
  const [shapeFill, setShapeFill] = useState(false);
  const [zoom, setZoom] = useState(1); // Page zoom level (0.5 – 3×)

  // Modal, Loading, & Feedback UI States
  const [showSigModal, setShowSigModal] = useState(false);
  const [sigIsEmpty, setSigIsEmpty] = useState(true); // Tracks whether anything has been drawn
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState(null);

  /* ────────────────────────────────────────────────────────────────────────
   * 3. REF HOOKS
   * ────────────────────────────────────────────────────────────────────── */
  const canvasesRef = useRef({});
  const overlaysRef = useRef({});
  const scrollContainerRef = useRef(null);
  const renderedPagesRef = useRef({});
  const sigCanvasRef = useRef(null);   // Ref to the native <canvas> drawing pad
  const sigDrawingRef = useRef(false); // Is the user currently drawing?
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  /* ────────────────────────────────────────────────────────────────────────
   * 4. DOCUMENT LOADING & RENDER ENGINE EFFECTS
   * ────────────────────────────────────────────────────────────────────── */

  /**
   * Effect: Handles new file uploads, parsing the PDF document structure.
   */
  useEffect(() => {
    if (!file) {
      setPdfDoc(null);
      setTotalPages(0);
      setCurrentPage(1);
      setPageInputVal('1');
      setElements([]);
      setPageDimensions({});
      canvasesRef.current = {};
      overlaysRef.current = {};
      renderedPagesRef.current = {};
      return;
    }

    const loadPdf = async () => {
      setRendering(true);
      setError(null);
      try {
        const fileReader = new FileReader();
        fileReader.onload = async (e) => {
          try {
            const typedarray = new Uint8Array(e.target.result);
            const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
            setPdfDoc(pdf);
            
            // Extract dimensions for all pages immediately
            const dimensions = {};
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: EDITOR_SCALE });
              dimensions[i] = { width: viewport.width, height: viewport.height };
            }
            setPageDimensions(dimensions);
            setTotalPages(pdf.numPages);
            setCurrentPage(1);
            setPageInputVal('1');
            setElements([]);
            canvasesRef.current = {};
            overlaysRef.current = {};
            renderedPagesRef.current = {};
          } catch (err) {
            console.error(err);
            setError('Failed to parse PDF.');
            setFile(null);
          } finally {
            setRendering(false);
          }
        };
        fileReader.readAsArrayBuffer(file);
      } catch (err) {
        console.error(err);
        setError('Error loading file.');
        setRendering(false);
      }
    };

    loadPdf();
  }, [file]);

  /**
   * Effect: Clears the native canvas pad every time the modal opens so stale
   * strokes from a previous session are never visible.
   */
  useEffect(() => {
    if (showSigModal) {
      // Short defer so the modal DOM is fully mounted before we touch the canvas
      const t = setTimeout(() => {
        const canvas = sigCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        setSigIsEmpty(true);
        sigDrawingRef.current = false;
      }, 50);
      return () => clearTimeout(t);
    }
  }, [showSigModal]);

  /* ── Native signature-pad drawing helpers ── */

  /** Translates a mouse or touch event into canvas-buffer coordinates. */
  const getSigPos = (e) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const sigHandleStart = (e) => {
    e.preventDefault();
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getSigPos(e);
    sigDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setSigIsEmpty(false);
  };

  const sigHandleMove = (e) => {
    e.preventDefault();
    if (!sigDrawingRef.current) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getSigPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const sigHandleEnd = () => { sigDrawingRef.current = false; };

  const clearSigPad = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setSigIsEmpty(true);
  };

  /**
   * Renders a single PDF page onto its canvas.
   */
  const renderSinglePage = async (pageNum) => {
    if (!pdfDoc || renderedPagesRef.current[pageNum]) return;
    renderedPagesRef.current[pageNum] = true;
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const canvas = canvasesRef.current[pageNum];
      if (!canvas) {
        renderedPagesRef.current[pageNum] = false;
        return;
      }

      const context = canvas.getContext('2d');
      const viewport = page.getViewport({ scale: EDITOR_SCALE });
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      await page.render(renderContext).promise;
    } catch (err) {
      console.error(`Page ${pageNum} render error:`, err);
      renderedPagesRef.current[pageNum] = false;
    }
  };

  /**
   * Effect: Intersection Observer to lazy-render pages when they scroll near/into the viewport.
   */
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.dataset.page);
            if (pageNum && !renderedPagesRef.current[pageNum]) {
              renderSinglePage(pageNum);
            }
          }
        });
      },
      {
        threshold: 0.05,
        root: scrollContainerRef.current,
        rootMargin: '200px 0px'
      }
    );

    for (let i = 1; i <= totalPages; i++) {
      const el = document.getElementById(`pdf-page-container-${i}`);
      if (el) {
        observer.observe(el);
      }
    }

    return () => observer.disconnect();
  }, [pdfDoc, totalPages, pageDimensions]);

  /**
   * Handler: Updates the active page based on scroll position within the infinite scroll viewport.
   */
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container || totalPages === 0) return;

    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    
    let activePage = 1;
    let minDiff = Infinity;

    for (let i = 1; i <= totalPages; i++) {
      const pageEl = document.getElementById(`pdf-page-container-${i}`);
      if (!pageEl) continue;

      const pageTop = pageEl.offsetTop - container.offsetTop;
      const pageHeight = pageEl.clientHeight;
      
      const pageCenter = pageTop + pageHeight / 2;
      const viewportCenter = scrollTop + containerHeight / 2;

      const diff = Math.abs(pageCenter - viewportCenter);
      if (diff < minDiff) {
        minDiff = diff;
        activePage = i;
      }
    }

    if (activePage !== currentPage) {
      setCurrentPage(activePage);
    }
  };

  /**
   * Effect: Keeps page number input synchronized with current page on scroll.
   */
  useEffect(() => {
    setPageInputVal(currentPage.toString());
  }, [currentPage]);

  /**
   * Handler: Jumps to a specific page number.
   */
  const handleGoToPage = () => {
    const pageNum = parseInt(pageInputVal);
    if (pageNum >= 1 && pageNum <= totalPages) {
      scrollToPage(pageNum);
    } else {
      setPageInputVal(currentPage.toString());
    }
  };

  const scrollToPage = (pageNum) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      const pageEl = document.getElementById(`pdf-page-container-${pageNum}`);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setCurrentPage(pageNum);
      }
    }
  };

  /* ────────────────────────────────────────────────────────────────────────
   * 5. ELEMENT POSITIONING & SCALE GESTURE HANDLERS (DRAG & RESIZE)
   * ────────────────────────────────────────────────────────────────────── */

  /**
   * Triggers moving translation for a placed element when dragged.
   */
  const handleElDragStart = (e, elId) => {
    if (tool !== 'select') return;
    e.preventDefault();
    setSelectedElId(elId);

    const getXY = (ev) => ev.touches?.length
      ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY }
      : { x: ev.clientX, y: ev.clientY };

    const { x: startX, y: startY } = getXY(e);
    const el = elements.find((item) => item.id === elId);
    if (!el) return;
    const { x: ix, y: iy, x1: ix1, y1: iy1, x2: ix2, y2: iy2 } = el;

    const handleMove = (mv) => {
      if (mv.cancelable) mv.preventDefault();
      const { x, y } = getXY(mv);
      const dx = (x - startX) / zoom;
      const dy = (y - startY) / zoom;
      setElements((prev) => prev.map((item) => {
        if (item.id !== elId) return item;
        if (item.type === 'shape' && item.shapeType === 'line')
          return { ...item, x1: ix1+dx, y1: iy1+dy, x2: ix2+dx, y2: iy2+dy };
        return { ...item, x: ix+dx, y: iy+dy };
      }));
    };
    const handleEnd = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
  };

  /**
   * Resizes boundaries of rectangles, circles, lines, texts, and image overlay objects.
   */
  const handleElResizeStart = (e, elId) => {
    e.preventDefault();
    e.stopPropagation();

    const getXY = (ev) => ev.touches?.length
      ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY }
      : { x: ev.clientX, y: ev.clientY };

    const { x: startX, y: startY } = getXY(e);
    const el = elements.find((item) => item.id === elId);
    if (!el) return;
    const iW = el.width||0, iH = el.height||0, iR = el.radius||0;
    const iFs = el.fontSize||0, iX2 = el.x2||0, iY2 = el.y2||0;

    const handleMove = (mv) => {
      if (mv.cancelable) mv.preventDefault();
      const { x, y } = getXY(mv);
      const dx = (x - startX) / zoom;
      const dy = (y - startY) / zoom;
      setElements((prev) => prev.map((item) => {
        if (item.id !== elId) return item;
        if (item.type === 'text') {
          const nFs = Math.max(8, iFs + Math.round(dx * 0.2));
          return { ...item, fontSize: nFs, width: item.text.length*(nFs*0.6), height: nFs*1.2 };
        }
        if (item.type === 'shape' && item.shapeType === 'circle')
          return { ...item, radius: Math.max(5, iR + Math.round(dx*0.5)) };
        if (item.type === 'shape' && item.shapeType === 'line')
          return { ...item, x2: iX2+dx, y2: iY2+dy };
        return { ...item, width: Math.max(10, iW+dx), height: Math.max(10, iH+dy) };
      }));
    };
    const handleEnd = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
  };

  /**
   * Resizes line segments specifically by translating endpoints x1/y1 or x2/y2.
   */
  const handleLineResizeStart = (e, elId, endpoint) => {
    e.preventDefault();
    e.stopPropagation();

    const getXY = (ev) => ev.touches?.length
      ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY }
      : { x: ev.clientX, y: ev.clientY };

    const { x: startX, y: startY } = getXY(e);
    const el = elements.find((item) => item.id === elId);
    if (!el) return;
    const iX = endpoint === 'x1' ? el.x1 : el.x2;
    const iY = endpoint === 'y1' ? el.y1 : el.y2;

    const handleMove = (mv) => {
      if (mv.cancelable) mv.preventDefault();
      const { x, y } = getXY(mv);
      const dx = (x - startX) / zoom;
      const dy = (y - startY) / zoom;
      setElements((prev) => prev.map((item) => {
        if (item.id !== elId) return item;
        return endpoint === 'x1'
          ? { ...item, x1: iX+dx, y1: iY+dy }
          : { ...item, x2: iX+dx, y2: iY+dy };
      }));
    };
    const handleEnd = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
  };

  /* ────────────────────────────────────────────────────────────────────────
   * 6. PLACEMENT & MODAL HANDLERS
   * ────────────────────────────────────────────────────────────────────── */

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type !== 'application/pdf') {
        setError('Please select a valid PDF file.');
        return;
      }
      setFile(selected);
    }
  };

  const removeElement = (id) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedElId === id) setSelectedElId(null);
  };

  /**
   * Handles user clicks on the overlay viewport to drop or inject tools content.
   */
  const handleOverlayClick = (e, pageNum) => {
    if (tool === 'select') return;

    const overlayEl = overlaysRef.current[pageNum];
    if (!overlayEl) return;
    const rect = overlayEl.getBoundingClientRect();
    // Divide by zoom: getBoundingClientRect returns zoomed dimensions
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    const newElId = `el-${Date.now()}`;
    const coords = { x, y, page: pageNum };
    setPlacementCoords(coords);

    if (tool === 'text') {
      const textVal = prompt('Enter overlay text:', 'Page Forge Text');
      if (!textVal) return;

      const newEl = {
        id: newElId,
        type: 'text',
        page: pageNum,
        x,
        y,
        text: textVal,
        fontSize,
        color: textColor,
        fontFamily,
        width: textVal.length * (fontSize * 0.6),
        height: fontSize * 1.2
      };
      setElements((prev) => [...prev, newEl]);
      setTool('select');
      setSelectedElId(newElId);
    } else if (tool === 'shape') {
      const newEl = {
        id: newElId,
        type: 'shape',
        shapeType,
        page: pageNum,
        x: shapeType === 'line' ? x : x - 40,
        y: shapeType === 'line' ? y : y - 20,
        x1: x,
        y1: y,
        x2: x + 80,
        y2: y + 40,
        width: 80,
        height: 40,
        radius: 25,
        color: textColor,
        thickness: shapeThickness,
        fill: shapeFill
      };
      setElements((prev) => [...prev, newEl]);
      setTool('select');
      setSelectedElId(newElId);
    } else if (tool === 'image') {
      imageInputRef.current.click();
    } else if (tool === 'signature') {
      setShowSigModal(true);
    }
  };

  /**
   * Handles custom picture upload, encoding image to base64, and sizing.
   */
  const handleImageFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      const { x, y, page: pageNum } = placementCoords || { x: 50, y: 50, page: 1 };

      const img = new window.Image();
      img.onload = () => {
        const maxW = 150;
        const ratio = img.height / img.width;
        const w = maxW;
        const h = maxW * ratio;

        const newEl = {
          id: `img-${Date.now()}`,
          type: 'image',
          page: pageNum,
          x: x - w / 2,
          y: y - h / 2,
          width: w,
          height: h,
          imageBuffer: base64
        };
        setElements((prev) => [...prev, newEl]);
        setTool('select');
        setSelectedElId(newEl.id);
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset file input
  };

  /**
   * Reads the native canvas as a PNG data-URL and adds the signature overlay.
   */
  const handleInsertSignature = () => {
    if (sigIsEmpty) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;

    const base64 = canvas.toDataURL('image/png');
    const { x, y, page: pageNum } = placementCoords || { x: 50, y: 50, page: 1 };

    const w = 120;
    const h = 50;

    const newEl = {
      id: `sig-${Date.now()}`,
      type: 'signature',
      page: pageNum,
      x: x - w / 2,
      y: y - h / 2,
      width: w,
      height: h,
      imageBuffer: base64
    };

    setElements((prev) => [...prev, newEl]);
    setShowSigModal(false);
    setTool('select');
    setSelectedElId(newEl.id);
  };

  /* ────────────────────────────────────────────────────────────────────────
   * 7. SAVE & DOWNLOAD EXPORTER PIPELINE
   * ────────────────────────────────────────────────────────────────────── */

  const handleSavePDF = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    // Map screen layout coordinates back to raw PDF coordinates
    const mappedElements = elements.map((el) => {
      const mapped = {
        type: el.type,
        page: el.page,
        color: el.color
      };

      if (el.type === 'text') {
        mapped.text = el.text;
        mapped.fontSize = el.fontSize / EDITOR_SCALE;
        mapped.fontFamily = el.fontFamily;
        mapped.x = el.x / EDITOR_SCALE;
        mapped.y = el.y / EDITOR_SCALE;
      } else if (el.type === 'image' || el.type === 'signature') {
        mapped.x = el.x / EDITOR_SCALE;
        mapped.y = el.y / EDITOR_SCALE;
        mapped.width = el.width / EDITOR_SCALE;
        mapped.height = el.height / EDITOR_SCALE;
        mapped.imageBuffer = el.imageBuffer;
      } else if (el.type === 'shape') {
        mapped.shapeType = el.shapeType;
        mapped.thickness = el.thickness;
        mapped.fill = el.fill;
        mapped.x = el.x / EDITOR_SCALE;
        mapped.y = el.y / EDITOR_SCALE;
        mapped.width = el.width / EDITOR_SCALE;
        mapped.height = el.height / EDITOR_SCALE;
        mapped.radius = el.radius / EDITOR_SCALE;
        mapped.x1 = el.x1 / EDITOR_SCALE;
        mapped.y1 = el.y1 / EDITOR_SCALE;
        mapped.x2 = el.x2 / EDITOR_SCALE;
        mapped.y2 = el.y2 / EDITOR_SCALE;
      }

      return mapped;
    });

    try {
      const response = await editPDF(file, mappedElements);
      downloadBlob(response, `${file.name.replace('.pdf', '')}_edited.pdf`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to apply edits to PDF.');
    } finally {
      setLoading(false);
    }
  };

  /* ────────────────────────────────────────────────────────────────────────
   * 8. COMPONENT VIEW
   * ────────────────────────────────────────────────────────────────────── */

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-left relative">
      {/* Header bar section */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center border border-violet-500/30">
            <Edit3 className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Edit PDF</h2>
            <p className="text-dark-300 text-sm">Draw shapes, write text, add images, and sign pages interactively.</p>
          </div>
        </div>

        {file && (
          <button
            onClick={() => setFile(null)}
            className="text-xs font-semibold text-red-400 hover:text-red-300 border border-red-500/10 hover:border-red-500/20 rounded-lg px-4 py-2 hover:bg-red-500/5 transition-all"
          >
            Close Document
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/15 border border-red-500/20 text-red-400 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* Main workspace panels layout */}
      {!file ? (
        <div className="max-w-lg mx-auto">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="application/pdf"
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.setAttribute('data-dragging', 'true'); }}
            onDragLeave={(e) => { e.currentTarget.removeAttribute('data-dragging'); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.removeAttribute('data-dragging');
              const dropped = e.dataTransfer.files?.[0];
              if (!dropped) return;
              if (dropped.type !== 'application/pdf' && !dropped.name.toLowerCase().endsWith('.pdf')) {
                setError('Please drop a valid PDF file.');
                return;
              }
              setFile(dropped);
            }}
            className="border-2 border-dashed border-white/10 hover:border-violet-500/40 data-[dragging]:border-violet-500/70 data-[dragging]:bg-violet-500/10 rounded-2xl p-12 text-center cursor-pointer transition-all bg-slate-900/10 hover:bg-slate-900/30 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/5 group-hover:scale-105 transition-transform duration-300">
              <Upload className="w-6 h-6 text-dark-300 group-hover:text-white" />
            </div>
            <h3 className="text-white font-semibold mb-1">Upload PDF Document</h3>
            <p className="text-dark-300 text-xs max-w-xs mx-auto">
              Click to choose or <span className="text-violet-400">drag &amp; drop</span> a PDF to open the interactive overlay builder.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* SIDEBAR PROPERTIES AND EDIT CONTROLS */}
          <div className="lg:col-span-1 space-y-4">
            
            {/* Main Action Exporter Box */}
            <div className="glass-panel rounded-xl border border-white/5 bg-slate-900/40 p-4 space-y-3">
              <button
                onClick={handleSavePDF}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 py-2.5 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-600 text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Applying Changes…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Save & Export</span>
                  </>
                )}
              </button>
            </div>

            {/* Placement Overlay Tools selector */}
            <div className="glass-panel rounded-xl border border-white/5 bg-slate-900/40 p-4 space-y-3">
              <h3 className="text-xs font-bold text-brand-300 uppercase tracking-wide">Overlay Tools</h3>

              <button
                onClick={() => setTool('select')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  tool === 'select'
                    ? 'bg-brand-500/20 text-brand-300 border-brand-500/30'
                    : 'text-dark-300 hover:text-white bg-dark-900/30 border-transparent'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Selection Cursor</span>
              </button>

              <button
                onClick={() => setTool('text')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  tool === 'text'
                    ? 'bg-brand-500/20 text-brand-300 border-brand-500/30'
                    : 'text-dark-300 hover:text-white bg-dark-900/30 border-transparent'
                }`}
              >
                <Type className="w-4 h-4" />
                <span>Add Text</span>
              </button>

              <button
                onClick={() => setTool('shape')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  tool === 'shape'
                    ? 'bg-brand-500/20 text-brand-300 border-brand-500/30'
                    : 'text-dark-300 hover:text-white bg-dark-900/30 border-transparent'
                }`}
              >
                <Square className="w-4 h-4" />
                <span>Add Shape</span>
              </button>

              <button
                onClick={() => setTool('image')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  tool === 'image'
                    ? 'bg-brand-500/20 text-brand-300 border-brand-500/30'
                    : 'text-dark-300 hover:text-white bg-dark-900/30 border-transparent'
                }`}
              >
                <Image className="w-4 h-4" />
                <span>Add Image</span>
              </button>

              <button
                onClick={() => setTool('signature')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  tool === 'signature'
                    ? 'bg-brand-500/20 text-brand-300 border-brand-500/30'
                    : 'text-dark-300 hover:text-white bg-dark-900/30 border-transparent'
                }`}
              >
                <PenTool className="w-4 h-4" />
                <span>Add Signature</span>
              </button>
            </div>

            {/* Custom Tool Properties Panel */}
            <div className="glass-panel rounded-xl border border-white/5 bg-slate-900/40 p-4 space-y-4">
              <h3 className="text-xs font-bold text-brand-300 uppercase tracking-wide">Properties</h3>

              {/* Color Picker */}
              <div>
                <label className="block text-[10px] uppercase font-semibold text-dark-300 mb-1.5">Color</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent"
                  />
                  <span className="text-xs text-white uppercase font-mono">{textColor}</span>
                </div>
              </div>

              {/* Text styling */}
              {tool === 'text' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-dark-300 mb-1.5">Font Size</label>
                    <input
                      type="number"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value) || 12)}
                      className="w-full px-2.5 py-1.5 bg-dark-900 border border-white/5 rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-dark-300 mb-1.5">Font Family</label>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-dark-900 border border-white/5 rounded text-xs text-white"
                    >
                      <option value="Helvetica">Helvetica</option>
                      <option value="Helvetica-Bold">Helvetica Bold</option>
                      <option value="Times-Roman">Times New Roman</option>
                      <option value="Courier">Courier</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Shape settings */}
              {tool === 'shape' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-dark-300 mb-1.5">Shape Type</label>
                    <select
                      value={shapeType}
                      onChange={(e) => setShapeType(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-dark-900 border border-white/5 rounded text-xs text-white"
                    >
                      <option value="rectangle">Rectangle</option>
                      <option value="circle">Circle</option>
                      <option value="line">Line</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-dark-300 mb-1.5">Border Thickness</label>
                    <input
                      type="number"
                      value={shapeThickness}
                      onChange={(e) => setShapeThickness(parseInt(e.target.value) || 2)}
                      className="w-full px-2.5 py-1.5 bg-dark-900 border border-white/5 rounded text-xs text-white"
                    />
                  </div>
                  {shapeType !== 'line' && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="shapeFill"
                        checked={shapeFill}
                        onChange={(e) => setShapeFill(e.target.checked)}
                        className="rounded bg-dark-900 border-white/5"
                      />
                      <label htmlFor="shapeFill" className="text-xs text-dark-300">Fill Shape</label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SELECTED ELEMENT PROPERTIES EDIT CONTROL BOX */}
            {selectedElId && (
              <div className="glass-panel rounded-xl border border-white/5 bg-slate-900/40 p-4 space-y-4">
                <h3 className="text-xs font-bold text-violet-300 uppercase tracking-wide">Selected Element</h3>
                {(() => {
                  const el = elements.find((e) => e.id === selectedElId);
                  if (!el) return <p className="text-[10px] text-dark-400">No element selected.</p>;
                  return (
                    <div className="space-y-3">
                      {/* Color Option */}
                      {(el.type === 'text' || el.type === 'shape') && (
                        <div>
                          <label className="block text-[10px] uppercase font-semibold text-dark-300 mb-1.5">Color</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={el.color}
                              onChange={(e) => {
                                setElements((prev) => prev.map((item) => item.id === el.id ? { ...item, color: e.target.value } : item));
                              }}
                              className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent"
                            />
                            <span className="text-xs text-white uppercase font-mono">{el.color}</span>
                          </div>
                        </div>
                      )}

                      {/* Font size configuration */}
                      {el.type === 'text' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] uppercase font-semibold text-dark-300 mb-1.5">Font Size</label>
                            <input
                              type="number"
                              value={el.fontSize}
                              onChange={(e) => {
                                const newSize = Math.max(6, parseInt(e.target.value) || 12);
                                setElements((prev) => prev.map((item) => item.id === el.id ? { ...item, fontSize: newSize, width: item.text.length * (newSize * 0.6), height: newSize * 1.2 } : item));
                              }}
                              className="w-full px-2.5 py-1.5 bg-dark-900 border border-white/5 rounded text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-semibold text-dark-300 mb-1.5">Text Value</label>
                            <input
                              type="text"
                              value={el.text}
                              onChange={(e) => {
                                setElements((prev) => prev.map((item) => item.id === el.id ? { ...item, text: e.target.value, width: e.target.value.length * (item.fontSize * 0.6) } : item));
                              }}
                              className="w-full px-2.5 py-1.5 bg-dark-900 border border-white/5 rounded text-xs text-white"
                            />
                          </div>
                        </div>
                      )}

                      {/* Width & Height Config */}
                      {(el.type === 'image' || el.type === 'signature' || (el.type === 'shape' && el.shapeType === 'rectangle')) && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] uppercase font-semibold text-dark-300 mb-1.5">Width (px)</label>
                            <input
                              type="number"
                              value={Math.round(el.width)}
                              onChange={(e) => {
                                const newW = Math.max(10, parseInt(e.target.value) || 50);
                                setElements((prev) => prev.map((item) => item.id === el.id ? { ...item, width: newW } : item));
                              }}
                              className="w-full px-2.5 py-1.5 bg-dark-900 border border-white/5 rounded text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-semibold text-dark-300 mb-1.5">Height (px)</label>
                            <input
                              type="number"
                              value={Math.round(el.height)}
                              onChange={(e) => {
                                const newH = Math.max(10, parseInt(e.target.value) || 20);
                                setElements((prev) => prev.map((item) => item.id === el.id ? { ...item, height: newH } : item));
                              }}
                              className="w-full px-2.5 py-1.5 bg-dark-900 border border-white/5 rounded text-xs text-white"
                            />
                          </div>
                        </div>
                      )}

                      {/* Circle radius configurations */}
                      {el.type === 'shape' && el.shapeType === 'circle' && (
                        <div>
                          <label className="block text-[10px] uppercase font-semibold text-dark-300 mb-1.5">Radius (px)</label>
                          <input
                            type="number"
                            value={Math.round(el.radius)}
                            onChange={(e) => {
                              const newR = Math.max(5, parseInt(e.target.value) || 10);
                              setElements((prev) => prev.map((item) => item.id === el.id ? { ...item, radius: newR } : item));
                            }}
                            className="w-full px-2.5 py-1.5 bg-dark-900 border border-white/5 rounded text-xs text-white"
                          />
                        </div>
                      )}

                      {/* Thickness configurations */}
                      {el.type === 'shape' && (
                        <div>
                          <label className="block text-[10px] uppercase font-semibold text-dark-300 mb-1.5">Line Thickness</label>
                          <input
                            type="number"
                            value={el.thickness}
                            onChange={(e) => {
                              const newT = Math.max(1, parseInt(e.target.value) || 1);
                              setElements((prev) => prev.map((item) => item.id === el.id ? { ...item, thickness: newT } : item));
                            }}
                            className="w-full px-2.5 py-1.5 bg-dark-900 border border-white/5 rounded text-xs text-white"
                          />
                        </div>
                      )}

                      <button
                        onClick={() => removeElement(el.id)}
                        className="w-full py-2 mt-2 bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/35 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 transition-all"
                      >
                        Delete Element
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Layer Elements Tracker List */}
            <div className="glass-panel rounded-xl border border-white/5 bg-slate-900/40 p-4">
              <h3 className="text-xs font-bold text-brand-300 uppercase tracking-wide mb-3">Elements List</h3>
              
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {elements.filter(el => el.page === currentPage).length === 0 ? (
                  <p className="text-[10px] text-dark-400">No edits placed on this page yet.</p>
                ) : (
                  elements.filter(el => el.page === currentPage).map(el => (
                    <div 
                      key={el.id} 
                      className={`flex items-center justify-between p-2 rounded border text-xs cursor-pointer ${
                        selectedElId === el.id 
                          ? 'border-brand-500/30 bg-brand-500/10 text-white' 
                          : 'border-white/5 bg-dark-950/40 text-dark-300 hover:text-white'
                      }`}
                      onClick={() => setSelectedElId(el.id)}
                    >
                      <span className="capitalize truncate max-w-[100px]">
                        {el.type === 'shape' ? `${el.shapeType}` : `${el.type}: ${el.text || 'embedded'}`}
                      </span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeElement(el.id); }}
                        className="p-0.5 rounded text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RENDERING CANVAS VIEWPORT AREA */}
          <div className="lg:col-span-3 flex flex-col items-center justify-start bg-dark-900/30 p-6 rounded-2xl border border-white/5 relative min-h-[500px]">
            
            {/* Pagination Navigator bar */}
            <div className="sticky top-2 z-30 mb-4 flex flex-wrap items-center justify-center gap-4 bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 w-full max-w-md shadow-lg">
              <div className="flex items-center space-x-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => { scrollToPage(currentPage - 1); setSelectedElId(null); }}
                  className="p-1.5 rounded-lg border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-white">
                  Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => { scrollToPage(currentPage + 1); setSelectedElId(null); }}
                  className="p-1.5 rounded-lg border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="hidden sm:block h-4 w-px bg-white/10" />

              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-slate-400">Go to page:</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInputVal}
                  onChange={(e) => setPageInputVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleGoToPage();
                    }
                  }}
                  className="w-12 px-2 py-1 bg-dark-900 border border-white/10 rounded text-xs text-white text-center font-semibold focus:outline-none focus:border-brand-500"
                />
                <button
                  onClick={handleGoToPage}
                  className="px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded text-xs font-semibold transition-colors"
                >
                  Go
                </button>
              </div>

              <div className="hidden sm:block h-4 w-px bg-white/10" />

              {/* Zoom controls */}
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setZoom(z => Math.max(0.5, parseFloat((z - 0.25).toFixed(2))))}
                  className="w-7 h-7 flex items-center justify-center rounded border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 text-sm font-bold transition-all"
                  title="Zoom out"
                >−</button>
                <button
                  onClick={() => setZoom(1)}
                  className="px-2 py-0.5 rounded border border-white/10 text-[11px] text-slate-300 hover:text-white hover:bg-white/10 font-mono transition-all min-w-[46px] text-center"
                  title="Reset zoom"
                >{Math.round(zoom * 100)}%</button>
                <button
                  onClick={() => setZoom(z => Math.min(3, parseFloat((z + 0.25).toFixed(2))))}
                  className="w-7 h-7 flex items-center justify-center rounded border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 text-sm font-bold transition-all"
                  title="Zoom in"
                >+</button>
              </div>
            </div>

            {rendering && (
              <div className="absolute inset-0 bg-dark-950/40 backdrop-blur-xs flex items-center justify-center z-40 rounded-2xl">
                <Loader2 className="w-10 h-10 animate-spin text-brand-400" />
              </div>
            )}

            {/* Bounding box containing the PDF Canvas + Overlay Interaction Div */}
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="w-full max-h-[80vh] overflow-y-auto space-y-6 flex flex-col items-center p-4 bg-dark-950/20 rounded-2xl border border-white/5 select-none"
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                const width = pageDimensions[pageNum]?.width || 500;
                const height = pageDimensions[pageNum]?.height || 700;

                return (
                  <div
                    key={pageNum}
                    id={`pdf-page-container-${pageNum}`}
                    data-page={pageNum}
                    className="relative flex-shrink-0 mb-6"
                    style={{ width: `${width * zoom}px`, height: `${height * zoom}px` }}
                  >
                    <div
                      className="absolute top-0 left-0 border border-slate-700/50 rounded-lg shadow-2xl bg-white select-none overflow-hidden"
                      style={{
                        width: `${width}px`,
                        height: `${height}px`,
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top left'
                      }}
                    >
                    <canvas 
                      ref={(el) => { canvasesRef.current[pageNum] = el; }} 
                      className="block pointer-events-none" 
                    />
                    
                    {/* Overlay listener tracking visual overlays */}
                    <div 
                      ref={(el) => { overlaysRef.current[pageNum] = el; }} 
                      onClick={(e) => handleOverlayClick(e, pageNum)}
                      className="absolute top-0 left-0 w-full h-full cursor-crosshair z-20"
                    >
                      {elements
                        .filter((el) => el.page === pageNum)
                        .map((el) => {
                          const isSelected = el.id === selectedElId;
                          
                          // Render overlay text box
                          if (el.type === 'text') {
                            return (
                              <div
                                key={el.id}
                                style={{
                                  position: 'absolute',
                                  left: `${el.x}px`,
                                  top: `${el.y}px`,
                                  color: el.color,
                                  fontSize: `${el.fontSize}px`,
                                  fontFamily: el.fontFamily,
                                  border: isSelected ? '1px dashed #8b5cf6' : '1px transparent solid',
                                  padding: '1px',
                                  cursor: 'move',
                                  userSelect: 'none',
                                  whiteSpace: 'nowrap'
                                }}
                                onMouseDown={(e) => handleElDragStart(e, el.id)}
                                onTouchStart={(e) => handleElDragStart(e, el.id)}
                              >
                                {el.text}
                                {isSelected && (
                                  <div
                                    onMouseDown={(e) => handleElResizeStart(e, el.id)}
                                    onTouchStart={(e) => handleElResizeStart(e, el.id)}
                                    className="absolute bottom-[-4px] right-[-4px] w-4 h-4 bg-violet-600 rounded-full border border-white cursor-se-resize z-30"
                                    title="Drag to resize text font size"
                                  />
                                )}
                              </div>
                            );
                          }

                          // Render overlay image or signature block
                          if (el.type === 'image' || el.type === 'signature') {
                            return (
                              <div
                                key={el.id}
                                style={{
                                  position: 'absolute',
                                  left: `${el.x}px`,
                                  top: `${el.y}px`,
                                  width: `${el.width}px`,
                                  height: `${el.height}px`,
                                  border: isSelected ? '1px dashed #8b5cf6' : '1px transparent solid',
                                  cursor: 'move'
                                }}
                                onMouseDown={(e) => handleElDragStart(e, el.id)}
                                onTouchStart={(e) => handleElDragStart(e, el.id)}
                              >
                                <img
                                  src={el.imageBuffer}
                                  alt="embedded"
                                  className="w-full h-full pointer-events-none object-contain"
                                />
                                {isSelected && (
                                  <div
                                    onMouseDown={(e) => handleElResizeStart(e, el.id)}
                                    onTouchStart={(e) => handleElResizeStart(e, el.id)}
                                    className="absolute bottom-[-4px] right-[-4px] w-4 h-4 bg-violet-600 rounded-full border border-white cursor-se-resize z-30"
                                    title="Drag to resize dimensions"
                                  />
                                )}
                              </div>
                            );
                          }

                          // Render shape overlays (rectangle, circle, line vector)
                          if (el.type === 'shape') {
                            if (el.shapeType === 'rectangle') {
                              return (
                                <div
                                  key={el.id}
                                  style={{
                                    position: 'absolute',
                                    left: `${el.x}px`,
                                    top: `${el.y}px`,
                                    width: `${el.width}px`,
                                    height: `${el.height}px`,
                                    border: `${el.thickness}px solid ${el.color}`,
                                    backgroundColor: el.fill ? el.color : 'transparent',
                                    boxSizing: 'border-box',
                                    cursor: 'move'
                                  }}
                                  onMouseDown={(e) => handleElDragStart(e, el.id)}
                                  onTouchStart={(e) => handleElDragStart(e, el.id)}
                                >
                                  {isSelected && (
                                    <div
                                      onMouseDown={(e) => handleElResizeStart(e, el.id)}
                                      onTouchStart={(e) => handleElResizeStart(e, el.id)}
                                      className="absolute bottom-[-4px] right-[-4px] w-4 h-4 bg-violet-600 rounded-full border border-white cursor-se-resize z-30"
                                      title="Drag to resize dimensions"
                                    />
                                  )}
                                </div>
                              );
                            }

                            if (el.shapeType === 'circle') {
                              return (
                                <div
                                  key={el.id}
                                  style={{
                                    position: 'absolute',
                                    left: `${el.x - el.radius}px`,
                                    top: `${el.y - el.radius}px`,
                                    width: `${el.radius * 2}px`,
                                    height: `${el.radius * 2}px`,
                                    borderRadius: '50%',
                                    border: `${el.thickness}px solid ${el.color}`,
                                    backgroundColor: el.fill ? el.color : 'transparent',
                                    boxSizing: 'border-box',
                                    cursor: 'move'
                                  }}
                                  onMouseDown={(e) => handleElDragStart(e, el.id)}
                                  onTouchStart={(e) => handleElDragStart(e, el.id)}
                                >
                                  {isSelected && (
                                    <div
                                      onMouseDown={(e) => handleElResizeStart(e, el.id)}
                                      onTouchStart={(e) => handleElResizeStart(e, el.id)}
                                      className="absolute bottom-[0px] right-[0px] w-4 h-4 bg-violet-600 rounded-full border border-white cursor-se-resize z-30"
                                      title="Drag to resize radius"
                                    />
                                  )}
                                </div>
                              );
                            }

                            if (el.shapeType === 'line') {
                              const xMin = Math.min(el.x1, el.x2);
                              const yMin = Math.min(el.y1, el.y2);
                              const w = Math.abs(el.x2 - el.x1) + el.thickness * 2;
                              const h = Math.abs(el.y2 - el.y1) + el.thickness * 2;

                              return (
                                <div
                                  key={el.id}
                                  style={{
                                    position: 'absolute',
                                    left: `${xMin - el.thickness}px`,
                                    top: `${yMin - el.thickness}px`,
                                    width: `${w}px`,
                                    height: `${h}px`,
                                    border: isSelected ? '1px dashed #8b5cf6' : '1px transparent solid',
                                    cursor: 'move'
                                  }}
                                  onMouseDown={(e) => handleElDragStart(e, el.id)}
                                  onTouchStart={(e) => handleElDragStart(e, el.id)}
                                >
                                  <svg className="w-full h-full pointer-events-none">
                                    <line
                                      x1={el.x1 - xMin + el.thickness}
                                      y1={el.y1 - yMin + el.thickness}
                                      x2={el.x2 - xMin + el.thickness}
                                      y2={el.y2 - yMin + el.thickness}
                                      stroke={el.color}
                                      strokeWidth={el.thickness}
                                    />
                                  </svg>
                                  {isSelected && (
                                    <>
                                      <div
                                        onMouseDown={(e) => handleLineResizeStart(e, el.id, 'x1')}
                                        onTouchStart={(e) => handleLineResizeStart(e, el.id, 'x1')}
                                        style={{ position:'absolute', left:`${el.x1-xMin+el.thickness-8}px`, top:`${el.y1-yMin+el.thickness-8}px` }}
                                        className="w-4 h-4 bg-violet-600 rounded-full border border-white cursor-pointer z-30"
                                        title="Drag start point"
                                      />
                                      <div
                                        onMouseDown={(e) => handleLineResizeStart(e, el.id, 'x2')}
                                        onTouchStart={(e) => handleLineResizeStart(e, el.id, 'x2')}
                                        style={{ position:'absolute', left:`${el.x2-xMin+el.thickness-8}px`, top:`${el.y2-yMin+el.thickness-8}px` }}
                                        className="w-4 h-4 bg-violet-600 rounded-full border border-white cursor-pointer z-30"
                                        title="Drag end point"
                                      />
                                    </>
                                  )}
                                </div>
                              );
                            }
                          }

                          return null;
                        })}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Input controls for base64 local image picker */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/png, image/jpeg, image/jpg"
        onChange={handleImageFileSelected}
        className="hidden"
      />

      {/* Signature Draw Modal backdrop */}
      {showSigModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="glass-panel max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Draw Signature</span>
              <button onClick={() => setShowSigModal(false)} className="text-dark-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              {/* Native canvas drawing pad — no external dependency, React 19 safe */}
              <div className="border border-white/10 bg-white rounded-lg p-1 mb-4 overflow-hidden">
                <canvas
                  ref={sigCanvasRef}
                  width={400}
                  height={160}
                  style={{ width: '100%', height: '160px', display: 'block', cursor: 'crosshair', touchAction: 'none' }}
                  className="bg-white"
                  onMouseDown={sigHandleStart}
                  onMouseMove={sigHandleMove}
                  onMouseUp={sigHandleEnd}
                  onMouseLeave={sigHandleEnd}
                  onTouchStart={sigHandleStart}
                  onTouchMove={sigHandleMove}
                  onTouchEnd={sigHandleEnd}
                />
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={clearSigPad}
                  className="flex-1 py-2 text-xs font-semibold uppercase tracking-wider text-dark-300 hover:text-white border border-white/5 rounded-lg hover:bg-white/5 transition-all"
                >
                  Clear Pad
                </button>
                <button
                  onClick={handleInsertSignature}
                  disabled={sigIsEmpty}
                  className="flex-1 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-lg hover:from-brand-500 hover:to-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-brand-500/20"
                >
                  Insert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
