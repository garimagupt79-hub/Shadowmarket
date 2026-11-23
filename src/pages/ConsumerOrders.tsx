import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  ChevronRight,
  AlertTriangle,
  X,
  Send,
  Zap,
  Flame,
  MessageSquare,
  Star,
  Info,
  ShieldCheck,
  ChevronDown,
  CreditCard,
  Lock,
  Camera,
  RotateCcw,
  Quote,
  PackageCheck,
} from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { ConsumerLayout } from '../components/ConsumerLayout';
import { EmptyState } from '../components/EmptyState';
import { DisputeChatModal } from '../components/DisputeChatModal';
import { ReviewModal } from '../components/ReviewModal';
import { InvoiceModal } from '../components/InvoiceModal';
import type { Order, TrackingStatus } from '../types';

const FLOW: TrackingStatus[] = ['Placed', 'Dispatched', 'In Transit', 'Delivered'];
const STATUS_ICONS: Record<TrackingStatus, React.ReactNode> = {
  Placed: <Package size={14} />,
  Dispatched: <Clock size={14} />,
  'In Transit': <Truck size={14} />,
  Delivered: <CheckCircle2 size={14} />,
};

const DISPUTE_REASONS = [
  'Wrong Item Received',
  'Damaged Package',
  'Quality Discrepancy',
  'Missing Accessories',
  'Counterfeit Suspected',
];

