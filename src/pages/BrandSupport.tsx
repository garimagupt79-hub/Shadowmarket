import { useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LifeBuoy,
  Send,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Lock,
  RefreshCw,
  IndianRupee,
  MessageSquare,
  ImagePlus,
  X,
} from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { BrandLayout } from '../components/BrandLayout';
import { EmptyState } from '../components/EmptyState';
import { isDisputeResolved } from '../types';
import type { Courier, Order } from '../types';

const COURIERS: Courier[] = ['BlueDart', 'Delhivery', 'DTDC', 'FedEx'];

const ACTIVE_DISPUTE_STATUSES = ['open', 'opened_under_review', 'escalated', 'pickup_scheduled', 'resolution_proposed', 'replacement_issued_by_admin'];

type Tab = 'pending' | 'resolved';

export function BrandSupport() {
  const {
    orders,
    addDisputeMessage,
    dismissDisputeFromBrand,
    refundOrderFromBrand,
    reshipOrderFromBrand,
    pushToast,
  } = useMarket();

  const [tab, setTab] = useState<Tab>('pending');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [reshipOpen, setReshipOpen] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [courier, setCourier] = useState<Courier>('BlueDart');
  const [trackingInput, setTrackingInput] = useState('');

  const disputedOrders = useMemo(
    () => orders.filter(
      (o) => ACTIVE_DISPUTE_STATUSES.includes(o.disputeStatus) || isDisputeResolved(o.disputeStatus),
    ),
    [orders],
  );

  const pendingOrders = disputedOrders.filter((o) => ACTIVE_DISPUTE_STATUSES.includes(o.disputeStatus));
  const resolvedOrders = disputedOrders.filter((o) => isDisputeResolved(o.disputeStatus));

  const currentList = tab === 'pending' ? pendingOrders : resolvedOrders;

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const handleSelect = (order: Order) => {
    setSelectedOrderId(order.id);
    setDraft('');
    setReshipOpen(false);
    setTrackingInput('');
  };

  const handleSend = () => {
    if (!selectedOrder || (!draft.trim() && attachedImages.length === 0)) return;
    if (isDisputeResolved(selectedOrder.disputeStatus)) return;
    addDisputeMessage(selectedOrder.id, draft.trim() || '(Image attachment)', attachedImages.length > 0 ? attachedImages : undefined);
    setDraft('');
    setAttachedImages([]);
  };

  const handleResolve = () => {
    if (!selectedOrder) return;
    // Two-key escrow: brand proposes, buyer confirms to release escrow.
    dismissDisputeFromBrand(selectedOrder.id);
    pushToast('info', 'Resolution proposed. Buyer must confirm to release escrow.');
    setTab('pending');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const readers = Array.from(files).map((file) => new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then((dataUrls) => setAttachedImages((prev) => [...prev, ...dataUrls]));
    e.target.value = '';
  };

  const handleReship = () => {
    if (!selectedOrder || !trackingInput.trim()) return;
    reshipOrderFromBrand(selectedOrder.id, { carrier: courier, trackingNumber: trackingInput.trim() });
    pushToast('success', 'Replacement dispatched. Tracking updated and buyer notified.');
    setReshipOpen(false);
    setTrackingInput('');
    setTab('resolved');
  };

  const handleFullRefund = () => {
    if (!selectedOrder) return;
    refundOrderFromBrand(selectedOrder.id);
    pushToast('success', 'Full refund issued. Escrow released to buyer.');
    setTab('resolved');
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending Disputes', count: pendingOrders.length },
    { key: 'resolved', label: 'Resolved', count: resolvedOrders.length },
  ];

  return (
    <BrandLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tighter text-white">
          Dispute & Support Inbox
        </h1>
        <p className="mt-1.5 text-sm text-platinum">
          Review buyer disputes, send messages, and resolve issues with escrow actions.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto scrollbar-thin">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
              tab === t.key
                ? 'border-[#00E676]/30 bg-[#00E676]/10 text-[#00E676]'
                : 'border-[#1F1F24] bg-[#111114] text-platinum hover:border-[#2A2A2E]'
            }`}
          >
            {t.key === 'pending' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
            {t.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                tab === t.key ? 'bg-[#00E676]/20 text-[#00E676]' : 'bg-[#060608] text-platinum'
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Thread list */}
        <div className="lg:w-80 lg:shrink-0">
          <div className="rounded-2xl border border-[#1F1F24] bg-[#111114]">
            <div className="border-b border-[#1F1F24] px-4 py-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
                {tab === 'pending' ? 'Active Disputes' : 'Resolved Threads'}
              </span>
            </div>
            {currentList.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<LifeBuoy size={24} />}
                  title={tab === 'pending' ? 'No pending disputes.' : 'No resolved disputes yet.'}
                  subtitle={tab === 'pending' ? 'Disputes raised by buyers will appear here.' : 'Resolved threads will be listed here.'}
                />
              </div>
            ) : (
              <ul className="divide-y divide-[#1F1F24]">
                {currentList.map((order, idx) => (
                  <motion.li
                    key={order.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                  >
                    <button
                      onClick={() => handleSelect(order)}
                      className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-all duration-300 hover:bg-[#060608] ${
                        selectedOrderId === order.id ? 'bg-[#060608]' : ''
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1F1F24] bg-[#060608]">
                        {ACTIVE_DISPUTE_STATUSES.includes(order.disputeStatus) ? (
                          <AlertTriangle size={15} className="text-[#FF3B3B]" />
                        ) : (
                          <CheckCircle2 size={15} className="text-[#00E676]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-white">
                          {order.productTitle}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-platinum">
                          {order.id} · ₹{order.priceInr.toLocaleString('en-IN')}
                        </p>
                        {ACTIVE_DISPUTE_STATUSES.includes(order.disputeStatus) ? (
                          <span className="mt-1 inline-block rounded-md border border-[#FF3B3B]/30 bg-[#FF3B3B]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#FF3B3B]">
                            PENDING
                          </span>
                        ) : (
                          <span className="mt-1 inline-block rounded-md border border-[#00E676]/30 bg-[#00E676]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#00E676]">
                            RESOLVED
                          </span>
                        )}
                      </div>
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Chat / detail panel */}
        <div className="flex-1">
          {!selectedOrder ? (
            <div className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-6">
              <EmptyState
                icon={<MessageSquare size={28} />}
                title="Select a dispute thread to view the conversation."
                subtitle="Choose a thread from the list to review messages and take action."
              />
            </div>
          ) : (
            <DisputeThread
              order={selectedOrder}
              draft={draft}
              setDraft={setDraft}
              onSend={handleSend}
              onResolve={handleResolve}
              onFullRefund={handleFullRefund}
              reshipOpen={reshipOpen}
              setReshipOpen={setReshipOpen}
              courier={courier}
              setCourier={setCourier}
              trackingInput={trackingInput}
              setTrackingInput={setTrackingInput}
              onReship={handleReship}
              attachedImages={attachedImages}
              setAttachedImages={setAttachedImages}
              onImageUpload={handleImageUpload}
              fileInputRef={fileInputRef}
              lightboxImage={lightboxImage}
              setLightboxImage={setLightboxImage}
            />
          )}
        </div>
      </div>
    </BrandLayout>
  );
}

function DisputeThread({
  order,
  draft,
  setDraft,
  onSend,
  onResolve,
  onFullRefund,
  reshipOpen,
  setReshipOpen,
  courier,
  setCourier,
  trackingInput,
  setTrackingInput,
  onReship,
  attachedImages,
  setAttachedImages,
  onImageUpload,
  fileInputRef,
  lightboxImage,
  setLightboxImage,
}: {
  order: Order;
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  onResolve: () => void;
  onFullRefund: () => void;
  reshipOpen: boolean;
  setReshipOpen: (v: boolean) => void;
  courier: Courier;
  setCourier: (c: Courier) => void;
  trackingInput: string;
  setTrackingInput: (v: string) => void;
  onReship: () => void;
  attachedImages: string[];
  setAttachedImages: (v: string[]) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  lightboxImage: string | null;
  setLightboxImage: (v: string | null) => void;
}) {
  const isResolved = isDisputeResolved(order.disputeStatus);
  const isProposed = order.disputeStatus === 'resolution_proposed';
  const maskedAddress = `****${order.consumerEmail.slice(2, 5)}@****`;

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#111114]"
    >
      {/* Header */}
      <div className="border-b border-[#1F1F24] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <img
              src={order.image}
              alt={order.productTitle}
              className="h-14 w-14 shrink-0 rounded-xl object-cover"
            />
            <div>
              <p className="text-sm font-semibold text-white">{order.productTitle}</p>
              <p className="text-[11px] text-platinum">
                Variant: {order.size} · {order.color}
              </p>
              <p className="mt-0.5 text-[10px] text-platinum/70">
                Buyer: <span className="font-mono">{maskedAddress}</span> · Order: {order.id}
              </p>
            </div>
          </div>
          {isResolved ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#00E676]/30 bg-[#00E676]/10 px-3 py-1.5 text-xs font-semibold text-[#00E676]">
              <CheckCircle2 size={13} />
              {order.disputeStatus === 'resolved_refunded' ? 'Refunded • Escrow Cancelled'
                : order.disputeStatus === 'resolved_reshipped' ? 'Replacement Dispatched'
                : 'Resolved • Escrow Released'}
            </span>
          ) : isProposed ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-400">
              <ShieldCheck size={13} />
              Awaiting Buyer
            </span>
          ) : (
            <button
              onClick={onResolve}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#00E676] px-4 py-2 text-xs font-semibold text-[#060608] transition-all hover:bg-[#00C853]"
            >
              <CheckCircle2 size={14} />
              Propose Resolution
            </button>
          )}
        </div>

        {/* Dispute reason */}
        {order.disputeReason && (
          <div className="mt-4 rounded-xl border border-[#FF3B3B]/20 bg-[#FF3B3B]/[0.06] p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#FF3B3B]" />
              <div>
                <p className="text-xs font-semibold text-[#FF3B3B]">Buyer's Dispute Reason</p>
                <p className="mt-0.5 text-xs text-platinum">{order.disputeReason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Escrow status */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#FFB300]/20 bg-[#FFB300]/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[#FFB300]">
            <Lock size={11} />
            ₹{order.priceInr.toLocaleString('en-IN')} {isResolved ? 'Escrow Released' : 'Held in Escrow'}
          </span>
          {order.refunded && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#00E676]/20 bg-[#00E676]/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[#00E676]">
              <IndianRupee size={11} />
              Refunded
            </span>
          )}
          {order.reshipped && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#00E676]/20 bg-[#00E676]/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[#00E676]">
              <RefreshCw size={11} />
              Reshipped
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="max-h-[40vh] space-y-3 overflow-y-auto p-5 scrollbar-thin">
        <AnimatePresence initial={false}>
          {(order.disputeMessages ?? []).map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.senderRole === 'brand' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs ${
                  msg.senderRole === 'brand'
                    ? 'bg-[#00E676]/10 text-[#00E676]'
                    : 'border border-[#1F1F24] bg-[#060608] text-platinum'
                }`}
              >
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide opacity-60">
                  {msg.senderRole === 'brand' ? 'You (Brand)' : 'Buyer'}
                </p>
                <p className="leading-relaxed">{msg.text}</p>
                {msg.images && msg.images.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.images.map((img, idx) => (
                      <button key={idx} onClick={() => setLightboxImage(img)} className="group relative h-14 w-14 overflow-hidden rounded-lg border border-white/20">
                        <img src={img} alt={`Attachment ${idx + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[9px] opacity-50">
                  {new Date(msg.timestamp).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {(!order.disputeMessages || order.disputeMessages.length === 0) && (
          <div className="flex items-center justify-center py-8 text-center">
            <p className="text-xs text-platinum/60">No messages yet. Start the conversation below.</p>
          </div>
        )}
      </div>

      {/* Action area */}
      <div className="border-t border-[#1F1F24] p-5">
        {isResolved ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-[#00E676]/20 bg-[#00E676]/[0.04] py-4 text-xs font-medium text-[#00E676]">
            <ShieldCheck size={14} />
            {order.disputeStatus === 'resolved_refunded'
              ? 'Refunded • Escrow Cancelled'
              : order.disputeStatus === 'resolved_reshipped'
                ? 'Replacement Dispatched'
                : 'Resolved • Escrow Released'}
          </div>
        ) : isProposed ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] py-4 text-xs font-medium text-amber-400">
            <ShieldCheck size={14} />
            Resolution Proposed • Awaiting Buyer Confirmation
          </div>
        ) : (
          <>
            {/* Financial actions — hidden once proposed/resolved (proposed hides via isResolved check below) */}
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => setReshipOpen(!reshipOpen)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#FFB300]/30 bg-[#FFB300]/10 px-3.5 py-2 text-xs font-semibold text-[#FFB300] transition-all hover:bg-[#FFB300]/20"
              >
                <RefreshCw size={13} />
                Reship
              </button>
              <button
                onClick={onFullRefund}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#FF3B3B]/30 bg-[#FF3B3B]/10 px-3.5 py-2 text-xs font-semibold text-[#FF3B3B] transition-all hover:bg-[#FF3B3B]/20"
              >
                <IndianRupee size={13} />
                Full Refund
              </button>
              <button
                onClick={onResolve}
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-[#00E676] px-3.5 py-2 text-xs font-semibold text-[#060608] transition-all hover:bg-[#00C853]"
              >
                <CheckCircle2 size={13} />
                Propose Resolution
              </button>
            </div>

            {/* Reship form */}
            {reshipOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-4 space-y-2 rounded-xl border border-[#FFB300]/20 bg-[#FFB300]/[0.04] p-3"
              >
                <select
                  value={courier}
                  onChange={(e) => setCourier(e.target.value as Courier)}
                  className="w-full rounded-lg border border-[#1F1F24] bg-[#060608] px-3 py-2 text-sm text-white outline-none focus:border-[#00E676]"
                >
                  {COURIERS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="New tracking number"
                  className="w-full rounded-lg border border-[#1F1F24] bg-[#060608] px-3 py-2 text-sm text-white outline-none focus:border-[#00E676]"
                />
                <button
                  onClick={onReship}
                  disabled={!trackingInput.trim()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FFB300] px-4 py-2 text-sm font-semibold text-[#060608] transition-all hover:bg-[#FFCA28] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  Confirm Reship & Release Escrow
                </button>
              </motion.div>
            )}

            {/* Message input */}
            <div className="space-y-3">
              {attachedImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachedImages.map((img, idx) => (
                    <div key={idx} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-[#1F1F24]">
                      <img src={img} alt={`Preview ${idx + 1}`} className="h-full w-full object-cover" />
                      <button onClick={() => setAttachedImages(attachedImages.filter((_, i) => i !== idx))} className="absolute right-0 top-0 rounded-bl-lg bg-red-500/80 px-1 text-white transition-colors hover:bg-red-500">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onImageUpload} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center justify-center rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2.5 text-platinum transition-all hover:border-[#00E676]/40 hover:text-[#00E676]" title="Attach images">
                  <ImagePlus size={16} />
                </button>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                  placeholder="Type a message to the buyer..."
                  className="flex-1 rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-[#00E676]"
                />
                <button
                  onClick={onSend}
                  disabled={!draft.trim() && attachedImages.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#00E676] px-4 py-2.5 text-sm font-semibold text-[#060608] transition-all hover:bg-[#00C853] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={14} />
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>

    {lightboxImage && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setLightboxImage(null)}>
        <button className="absolute right-6 top-6 text-white/70 transition-colors hover:text-white" onClick={() => setLightboxImage(null)}>
          <X size={24} />
        </button>
        <img src={lightboxImage} alt="Full preview" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      </div>
    )}
    </>
  );
}
