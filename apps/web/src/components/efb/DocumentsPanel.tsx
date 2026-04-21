/**
 * DocumentsPanel — upload, browse and view aviation documents (PDFs).
 * PDF viewing uses PDF.js rendered into an off-screen canvas.
 * Documents are stored in S3; frontend gets pre-signed URLs from the API.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { FileText, Upload, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import { documentsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

// Required: point to bundled PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const DOC_CATEGORIES = ['MANUAL', 'CHECKLIST', 'AFM', 'MEL', 'CHARTS', 'REGULATIONS', 'TRAINING', 'MAINTENANCE', 'OTHER'];

interface Doc {
  id: string;
  title: string;
  category: string;
  version: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  aircraft?: { registration: string };
}

export function DocumentsPanel() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('');

  const fetchDocs = useCallback(() => {
    setLoading(true);
    documentsApi.list()
      .then((data: any) => setDocs(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const openDoc = async (doc: Doc) => {
    setSelectedDoc(doc);
    try {
      const { url } = await documentsApi.getDownloadUrl(doc.id);
      setPdfUrl(url);
    } catch {
      setPdfUrl(null);
    }
  };

  const closeDoc = () => { setSelectedDoc(null); setPdfUrl(null); };

  const deleteDoc = async (doc: Doc) => {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    await documentsApi.delete(doc.id);
    fetchDocs();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', file.name.replace(/\.[^.]+$/, ''));
      fd.append('category', 'OTHER');
      await documentsApi.upload(fd);
      fetchDocs();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const filtered = filterCategory
    ? docs.filter((d) => d.category === filterCategory)
    : docs;

  // ── PDF Viewer mode ──
  if (selectedDoc && pdfUrl) {
    return <PdfViewer url={pdfUrl} title={selectedDoc.title} onClose={closeDoc} />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-panel-border flex-shrink-0">
        <select
          className="flex-1 bg-panel-muted border border-panel-border rounded px-2 py-1.5 text-xs text-white"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Upload button */}
        <label className={cn(
          'flex items-center gap-1 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors',
          uploading
            ? 'bg-panel-muted text-muted-foreground'
            : 'bg-avionics-blue text-white hover:opacity-90',
        )}>
          {uploading ? <Loader size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploading ? 'Uploading…' : 'Upload'}
          <input type="file" accept=".pdf,.png,.jpg" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-4 text-center text-muted-foreground text-sm">Loading…</div>}

        {!loading && !filtered.length && (
          <div className="p-8 text-center text-muted-foreground">
            <FileText size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No documents</p>
            <p className="text-xs mt-1">Upload PDFs, charts, or manuals</p>
          </div>
        )}

        {filtered.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-2 p-2 border-b border-panel-border hover:bg-panel-muted transition-colors group cursor-pointer"
            onClick={() => openDoc(doc)}
          >
            <FileText size={16} className="text-avionics-cyan flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white truncate">{doc.title}</div>
              <div className="text-[10px] text-muted-foreground font-cockpit">
                {doc.category} v{doc.version}
                {doc.aircraft && ` • ${doc.aircraft.registration}`}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); deleteDoc(doc); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-avionics-red p-1"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PDF Viewer component ──────────────────────────────────────────────────
interface PdfViewerProps {
  url: string;
  title: string;
  onClose: () => void;
}

function PdfViewer({ url, title, onClose }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [rendering, setRendering] = useState(false);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;
    pdfjs.getDocument({ url, cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist/cmaps/', cMapPacked: true })
      .promise.then((doc) => {
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPage(1);
      }).catch(console.error);
    return () => { cancelled = true; };
  }, [url]);

  // Render current page to canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    setRendering(true);

    pdfDoc.getPage(page).then((p) => {
      if (cancelled) return;
      const viewport = p.getViewport({ scale });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      return p.render({ canvasContext: ctx, viewport }).promise;
    }).then(() => {
      if (!cancelled) setRendering(false);
    }).catch(() => { if (!cancelled) setRendering(false); });

    return () => { cancelled = true; };
  }, [pdfDoc, page, scale]);

  return (
    <div className="flex flex-col h-full bg-panel overflow-hidden">
      {/* PDF toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-panel-border flex-shrink-0">
        <button onClick={onClose} className="text-muted-foreground hover:text-white">
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs text-white flex-1 truncate">{title}</span>
        <button onClick={() => setScale((s) => Math.max(0.5, s - 0.2))} className="text-muted-foreground hover:text-white">
          <ZoomOut size={14} />
        </button>
        <span className="text-[10px] font-cockpit text-muted-foreground">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(3, s + 0.2))} className="text-muted-foreground hover:text-white">
          <ZoomIn size={14} />
        </button>
      </div>

      {/* Page navigation */}
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-1 border-b border-panel-border flex-shrink-0">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-muted-foreground hover:text-white disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[10px] font-cockpit text-muted-foreground">
            {page} / {numPages}
          </span>
          <button
            disabled={page >= numPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-muted-foreground hover:text-white disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Canvas container */}
      <div className="flex-1 overflow-auto bg-[#1a1a2e] flex justify-center p-2 pdf-canvas-container">
        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader size={24} className="animate-spin text-avionics-cyan" />
          </div>
        )}
        <canvas ref={canvasRef} className="shadow-xl" />
      </div>
    </div>
  );
}
