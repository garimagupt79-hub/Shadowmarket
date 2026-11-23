import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Wallet,
  Lock,
  ArrowDownToLine,
  Loader2,
  ShieldCheck,
  Truck,
  Package,
  AlertTriangle,
  Filter,
  Store,
  Sparkles,
  PauseCircle,
} from 'lucide-react';
import { useMarket, normalizeBrand, classifyOrderEscrow, orderEscrowBounty, type EscrowBucket } from '../context/MarketContext';
import { ConsumerLayout } from '../components/ConsumerLayout';
import { EmptyState } from '../components/EmptyState';
import { playCashoutSound } from '../lib/audio';
import type { Order, WalletTransaction, BrandCredit } from '../types';

type LedgerFilter = 'All' | 'Money In' | 'Money Out' | 'Bounties & Refunds';

export function ConsumerWallet() {
  const {
    orders,
    walletTransactions,
    withdrawCash,
    pushToast,
    confirmDelivery,
    pushNotification,
    brandCredits,
    availableBalance,
    realizedBounties,
    lockedInEscrow,
    frozenInDispute,
    totalPrincipalBoosted,
    totalUpiPayouts,
    processUpiWithdrawal,
    brandTokens,
    brandTokenSettings,
    convertBountyToBrandToken,
    refreshAllMarketData,
  } = useMarket();
  const [upiId, setUpiId] = useState('');
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('All');
  const [boostingBrand, setBoostingBrand] = useState<string | null>(null);

  // Fresh data on every wallet mount — switching from Brand mode or My Purchases
  // must never show stale balances.
  useEffect(() => { void refreshAllMarketData(); }, []);

  const myOrders = orders;
  const myTransactions = walletTransactions.filter((tx) => !tx.wallet || tx.wallet === 'consumer');

  // Row badges/table derive from the same classifier as the summary cards,
  // so a resolved dispute can never stay stuck as "Frozen".
  const bucketByOrderId = new Map<string, EscrowBucket>();
  for (const o of myOrders) bucketByOrderId.set(o.id, classifyOrderEscrow(o));

  const filteredTransactions = myTransactions.filter((tx) => {
    if (ledgerFilter === 'All') return true;
    if (ledgerFilter === 'Money In') return isCredit(tx);
    if (ledgerFilter === 'Money Out') return isDebit(tx);
    return ['PRODUCT_BOUNTY_CASHBACK', 'IMAGE_REVIEW_BOUNTY', 'bounty_release', 'image_review_bounty', 'REFUND', 'FAILED_DELIVERY_REFUND', 'admin_refund', 'UNCLAIMED_BOUNTY_RETURN', 'IMAGE_REVIEW_BOUNTY_EXPIRED'].includes(tx.type);
  });

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!upiId.trim() || !amt || amt <= 0) return;
    if (amt > availableBalance) return;
    setProcessing(true);
    await processUpiWithdrawal(upiId.trim(), amt);
    withdrawCash(amt);
    setProcessing(false);
    playCashoutSound();
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00E676', '#ffffff', '#00E676'],
    });
    pushToast('success', `₹${amt.toLocaleString('en-IN')} transferred instantly via UPI!`);
    pushNotification({
      type: 'wallet_cashout',
      title: 'Payout Complete',
      description: `₹${amt.toLocaleString('en-IN')} sent to ${upiId.trim()}.`,
      link: 'Open Wallet',
    });
    setUpiId('');
    setAmount('');
  };

  const handleRelease = (order: Order) => {
    confirmDelivery(order.id);
    pushToast('success', `₹${order.bountyAmount.toLocaleString('en-IN')} Cash Back released!`);
    pushNotification({
      type: 'wallet_cashout',
      title: 'Escrow Released',
      description: `₹${order.bountyAmount.toLocaleString('en-IN')} bounty unlocked for ${order.productTitle}.`,
      link: 'Open Wallet',
    });
  };

  // Per-brand token boost candidates: realized (delivered/released) bounty
  // earnings merged with held credit, via the shared classifier.
  const totalBrandEarned = (() => {
    const byBrand = new Map<string, number>();
    for (const o of orders) {
      if (classifyOrderEscrow(o) !== 'realized') continue;
      const brand = normalizeBrand(o.brandName);
      byBrand.set(brand, (byBrand.get(brand) ?? 0) + orderEscrowBounty(o));
    }
    return byBrand;
  })();

  const boostCandidates = (() => {
    const brands = new Set<string>([
      ...Array.from(totalBrandEarned.keys()),
      ...brandTokens.map((t) => normalizeBrand(t.brandName)),
    ]);
    const rows: Array<{
      brand: string;
      availableToBoost: number;
      activeStoreCredit: number;
      isBrandEnabled: boolean;
    }> = [];
    for (const brand of brands) {
      const tokenRow = brandTokens.find((t) => normalizeBrand(t.brandName) === brand);
      const existingPrincipalBoosted = brandTokens
        .filter((t) => normalizeBrand(t.brandName) === brand)
        .reduce((sum, t) => sum + Number(t.principalBoosted ?? 0), 0);
      const totalEarned = totalBrandEarned.get(brand) ?? 0;
      const availableToBoost = Math.max(0, Math.min(availableBalance, Math.round(totalEarned - existingPrincipalBoosted)));
      const activeStoreCredit = Number(tokenRow?.availableCredit || 0);
      const isBrandEnabled = brandTokenSettings[brand]?.tokens_enabled ?? true;
      if (availableToBoost > 0 || activeStoreCredit > 0) {
        rows.push({ brand, availableToBoost, activeStoreCredit, isBrandEnabled });
      }
    }
    return rows.sort((a, b) => b.availableToBoost - a.availableToBoost);
  })();

  const handleBoost = async (brand: string, boostAmount: number) => {
    setBoostingBrand(brand);
    await convertBountyToBrandToken(brand, boostAmount);
    setBoostingBrand(null);
  };

  return (
    <ConsumerLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tighter text-white">Bounty Vault & Cashout</h1>
        <p className="mt-1.5 text-sm text-platinum">
          Manage cash back earnings and zkTLS escrow releases.
        </p>
      </div>

      {/* 3D Card Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8 overflow-hidden rounded-2xl border border-[#1F1F24] bg-gradient-to-br from-[#111114] via-[#0a0a0c] to-[#060608] p-8"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[#00E676]/5 blur-[80px]" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1F1F24] bg-[#060608]">
                <ShieldCheck size={18} className="text-[#00E676]" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-white">ShadowMarket VIP Wallet</span>
            </div>
            <Lock size={14} className="text-platinum/60" />
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">Available Balance</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-[#00E676] shadow-[0_0_24px_rgba(0,230,118,0.2)]">
                ₹{availableBalance.toLocaleString('en-IN')}
              </p>
              <p className="mt-1 text-[11px] text-platinum/60">Ready for instant withdrawal</p>
              <p className="mt-0.5 text-[10px] text-platinum/40">
                Realized ₹{realizedBounties.toLocaleString('en-IN')} − Boosted ₹{totalPrincipalBoosted.toLocaleString('en-IN')} − Payouts ₹{totalUpiPayouts.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">Locked in Escrow</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.15)]">
                ₹{lockedInEscrow.toLocaleString('en-IN')}
              </p>
              <p className="mt-1 text-[11px] text-platinum/60">Active deliveries (processing/shipped)</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">Frozen in Dispute</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-[#FF3B3B] shadow-[0_0_24px_rgba(255,59,59,0.15)]">
                ₹{frozenInDispute.toLocaleString('en-IN')}
              </p>
              <p className="mt-1 text-[11px] text-platinum/60">Held pending dispute resolution</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">Realized Bounties</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-sky-400 shadow-[0_0_24px_rgba(56,189,248,0.15)]">
                ₹{realizedBounties.toLocaleString('en-IN')}
              </p>
              <p className="mt-1 text-[11px] text-platinum/60">Lifetime earned from delivered orders</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Cashout */}
      <div className="mb-8">
        <div className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-6">
          <div className="mb-5 flex items-center gap-2">
            <ArrowDownToLine size={15} className="text-[#00E676]" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-white">Instant UPI / Bank Payout</h2>
          </div>
          <form onSubmit={handleTransfer} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">UPI ID</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="user@paytm / user@okicici"
                className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] px-3.5 py-2.5 text-sm text-white placeholder:text-platinum/50 transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-[#00E676]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">Amount (INR)</label>
              <input
                type="number"
                min={1}
                max={availableBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Max ₹${availableBalance.toLocaleString('en-IN')}`}
                className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] px-3.5 py-2.5 text-sm text-white placeholder:text-platinum/50 transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-[#00E676]"
              />
            </div>
            <button
              type="submit"
              disabled={processing || !upiId.trim() || !amount || availableBalance <= 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#00E676]/40 bg-[#00E676]/10 px-4 py-3 text-sm font-semibold text-[#00E676] shadow-[0_0_20px_rgba(0,230,118,0.15)] transition-all duration-300 ease-in-out hover:bg-[#00E676]/20 disabled:cursor-not-allowed disabled:border-[#1F1F24] disabled:bg-[#060608] disabled:text-platinum disabled:shadow-none"
            >
              {processing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <Wallet size={16} />
                  Transfer Cash to Bank
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Reinvest Earned Bounties (+25% bonus) */}
      {boostCandidates.length > 0 && (
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles size={15} className="text-[#00E676]" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-white">Reinvest Earned Bounties (+25% Bonus)</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boostCandidates.map((row) => (
              <motion.div
                key={row.brand}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden rounded-2xl border border-[#1F1F24] bg-gradient-to-br from-[#0f1512] via-[#111114] to-[#060608] p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00E676]/20 bg-[#00E676]/10">
                      <Store size={14} className="text-[#00E676]" />
                    </div>
                    <span className="text-sm font-semibold text-white">{row.brand}</span>
                  </div>
                  {!row.isBrandEnabled && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-platinum/25 bg-platinum/10 px-2 py-0.5 text-[10px] font-medium text-platinum">
                      <PauseCircle size={10} />
                      New Conversions Paused by Brand
                    </span>
                  )}
                </div>
                {row.activeStoreCredit > 0 && (
                  <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">Active Store Credit</p>
                )}
                {row.activeStoreCredit > 0 && (
                  <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-300">
                    ₹{row.activeStoreCredit.toLocaleString('en-IN')}
                  </p>
                )}
                {row.isBrandEnabled && row.availableToBoost > 0 && (
                  <>
                    <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">Convertible Bounty</p>
                    <p className="mt-1 text-lg font-bold tracking-tight text-amber-300">
                      ₹{row.availableToBoost.toLocaleString('en-IN')}
                    </p>
                    <button
                      type="button"
                      disabled={boostingBrand === row.brand}
                      onClick={() => void handleBoost(row.brand, row.availableToBoost)}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#00E676]/40 bg-[#00E676]/10 px-4 py-2.5 text-xs font-semibold text-[#00E676] transition-all hover:bg-[#00E676]/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {boostingBrand === row.brand ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Sparkles size={13} />
                      )}
                      Boost to ₹{Math.round(row.availableToBoost * 1.25).toLocaleString('en-IN')} Credit (+25%)
                    </button>
                  </>
                )}
                {!row.isBrandEnabled && row.activeStoreCredit > 0 && (
                  <p className="mt-3 text-[11px] leading-relaxed text-emerald-400">
                    Your existing ₹{row.activeStoreCredit.toLocaleString('en-IN')} credit remains 100% redeemable at checkout.
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Brand Credits Section */}
      {brandCredits.length > 0 && (
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Store size={15} className="text-amber-400" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-white">Brand Store Credits</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {brandCredits.map((credit: BrandCredit) => (
              <motion.div
                key={credit.brandId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-br from-[#1a1410] via-[#111114] to-[#060608] p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10">
                      <Store size={14} className="text-amber-400" />
                    </div>
                    <span className="text-sm font-semibold text-white">{credit.brandName}</span>
                  </div>
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                    Store Credit
                  </span>
                </div>
                <p className="mt-4 text-3xl font-bold tracking-tight text-amber-300">
                  ₹{credit.amount.toLocaleString('en-IN')}
                </p>
                <p className="mt-1 text-[11px] text-platinum/60">
                  Updated {new Date(credit.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </p>
                <button
                  onClick={() => {
                    window.location.hash = `#/consumer/catalog`;
                  }}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-4 py-2.5 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-400/15"
                >
                  <Store size={13} />
                  Shop {credit.brandName} Products
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Escrow Ledger */}
      <div className="mb-4 flex items-center gap-2">
        <Lock size={15} className="text-platinum" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-white">Escrow Release & Order Vault</h2>
      </div>

      {myOrders.length === 0 ? (
        <EmptyState
          icon={<Package size={28} />}
          title="No orders in escrow."
          subtitle="Purchase a product to see your escrow-locked bounties here."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#111114]">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-[#1F1F24] bg-[#060608]/60">
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Order ID</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Product</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Qty</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Total</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Cash Back</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Status</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Action</th>
                </tr>
              </thead>
              <tbody>
                {myOrders.map((order: Order) => {
                  const qty = order.quantity ?? 1;
                  const bucket = bucketByOrderId.get(order.id) ?? classifyOrderEscrow(order);
                  const isCancelled = bucket === 'cancelled';
                  const isRefunded = bucket === 'cancelled';
                  const isDisputed = bucket === 'frozen';
                  const isDelivered = bucket === 'realized';
                  const isProcessing = bucket === 'locked';
                  const lineBounty = orderEscrowBounty(order);
                  const statusBadge = isCancelled || order.status === 'cancelled' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-platinum/30 bg-platinum/10 px-2.5 py-1 text-xs font-bold text-platinum">
                      Refunded &amp; Restocked
                    </span>
                  ) : isRefunded ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-platinum/30 bg-platinum/10 px-2.5 py-1 text-xs font-bold text-platinum">
                      Refunded &amp; Restocked
                    </span>
                  ) : isDisputed ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF8C42]/40 bg-[#FF8C42]/15 px-2.5 py-1 text-xs font-bold text-[#FF8C42]">
                      <AlertTriangle size={12} /> Dispute Open • Escrow Frozen
                    </span>
                  ) : isDelivered ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00E676]/40 bg-[#00E676]/15 px-2.5 py-1 text-xs font-bold text-[#00E676]">
                      <ShieldCheck size={12} /> Delivered • Bounty Released
                    </span>
                  ) : order.trackingStatus === 'Dispatched' || String(order.status ?? '') === 'shipped' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-400/15 px-2.5 py-1 text-xs font-bold text-sky-300">
                      <Truck size={12} /> In Transit • Escrow Locked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 text-xs font-bold text-amber-400">
                      <Lock size={12} /> Processing • Escrow Locked
                    </span>
                  );
                  return (
                  <tr key={order.id} className={`border-b border-[#1F1F24] last:border-0 hover:bg-[#060608]/40 ${isDisputed ? 'bg-[#FF8C42]/[0.03]' : ''} ${isCancelled || isRefunded ? 'bg-platinum/[0.02]' : ''}`}>
                    <td className="px-5 py-4 font-mono text-[11px] text-platinum">#{order.id.slice(-6).toUpperCase()}</td>
                    <td className="px-5 py-4 text-sm font-medium text-white">{order.productTitle}</td>
                    <td className="px-5 py-4 text-sm text-platinum">{qty}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-white">₹{order.priceInr.toLocaleString('en-IN')}<span className="block text-[10px] font-normal text-platinum/60">₹{Math.round(order.priceInr / qty).toLocaleString('en-IN')} × {qty}</span></td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-0.5">
                        {isCancelled || isRefunded ? (
                          <span className="text-sm font-semibold text-platinum/60">—</span>
                        ) : (
                          <span className="text-sm font-semibold text-[#00E676]">₹{lineBounty.toLocaleString('en-IN')}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">{statusBadge}</td>
                    <td className="px-5 py-4">
                      {isCancelled || isRefunded ? (
                        <span className="text-xs text-platinum/60">Escrow cancelled</span>
                      ) : isDisputed ? (
                        <span className="text-xs text-[#FF8C42]/80">Frozen pending review</span>
                      ) : isDelivered ? (
                        <span className="text-xs text-platinum/50">Released</span>
                      ) : isProcessing ? (
                        <button
                          onClick={() => handleRelease(order)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#00E676]/40 bg-[#00E676]/10 px-3 py-2 text-[11px] font-semibold text-[#00E676] transition-all duration-300 hover:bg-[#00E676]/20"
                        >
                          <Truck size={12} />
                          Confirm Delivery &amp; Realize Bounty
                        </button>
                      ) : (
                        <span className="text-xs text-platinum/50">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <TransactionLedger
        transactions={filteredTransactions}
        filter={ledgerFilter}
        onFilterChange={setLedgerFilter}
      />

    </ConsumerLayout>
  );
}

function TransactionLedger({
  transactions,
  filter,
  onFilterChange,
}: {
  transactions: WalletTransaction[];
  filter: LedgerFilter;
  onFilterChange: (filter: LedgerFilter) => void;
}) {
  const filters: LedgerFilter[] = ['All', 'Money In', 'Money Out', 'Bounties & Refunds'];

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-[#00E676]" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-white">Transaction Audit Ledger</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item}
              onClick={() => onFilterChange(item)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                filter === item
                  ? 'border-[#00E676]/40 bg-[#00E676]/10 text-[#00E676]'
                  : 'border-[#1F1F24] bg-[#111114] text-platinum hover:text-white'
              }`}
            >
              {item === 'Money In' && '🟢 '}
              {item === 'Money Out' && '🔴 '}
              {item === 'Bounties & Refunds' && '🛡️ '}
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#111114]">
        {transactions.length === 0 ? (
          <p className="p-6 text-sm text-platinum">No transactions match this filter.</p>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-[#1F1F24] bg-[#060608]/60">
                  <th className="px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-platinum">Timestamp &amp; Date</th>
                  <th className="px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-platinum">Transaction Tag</th>
                  <th className="px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-platinum">Order Reference</th>
                  <th className="px-5 py-3 text-right text-[10px] uppercase tracking-[0.15em] text-platinum">Amount</th>
                  <th className="px-5 py-3 text-right text-[10px] uppercase tracking-[0.15em] text-platinum">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const credit = isCredit(tx);
                  return (
                  <tr key={tx.id} className="border-b border-[#1F1F24] last:border-0 hover:bg-[#060608]/40">
                    <td className="px-5 py-3 text-xs text-platinum">
                      {new Date(tx.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#1F1F24] bg-[#060608] px-2 py-1 font-mono text-[10px] text-sky-300">
                        {credit ? '🟢' : '🔴'} [{getLedgerTag(tx)}]
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-[11px] text-platinum">{tx.orderId ? `#${tx.orderId.slice(-6).toUpperCase()}` : '—'}</td>
                    <td className={`px-5 py-3 text-right font-mono text-xs font-bold ${credit ? 'text-emerald-400' : 'text-red-400'}`}>
                      {credit ? '↙️ +' : '↗️ -'}₹{tx.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-white">{tx.runningBalance === undefined ? '—' : `₹${tx.runningBalance.toLocaleString('en-IN')}`}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function getLedgerTag(tx: WalletTransaction): string {
  if (tx.type === 'ORDER_PAYMENT') return 'ORDER_PAYMENT';
  if (tx.type === 'WITHDRAWAL') return 'WITHDRAWAL';
  if (tx.type === 'BRAND_CREDIT_CONVERSION') return 'BRAND_CREDIT';
  if (tx.type === 'BOUNTY_BRAND_BOOST') return 'BOUNTY_BOOST';
  if (tx.type === 'BRAND_CREDIT_REDEEMED') return 'CREDIT_REDEEMED';
  if (tx.type === 'PLATFORM_FEE_DEDUCTION') return 'PLATFORM_FEE';
  if (tx.type === 'BOUNTY_ESCROW_DEDUCTION') return 'BOUNTY_ESCROW';
  if (tx.type === 'PRODUCT_BOUNTY_CASHBACK' || tx.type === 'bounty_release') return 'PRODUCT_BOUNTY';
  if (tx.type === 'IMAGE_REVIEW_BOUNTY' || tx.type === 'image_review_bounty') return 'IMAGE_BOUNTY';
  if (tx.type === 'ESCROW_RELEASE' || tx.type === 'admin_release' || tx.type === 'brand_payout') return 'ESCROW_RELEASE';
  if (tx.type === 'FAILED_DELIVERY_REFUND') return 'FAILED_DELIVERY_REFUND';
  if (tx.type === 'UNCLAIMED_BOUNTY_RETURN' || tx.type === 'IMAGE_REVIEW_BOUNTY_EXPIRED') return 'UNCLAIMED_BOUNTY_RETURN';
  return 'REFUND';
}

function isCredit(tx: WalletTransaction): boolean {
  if (tx.direction === 'credit' || tx.category === 'credit') return true;
  if (tx.direction === 'debit' || tx.category === 'debit') return false;
  return !['cashout', 'platform_fee', 'brand_payout', 'ESCROW_RELEASE', 'ORDER_PAYMENT', 'WITHDRAWAL', 'PLATFORM_FEE_DEDUCTION', 'BOUNTY_ESCROW_DEDUCTION', 'BRAND_CREDIT_CONVERSION', 'BOUNTY_BRAND_BOOST', 'BRAND_CREDIT_REDEEMED'].includes(tx.type);
}

function isDebit(tx: WalletTransaction): boolean {
  return !isCredit(tx);
}
