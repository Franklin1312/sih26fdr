import { useState, useEffect } from 'react';
import { Download, Maximize, Minimize, RotateCcw, RotateCw, ZoomIn, ZoomOut, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { casesApi } from '../../api/cases';
import type { DepositEvidenceResponse } from '../../types/case';
import { formatFileSize } from '../../utils/helpers';

interface DocumentViewerProps {
  document: DepositEvidenceResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: (doc: DepositEvidenceResponse) => void;
}

export function DocumentViewer({ document, isOpen, onClose, onDownload }: DocumentViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isPdf = document?.mime_type === 'application/pdf';
  const isImage = document?.mime_type?.startsWith('image/');

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.25, 3));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.25, 0.5));
  const handleRotate = (deg: number) => setRotation((rotation + deg) % 360);
  const handleReset = () => { setZoom(1); setRotation(0); };

  useEffect(() => {
    if (isOpen && !isFullscreen) {
      globalThis.document.body.style.overflow = 'hidden';
    }
    return () => { globalThis.document.body.style.overflow = 'unset'; };
  }, [isOpen, isFullscreen]);

  useEffect(() => {
    if (!isOpen || !document) return;
    let objectUrl: string | null = null;
    let active = true;
    casesApi.downloadDocument(document.id).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
    }).catch(() => setPreviewUrl(null));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPreviewUrl(null);
    };
  }, [isOpen, document?.id]);

  if (!isOpen || !document) return null;

  return (
    <Modal.Root open={isOpen} onOpenChange={onClose}>
      <Modal.Content size="full" className="h-[90vh] max-h-[90vh] flex flex-col">
        <Modal.Header showClose={!isFullscreen}>
          <div className="flex items-center justify-between w-full">
            <div className="flex-1 min-w-0">
              <Modal.Title className="truncate">{document.original_filename}</Modal.Title>
              <Modal.Description>
                {document.mime_type} • {formatFileSize(document.file_size)} • {new Date(document.created_at).toLocaleDateString()}
              </Modal.Description>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={handleZoomOut} title="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
                <span className="text-sm text-gray-600 w-16 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="sm" onClick={handleZoomIn} title="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
                {isImage && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => handleRotate(-90)} title="Rotate left"><RotateCcw className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleRotate(90)} title="Rotate right"><RotateCw className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={handleReset} title="Reset"><Minimize className="h-4 w-4" /></Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
                {onDownload && (
                  <Button variant="ghost" size="sm" onClick={() => onDownload?.(document)}><Download className="h-4 w-4" /></Button>
                )}
                {isFullscreen && (
                  <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
                )}
              </div>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body className="flex-1 overflow-auto p-4 bg-gray-100 flex items-center justify-center">
          {isPdf && (
            <div className="w-full max-w-3xl">
              <iframe
                src={previewUrl ?? undefined}
                className="w-full h-[calc(100%-80px)] min-h-[500px] border border-gray-300 rounded bg-white"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                title={document.original_filename}
              />
            </div>
          )}
          {isImage && (
            <img
              src={previewUrl ?? undefined}
              alt={document.original_filename}
              className="max-w-full max-h-[calc(100%-80px)] object-contain"
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transformOrigin: 'center center' }}
            />
          )}
          {!isPdf && !isImage && (
            <div className="text-center text-gray-500">
              <p>Preview not available for this file type</p>
              <Button variant="primary" className="mt-4" onClick={() => onDownload?.(document)}>
                <Download className="h-4 w-4 mr-2" />
                Download File
              </Button>
            </div>
          )}
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
