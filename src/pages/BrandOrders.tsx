import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Truck,
  CheckCircle2,
  Lock,
  AlertTriangle,
  Send,
  ShieldCheck,
  X,
  RefreshCw,
  Banknote,
  ChevronDown,
  CreditCard,
  Camera,
  RotateCcw,
  PackageCheck,
  ClipboardCheck,
} from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { BrandLayout } from '../components/BrandLayout';
import { EmptyState } from '../components/EmptyState';
import { InvoiceModal } from '../components/InvoiceModal';
import { PackingSlipModal } from '../components/PackingSlipModal';
import { isDisputeResolved } from '../types';
import type { Courier, Order } from '../types';

const COURIERS: Courier[] = ['BlueDart', 'Delhivery', 'DTDC', 'FedEx'];

type Tab = 'pending' | 'transit' | 'completed';

export function BrandOrders() {
  const { orders, markShipped, approveRefundFromBrand, scheduleDoorstepPickupFromBrand, verifyDoorstepQCAndRefundFromBrand, dismissDisputeFromBrand, reshipOrderFromBrand, cancelFailedDelivery, pushToast } = useMarket();
  const [tab, setTab] = useState<Tab>('pending');
  const [courierMap, setCourierMap] = useState<Record<string, Courier>>({});
  const [trackingMap, setTrackingMap] = useState<Record<string, string>>({});
  const [reshipOrder, setReshipOrder] = useState<Order | null>(null);
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [packingSlipOrder, setPackingSlipOrder] = useState<Order | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const pending = orders.filter((o) => o.trackingStatus === 'Placed' && o.status !== 'cancelled');
  const inTransit = orders.filter((o) => (o.trackingStatus === 'Dispatched' || o.status === 'cancelled') && o.trackingStatus !== 'Delivered');
  const completed = orders.filter((o) => o.trackingStatus === 'Delivered');

  const tabs: { key: Tab; label: string; icon: typeof Package; count: number }[] = [
    { key: 'pending', label: 'Pending Dispatch', icon: Package, count: pending.length },
    { key: 'transit', label: 'In Transit', icon: Truck, count: inTransit.length },
    { key: 'completed', label: 'Completed & Escrow Released', icon: CheckCircle2, count: completed.length },
  ];

  const currentList = tab === 'pending' ? pending : tab === 'transit' ? inTransit : completed;

  const handleShip = (orderId: string) => {
    const courier = courierMap[orderId] ?? 'BlueDart';
    const tracking = trackingMap[orderId]?.trim();
    if (!tracking) return;
    markShipped(orderId, courier, tracking);
    setTrackingMap((prev) => ({ ...prev, [orderId]: '' }));
  };

  const handleConfirmRefund = () => {
    if (!refundOrder) return;
    approveRefundFromBrand(refundOrder.id);
    pushToast('success', `Refund issued for Order #${refundOrder.id.slice(-6).toUpperCase()}. Funds transferred to buyer wallet.`);
    setRefundOrder(null);
  };

  const handleDismissDispute = (orderId: string) => {
    dismissDisputeFromBrand(orderId);
    pushToast('info', `Resolution proposed for Order #${orderId.slice(-6).toUpperCase()}. Buyer must confirm to release escrow.`);
  };

  return (
    <BrandLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tighter text-white">
          Order Fulfillment & Escrow Hub
        </h1>
        <p className="mt-1.5 text-sm text-platinum">
          Dispatch orders, attach tracking, and resolve disputes.
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
            <t.icon size={15} />
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

      <AnimatePresence mode="wait">
        {currentList.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-6"
          >
            <EmptyState
              icon={<Package size={28} />}
              title="No orders in this stage."
              subtitle="Orders will appear here as consumers purchase from your catalog."
            />
          </motion.div>
        ) : (
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {currentList.map((order, idx) => (
              <OrderCard
                key={order.id}
                order={order}
                idx={idx}
                tab={tab}
                courier={courierMap[order.id] ?? 'BlueDart'}
                trackingInput={trackingMap[order.id] ?? ''}
                onCourierChange={(c) => setCourierMap((prev) => ({ ...prev, [order.id]: c }))}
                onTrackingChange={(v) => setTrackingMap((prev) => ({ ...prev, [order.id]: v }))}
                onShip={() => handleShip(order.id)}
                onApproveRefund={() => setRefundOrder(order)}
                onSchedulePickup={() => { scheduleDoorstepPickupFromBrand(order.id); }}
                onVerifyQC={() => { verifyDoorstepQCAndRefundFromBrand(order.id); pushToast('success', `QC verified & refund issued for Order #${order.id.slice(-6).toUpperCase()}.`); }}
                onDismissDispute={() => handleDismissDispute(order.id)}
                onReship={() => setReshipOrder(order)}
                onRefund={() => setRefundOrder(order)}
                onCancel={() => setCancelOrder(order)}
                onInvoice={() => setInvoiceOrder(order)}
                onPackingSlip={() => setPackingSlipOrder(order)}
                expanded={expandedOrder === order.id}
                onToggleExpand={() => setExpandedOrder((prev) => (prev === order.id ? null : order.id))}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reship / Send Replacement Modal */}
      <ReshipModal
        order={reshipOrder}
        onClose={() => setReshipOrder(null)}
        onSubmit={(details) => {
          if (!reshipOrder) return;
          reshipOrderFromBrand(reshipOrder.id, details);
          pushToast('success', `Replacement dispatched for Order #${reshipOrder.id.slice(-6).toUpperCase()} via ${details.carrier}.`);
          setReshipOrder(null);
        }}
      />

      {/* Refund Confirmation Modal */}
      <RefundConfirmModal
        order={refundOrder}
        onClose={() => setRefundOrder(null)}
        onConfirm={handleConfirmRefund}
      />

      {/* Cancel Failed Delivery Modal */}
      <CancelDeliveryModal
        order={cancelOrder}
        onClose={() => setCancelOrder(null)}
        onConfirm={(reason, notes) => {
          if (!cancelOrder) return;
          cancelFailedDelivery(cancelOrder.id, reason, notes);
          pushToast('success', `Order #${cancelOrder.id.slice(-6).toUpperCase()} cancelled. ₹${(cancelOrder.priceAtPurchase ?? cancelOrder.priceInr).toLocaleString('en-IN')} refunded to buyer wallet.`);
          setCancelOrder(null);
        }}
      />

      {/* Invoice Modal */}
      <InvoiceModal
        order={invoiceOrder}
        address={null}
        open={!!invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
      />

      {/* Packing Slip Modal */}
      <PackingSlipModal
        order={packingSlipOrder}
        address={null}
        open={!!packingSlipOrder}
        onClose={() => setPackingSlipOrder(null)}
      />
    </BrandLayout>
  );
}

function OrderCard({
  order,
  idx,
  tab,
  courier,
  trackingInput,
  onCourierChange,
  onTrackingChange,
  onShip,
  onApproveRefund,
  onSchedulePickup,
  onVerifyQC,
  onDismissDispute,
  onReship,
  onCancel,
  onInvoice,
  onPackingSlip,
  expanded,
  onToggleExpand,
}: {
  order: Order;
  idx: number;
  tab: Tab;
  courier: Courier;
  trackingInput: string;
  onCourierChange: (c: Courier) => void;
  onTrackingChange: (v: string) => void;
  onShip: () => void;
  onApproveRefund: () => void;
  onSchedulePickup: () => void;
  onVerifyQC: () => void;
  onDismissDispute: () => void;
  onReship: () => void;
  onRefund: () => void;
  onCancel: () => void;
  onInvoice: () => void;
  onPackingSlip: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const maskedAddress = `****${order.consumerEmail.slice(2, 5)}@****`;
  const escrowAmount = order.priceInr;
  const isRefunded = order.settlementStatus === 'refunded';
  const isCancelled = order.status === 'cancelled' || order.disputeStatus === 'closed_cancelled';
  const isReshipped = !!order.isReshipped;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: idx * 0.05 }}
      className="overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#111114]"
    >
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start">
        {/* Product thumbnail */}
        <img
          src={order.image}
          alt={order.productTitle}
          className="h-20 w-20 shrink-0 rounded-xl object-cover"
        />

        {/* Order info */}
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{order.productTitle}</p>
              <p className="text-xs text-platinum">
                Variant: {order.size || order.selectedSize || '—'} · {order.color || order.selectedColor || '—'}
                {(order.quantity ?? 1) > 1 && (
                  <span className="ml-2 inline-flex items-center rounded-md border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                    Qty: {order.quantity}
                  </span>
                )}
              </p>
            </div>
            <span className="text-sm font-bold text-white">
              ₹{order.priceInr.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-platinum">
              Buyer: <span className="font-mono text-platinum/80">{maskedAddress}</span>
            </span>
            <span className="text-platinum">
              Order ID: <span className="font-mono text-platinum/80">{order.id}</span>
            </span>
            <span className="text-platinum">
              {new Date(order.timestamp).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {isRefunded ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#00E676]/30 bg-[#00E676]/[0.08] px-2.5 py-1 text-[11px] font-bold text-[#00E676]">
                💸 Refunded to Wallet
              </span>
            ) : isCancelled ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#FF3B3B]/30 bg-[#FF3B3B]/[0.08] px-2.5 py-1 text-[11px] font-bold text-[#FF3B3B]">
                ❌ Cancelled (Delivery Failed)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#FFB300]/20 bg-[#FFB300]/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[#FFB300]">
                <Lock size={11} />
                ₹{escrowAmount.toLocaleString('en-IN')} Held in Escrow
              </span>
            )}
            {order.courier && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#1F1F24] bg-[#060608] px-2.5 py-1 text-[11px] text-platinum">
                <Truck size={11} />
                {order.courier} · {order.trackingNumber || '—'}
              </span>
            )}
            {isReshipped && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/[0.08] px-2.5 py-1 text-[11px] font-bold text-sky-300">
                <RefreshCw size={11} />
                Replacement Dispatched
              </span>
            )}
            {tab === 'completed' && !isRefunded && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#00E676]/20 bg-[#00E676]/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[#00E676]">
                <ShieldCheck size={11} />
                Escrow Released
              </span>
            )}
          </div>
          {(['open', 'opened_under_review', 'escalated', 'replacement_dispatched', 'pickup_scheduled', 'resolution_proposed'].includes(order.disputeStatus) || order.disputeReason) && !isDisputeResolved(order.disputeStatus) && order.disputeReason && (
            <div className="mt-2 rounded-xl border border-[#FF3B3B]/20 bg-[#FF3B3B]/[0.06] p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#FF3B3B]" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-[#FF3B3B]">
                    {order.disputeStatus === 'pickup_scheduled' ? 'Doorstep Pickup Scheduled' : order.disputeStatus === 'resolution_proposed' ? 'Resolution Proposed — Awaiting Buyer' : 'Active Dispute'}
                  </p>
                  <p className="mt-0.5 text-xs text-platinum">{order.disputeReason}</p>
                  {order.returnStatus === 'pickup_scheduled' && order.returnTrackingNumber && (
                    <p className="mt-1 text-[11px] font-semibold text-amber-400">
                      Reverse Pickup AWB: {order.returnTrackingNumber}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {order.disputeStatus === 'pickup_scheduled' ? (
                    <button
                      onClick={onVerifyQC}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#00E676]/40 bg-[#00E676]/10 px-3 py-1.5 text-[11px] font-semibold text-[#00E676] transition-all hover:bg-[#00E676]/20"
                    >
                      <ClipboardCheck size={12} />
                      Verify QC & Issue Refund
                    </button>
                  ) : order.disputeStatus === 'resolution_proposed' ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold text-amber-400">
                      <ShieldCheck size={12} />
                      Awaiting Buyer Confirmation
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={onSchedulePickup}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold text-amber-400 transition-all hover:bg-amber-400/20"
                      >
                        <PackageCheck size={12} />
                        Schedule Doorstep QC Pickup
                      </button>
                      <button
                        onClick={onApproveRefund}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#00E676]/40 bg-[#00E676]/10 px-3 py-1.5 text-[11px] font-semibold text-[#00E676] transition-all hover:bg-[#00E676]/20"
                      >
                        <Banknote size={12} />
                        Direct Full Refund
                      </button>
                      <button
                        onClick={onDismissDispute}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-[11px] font-semibold text-sky-300 transition-all hover:bg-sky-400/20"
                      >
                        <CheckCircle2 size={12} />
                        Propose Resolution
                      </button>
                    </>
                  )}
                </div>
              </div>
              {order.disputeStatus !== 'pickup_scheduled' && order.disputeStatus !== 'resolution_proposed' && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={onReship}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-[11px] font-semibold text-sky-300 transition-all hover:bg-sky-400/20"
                  >
                    <RefreshCw size={12} />
                    Reship / Send Replacement
                  </button>
                  <button
                    onClick={onCancel}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#FF3B3B]/40 bg-[#FF3B3B]/10 px-3 py-1.5 text-[11px] font-semibold text-[#FF3B3B] transition-all hover:bg-[#FF3B3B]/20"
                  >
                    <X size={12} />
                    Cancel (Delivery Failed)
                  </button>
                </div>
              )}
            </div>
          )}
          {isDisputeResolved(order.disputeStatus) && order.disputeReason && (
            <div className="mt-2 rounded-xl border border-[#00E676]/20 bg-[#00E676]/[0.06] p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="shrink-0 text-[#00E676]" />
                <p className="text-xs font-semibold text-[#00E676]">
                  {order.disputeStatus === 'resolved_refunded' || order.disputeStatus === 'resolved_refunded_by_admin'
                    ? 'Refunded • Escrow Cancelled'
                    : order.disputeStatus === 'resolved_reshipped'
                      ? 'Replacement Dispatched'
                      : 'Resolved • Escrow Released'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action bar for pending dispatch */}
        {tab === 'pending' && !isRefunded && !isCancelled && (
          <div className="flex flex-col gap-2 lg:w-64">
            <select
              value={courier}
              onChange={(e) => onCourierChange(e.target.value as Courier)}
              className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2 text-sm text-white outline-none focus:border-[#00E676]"
            >
              {COURIERS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              value={trackingInput}
              onChange={(e) => onTrackingChange(e.target.value)}
              placeholder="Tracking number"
              className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2 text-sm text-white outline-none focus:border-[#00E676]"
            />
            <button
              onClick={onShip}
              disabled={!trackingInput.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00E676] px-4 py-2.5 text-sm font-semibold text-[#060608] transition-all hover:bg-[#00C853] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={14} />
              Mark Shipped & Update Buyer
            </button>
            <button
              onClick={onCancel}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#FF3B3B]/40 bg-[#FF3B3B]/[0.06] px-4 py-2.5 text-sm font-semibold text-[#FF3B3B] transition-all hover:bg-[#FF3B3B]/[0.12]"
            >
              <X size={14} />
              Cancel Order (Delivery Failed)
            </button>
          </div>
        )}

        {/* Cancel action for in-transit orders */}
        {tab === 'transit' && !isRefunded && !isCancelled && (
          <div className="flex flex-col gap-2 lg:w-64">
            <button
              onClick={onCancel}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#FF3B3B]/40 bg-[#FF3B3B]/[0.06] px-4 py-2.5 text-sm font-semibold text-[#FF3B3B] transition-all hover:bg-[#FF3B3B]/[0.12]"
            >
              <X size={14} />
              Cancel Order (Delivery Failed)
            </button>
          </div>
        )}

        {/* Cancelled banner */}
        {isCancelled && order.cancelReason && (
          <div className="flex flex-col gap-2 lg:w-64">
            <div className="rounded-xl border border-[#FF3B3B]/20 bg-[#FF3B3B]/[0.06] p-3">
              <p className="text-[11px] font-semibold text-[#FF3B3B]">❌ Cancelled: {order.cancelReason}</p>
              {order.cancelNotes && order.cancelNotes.trim() && (
                <p className="mt-1.5 text-[11px] italic leading-relaxed text-platinum/80">
                  💬 “{order.cancelNotes}”
                </p>
              )}
              {order.cancelledAt && (
                <p className="mt-1 text-[10px] text-platinum/70">
                  {new Date(order.cancelledAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Invoice & Packing Slip buttons */}
        <div className="flex flex-col gap-2 lg:w-64">
          <button
            onClick={onInvoice}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-platinum/30 bg-[#060608] px-4 py-2.5 text-sm font-semibold text-platinum transition-all hover:border-platinum/60 hover:text-white"
          >
            <CreditCard size={14} />
            Invoice
          </button>
          <button
            onClick={onPackingSlip}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-platinum/30 bg-[#060608] px-4 py-2.5 text-sm font-semibold text-platinum transition-all hover:border-platinum/60 hover:text-white"
          >
            <Package size={14} />
            Packing Slip
          </button>
        </div>
      </div>

      {/* Financial & Escrow Breakdown Accordion */}
      <BrandFinancialBreakdown
        order={order}
        expanded={expanded}
        onToggle={onToggleExpand}
      />
    </motion.div>
  );
}

function BrandFinancialBreakdown({
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
  const reviewBountyClaimed = !!order.imageReviewBountyReleased && order.reviewStatus === 'uploaded';
  const reviewBountyExpired = order.reviewStatus === 'expired';

  return (
    <div className="overflow-hidden border-t border-[#1F1F24] bg-[#060608]">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left transition-colors hover:bg-[#111114]"
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
            <div className="space-y-2 px-5 py-4">
              <BrandBreakdownRow label="Item List Price" value={`₹${priceAtPurchase.toLocaleString('en-IN')}`} />
              <BrandBreakdownRow label="Platform Commission (5%)" value={`₹${platformFee.toLocaleString('en-IN')}`} />
              <BrandBreakdownRow
                label={`Catalog Bounty (${order.productBountyReleased || escrowReleased ? 'Released on Approval' : 'Locked'})`}
                value={`₹${productBounty.toLocaleString('en-IN')}`}
              />
              <BrandBreakdownRow
                label={`Image Review Bounty (15-Day Escrow: ${order.reviewStatus ?? 'pending_upload'})`}
                value={`₹${imageReviewBounty.toLocaleString('en-IN')}`}
              />
              <div className="my-1.5 border-t border-dashed border-[#1F1F24]" />
              <BrandBreakdownRow
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

function BrandBreakdownRow({
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

function ReshipModal({
  order,
  onClose,
  onSubmit,
}: {
  order: Order | null;
  onClose: () => void;
  onSubmit: (details: {
    carrier: string;
    trackingNumber: string;
    estimatedDelivery?: number;
    returnOldItemRequired?: boolean;
  }) => void;
}) {
  const [carrier, setCarrier] = useState('BlueDart');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [returnOldItemRequired, setReturnOldItemRequired] = useState(false);

  const handleSubmit = () => {
    if (!order || !trackingNumber.trim()) return;
    onSubmit({
      carrier: carrier.trim(),
      trackingNumber: trackingNumber.trim(),
      estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery).getTime() : undefined,
      returnOldItemRequired,
    });
    setTrackingNumber('');
    setEstimatedDelivery('');
    setReturnOldItemRequired(false);
  };

  return (
    <AnimatePresence>
      {order && (
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
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[#1F1F24] bg-zinc-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#1F1F24] px-5 py-4">
              <div className="flex items-center gap-2">
                <RefreshCw size={16} className="text-sky-400" />
                <h3 className="text-sm font-semibold text-white">Reship / Send Replacement</h3>
              </div>
              <button
                onClick={onClose}
                className="text-platinum/60 transition-colors hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
              <p className="mb-1 text-xs text-platinum">
                Order: <span className="font-mono text-white">#{order.id.slice(-6).toUpperCase()}</span>
              </p>
              <p className="mb-4 text-xs text-platinum">{order.productTitle}</p>

              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
                Carrier Name
              </label>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="mb-4 w-full rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400/50"
              >
                {COURIERS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
                New Tracking ID
              </label>
              <input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter new tracking number"
                className="mb-4 w-full rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400/50"
              />

              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
                Estimated Delivery Date
              </label>
              <input
                type="date"
                value={estimatedDelivery}
                onChange={(e) => setEstimatedDelivery(e.target.value)}
                className="mb-4 w-full rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400/50"
              />

              <label className="mb-4 flex cursor-pointer items-center gap-2.5 rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-3 transition-all hover:border-[#2A2A2E]">
                <input
                  type="checkbox"
                  checked={returnOldItemRequired}
                  onChange={(e) => setReturnOldItemRequired(e.target.checked)}
                  className="h-4 w-4 accent-sky-400"
                />
                <span className="text-xs text-platinum">
                  Require return of old/defective item (Reverse Pickup on Delivery)
                </span>
              </label>

              <button
                onClick={handleSubmit}
                disabled={!trackingNumber.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={14} />
                Dispatch Replacement
              </button>
              <p className="mt-3 text-center text-[10px] text-platinum/60">
                The buyer will be notified and the live tracking will reset for the replacement parcel.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RefundConfirmModal({
  order,
  onClose,
  onConfirm,
}: {
  order: Order | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!order) return null;
  const refundAmount = order.priceAtPurchase ?? order.priceInr;

  return (
    <AnimatePresence>
      {order && (
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
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[#1F1F24] bg-zinc-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#1F1F24] px-5 py-4">
              <div className="flex items-center gap-2">
                <Banknote size={16} className="text-[#00E676]" />
                <h3 className="text-sm font-semibold text-white">Confirm Refund</h3>
              </div>
              <button
                onClick={onClose}
                className="text-platinum/60 transition-colors hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
              <p className="mb-1 text-xs text-platinum">
                Order: <span className="font-mono text-white">#{order.id.slice(-6).toUpperCase()}</span>
              </p>
              <p className="mb-4 text-xs text-platinum">{order.productTitle}</p>
              <div className="mb-4 rounded-xl border border-[#00E676]/20 bg-[#00E676]/[0.06] p-4">
                <p className="text-xs text-platinum">Refund amount</p>
                <p className="mt-1 text-2xl font-bold text-[#00E676]">
                  ₹{refundAmount.toLocaleString('en-IN')}
                </p>
                <p className="mt-1 text-[11px] text-platinum/70">
                  This amount will be transferred to the buyer's wallet balance. Escrow will be unfrozen and the dispute closed.
                </p>
              </div>
              <button
                onClick={onConfirm}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00E676] px-4 py-3 text-sm font-semibold text-[#060608] transition-all hover:bg-[#00C853]"
              >
                <Banknote size={14} />
                Issue Refund to Buyer Wallet
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const CANCEL_REASONS = [
  'Customer unavailable / Contact unreachable',
  'Incorrect or incomplete address',
  'Package lost / damaged by courier partner',
  'Delivery rejected / Courier returned to origin',
  'Other logistics failure',
];

function CancelDeliveryModal({
  order,
  onClose,
  onConfirm,
}: {
  order: Order | null;
  onClose: () => void;
  onConfirm: (reason: string, notes: string) => void;
}) {
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (order) {
      setReason(CANCEL_REASONS[0]);
      setNotes('');
    }
  }, [order]);

  if (!order) return null;
  const refundAmount = order.priceAtPurchase ?? order.priceInr;

  return (
    <AnimatePresence>
      {order && (
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
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[#1F1F24] bg-zinc-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#1F1F24] px-5 py-4">
              <div className="flex items-center gap-2">
                <X size={16} className="text-[#FF3B3B]" />
                <h3 className="text-sm font-semibold text-white">Mark Delivery Failed & Refund Consumer</h3>
              </div>
              <button
                onClick={onClose}
                className="text-platinum/60 transition-colors hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
              <p className="mb-1 text-xs text-platinum">
                Order: <span className="font-mono text-white">#{order.id.slice(-6).toUpperCase()}</span>
              </p>
              <p className="mb-4 text-xs text-platinum">{order.productTitle}</p>

              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
                Cancellation Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mb-4 w-full rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF3B3B]/50"
              >
                {CANCEL_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
                Additional notes for customer support (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any extra context for support..."
                rows={3}
                className="mb-4 w-full resize-none rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2.5 text-sm text-white placeholder:text-platinum/50 outline-none focus:border-[#FF3B3B]/50"
              />

              <div className="mb-4 rounded-xl border border-[#FFB300]/30 bg-[#FFB300]/[0.08] p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#FFB300]" />
                  <p className="text-[11px] leading-relaxed text-[#FFB300]">
                    ⚠️ This action will immediately cancel the order and issue a full 100% refund (₹{refundAmount.toLocaleString('en-IN')}) to the consumer's wallet balance.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-3 text-sm font-semibold text-platinum transition-all hover:border-[#2A2A2E] hover:text-white"
                >
                  Close
                </button>
                <button
                  onClick={() => onConfirm(reason, notes.trim())}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF3B3B] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[#E03535]"
                >
                  <Banknote size={14} />
                  Confirm Cancellation & Refund Buyer
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
