import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/helpers';
import { Button } from './Button';

interface ModalContextValue {
  close: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

function useModalContext() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('Modal components must be used within Modal.Root');
  }
  return context;
}

interface ModalRootProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

export function ModalRoot({ open, onOpenChange, children, className }: ModalRootProps) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = originalOverflow || 'unset';
      };
    }
  }, [open, close]);

  if (!open) return null;

  return createPortal(
    <ModalContext.Provider value={{ close }}>
      <div
        className="fixed inset-0 z-50 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-[2px] animate-fade-in transition-opacity"
          onClick={close}
          aria-hidden="true"
        />
        <div
          className={cn(
            'min-h-full flex items-center justify-center p-4 relative z-10',
            className
          )}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          {children}
        </div>
      </div>
    </ModalContext.Provider>,
    document.body
  );
}

interface ModalContentProps {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
};

export function ModalContent({ children, className, size = 'md' }: ModalContentProps) {
  return (
    <div
      className={cn(
        'w-full bg-white rounded-2xl border border-gray-200 shadow-[var(--shadow-pop)] animate-slide-in',
        sizeClasses[size],
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

interface ModalHeaderProps {
  children: ReactNode;
  className?: string;
  showClose?: boolean;
}

export function ModalHeader({ children, className, showClose = true }: ModalHeaderProps) {
  const { close } = useModalContext();

  return (
    <div className={cn('flex items-center justify-between px-5 py-4 border-b border-gray-100', className)}>
      <div className="flex-1">{children}</div>
      {showClose && (
        <Button
          variant="ghost"
          size="sm"
          onClick={close}
          aria-label="Close modal"
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

interface ModalTitleProps {
  children: ReactNode;
  className?: string;
}

export function ModalTitle({ children, className }: ModalTitleProps) {
  return (
    <h2 id="modal-title" className={cn('text-lg font-semibold text-gray-900', className)}>
      {children}
    </h2>
  );
}

interface ModalDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function ModalDescription({ children, className }: ModalDescriptionProps) {
  return (
    <p className={cn('text-sm text-gray-500 mt-1', className)}>
      {children}
    </p>
  );
}

interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}

export function ModalBody({ children, className }: ModalBodyProps) {
  return (
    <div className={cn('p-4', className)}>
      {children}
    </div>
  );
}

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div className={cn('flex items-center justify-end gap-3 p-4 border-t border-gray-200', className)}>
      {children}
    </div>
  );
}

// This compound component intentionally exports a namespace object alongside its component parts.
// eslint-disable-next-line react-refresh/only-export-components
export const Modal = Object.assign(ModalRoot, {
  Root: ModalRoot,
  Content: ModalContent,
  Header: ModalHeader,
  Title: ModalTitle,
  Description: ModalDescription,
  Body: ModalBody,
  Footer: ModalFooter,
});