export function ConsumerOrders() {
  const {
    orders,
    products,
    confirmDelivery,
    pushToast,
    pushNotification,
    openDispute,
    escalateDispute,
    addConsumerDisputeMessage,
    expireUnclaimedReview,
    simulateDoorstepQCPass,
    acceptProposedResolution,
    rejectProposedResolution,
  } = useMarket();
  const navigate = useNavigate();
  const [disputeOrder, setDisputeOrder] = useState<Order | null>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');
  const [chatOrder, setChatOrder] = useState<Order | null>(null);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const myOrders = useMemo(
    () => [...orders].sort((a, b) => b.timestamp - a.timestamp),
    [orders],
  );

  const handleConfirm = (order: Order) => {
    confirmDelivery(order.id);
    pushToast('success', 'Delivery confirmed. Your cash back remains protected during the review window.');
    pushNotification({
      type: 'order',
      title: 'Delivery Confirmed',
      description: `Your order for ${order.productTitle} entered the protected review window.`, 
      link: 'Open Wallet',
    });
  };

  const handleFileDispute = () => {
    if (!disputeOrder || !selectedReason.trim()) return;
    const combined = details.trim()
      ? `${selectedReason} — ${details.trim()}`
      : selectedReason.trim();
    openDispute(disputeOrder.id, combined);
    pushToast('success', 'Dispute filed. Escrow frozen pending resolution.');
    setDisputeOrder(null);
    setSelectedReason('');
    setDetails('');
  };

  const handleOpenDispute = (order: Order) => {
    setDisputeOrder(order);
    setSelectedReason('');
    setDetails('');
  };

  const handleSendChatMessage = (text: string, images?: string[]) => {
    if (!chatOrder) return;
    addConsumerDisputeMessage(chatOrder.id, text, images);
  };

  return (
    <ConsumerLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter text-white">My Purchases</h1>
          <p className="mt-1.5 text-sm text-platinum">
            Track packages, confirm delivery, and release escrow cash back.
          </p>
        </div>
        <button
          onClick={() => navigate('/consumer/dashboard')}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#1F1F24] bg-[#111114] px-4 py-2.5 text-xs font-medium text-platinum transition-all duration-300 hover:text-white"
        >
          Back to Searches
          <ChevronRight size={14} />
        </button>
      </div>

      {myOrders.length === 0 ? (
        <EmptyState
          icon={<Package size={28} />}
          title="No purchases yet."
          subtitle="When you buy a product, your order and tracking will appear here."
        />
      ) : (
        <>
          <div className="mb-5 overflow-hidden rounded-2xl border border-sky-400/30 bg-sky-400/[0.08] shadow-[0_12px_36px_rgba(14,165,233,0.08)]">
            <div className="flex gap-4 p-5 sm:p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-300/30 bg-sky-300/10 text-sky-300">
                <ShieldCheck size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Info size={14} className="text-sky-300" />
                  <h2 className="text-sm font-semibold text-white">Important Note on Delivery Approval &amp; Disputes</h2>
                </div>
                <p className="mt-2 max-w-4xl text-xs leading-5 text-platinum/90">
                  Approving delivery confirms that you have received and inspected your order. Once delivery is approved, the dispute thread for that order will be permanently closed and funds released to the seller. (Photo review cashback remains claimable for up to 15 days).
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
          {myOrders.map((order: Order, idx: number) => {
            const stepIdx = FLOW.indexOf(order.trackingStatus);
            const isVip = order.id.startsWith('VIP-');
            const isCancelled = order.status === 'cancelled' && order.settlementStatus === 'refunded';
            const isSettlementRefunded = order.settlementStatus === 'refunded' && !isCancelled;
            const isDisputeRefunded = order.disputeStatus === 'resolved_refunded' || order.disputeStatus === 'resolved_refunded_by_admin';
            const isRefunded = isSettlementRefunded || isDisputeRefunded || (!!order.refunded && !isCancelled);
            const isReshipped = !!order.isReshipped || !!order.reshipped;
            const isReplacementDispatched = order.disputeStatus === 'replacement_dispatched';
            const rawDispute = String(order.disputeStatus ?? order.dispute_status ?? '').toLowerCase();
            const isResolutionProposed = rawDispute === 'resolution_proposed' && order.status !== 'delivered' && order.status !== 'refunded';
            const isReplacementInTransit = (rawDispute === 'resolved_reshipped' || rawDispute === 'reshipped') && order.status !== 'delivered' && order.status !== 'refunded';
            const isDisputed = ['open', 'opened_under_review', 'escalated', 'replacement_issued_by_admin'].includes(order.disputeStatus) && !isRefunded && !isReplacementDispatched && !isResolutionProposed && !isCancelled;
            const canEscalate = isDisputed && !order.disputeEscalatedAt && !!order.disputeOpenedAt && Date.now() - order.disputeOpenedAt > 24 * 60 * 60 * 1000;
            const lastBrandMessage = [...(order.disputeMessages ?? [])].reverse().find((m) => m.senderRole === 'brand')?.text;
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className={`overflow-hidden rounded-2xl border p-5 ${
                  isCancelled
                    ? 'border-[#FF3B3B]/30 bg-[#FF3B3B]/[0.04]'
                    : isRefunded
                      ? 'border-[#00E676]/30 bg-[#00E676]/[0.04]'
                      : isResolutionProposed
                        ? 'border-amber-400/40 bg-amber-400/[0.04]'
                        : isDisputed
                          ? 'border-[#FF3B3B]/30 bg-[#FF3B3B]/[0.04]'
                          : isReshipped || isReplacementInTransit
                            ? 'border-sky-400/30 bg-sky-400/[0.04]'
                            : 'border-[#1F1F24] bg-[#111114]'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  {/* Thumbnail */}
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[#1F1F24]">
                    {order.image ? (
                      <img src={order.image} alt={order.productTitle} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#060608] text-platinum">
                        <Package size={18} />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
                            {order.brandName}
                          </p>
                          {isVip && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#00E676]/40 bg-[#00E676]/10 px-2 py-0.5 text-[9px] font-bold text-[#00E676] shadow-[0_0_12px_rgba(0,230,118,0.3)]">
                              <Zap size={9} />
                              VIP Pitch Deal
                            </span>
                          )}
                          {isCancelled && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#FF3B3B]/40 bg-[#FF3B3B]/10 px-2.5 py-0.5 text-[9px] font-bold text-[#FF3B3B]">
                              ❌ CANCELLED
                            </span>
                          )}
                          {isRefunded && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#00E676]/40 bg-[#00E676]/15 px-2.5 py-0.5 text-[9px] font-bold text-[#00E676] shadow-[0_0_12px_rgba(0,230,118,0.25)]">
                              💸 Refunded to Wallet
                            </span>
                          )}
                          {isDisputed && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#FF3B3B]/40 bg-[#FF3B3B]/10 px-2 py-0.5 text-[9px] font-bold text-[#FF3B3B]">
                              <AlertTriangle size={9} />
                              DISPUTE ACTIVE
                            </span>
                          )}
                          {isResolutionProposed && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-400">
                              <ShieldCheck size={9} />
                              RESOLUTION PROPOSED
                            </span>
                          )}
                          {isReplacementDispatched && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 text-[9px] font-bold text-sky-300">
                              <Truck size={9} />
                              REPLACEMENT DISPATCHED
                            </span>
                          )}
                        </div>
                        <h3 className="mt-0.5 text-sm font-semibold text-white">{order.productTitle}</h3>
                      </div>
                      <span className="shrink-0 rounded-lg border border-[#1F1F24] bg-[#060608] px-2 py-1 font-mono text-[10px] text-platinum">
                        #{order.id.slice(-6).toUpperCase()}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {isCancelled ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-platinum/30 bg-platinum/10 px-2.5 py-1 text-[10px] font-bold text-platinum">
                          Refunded &amp; Restocked • Escrow Cancelled
                        </span>
                      ) : isRefunded ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-platinum/30 bg-platinum/10 px-2.5 py-1 text-[10px] font-bold text-platinum">
                          Refunded &amp; Restocked • Escrow Cancelled
                        </span>
                      ) : isResolutionProposed ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 text-[10px] font-bold text-amber-400">
                          <ShieldCheck size={11} /> Resolution Proposed • Action Required
                        </span>
                      ) : isReplacementInTransit ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-400/15 px-2.5 py-1 text-[10px] font-bold text-violet-300">
                          <RotateCcw size={11} /> Reshipped • Replacement In Transit
                        </span>
                      ) : isDisputed ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF8C42]/40 bg-[#FF8C42]/15 px-2.5 py-1 text-[10px] font-bold text-[#FF8C42]">
                          <AlertTriangle size={11} /> Dispute Open • Escrow Frozen
                        </span>
                      ) : order.trackingStatus === 'Delivered' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00E676]/40 bg-[#00E676]/15 px-2.5 py-1 text-[10px] font-bold text-[#00E676]">
                          <ShieldCheck size={11} /> Delivered • Bounty Released
                        </span>
                      ) : order.trackingStatus === 'Dispatched' || String(order.status ?? '') === 'shipped' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-400/15 px-2.5 py-1 text-[10px] font-bold text-sky-300">
                          <Truck size={11} /> In Transit • Escrow Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 text-[10px] font-bold text-amber-400">
                          <Lock size={11} /> Processing • Escrow Locked
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-platinum">
                      <span className="rounded-md border border-[#1F1F24] bg-[#060608] px-2 py-0.5">Size: {order.selectedSize || order.size || '—'}</span>
                      <span className="rounded-md border border-[#1F1F24] bg-[#060608] px-2 py-0.5">Color: {order.selectedColor || order.color || '—'}</span>
                      {(order.quantity ?? 1) > 1 && (
                        <span className="rounded-md border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 font-semibold text-sky-300">
                          Qty: {order.quantity}
                        </span>
                      )}
                      <span className="rounded-md border border-[#1F1F24] bg-[#060608] px-2 py-0.5">₹{order.priceInr.toLocaleString('en-IN')}</span>
                      {!isRefunded && (
                        <span className="rounded-md border border-[#00E676]/30 bg-[#00E676]/10 px-2 py-0.5 text-[#00E676]">
                          Cashback: ₹{(order.productBounty ?? order.bountyAmount).toLocaleString('en-IN')}
                          {order.isSyndicateOrder && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-[9px] text-[#FF8C42]">
                              <Flame size={8} />
                              Wave Tier {order.syndicateTierUnlocked ?? 1}
                            </span>
                          )}
                        </span>
                      )}
                      {order.isSyndicateOrder && (order.bountyUpgradeHistory?.length ?? 0) > 0 && !isRefunded && (
                        <div className="w-full mt-1 rounded-md border border-[#FF8C42]/20 bg-[#FF8C42]/[0.06] px-2 py-1 text-[10px] text-[#FF8C42]/80 space-y-0.5">
                          {order.bountyUpgradeHistory!.map((entry, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <Flame size={8} className="shrink-0" />
                              <span>Tier {entry.tierNumber} Upgrade: +₹{entry.deltaAdded.toLocaleString('en-IN')} escrow boost</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {(order.imageReviewBounty ?? 0) > 0 && !isRefunded && (
                        <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-amber-400">
                          Photo Bounty: ₹{(order.imageReviewBounty ?? 0).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    {/* Reshipped notification header */}
                    {isReplacementInTransit && (
                      <div className="mt-3 rounded-xl border border-sky-400/30 bg-sky-400/[0.08] p-3">
                        <p className="text-xs font-semibold leading-5 text-sky-200">
                          <RotateCcw size={12} className="mr-1 inline" />
                          Brand dispatched a replacement for your disputed order. Escrow remains protected until you confirm the replacement arrived in good condition.
                        </p>
                      </div>
                    )}
                    {isReshipped && (
                      <div className="mt-3 overflow-hidden rounded-xl border border-sky-400/30 bg-sky-400/[0.08]">
                        <div className="flex items-start gap-3 p-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-300/30 bg-sky-300/10 text-sky-300">
                            <Package size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-sky-200">
                              📦 Replacement Parcel Dispatched (Tracking ID: {order.trackingNumber || '—'})
                            </p>
                            {order.carrier && (
                              <p className="mt-0.5 text-[11px] text-sky-200/80">Carrier: {order.carrier}</p>
                            )}
                            {order.estimatedDelivery && (
                              <p className="mt-0.5 text-[11px] text-sky-200/80">
                                Estimated delivery: {new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                            {order.returnOldItemRequired && (
                              <p className="mt-1.5 text-[11px] font-medium text-amber-300">
                                🔄 Doorstep Exchange: Please hand over the old item to the courier upon delivery.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cancelled order banner */}
                    {isCancelled && (
                      <div className="mt-3 space-y-2">
                        <div className="rounded-xl border border-[#FF3B3B]/30 bg-[#FF3B3B]/[0.08] p-3">
                          <div className="flex items-start gap-2">
                            <X size={14} className="mt-0.5 shrink-0 text-[#FF3B3B]" />
                            <div className="flex-1">
                              <p className="text-xs font-bold text-[#FF3B3B]">
                                ❌ Order Cancelled: {order.cancelReason}
                              </p>
                              <p className="mt-1 text-[11px] font-medium text-[#FFB300]">
                                💸 100% Refund of ₹{(order.priceAtPurchase ?? order.priceInr).toLocaleString('en-IN')} has been credited to your wallet balance.
                              </p>
                              {order.cancelledAt && (
                                <p className="mt-1 text-[10px] text-platinum/70">
                                  Cancelled on {new Date(order.cancelledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        {order.cancelNotes && order.cancelNotes.trim() && (
                          <div className="rounded-xl border border-sky-400/30 bg-sky-400/[0.06] p-3">
                            <div className="flex items-start gap-2">
                              <Quote size={14} className="mt-0.5 shrink-0 text-sky-300" />
                              <div className="flex-1">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-sky-300">
                                  💬 Note from Seller
                                </p>
                                <p className="mt-1 text-xs italic leading-relaxed text-sky-100">
                                  “{order.cancelNotes}”
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="mt-2 font-mono text-[10px] text-platinum/60">
                      Tracking: {order.trackingNumber || '—'}
                    </p>

                    {/* Progress bar */}
                    <div className="mt-4 flex items-center gap-1">
                      {FLOW.map((step, i) => (
                        <div key={step} className="flex flex-1 items-center">
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] transition-all duration-300 ${
                              i <= stepIdx
                                ? isReshipped
                                  ? 'border-sky-400 bg-sky-400/10 text-sky-300'
                                  : 'border-[#00E676] bg-[#00E676]/10 text-[#00E676]'
                                : 'border-[#1F1F24] bg-[#060608] text-platinum/40'
                            }`}
                          >
                            {STATUS_ICONS[step]}
                          </div>
                          {i < FLOW.length - 1 && (
                            <div
                              className={`h-0.5 flex-1 transition-all duration-300 ${
                                i < stepIdx
                                  ? isReshipped ? 'bg-sky-400' : 'bg-[#00E676]'
                                  : 'bg-[#1F1F24]'
                              }`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 flex justify-between text-[9px] uppercase tracking-wide text-platinum/50">
                      {FLOW.map((step) => (
                        <span key={step} className={FLOW.indexOf(order.trackingStatus) >= FLOW.indexOf(step) ? (isReshipped ? 'text-sky-300' : 'text-[#00E676]') : ''}>
                          {step}
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {isCancelled ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF3B3B]">
                          <X size={14} />
                          Order cancelled — full refund issued to wallet.
                        </span>
                      ) : isRefunded ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00E676]">
                          <CheckCircle2 size={14} />
                          ₹{(order.priceAtPurchase ?? order.priceInr).toLocaleString('en-IN')} refunded to your wallet balance.
                        </span>
                      ) : isResolutionProposed ? (
                        <div className="w-full rounded-xl border border-amber-400/30 bg-amber-400/[0.07] p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-300/30 bg-amber-300/10 text-amber-300">
                              <ShieldCheck size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-amber-300">
                                Brand Proposed a Resolution
                              </p>
                              {order.disputeReason && (
                                <p className="mt-1 text-[11px] text-platinum">
                                  Dispute: {order.disputeReason}
                                </p>
                              )}
                              {lastBrandMessage && (
                                <p className="mt-1 line-clamp-3 text-[11px] italic leading-relaxed text-platinum/80">
                                  “{lastBrandMessage}”
                                </p>
                              )}
                              <p className="mt-2 text-[11px] font-medium text-amber-300/90">
                                Review the brand's response before releasing ₹{order.priceInr.toLocaleString('en-IN')} from escrow and unlocking your ₹{(order.productBounty ?? order.bountyAmount).toLocaleString('en-IN')} bounty.
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  onClick={() => { acceptProposedResolution(order.id); pushToast('success', 'Resolution accepted. Escrow released.'); }}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#00E676] px-3.5 py-2 text-xs font-semibold text-[#060608] transition-all duration-300 hover:bg-[#00C853]"
                                >
                                  <CheckCircle2 size={13} />
                                  Accept Resolution &amp; Release Escrow
                                </button>
                                <button
                                  onClick={() => { rejectProposedResolution(order.id); pushToast('info', 'Resolution rejected. Dispute remains open.'); }}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#FF3B3B]/40 bg-[#FF3B3B]/10 px-3.5 py-2 text-xs font-semibold text-[#FF3B3B] transition-all duration-300 hover:bg-[#FF3B3B]/20"
                                >
                                  <AlertTriangle size={13} />
                                  Reject — Keep Dispute Open
                                </button>
                                <button
                                  onClick={() => setChatOrder(order)}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#1F1F24] bg-[#060608] px-3.5 py-2 text-xs font-semibold text-platinum transition-all duration-300 hover:text-white"
                                >
                                  <MessageSquare size={13} />
                                  View Dispute Thread
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : isReplacementInTransit ? (
                        <div className="flex flex-col items-start gap-1.5">
                          <button
                            onClick={() => handleConfirm(order)}
                            className="inline-flex items-center gap-2 rounded-xl border border-sky-400/40 bg-sky-400/10 px-4 py-2.5 text-xs font-semibold text-sky-300 transition-all duration-300 hover:bg-sky-400/20"
                          >
                            <RotateCcw size={14} />
                            Confirm Replacement Received
                          </button>
                        </div>
                      ) : isReplacementDispatched ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300">
                          <Truck size={14} />
                          Replacement on the way — track progress above.
                        </span>
                      ) : order.trackingStatus === 'Delivered' && !isDisputed ? (
                        <div className="flex flex-col gap-1.5">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00E676]">
                            <ShieldCheck size={14} />
                            ₹{(order.productBounty ?? order.bountyAmount).toLocaleString('en-IN')} cashback released
                          </span>
                          {(order.imageReviewBounty ?? 0) > 0 && !order.imageReviewBountyReleased && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                              <Clock size={14} />
                              ₹{(order.imageReviewBounty ?? 0).toLocaleString('en-IN')} photo bounty locked — review to claim
                            </span>
                          )}
                          {order.imageReviewBountyReleased && (order.imageReviewBounty ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00E676]">
                              <ShieldCheck size={14} />
                              ₹{(order.imageReviewBounty ?? 0).toLocaleString('en-IN')} photo bounty released
                            </span>
                          )}
                        </div>
                      ) : isDisputed ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF3B3B]">
                            <AlertTriangle size={14} />
                            Dispute Active: Funds frozen in secure escrow during platform review.
                          </span>
                          {order.returnStatus === 'pickup_scheduled' && order.returnTrackingNumber && (
                            <div className="w-full mt-2 overflow-hidden rounded-xl border border-amber-400/30 bg-amber-400/[0.08]">
                              <div className="flex items-start gap-3 p-4">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-300/30 bg-amber-300/10 text-amber-300">
                                  <PackageCheck size={16} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-amber-200">
                                    Doorstep Pickup Scheduled — AWB: {order.returnTrackingNumber}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-amber-200/80">
                                    Courier agent will verify variant ({order.selectedSize || order.size} • {order.selectedColor || order.color}) at your doorstep. Refund releases automatically upon QC pass.
                                  </p>
                                  <button
                                    onClick={() => { simulateDoorstepQCPass(order.id); pushToast('success', 'Doorstep QC passed! Refund released instantly.'); }}
                                    className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-[#00E676]/40 bg-[#00E676]/10 px-3.5 py-2 text-xs font-semibold text-[#00E676] transition-all duration-300 hover:bg-[#00E676]/20"
                                  >
                                    <CheckCircle2 size={13} />
                                    Simulate Courier Doorstep Handover (QC Pass)
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          {order.disputeStatus === 'resolution_proposed' && (
                            <div className="w-full mt-2 flex flex-wrap gap-2">
                              <button
                                onClick={() => { acceptProposedResolution(order.id); pushToast('success', 'Resolution accepted. Escrow released.'); }}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[#00E676]/40 bg-[#00E676]/10 px-3.5 py-2.5 text-xs font-semibold text-[#00E676] transition-all duration-300 hover:bg-[#00E676]/20"
                              >
                                <ShieldCheck size={13} />
                                Accept Resolution & Release Escrow
                              </button>
                              <button
                                onClick={() => { rejectProposedResolution(order.id); pushToast('info', 'Resolution rejected. Dispute remains open.'); }}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[#FF3B3B]/40 bg-[#FF3B3B]/10 px-3.5 py-2.5 text-xs font-semibold text-[#FF3B3B] transition-all duration-300 hover:bg-[#FF3B3B]/20"
                              >
                                <AlertTriangle size={13} />
                                Reject — Still Unresolved
                              </button>
                            </div>
                          )}
                          <button
                            onClick={() => setChatOrder(order)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#00E676]/40 bg-[#00E676]/10 px-3.5 py-2.5 text-xs font-semibold text-[#00E676] transition-all duration-300 hover:bg-[#00E676]/20"
                          >
                            <MessageSquare size={13} />
                            View Dispute Thread
                          </button>
                          {canEscalate && (
                            <button
                              onClick={() => { escalateDispute(order.id); pushToast('success', 'Dispute escalated to Platform Support.'); }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3.5 py-2.5 text-xs font-semibold text-amber-400 transition-all duration-300 hover:bg-amber-400/20"
                            >
                              <AlertTriangle size={13} />
                              Escalate to Platform Support
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-start gap-1.5">
                          <button
                            onClick={() => handleConfirm(order)}
                            className="inline-flex items-center gap-2 rounded-xl border border-[#00E676]/40 bg-[#00E676]/10 px-4 py-2.5 text-xs font-semibold text-[#00E676] shadow-[0_0_20px_rgba(0,230,118,0.15)] transition-all duration-300 ease-in-out hover:bg-[#00E676]/20"
                          >
                            <Truck size={14} />
                            Confirm Package Received
                          </button>
                          <p className="inline-flex items-center gap-1 text-[10px] leading-4 text-amber-400/80">
                            <AlertTriangle size={11} />
                            Confirming delivery will permanently close the dispute thread for this order.
                          </p>
                        </div>
                      )}
                      {!isDisputed && !isResolutionProposed && !isCancelled && order.trackingStatus !== 'Delivered' && (
                        <button
                          onClick={() => handleOpenDispute(order)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#FF3B3B]/30 bg-[#FF3B3B]/10 px-3.5 py-2.5 text-xs font-semibold text-[#FF3B3B] transition-all duration-300 hover:bg-[#FF3B3B]/20"
                        >
                          <AlertTriangle size={13} />
                          {isReplacementInTransit ? 'Issue with Replacement?' : 'Report Issue'}
                        </button>
                      )}
                      {order.trackingStatus === 'Delivered' && !isDisputed && !isRefunded && !isCancelled && !order.reviewBountyClaimed && (
                        <button
                          onClick={() => setReviewOrder(order)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-xs font-semibold text-amber-400 transition-all duration-300 hover:bg-amber-400/20"
                        >
                          <Star size={13} />
                          Write a Review
                        </button>
                      )}
                      {order.trackingStatus === 'Delivered' && !isDisputed && !isRefunded && !isCancelled && (order.imageReviewBounty ?? 0) > 0 && !order.imageReviewBountyReleased && order.reviewStatus !== 'expired' && (
                        <button
                          onClick={() => {
                            expireUnclaimedReview(order.id);
                            pushToast('info', '15-day photo review window expired. Image bounty refunded to brand.');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3.5 py-2.5 text-xs font-semibold text-sky-300 transition-all duration-300 hover:bg-sky-400/20"
                        >
                          <Clock size={13} />
                          Simulate 15-Day Expiry
                        </button>
                      )}
                      {order.imageReviewBountyReleased && (order.imageReviewBounty ?? 0) > 0 && order.reviewStatus !== 'expired' && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-platinum/60">
                          <CheckCircle2 size={13} />
                          Review Submitted
                        </span>
                      )}
                      <button
                        onClick={() => setInvoiceOrder(order)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-platinum/30 bg-[#111114] px-3.5 py-2.5 text-xs font-semibold text-platinum transition-all duration-300 hover:border-platinum/60 hover:text-white"
                      >
                        <CreditCard size={13} />
                        View & Print Tax Invoice
                      </button>
                    </div>

                    {/* Financial & Escrow Breakdown Accordion */}
                    <FinancialBreakdown
                      order={order}
                      expanded={expandedOrder === order.id}
                      onToggle={() => setExpandedOrder((prev) => (prev === order.id ? null : order.id))}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
          </div>
        </>
      )}

      {/* Dispute Modal */}
      <AnimatePresence>
        {disputeOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setDisputeOrder(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#1F1F24] bg-zinc-900 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#1F1F24] px-5 py-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-[#FF3B3B]" />
                  <h3 className="text-sm font-semibold text-white">Report an Issue</h3>
                </div>
                <button
                  onClick={() => setDisputeOrder(null)}
                  className="text-platinum/60 transition-colors hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-5">
                <p className="mb-1 text-xs text-platinum">
                  Order: <span className="font-mono text-white">#{disputeOrder.id.slice(-6).toUpperCase()}</span>
                </p>
                <p className="mb-4 text-xs text-platinum">{disputeOrder.productTitle}</p>
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
                  Reason for Dispute
                </label>
                <div className="mb-4 space-y-2">
                  {DISPUTE_REASONS.map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setSelectedReason(reason)}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-all ${
                        selectedReason === reason
                          ? 'border-[#FF3B3B]/40 bg-[#FF3B3B]/10 text-[#FF3B3B]'
                          : 'border-[#1F1F24] bg-[#060608] text-platinum hover:border-[#2A2A2E]'
                      }`}
                    >
                      <AlertTriangle size={12} className={selectedReason === reason ? 'text-[#FF3B3B]' : 'text-platinum/50'} />
                      {reason}
                    </button>
                  ))}
                </div>
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
                  Additional Details (optional)
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Describe the issue..."
                  rows={3}
                  className="mb-4 w-full resize-none rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-[#FF3B3B]/50"
                />
                <button
                  onClick={handleFileDispute}
                  disabled={!selectedReason.trim()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF3B3B] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[#E03535] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={14} />
                  Submit Dispute
                </button>
                <p className="mt-3 text-center text-[10px] text-platinum/60">
                  Filing a dispute freezes the escrow until the brand resolves it.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <DisputeChatModal
        order={chatOrder}
        open={!!chatOrder}
        onClose={() => setChatOrder(null)}
        onSend={handleSendChatMessage}
        senderRole="consumer"
      />

      <InvoiceModal
        order={invoiceOrder}
        address={null}
        open={!!invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
      />

      <ReviewModal
        open={!!reviewOrder}
        onClose={() => setReviewOrder(null)}
        productId={reviewOrder?.productId ?? ''}
        orderId={reviewOrder?.id}
        bountyEnabled={
          !!reviewOrder &&
          !!products.find((p) => p.id === reviewOrder.productId)?.imageReviewBountyEnabled
        }
        bountyAmount={
          products.find((p) => p.id === reviewOrder?.productId)?.imageReviewBountyAmount ?? 0
        }
      />
    </ConsumerLayout>
  );
}

function FinancialBreakdown({
  order,
  expanded,
  onToggle,
}: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
}) {
  const priceAtPurchase = order.priceAtPurchase ?? order.priceInr;
  const platformFee = order.platformFee ?? Math.round(priceAtPurchase * 0.05);
  const productBounty = order.productBounty ?? order.bountyAmount;
  const imageReviewBounty = order.imageReviewBounty ?? 0;
  const brandNet = order.brandNetPayout ?? Math.max(0, priceAtPurchase - platformFee - productBounty - imageReviewBounty);
  const escrowReleased = order.escrowStatus === 'released' || !!order.brandPayoutReleased;
  const isCancelled = order.status === 'cancelled';
  const isRefunded = order.settlementStatus === 'refunded' || !!order.refunded;
  const reviewBountyClaimed = !!order.imageReviewBountyReleased;
  const reviewBountyExpired = order.reviewStatus === 'expired';

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[#1F1F24] bg-[#060608]">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[#111114]"
      >
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-platinum">
          <CreditCard size={13} className="text-[#00E676]" />
          View Financial &amp; Escrow Breakdown
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-platinum transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-[#1F1F24] px-4 py-4">
              <BreakdownRow label="Item List Price" value={`₹${priceAtPurchase.toLocaleString('en-IN')}`} />
              <BreakdownRow label="Platform Commission (5%)" value={`₹${platformFee.toLocaleString('en-IN')}`} />
              <BreakdownRow
                label={`Catalog Bounty (${order.productBountyReleased || escrowReleased ? 'Released on Approval' : 'Locked'})`}
                value={`₹${productBounty.toLocaleString('en-IN')}`}
              />
              <BreakdownRow
                label={`Image Review Bounty (15-Day Escrow: ${order.reviewStatus ?? 'pending_upload'})`}
                value={`₹${imageReviewBounty.toLocaleString('en-IN')}`}
              />
              <div className="my-1.5 border-t border-dashed border-[#1F1F24]" />
              <BreakdownRow
                label="Brand Net Settlement"
                value={`₹${brandNet.toLocaleString('en-IN')}`}
                highlight
              />

              {/* Escrow status badges */}
              <div className="mt-3 flex flex-wrap gap-2">
                {isCancelled || isRefunded ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF3B3B]/40 bg-[#FF3B3B]/10 px-2.5 py-1 text-[10px] font-bold text-[#FF3B3B]">
                    <RotateCcw size={10} />
                    Escrow Refunded to Consumer
                  </span>
                ) : escrowReleased ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00E676]/40 bg-[#00E676]/10 px-2.5 py-1 text-[10px] font-bold text-[#00E676]">
                    🟢 Released to Brand
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-400">
                    <Lock size={10} />
                    🔒 Locked until 7-day dispute window / approval
                  </span>
                )}
                {imageReviewBounty > 0 && (
                  <>
                    {reviewBountyClaimed ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00E676]/40 bg-[#00E676]/10 px-2.5 py-1 text-[10px] font-bold text-[#00E676]">
                        🟢 Claimed
                      </span>
                    ) : reviewBountyExpired ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 text-[10px] font-bold text-sky-300">
                        ↩️ Refunded to Brand
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-400">
                        <Camera size={10} />
                        📸 Locked in 15-day review escrow
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-platinum">{label}</span>
      <span
        className={`font-mono text-xs font-semibold ${highlight ? 'text-[#00E676]' : 'text-white'}`}
      >
        {value}
      </span>
    </div>
  );
}
