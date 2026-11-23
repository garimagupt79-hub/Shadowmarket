import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Gavel,
  Building2,
  TrendingUp,
  Lock,
  Zap,
  IndianRupee,
  AlertTriangle,
  X,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ArrowRight,
  Package,
} from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { AdminLayout } from '../components/AdminLayout';
import { DisputeChatModal } from '../components/DisputeChatModal';
import type { AdminDisputeDecision, Order, BrandStatus } from '../types';

type Tab = 'overview' | 'disputes' | 'brands';

export function AdminPortal() {
  const {
    orders,
    products,
    brandRecords,
    consumerWallet,
    brandWallet,
    walletTransactions,
    adminForceRefund,
    adminForceRelease,
    resolveDisputeByAdmin,
    setBrandStatus,
    addConsumerDisputeMessage,
    pushToast,
  } = useMarket();

  const [tab, setTab] = useState<Tab>('overview');
  const [inspectorOrder, setInspectorOrder] = useState<Order | null>(null);
  const [chatOrder, setChatOrder] = useState<Order | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  // Aggregated metrics
  const metrics = useMemo(() => {
    const totalGMV = orders.reduce((sum, o) => sum + o.priceInr, 0);
    const activeEscrow = orders
      .filter((o) => o.escrowFrozen || o.trackingStatus !== 'Delivered')
      .reduce((sum, o) => sum + o.bountyAmount, 0);
    const totalBounties = orders
      .filter((o) => o.trackingStatus === 'Delivered')
      .reduce((sum, o) => sum + o.bountyAmount, 0);
    const platformRevenue = orders.reduce((sum, o) => sum + Math.round(o.priceInr * 0.03), 0);
    return { totalGMV, activeEscrow, totalBounties, platformRevenue };
  }, [orders]);

  const disputedOrders = useMemo(
    () => orders.filter((o) => ['open', 'opened_under_review', 'escalated', 'replacement_issued_by_admin'].includes(o.disputeStatus)),
    [orders],
  );

  const handleSendChatMessage = (text: string, images?: string[]) => {
    if (!chatOrder) return;
    addConsumerDisputeMessage(chatOrder.id, text, images);
  };

  const handleForceRefund = (orderId: string) => {
    adminForceRefund(orderId);
    pushToast('success', 'Force refund executed. Buyer wallet credited.');
    setInspectorOrder(null);
  };

  const handleForceRelease = (orderId: string) => {
    adminForceRelease(orderId);
    pushToast('success', 'Force release executed. Brand wallet credited.');
    setInspectorOrder(null);
  };

  const handleAdminDecision = (orderId: string, decision: AdminDisputeDecision) => {
    resolveDisputeByAdmin(orderId, decision, adminNotes.trim() || 'Decision recorded by Platform Support.');
    pushToast('success', decision === 'force_refund' ? 'Refund approved and buyer wallet credited.' : decision === 'force_replacement' ? 'Replacement approved and return instructions issued.' : 'Dispute rejected and escrow settled for the brand.');
    setAdminNotes('');
    setInspectorOrder(null);
  };

  const handleSetStatus = (brandId: string, status: BrandStatus) => {
    setBrandStatus(brandId, status);
    pushToast('success', `Brand status updated to ${status.toUpperCase()}.`);
  };

  const statusIcon = (status: BrandStatus) => {
    if (status === 'verified') return <ShieldCheck size={14} className="text-[#00E676]" />;
    if (status === 'pending') return <ShieldAlert size={14} className="text-[#FFB300]" />;
    return <ShieldX size={14} className="text-[#FF3B3B]" />;
  };

  const statusColor = (status: BrandStatus) => {
    if (status === 'verified') return 'text-[#00E676] bg-[#00E676]/10 border-[#00E676]/30';
    if (status === 'pending') return 'text-[#FFB300] bg-[#FFB300]/10 border-[#FFB300]/30';
    return 'text-[#FF3B3B] bg-[#FF3B3B]/10 border-[#FF3B3B]/30';
  };

  const tabs: { key: Tab; label: string; icon: typeof BarChart3; count?: number }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'disputes', label: 'Active Disputes & Support', icon: Gavel, count: disputedOrders.length },
    { key: 'brands', label: 'Brands & Inventory', icon: Building2, count: brandRecords.length },
  ];

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tighter text-white">Platform Control Center</h1>
        <p className="mt-1.5 text-sm text-platinum">
          Real-time oversight of GMV, escrow, disputes, and brand compliance.
        </p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-2 overflow-x-auto scrollbar-thin">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
              tab === t.key
                ? 'border-amber-400/30 bg-amber-400/10 text-amber-400'
                : 'border-[#1F1F24] bg-[#111114] text-platinum hover:border-[#2A2A2E]'
            }`}
          >
            <t.icon size={15} />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                icon={<TrendingUp size={18} />}
                label="Total Platform GMV"
                value={`₹${metrics.totalGMV.toLocaleString('en-IN')}`}
                accent="emerald"
              />
              <MetricCard
                icon={<Lock size={18} />}
                label="Active Escrow Balance"
                value={`₹${metrics.activeEscrow.toLocaleString('en-IN')}`}
                accent="amber"
              />
              <MetricCard
                icon={<Zap size={18} />}
                label="VIP Cash Back Distributed"
                value={`₹${metrics.totalBounties.toLocaleString('en-IN')}`}
                accent="emerald"
              />
              <MetricCard
                icon={<IndianRupee size={18} />}
                label="Platform Revenue (3% Fee)"
                value={`₹${metrics.platformRevenue.toLocaleString('en-IN')}`}
                accent="emerald"
              />
            </div>

            {/* Wallet snapshot */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-platinum">Consumer Wallet Snapshot</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-platinum">Withdrawable Balance</span>
                    <span className="font-bold text-[#00E676]">₹{consumerWallet.withdrawable.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-platinum">Locked Escrow</span>
                    <span className="font-bold text-[#FFB300]">₹{consumerWallet.lockedEscrow.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-platinum">Brand Wallet Snapshot</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-platinum">Global Bounty Budget</span>
                    <span className="font-bold text-white">₹{brandWallet.globalBudget.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent transactions */}
            <div className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-platinum">Recent Wallet Transactions</p>
              {walletTransactions.length === 0 ? (
                <p className="py-6 text-center text-xs text-platinum/60">No transactions yet.</p>
              ) : (
                <div className="space-y-2">
                  {walletTransactions.slice(0, 10).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-white">{tx.description}</p>
                        <p className="text-[10px] text-platinum/60">
                          {new Date(tx.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-[#00E676]">+₹{tx.amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* DISPUTES TAB */}
        {tab === 'disputes' && (
          <motion.div
            key="disputes"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {disputedOrders.length === 0 ? (
              <div className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-8 text-center">
                <CheckCircle2 size={28} className="mx-auto mb-3 text-[#00E676]" />
                <p className="text-sm font-semibold text-white">No active disputes.</p>
                <p className="mt-1 text-xs text-platinum">All clear — no orders require arbitration.</p>
              </div>
            ) : (
              disputedOrders.map((order, idx) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  className="rounded-2xl border border-[#FF3B3B]/20 bg-[#FF3B3B]/[0.03] p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[#1F1F24]">
                      {order.image ? (
                        <img src={order.image} alt={order.productTitle} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#060608] text-platinum">
                          <Package size={16} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">{order.brandName}</p>
                          <h3 className="mt-0.5 text-sm font-semibold text-white">{order.productTitle}</h3>
                        </div>
                        <span className="shrink-0 rounded-lg border border-[#1F1F24] bg-[#060608] px-2 py-1 font-mono text-[10px] text-platinum">
                          #{order.id.slice(-6).toUpperCase()}
                        </span>
                      </div>
                      {order.disputeReason && (
                        <div className="mt-2 rounded-lg border border-[#FF3B3B]/20 bg-[#FF3B3B]/[0.06] p-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#FF3B3B]">Dispute Reason</p>
                          <p className="mt-0.5 text-xs text-platinum">{order.disputeReason}</p>
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-platinum">
                        <span className="rounded-md border border-[#1F1F24] bg-[#060608] px-2 py-0.5">Buyer: {order.consumerEmail}</span>
                        <span className="rounded-md border border-[#1F1F24] bg-[#060608] px-2 py-0.5">₹{order.priceInr.toLocaleString('en-IN')}</span>
                        <span className="rounded-md border border-[#FF3B3B]/30 bg-[#FF3B3B]/10 px-2 py-0.5 text-[#FF3B3B]">Escrow: ₹{order.bountyAmount.toLocaleString('en-IN')}</span>
                        <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-amber-400">Status: {order.disputeStatus.replaceAll('_', ' ')}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => { setInspectorOrder(order); setAdminNotes(order.adminNotes ?? ''); }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2 text-xs font-semibold text-amber-400 transition-all hover:bg-amber-400/20"
                        >
                          <Gavel size={13} />
                          Open Inspector
                        </button>
                        <button
                          onClick={() => setChatOrder(order)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#00E676]/30 bg-[#00E676]/10 px-3.5 py-2 text-xs font-semibold text-[#00E676] transition-all hover:bg-[#00E676]/20"
                        >
                          <ArrowRight size={13} />
                          View Chat Thread
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* BRANDS TAB */}
        {tab === 'brands' && (
          <motion.div
            key="brands"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {brandRecords.map((brand, idx) => {
              const brandProducts = products.filter((p) => p.brandName === brand.brandName);
              return (
                <motion.div
                  key={brand.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#1F1F24] bg-[#060608]">
                        <Building2 size={20} className="text-platinum" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white">{brand.brandName}</h3>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${statusColor(brand.status)}`}>
                            {statusIcon(brand.status)}
                            {brand.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-platinum/70">{brandProducts.length} live products</p>
                      </div>
                    </div>

                    {/* Status toggle */}
                    <div className="flex gap-1.5">
                      {(['verified', 'pending', 'suspended'] as BrandStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSetStatus(brand.id, s)}
                          className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase transition-all ${
                            brand.status === s
                              ? statusColor(s)
                              : 'border-[#1F1F24] bg-[#060608] text-platinum/60 hover:text-white'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Performance stats */}
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-[#1F1F24] bg-[#060608] p-3 text-center">
                      <p className="text-[9px] font-medium uppercase tracking-wide text-platinum/60">Total Sales</p>
                      <p className="mt-1 text-sm font-bold text-white">₹{brand.totalSales.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="rounded-xl border border-[#1F1F24] bg-[#060608] p-3 text-center">
                      <p className="text-[9px] font-medium uppercase tracking-wide text-platinum/60">Active Pitches</p>
                      <p className="mt-1 text-sm font-bold text-white">{brand.activePitches}</p>
                    </div>
                    <div className="rounded-xl border border-[#1F1F24] bg-[#060608] p-3 text-center">
                      <p className="text-[9px] font-medium uppercase tracking-wide text-platinum/60">Bounties Offered</p>
                      <p className="mt-1 text-sm font-bold text-[#00E676]">₹{brand.totalBounties.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dispute Inspector Modal */}
      <AnimatePresence>
        {inspectorOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setInspectorOrder(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-400/20 bg-zinc-900 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#1F1F24] px-5 py-4">
                <div className="flex items-center gap-2">
                  <Gavel size={16} className="text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">Dispute Inspector</h3>
                </div>
                <button onClick={() => setInspectorOrder(null)} className="text-platinum/60 transition-colors hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <img src={inspectorOrder.image} alt={inspectorOrder.productTitle} className="h-14 w-14 rounded-xl object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-white">{inspectorOrder.productTitle}</p>
                    <p className="text-[10px] text-platinum">Order #{inspectorOrder.id.slice(-6).toUpperCase()}</p>
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-[#1F1F24] bg-[#060608] p-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-platinum">Buyer</span>
                    <span className="font-medium text-white">{inspectorOrder.consumerEmail}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-platinum">Brand</span>
                    <span className="font-medium text-white">{inspectorOrder.brandName}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-platinum">Order Value</span>
                    <span className="font-medium text-white">₹{inspectorOrder.priceInr.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-platinum">Escrow (Bounty)</span>
                    <span className="font-medium text-[#FFB300]">₹{inspectorOrder.bountyAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {inspectorOrder.disputeReason && (
                  <div className="rounded-xl border border-[#FF3B3B]/20 bg-[#FF3B3B]/[0.06] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#FF3B3B]">Dispute Reason</p>
                    <p className="mt-0.5 text-xs text-platinum">{inspectorOrder.disputeReason}</p>
                  </div>
                )}

                {inspectorOrder.disputeEvidenceImages && inspectorOrder.disputeEvidenceImages.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-platinum">Evidence ({inspectorOrder.disputeEvidenceImages.length})</p>
                    <div className="grid grid-cols-3 gap-2">
                      {inspectorOrder.disputeEvidenceImages.map((image, index) => (
                        <img key={`${image}-${index}`} src={image} alt={`Dispute evidence ${index + 1}`} className="aspect-square w-full rounded-lg border border-[#1F1F24] object-cover" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Message history */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-platinum">Message History ({inspectorOrder.disputeMessages?.length ?? 0})</p>
                  <div className="max-h-40 space-y-2 overflow-y-auto scrollbar-thin">
                    {(inspectorOrder.disputeMessages ?? []).length === 0 ? (
                      <p className="py-3 text-center text-[10px] text-platinum/60">No messages exchanged.</p>
                    ) : (
                      (inspectorOrder.disputeMessages ?? []).map((msg) => (
                        <div key={msg.id} className={`rounded-lg p-2.5 text-xs ${msg.senderRole === 'consumer' ? 'bg-emerald-600/10 text-emerald-400' : 'bg-zinc-800 text-zinc-100'}`}>
                          <p className="mb-0.5 text-[9px] font-semibold uppercase opacity-70">{msg.senderRole}</p>
                          <p>{msg.text}</p>
                          <p className="mt-0.5 text-[9px] opacity-50">{new Date(msg.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Override actions */}
                <div className="space-y-3 border-t border-[#1F1F24] pt-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">Binding Admin Decision</p>
                    <p className="mt-1 text-[11px] leading-5 text-platinum/70">Choose one final outcome. This updates the escrow and records the decision for both parties.</p>
                  </div>
                  <textarea
                    value={adminNotes}
                    onChange={(event) => setAdminNotes(event.target.value)}
                    placeholder="Optional decision note"
                    rows={3}
                    className="w-full resize-none rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2.5 text-xs text-white outline-none placeholder:text-platinum/40 focus:border-amber-400/50"
                  />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      onClick={() => handleAdminDecision(inspectorOrder.id, 'force_refund')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF3B3B] px-3 py-3 text-xs font-semibold text-white transition-all hover:bg-[#E03535]"
                    >
                      <AlertTriangle size={14} />
                      Refund Buyer
                    </button>
                    <button
                      onClick={() => handleAdminDecision(inspectorOrder.id, 'force_replacement')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 py-3 text-xs font-semibold text-[#060608] transition-all hover:bg-amber-300"
                    >
                      <Package size={14} />
                      Issue Replacement
                    </button>
                    <button
                      onClick={() => handleAdminDecision(inspectorOrder.id, 'reject_dispute')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-3 text-xs font-semibold text-white transition-all hover:border-white/30"
                    >
                      <ShieldCheck size={14} />
                      Reject Dispute
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dispute Chat Modal (admin view) */}
      <DisputeChatModal
        order={chatOrder}
        open={!!chatOrder}
        onClose={() => setChatOrder(null)}
        onSend={handleSendChatMessage}
        senderRole="admin"
      />
    </AdminLayout>
  );
}

function MetricCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: 'emerald' | 'amber';
}) {
  const color = accent === 'emerald' ? 'text-[#00E676]' : 'text-[#FFB300]';
  const bg = accent === 'emerald' ? 'border-[#00E676]/20 bg-[#00E676]/[0.04]' : 'border-[#FFB300]/20 bg-[#FFB300]/[0.04]';
  return (
    <div className={`rounded-2xl border p-5 ${bg}`}>
      <div className={`mb-3 ${color}`}>{icon}</div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-platinum/70">{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}
