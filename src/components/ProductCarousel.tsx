import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ProductCarousel({
  images,
  badge,
  onIndexChange,
}: {
  images: string[];
  badge?: React.ReactNode;
  onIndexChange?: (index: number) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-t-xl bg-[#060608] text-xs text-platinum">
        No image
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-t-xl">
        <img
          src={images[0]}
          alt="Product"
          className="h-full w-full object-cover"
        />
        {badge && (
          <div className="absolute left-2 top-2 z-10">{badge}</div>
        )}
      </div>
    );
  }

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((i) => {
      const next = i === 0 ? images.length - 1 : i - 1;
      onIndexChange?.(next);
      return next;
    });
  };
  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((i) => {
      const next = i === images.length - 1 ? 0 : i + 1;
      onIndexChange?.(next);
      return next;
    });
  };

  return (
    <div className="group relative aspect-square overflow-hidden rounded-t-xl">
      {badge && <div className="absolute left-2 top-2 z-10">{badge}</div>}
      <AnimatePresence initial={false} mode="wait">
        <motion.img
          key={currentIndex}
          src={images[currentIndex]}
          alt={`Product view ${currentIndex + 1}`}
          className="h-full w-full object-cover"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </AnimatePresence>

      {/* Gradient overlay for button legibility */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <button
        onClick={goPrev}
        className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#1F1F24] bg-[#060608]/80 text-white backdrop-blur-md transition-all duration-300 ease-in-out hover:border-[#00E676]/40 hover:text-[#00E676]"
        aria-label="Previous image"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={goNext}
        className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#1F1F24] bg-[#060608]/80 text-white backdrop-blur-md transition-all duration-300 ease-in-out hover:border-[#00E676]/40 hover:text-[#00E676]"
        aria-label="Next image"
      >
        <ChevronRight size={18} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        {images.map((_, idx) => (
          <button
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(idx);
              onIndexChange?.(idx);
            }}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? 'w-5 bg-[#00E676]'
                : 'w-1.5 bg-white/40 hover:bg-white/70'
            }`}
            aria-label={`Go to image ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
