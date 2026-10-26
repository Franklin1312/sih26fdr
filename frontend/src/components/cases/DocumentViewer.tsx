import { useState, useEffect } from 'react';
import { Download, Maximize, Minimize, RotateCcw, RotateCw, ZoomIn, ZoomOut, X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { casesApi } from '../../api/cases';
import type { DepositEvidenceResponse } from '../../types/case';
import { formatFileSize, cn } from '../../utils/helpers';

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
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isPdf = document?.mime_type === 'application/pdf';
  const isImage = document?.mime_type?.startsWith('image/');

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = (deg: number) => setRotation((r) => (r + deg) % 360);
  const handleReset = () => { setZoom(1); setRotation(0); };

  useEffect(() => {
    if (!isOpen || !document) return;
    let objectUrl: string | null = null;
    let active = true;
    setLoading(true);
    setLoadError(null);
    setZoom(1);
    setRotation(0);

    casesApi.downloadDocument(document.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load preview');
        setPreviewUrl(null);
        setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPreviewUrl(null);
      setLoading(false);
    };
  }, [isOpen, document?.id]);

  if (!isOpen || !document) return null;

  return (
    <Modal.Root open={isOpen} onOpenChange={onClose}>
      <Modal.Content
        size="full"
        className={cn(
          'flex flex-col overflow-hidden',
          isFullscreen
            ? 'fixed inset-0 h-full max-h-none max-w-none rounded-none m-0 border-0 z-50'
            : 'h-[85vh] max-h-[85vh]'
        )}
      >
        <Modal.Header showClose={!isFullscreen}>
          <div className="flex items-center justify-between w-full pr-4">
            <div className="flex-1 min-w-0 mr-4">
              <Modal.Title className="truncate">{document.original_filename}</Modal.Title>
              <Modal.Description>
                {document.mime_type} • {formatFileSize(document.file_size)} • {new Date(document.created_at).toLocaleDateString()}
              </Modal.Description>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={handleZoomOut} title="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-gray-600 w-12 text-center font-mono">
                {Math.round(zoom * 100)}%
              </span>
              <Button variant="ghost" size="sm" onClick={handleZoomIn} title="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </Button>
              {isImage && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => handleRotate(-90)} title="Rotate left">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleRotate(90)} title="Rotate right">
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleReset} title="Reset">
                    <Minimize className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? 'Exit full screen' : 'Full screen'}
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
              {onDownload && (
                <Button variant="ghost" size="sm" onClick={() => onDownload(document)} title="Download document">
                  <Download className="h-4 w-4" />
                </Button>
              )}
              {isFullscreen && (
                <Button variant="ghost" size="sm" onClick={onClose} title="Close">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </Modal.Header>

        <Modal.Body className="flex-1 overflow-auto p-4 bg-gray-100 flex items-center justify-center min-h-[350px]">
          {loading && (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600 mb-3" />
              <p className="text-sm font-medium text-gray-700">Loading document preview...</p>
            </div>
          )}

          {!loading && loadError && (
            <div className="text-center p-8 bg-white rounded-xl border border-gray-200 shadow-sm max-w-md">
              <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-900">Preview Unavailable</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">{loadError}</p>
              {onDownload && (
                <Button variant="primary" onClick={() => onDownload(document)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download File Instead
                </Button>
              )}
            </div>
          )}

          {!loading && !loadError && isPdf && previewUrl && (
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              <iframe
                src={previewUrl}
                className="w-full h-full min-h-[500px] border border-gray-300 rounded-lg bg-white shadow-sm"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                title={document.original_filename}
              />
            </div>
          )}

          {!loading && !loadError && isImage && previewUrl && (
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              <img
                src={previewUrl}
                alt={document.original_filename}
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transformOrigin: 'center center' }}
              />
            </div>
          )}

          {!loading && !loadError && !isPdf && !isImage && (
            <div className="text-center text-gray-500 p-8 bg-white rounded-xl border border-gray-200 shadow-sm max-w-md">
              <p className="font-semibold text-gray-900 mb-1">Preview not available for this file type</p>
              <p className="text-xs text-gray-500 mb-4">{document.mime_type}</p>
              {onDownload && (
                <Button variant="primary" onClick={() => onDownload(document)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </Button>
              )}
            </div>
          )}
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
