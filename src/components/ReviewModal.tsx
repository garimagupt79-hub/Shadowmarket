import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Star, X, Camera, Zap, Plus, Trash2 } from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import type { Review } from '../types';
import { Lightbox } from './Lightbox';

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const masked = name.length <= 1 ? name[0] : `${name[0]}${'*'.repeat(name.length - 1)}`;
  return `${masked}@${domain}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-platinum/30'}
        />
      ))}
    </div>
  );
}

export function ReviewModal({
  open,
  onClose,
  productId,
  orderId,
  bountyEnabled = false,
  bountyAmount = 0,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  orderId?: string;
  bountyEnabled?: boolean;
  bountyAmount?: number;
}) {
  const { reviews, submitReviewWithBounty, addReview, session, pushToast } = useMarket();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxStart, setLightboxStart] = useState(0);

  const productReviews = reviews.filter((r) => r.productId === productId);

  const openLightbox = (imgs: string[], idx: number) => {
    setLightboxImages(imgs);
    setLightboxStart(idx);
    setLightboxOpen(true);
  };

  const addUrlImage = () => {
    const url = urlInput.trim();
    if (!url) return;
    setImages((prev) => [...prev, url]);
    setUrlInput('');
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const hasImages = images.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0 || !comment.trim()) return;

    setSubmitting(true);

    if (orderId && bountyEnabled && hasImages) {
      submitReviewWithBounty(
        {
          productId,
          consumerEmail: session.email || 'anon@shadowmarket.io',
          rating,
          comment: comment.trim(),
          images,
          image: images[0],
        },
        orderId,
        bountyAmount,
      );
      pushToast('success', `Review published! ₹${bountyAmount} Image Review Bounty added to your wallet.`);
    } else {
      const result = await addReview({
        productId,
        consumerEmail: session.email || 'anon@shadowmarket.io',
        rating,
        comment: comment.trim(),
        ...(hasImages ? { images, image: images[0] } : {}),
      });
      if (!result) {
        setSubmitting(false);
        return;
      }
      pushToast('success', 'Review published!');
    }

    setRating(0);
    setHoverRating(0);
    setComment('');
    setImages([]);
    setUrlInput('');
    setSubmitting(false);
    onClose();
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
              className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#1F1F24] bg-[#111114] p-6 shadow-2xl scrollbar-thin"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-base font-semibold tracking-wide text-white">
                  Ratings & Reviews
                </h3>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1 text-platinum transition-all duration-300 hover:bg-[#060608] hover:text-white"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Incentivization banner */}
              {bountyEnabled && bountyAmount > 0 && (
                <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#00E676]/30 bg-[#00E676]/[0.06] p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#00E676]/10">
                    <Camera size={18} className="text-[#00E676]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#00E676]">
                      Attach item photos to instantly earn an extra ₹{bountyAmount} Cash Back!
                    </p>
                    <p className="mt-0.5 text-xs text-platinum/70">
                      Your bounty is deposited to your wallet immediately upon submission.
                    </p>
                  </div>
                </div>
              )}

              {/* Ledger */}
              <div className="mb-5 max-h-64 space-y-4 overflow-y-auto scrollbar-thin pr-1">
                {productReviews.length === 0 ? (
                  <p className="py-10 text-center text-sm text-platinum/60">
                    No reviews yet. Be the first to share your experience!
                  </p>
                ) : (
                  productReviews.map((r: Review) => {
                    const rImages = r.images ?? (r.image ? [r.image] : []);
                    return (
                      <div
                        key={r.id}
                        className="rounded-xl border border-[#1F1F24] bg-[#060608] p-4"
                      >
                        <div className="flex items-center justify-between">
                          <StarRow rating={r.rating} />
                          <span className="text-xs text-platinum/60">
                            {formatDate(r.timestamp)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-platinum/80">
                          {maskEmail(r.consumerEmail)}
                        </p>
                        <p className="mt-1.5 text-sm leading-relaxed text-platinum">
                          {r.comment}
                        </p>
                        {rImages.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {rImages.map((img, idx) => (
                              <button
                                key={idx}
                                onClick={() => openLightbox(rImages, idx)}
                                className="h-20 w-20 overflow-hidden rounded-xl border border-[#1F1F24] transition-opacity duration-200 hover:opacity-90 md:h-24 md:w-24"
                              >
                                <img
                                  src={img}
                                  alt={`Review photo ${idx + 1}`}
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        )}
                        {r.bountyClaimed && (
                          <span className="mt-3 inline-flex items-center gap-1 rounded-md border border-[#00E676]/30 bg-[#00E676]/10 px-2 py-0.5 text-[10px] font-bold text-[#00E676]">
                            <Zap size={11} />
                            Bounty Earned
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Submission form */}
              <form onSubmit={handleSubmit} className="space-y-5 border-t border-[#1F1F24] pt-5">
                <div>
                  <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.15em] text-platinum">
                    Your Rating
                  </p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        onMouseEnter={() => setHoverRating(n)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-0.5 transition-transform duration-150 hover:scale-110"
                        aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                      >
                        <Star
                          size={26}
                          className={
                            n <= (hoverRating || rating)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-platinum/40'
                          }
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.15em] text-platinum">
                    Your Review
                  </p>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    placeholder="Share your experience with this product..."
                    className="w-full resize-none rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-3 text-sm text-white placeholder:text-platinum/50 transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-[#00E676]"
                  />
                </div>

                {/* Multi-image upload */}
                <div>
                  <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.15em] text-platinum">
                    {bountyEnabled ? `Attach Item Photos (Earn ₹${bountyAmount} Bonus)` : 'Attach Photos (Optional)'}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addUrlImage();
                        }
                      }}
                      placeholder="Paste image URL and press Enter..."
                      className="flex-1 rounded-xl border border-[#1F1F24] bg-[#060608] px-3.5 py-2.5 text-sm text-white placeholder:text-platinum/50 transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-[#00E676]"
                    />
                    <button
                      type="button"
                      onClick={addUrlImage}
                      disabled={!urlInput.trim()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2.5 text-xs font-medium text-platinum transition-all hover:text-white disabled:opacity-40"
                    >
                      <Plus size={14} />
                      <span className="hidden sm:inline">Add</span>
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2.5 text-xs font-medium text-platinum transition-all hover:text-white">
                      <Camera size={14} />
                      <span className="hidden sm:inline">Browse</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files)}
                      />
                    </label>
                  </div>

                  {/* Removable preview thumbnails */}
                  {images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2.5">
                      {images.map((img, idx) => (
                        <div
                          key={idx}
                          className="group relative h-20 w-20 overflow-hidden rounded-xl border border-[#1F1F24] md:h-24 md:w-24"
                        >
                          <img src={img} alt={`Preview ${idx + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-lg bg-black/80 text-platinum opacity-0 transition-opacity duration-200 hover:text-red-400 group-hover:opacity-100"
                            aria-label="Remove image"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={rating === 0 || !comment.trim() || submitting}
                  className="w-full rounded-xl bg-[#00E676] px-4 py-3 text-sm font-bold text-black transition-all duration-300 ease-in-out hover:bg-[#00E676]/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting
                    ? 'Publishing...'
                    : bountyEnabled && hasImages
                      ? `Publish Review & Earn ₹${bountyAmount}`
                      : 'Publish Review'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Lightbox
        images={lightboxImages}
        startIndex={lightboxStart}
        alt="Review photo"
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
