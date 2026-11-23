import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, AlertTriangle, CheckCircle2, IndianRupee, RefreshCw, ShieldCheck, ImagePlus, ZoomIn } from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import type { Order } from '../types';

export function DisputeChatModal({
  order: orderProp,
  open,
  onClose,
  onSend,
  senderRole = 'consumer',
}: {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onSend: (text: string, images?: string[]) => void;
  senderRole?: 'consumer' | 'brand';
}) {
  const { orders } = useMarket();
  const [draft, setDraft] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const order = orderProp
    ? orders.find((o) => o.id === orderProp.id) ?? orderProp
    : null;

  useEffect(() => {
    if (open) {
      setDraft('');
      setAttachedImages([]);
    }
  }, [open, order?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [order?.disputeMessages?.length, open]);

  if (!order) return null;

  const isResolved = order.disputeStatus === 'resolved';
  const messages = order.disputeMessages ?? [];

  const statusBadge = () => {
    if (order.refunded) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#00E676]/30 bg-[#00E676]/10 px-2.5 py-1 text-[10px] font-bold text-[#00E676]">
          <IndianRupee size={11} /> REFUNDED
        </span>
      );
    }
    if (order.reshipped) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#FFB300]/30 bg-[#FFB300]/10 px-2.5 py-1 text-[10px] font-bold text-[#FFB300]">
          <RefreshCw size={11} /> RESHIPPED
        </span>
      );
    }
    if (isResolved) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#00E676]/30 bg-[#00E676]/10 px-2.5 py-1 text-[10px] font-bold text-[#00E676]">
          <CheckCircle2 size={11} /> RESOLVED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#FF3B3B]/30 bg-[#FF3B3B]/10 px-2.5 py-1 text-[10px] font-bold text-[#FF3B3B]">
        <AlertTriangle size={11} /> PENDING
      </span>
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const readers = Array.from(files).map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    });
    Promise.all(readers).then((dataUrls) => {
      setAttachedImages((prev) => [...prev, ...dataUrls]);
    });
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSend = () => {
    if ((!draft.trim() && attachedImages.length === 0) || isResolved) return;
    onSend(draft.trim() || '(Image attachment)', attachedImages.length > 0 ? attachedImages : undefined);
    setDraft('');
    setAttachedImages([]);
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  };

  const formatTime = (ts: number | string) =>
    new Date(ts).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const placeholderText = senderRole === 'consumer' ? 'Type a message to the brand...' : 'Type a message to the consumer...';

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#1F1F24] bg-zinc-900 shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#1F1F24] px-5 py-4">
                <div className="flex items-start gap-3">
                  <img
                    src={order.image}
                    alt={order.productTitle}
                    className="h-12 w-12 shrink-0 rounded-xl object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">{order.productTitle}</p>
                    <p className="text-[10px] text-platinum">
                      Order: <span className="font-mono">#{order.id.slice(-6).toUpperCase()}</span>
                    </p>
                    <div className="mt-1">{statusBadge()}</div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-platinum/60 transition-colors hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Dispute reason */}
              {order.disputeReason && (
                <div className="border-b border-[#1F1F24] px-5 py-3">
                  <div className="flex items-start gap-2 rounded-xl border border-[#FF3B3B]/20 bg-[#FF3B3B]/[0.06] p-3">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[#FF3B3B]" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#FF3B3B]">
                        Dispute Reason
                      </p>
                      <p className="mt-0.5 text-xs text-platinum">{order.disputeReason}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 space-y-3 overflow-y-auto p-5 scrollbar-thin"
                style={{ minHeight: '200px', maxHeight: '40vh' }}
              >
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-center">
                    <p className="text-xs text-platinum/60">
                      No messages yet. Start the conversation below.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSelf = msg.senderRole === senderRole;
                    const senderLabel = msg.senderName
                      ? msg.senderName
                      : msg.senderRole === 'consumer'
                        ? 'Consumer'
                        : msg.senderRole === 'admin'
                          ? 'Admin'
                          : order.brandName;
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className="flex flex-col gap-1">
                          <div
                            className={
                              isSelf
                                ? 'rounded-2xl rounded-tr-sm bg-emerald-600 p-3 text-white max-w-[80%]'
                                : 'rounded-2xl rounded-tl-sm bg-zinc-800 p-3 text-zinc-100 max-w-[80%]'
                            }
                          >
                            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide opacity-70">
                              {isSelf ? 'You' : senderLabel}
                            </p>
                            {msg.text && msg.text !== '(Image attachment)' && (
                              <p className="text-xs leading-relaxed">{msg.text}</p>
                            )}
                            {msg.images && msg.images.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {msg.images.map((img, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setLightboxImage(img)}
                                    className="group relative h-16 w-16 overflow-hidden rounded-lg border border-white/20"
                                  >
                                    <img src={img} alt={`Attachment ${idx + 1}`} className="h-full w-full object-cover" />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                                      <ZoomIn size={14} className="text-white" />
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <span
                            className={`text-[9px] text-platinum/50 ${isSelf ? 'mr-1 self-end' : 'ml-1 self-start'}`}
                          >
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Input */}
              <div className="border-t border-[#1F1F24] p-5">
                {isResolved ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-[#00E676]/20 bg-[#00E676]/[0.04] py-4 text-xs font-medium text-[#00E676]">
                    <ShieldCheck size={14} />
                    This dispute is resolved. No further messages can be sent.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Attached image previews */}
                    {attachedImages.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {attachedImages.map((img, idx) => (
                          <div key={idx} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-[#1F1F24]">
                            <img src={img} alt={`Preview ${idx + 1}`} className="h-full w-full object-cover" />
                            <button
                              onClick={() => removeImage(idx)}
                              className="absolute right-0 top-0 rounded-bl-lg bg-red-500/80 px-1 text-white transition-colors hover:bg-red-500"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center justify-center rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2.5 text-platinum transition-all hover:border-[#00E676]/40 hover:text-[#00E676]"
                        title="Attach images"
                      >
                        <ImagePlus size={16} />
                      </button>
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder={placeholderText}
                        className="flex-1 rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-[#00E676]/50"
                      />
                      <button
                        onClick={handleSend}
                        disabled={!draft.trim() && attachedImages.length === 0}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#00E676] px-4 py-2.5 text-sm font-semibold text-[#060608] transition-all hover:bg-[#00C853] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Send size={14} />
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute right-6 top-6 text-white/70 transition-colors hover:text-white"
          >
            <X size={24} />
          </button>
          <img
            src={lightboxImage}
            alt="Full preview"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
