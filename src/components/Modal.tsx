import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className={`relative my-auto flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl sm:max-h-[90vh] ${maxWidth}`}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-6 py-4">
              <h3 className="text-sm font-semibold tracking-wide text-gray-200">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-gray-500 transition-all duration-300 ease-in-out hover:bg-base hover:text-gray-200"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
