import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Lightbox({
  images,
  startIndex,
  alt,
  open,
  onClose,
}: {
  images: string[];
  startIndex?: number;
  alt: string;
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex ?? 0);

  useEffect(() => {
    if (open) setIndex(startIndex ?? 0);
  }, [open, startIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && images.length > 1)
        setIndex((i) => (i === 0 ? images.length - 1 : i - 1));
      if (e.key === 'ArrowRight' && images.length > 1)
        setIndex((i) => (i === images.length - 1 ? 0 : i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, images.length]);

  if (images.length === 0) return null;
  const current = images[index] ?? images[0];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[#1F1F24] bg-[#111114]/80 text-platinum transition-all hover:text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => (i === 0 ? images.length - 1 : i - 1));
                }}
                className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#1F1F24] bg-[#111114]/80 text-white backdrop-blur-md transition-all hover:border-[#00E676]/40 hover:text-[#00E676]"
                aria-label="Previous image"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => (i === images.length - 1 ? 0 : i + 1));
                }}
                className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#1F1F24] bg-[#111114]/80 text-white backdrop-blur-md transition-all hover:border-[#00E676]/40 hover:text-[#00E676]"
                aria-label="Next image"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          <motion.img
            key={index}
            src={current}
            alt={`${alt} — view ${index + 1}`}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative max-h-[85vh] max-w-[90vw] rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === index
                      ? 'w-5 bg-[#00E676]'
                      : 'w-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                  aria-label={`Go to image ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
