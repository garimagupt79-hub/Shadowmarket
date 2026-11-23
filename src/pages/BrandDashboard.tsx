import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Wallet,
  ShoppingBag,
  CheckCircle2,
  Package,
  Boxes,
  Loader2,
  Lock,
  ShieldCheck,
  Building2,
  AlertTriangle,
  TrendingDown,
  Zap,
  Flame,
  ArrowRight,
  Trash2,
  Target,
  Sparkles,
} from 'lucide-react';
import { useMarket, normalizeBrand } from '../context/MarketContext';
import { BrandLayout } from '../components/BrandLayout';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import type { Product } from '../types';

export function BrandDashboard() {
  const {
    salesAnalytics,
    products,
    brandProfile,
    verifyBrand,
    orders,
    campaigns,
    intents,
    addCampaign,
    deleteSalesRecord,
    authProfile,
    session,
    brandTokenSettings,
    toggleBrandTokens,
  } = useMarket();
  const activeBrandName = String(authProfile?.display_name || session.email || 'NOIR ATELIER');
  const tokensEnabled = brandTokenSettings[normalizeBrand(activeBrandName)]?.tokens_enabled ?? true;
  const [modalOpen, setModalOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pitchModal, setPitchModal] = useState<{
    keyword: string;
    count: number;
    product: Product;
  } | null>(null);
  const [pitchReach, setPitchReach] = useState(25);
  const [pitchExtraBounty, setPitchExtraBounty] = useState(0);

  const handleVerify = () => {
    setModalOpen(true);
    setVerifying(true);
    window.setTimeout(() => {
      verifyBrand();
      setVerifying(false);
      setModalOpen(false);
    }, 4000);
  };

  // Live KPIs computed from Supabase-backed product rows (sold_count, price, auto_bounty)
  const grossSales = useMemo(
    () => products.reduce((sum, p) => {
      const sold = Number(p.soldCount ?? 0);
      const price = Number(p.priceInr ?? 0);
      return sum + Number(p.grossSales ?? sold * price);
    }, 0),
    [products],
  );
  const totalBounties = useMemo(
    () => products.reduce((sum, p) => {
      const sold = Number(p.soldCount ?? 0);
      const bounty = Number(p.autoBounty ?? 0);
      return sum + Number(p.bountiesPaid ?? sold * bounty);
    }, 0),
    [products],
  );
  const unitsVolume = useMemo(
    () => products.reduce((sum, p) => sum + Number(p.soldCount ?? 0), 0),
    [products],
  );
  const netRevenue = useMemo(
    () => grossSales - totalBounties,
    [grossSales, totalBounties],
  );
  const totalAvailableStock = useMemo(
    () => products.reduce((sum, p) => sum + Number(p.stockQuantity ?? 0), 0),
    [products],
  );
  // Per-product performance, best-selling first
  const productPerformance = useMemo(
    () =>
      [...products]
        .map((p) => ({
          id: p.id,
          title: p.title,
          image: p.images[0] ?? '',
          category: p.category,
          sold: Number(p.soldCount ?? 0),
          gross: Number(p.grossSales ?? (p.soldCount ?? 0) * p.priceInr),
          bounty: Number(p.bountiesPaid ?? (p.soldCount ?? 0) * p.autoBounty),
          net: Number(p.netRevenue ?? ((p.soldCount ?? 0) * p.priceInr) - ((p.soldCount ?? 0) * p.autoBounty)),
          stock: Number(p.stockQuantity ?? 0),
          price: p.priceInr,
        }))
        .sort((a, b) => b.gross - a.gross),
    [products],
  );

  // Action Required tray
  const overdueShipments = orders.filter(
    (o) =>
      o.trackingStatus === 'Placed' &&
      Date.now() - o.timestamp > 24 * 60 * 60 * 1000,
  );
  const openDisputes = orders.filter((o) => o.disputeStatus === 'open');
  const outOfStockVariants = products.flatMap((p) =>
    p.variants.filter((v) => v.outOfStock || v.stock === 0),
  );

  const alerts = [
    {
      key: 'overdue',
      icon: Package,
      label: `${overdueShipments.length} Orders pending dispatch (>24h)`,
      link: '/brand/orders',
      tone: 'amber' as const,
    },
    {
      key: 'disputes',
      icon: AlertTriangle,
      label: `${openDisputes.length} Active disputes awaiting proof`,
      link: '/brand/orders',
      tone: 'red' as const,
    },
    {
      key: 'lowstock',
      icon: TrendingDown,
      label: `${outOfStockVariants.length} Variants out of stock`,
      link: '/brand/catalog/new',
      tone: 'amber' as const,
    },
  ].filter((a) => {
    if (a.key === 'overdue') return overdueShipments.length > 0;
    if (a.key === 'disputes') return openDisputes.length > 0;
    if (a.key === 'lowstock') return outOfStockVariants.length > 0;
    return false;
  });

  // High-demand opportunity clusters
  const demandClusters = useMemo(() => {
    const clusterMap = new Map<string, number>();
    intents.forEach((i) => {
      const kw = i.searchQuery.toLowerCase();
      clusterMap.set(kw, (clusterMap.get(kw) ?? 0) + 1);
    });
    const clusters = Array.from(clusterMap.entries())
      .map(([keyword, count]) => {
        const match = products.find((p) =>
          p.keywords.some((k) => k.toLowerCase().includes(keyword) || keyword.includes(k.toLowerCase())),
        );
        return { keyword, count, product: match };
      })
      .filter((c) => c.product)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
    return clusters;
  }, [intents, products]);

  // Daily metrics
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaySales = salesAnalytics.filter(
    (r) => r.timestamp >= todayStart.getTime(),
  );
  const todayGross = todaySales.reduce((sum, r) => sum + r.salePrice, 0);
  const pendingEscrow = orders
    .filter((o) => o.trackingStatus !== 'Delivered')
    .reduce((sum, o) => sum + o.priceInr, 0);
  const activePitches = campaigns.length;
  const conversionRate =
    activePitches > 0
      ? Math.round((todaySales.length / Math.max(activePitches, 1)) * 100)
      : 0;

  const dailyMetrics = [
    {
      label: "Today's Gross Sales",
      value: `₹${todayGross.toLocaleString('en-IN')}`,
      icon: BarChart3,
      accent: true,
    },
    {
      label: 'Active Pitch Conversion',
      value: `${conversionRate}%`,
      icon: Target,
      accent: false,
    },
    {
      label: 'Pending Escrow Balance',
      value: `₹${pendingEscrow.toLocaleString('en-IN')}`,
      icon: Lock,
      accent: true,
    },
  ];

  const summaryCards = [
    {
      label: 'Gross Sales Revenue',
      value: `₹${grossSales.toLocaleString('en-IN')}`,
      icon: BarChart3,
      accent: true,
    },
    {
      label: 'Total Disbursed Bounties',
      value: `₹${totalBounties.toLocaleString('en-IN')}`,
      icon: Wallet,
      accent: true,
    },
    {
      label: 'Total Units Sold',
      value: unitsVolume.toLocaleString('en-IN'),
      icon: ShoppingBag,
      accent: false,
    },
    {
      label: 'Net Revenue',
      value: `₹${netRevenue.toLocaleString('en-IN')}`,
      icon: TrendingDown,
      accent: true,
    },
    {
      label: 'Available Stock',
      value: totalAvailableStock.toLocaleString('en-IN'),
      icon: Boxes,
      accent: false,
    },
  ];

  const openPitchModal = (keyword: string, count: number, product: Product) => {
    setPitchReach(25);
    setPitchExtraBounty(Math.ceil(product.autoBounty * 0.25));
    setPitchModal({ keyword, count, product });
  };

  const launchPitch = () => {
    if (!pitchModal) return;
    const targetCount = Math.ceil(pitchModal.count * (pitchReach / 100));
    addCampaign({
      productId: pitchModal.product.id,
      productTitle: pitchModal.product.title,
      keyword: pitchModal.keyword,
      reachPercent: pitchReach,
      targetCount,
      totalVipBounty: pitchModal.product.autoBounty + pitchExtraBounty,
    });
    setPitchModal(null);
  };

  return (
    <BrandLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tighter text-white">
          Executive Control Dashboard
        </h1>
        <p className="mt-1.5 text-sm text-platinum">
          Real-time automated sales tracking across your inventory ledger.
        </p>
      </div>

      {/* Brand Token Boost Program opt-out */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8 rounded-2xl border border-[#1F1F24] bg-[#111114] p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tokensEnabled ? 'bg-[#00E676]/15 text-[#00E676]' : 'bg-[#1F1F24] text-platinum'}`}>
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Brand Token Boost Program (+25% Store Credit)</p>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-platinum">
                {tokensEnabled
                  ? 'Active — Buyers can convert earned bounties into 1.25x store credit redeemable up to 100% per order.'
                  : 'Paused — New bounty-to-token conversions are disabled. Buyers with existing store credit can still redeem their remaining balance at checkout.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={tokensEnabled}
            onClick={() => void toggleBrandTokens(activeBrandName, !tokensEnabled)}
            className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full border transition-colors duration-300 ${tokensEnabled ? 'border-[#00E676]/50 bg-[#00E676]/25' : 'border-[#1F1F24] bg-[#060608]'}`}
            style={{ width: '3.25rem' }}
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              className={`h-5 w-5 rounded-full ${tokensEnabled ? 'ml-[1.4rem] bg-[#00E676]' : 'ml-1 bg-platinum'}`}
            />
          </button>
        </div>
        {!tokensEnabled && (
          <p className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-[11px] text-emerald-400">
            Grandfathering guarantee: buyers holding existing credit can always redeem it at checkout, even while conversions are paused.
          </p>
        )}
      </motion.div>

      {/* Action Required Tray */}
      {alerts.length > 0 && (
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-[#FFB300]" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-white">
              Action Required
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.map((alert, idx) => (
              <motion.a
                key={alert.key}
                href={alert.link}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.06 }}
                className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:scale-[1.02] ${
                  alert.tone === 'red'
                    ? 'border-[#FF3B3B]/30 bg-[#FF3B3B]/[0.06] shadow-[0_0_24px_rgba(255,59,59,0.12)]'
                    : 'border-[#FFB300]/30 bg-[#FFB300]/[0.06] shadow-[0_0_24px_rgba(255,179,0,0.12)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      alert.tone === 'red'
                        ? 'bg-[#FF3B3B]/15 text-[#FF3B3B]'
                        : 'bg-[#FFB300]/15 text-[#FFB300]'
                    }`}
                  >
                    <alert.icon size={18} />
                  </div>
                  <p className="flex-1 text-sm font-medium text-white">
                    {alert.label}
                  </p>
                  <ArrowRight
                    size={16}
                    className="text-platinum transition-transform group-hover:translate-x-1"
                  />
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      )}

      {/* Business Identity & Escrow Security Action Card */}
      <AnimatePresence mode="wait">
        {brandProfile.isCorporateVerified ? (
          <motion.div
            key="verified"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-8 flex flex-col gap-4 overflow-hidden rounded-2xl border border-[#00E676]/30 bg-[#00E676]/[0.04] p-6 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#00E676]/30 bg-[#00E676]/10">
                <ShieldCheck size={20} className="text-[#00E676]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  ✓ Business Identity Verified by Middesk. Escrow Vault Secured
                  by Stripe.
                </p>
                <p className="mt-1 text-xs text-platinum">
                  Gold Trust Badges are active across all your consumer
                  listings. Consumers can now transact with full escrow
                  protection.
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="unverified"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-8 overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#111114] p-6"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#1F1F24] bg-[#060608]">
                  <Building2 size={20} className="text-platinum" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Business Identity & Escrow Security
                  </h2>
                  <p className="mt-1 max-w-md text-xs text-platinum">
                    Verify your legal entity through Middesk KYB and Stripe
                    Identity to unlock Gold Trust Badges and enable consumer
                    escrow-protected purchases.
                  </p>
                </div>
              </div>
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#635BFF] px-5 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(99,91,255,0.25)] transition-all duration-300 ease-in-out hover:bg-[#5851E5] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Lock size={16} />
                Verify Business with Stripe & Middesk
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daily Metric Summary Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {dailyMetrics.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut', delay: idx * 0.08 }}
            className="relative overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#111114] p-6"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-b from-[#242427] to-transparent" />
            <div className="flex items-center gap-2 text-platinum">
              <card.icon size={15} />
              <span className="text-xs font-medium uppercase tracking-[0.15em]">
                {card.label}
              </span>
            </div>
            <p
              className={`mt-4 text-3xl font-bold tracking-tight ${
                card.accent
                  ? 'text-[#00E676] shadow-[0_0_20px_rgba(0,230,118,0.15)]'
                  : 'text-white'
              }`}
            >
              {card.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* High-Demand Opportunity Clusters */}
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Flame size={16} className="text-[#FF6B35]" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-white">
            High-Demand Opportunities
          </h2>
        </div>
        {demandClusters.length === 0 ? (
          <div className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-6">
            <EmptyState
              icon={<Target size={28} />}
              title="No matching intent clusters yet."
              subtitle="Live buyer demand matching your catalog will surface here as intents are broadcast."
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {demandClusters.map((cluster, idx) => (
              <motion.div
                key={cluster.keyword}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.07 }}
                className="overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#111114] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Flame size={15} className="text-[#FF6B35]" />
                      <p className="text-sm font-semibold text-white">
                        High Intent Volume: {cluster.keyword}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-platinum">
                      {cluster.count} Active Buyers right now
                    </p>
                  </div>
                </div>
                {cluster.product && (
                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#1F1F24] bg-[#060608] p-3">
                    <img
                      src={cluster.product.images[0]}
                      alt={cluster.product.title}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-white">
                        {cluster.product.title}
                      </p>
                      <p className="text-[11px] text-platinum">
                        Direct Catalog Match · ₹{cluster.product.priceInr.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() =>
                    cluster.product &&
                    openPitchModal(cluster.keyword, cluster.count, cluster.product)
                  }
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00E676] px-4 py-2.5 text-sm font-semibold text-[#060608] transition-all duration-300 hover:bg-[#00C853]"
                >
                  <Zap size={15} />
                  Launch Direct Pitch
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Analytics summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {summaryCards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut', delay: idx * 0.08 }}
            className="relative overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#111114] p-6"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-b from-[#242427] to-transparent" />
            <div className="flex items-center gap-2 text-platinum">
              <card.icon size={15} />
              <span className="text-xs font-medium uppercase tracking-[0.15em]">
                {card.label}
              </span>
            </div>
            <p
              className={`mt-4 text-3xl font-bold tracking-tight ${
                card.accent
                  ? 'text-[#00E676] shadow-[0_0_20px_rgba(0,230,118,0.15)]'
                  : 'text-white'
              }`}
            >
              {card.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Per-product performance table (live from database) */}
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Boxes size={16} className="text-[#00E676]" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-white">
            Product Performance Ledger
          </h2>
          <span className="ml-1 rounded-full border border-[#1F1F24] bg-[#060608] px-2 py-0.5 text-[10px] text-platinum">
            {productPerformance.length} SKUs
          </span>
        </div>
        {productPerformance.length === 0 ? (
          <div className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-6">
            <EmptyState
              icon={<Package size={28} />}
              title="No products in your catalog yet."
              subtitle="Publish products to start tracking live sales performance."
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#111114]">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-[#1F1F24] bg-[#060608]/60">
                    <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Product</th>
                    <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Price</th>
                    <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Units Sold</th>
                    <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Gross Sales</th>
                    <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Bounties Paid</th>
                    <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Net Revenue</th>
                    <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {productPerformance.map((p, idx) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.3) }}
                      className="border-b border-[#1F1F24] last:border-0 hover:bg-[#060608]/40"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {p.image ? (
                            <img src={p.image} alt={p.title} className="h-9 w-9 rounded-lg object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#060608] text-platinum/40">
                              <Package size={16} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">{p.title}</p>
                            <p className="text-[10px] text-platinum/60">{p.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-platinum">₹{p.price.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-4 text-xs font-semibold text-white">{p.sold.toLocaleString('en-IN')} <span className="font-normal text-platinum/60">sold</span></td>
                      <td className="px-5 py-4 text-xs font-semibold text-[#00E676]">₹{p.gross.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-4 text-xs text-[#FFB300]">₹{p.bounty.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-4 text-xs font-semibold text-white">₹{p.net.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                          p.stock <= 0
                            ? 'border-[#FF3B3B]/30 bg-[#FF3B3B]/10 text-[#FF3B3B]'
                            : p.stock <= 10
                              ? 'border-[#FFB300]/30 bg-[#FFB300]/10 text-[#FFB300]'
                              : 'border-[#1F1F24] bg-[#060608] text-platinum'
                        }`}>
                          {p.stock.toLocaleString('en-IN')} in stock
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Live sales ledger grid */}
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 size={16} className="text-platinum" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-white">
          Live Sales Ledger
        </h2>
        <span className="ml-1 rounded-full border border-[#1F1F24] bg-[#060608] px-2 py-0.5 text-[10px] text-platinum">
          {salesAnalytics.length} transactions
        </span>
      </div>

      {salesAnalytics.length === 0 ? (
        <div className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-6">
          <EmptyState
            icon={<Package size={28} />}
            title="No active signals in this sector."
            subtitle="Sales will appear here automatically as consumers purchase from your inventory."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#111114]">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-[#1F1F24] bg-[#060608]/60">
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">
                    Product Name
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">
                    Buyer
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">
                    Timestamp
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">
                    Category
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">
                    Qty
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">
                    Transaction ID
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">
                    Status
                  </th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody>
                {salesAnalytics.map((record, idx) => (
                  <motion.tr
                    key={record.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.3) }}
                    className="border-b border-[#1F1F24] last:border-0 hover:bg-[#060608]/40"
                  >
                    <td className="px-5 py-4 text-sm font-medium text-white">
                      {record.productTitle}
                    </td>
                    <td className="px-5 py-4 text-xs text-platinum">
                      {record.buyerEmail || '—'}
                    </td>
                    <td className="px-5 py-4 text-xs text-platinum">
                      {new Date(record.timestamp).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-md border border-[#1F1F24] bg-[#060608] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-platinum">
                        {record.category}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-white">
                      {record.quantity ?? 1}
                    </td>
                    <td className="px-5 py-4 font-mono text-[11px] text-platinum">
                      {record.id}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00E676]">
                        <CheckCircle2 size={13} />
                        Fulfilled via zK-Proof
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => deleteSalesRecord(record.id)}
                        className="rounded-lg p-1.5 text-platinum transition-all duration-300 hover:bg-[#FF3B3B]/10 hover:text-[#FF3B3B]"
                        aria-label="Delete record"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          if (!verifying) setModalOpen(false);
        }}
        title="Stripe & Middesk Identity"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col items-center justify-center gap-5 py-12 text-center">
          <Loader2 size={36} className="animate-spin text-[#635BFF]" />
          <div>
            <p className="text-sm font-semibold text-white">
              Securely connecting to Middesk KYB and Stripe Identity...
            </p>
            <p className="mt-2 text-xs text-platinum">
              Establishing encrypted session. Do not close this window.
            </p>
          </div>
        </div>
      </Modal>

      {/* Direct Pitch Launcher Modal */}
      <Modal
        open={!!pitchModal}
        onClose={() => setPitchModal(null)}
        title="Programmatic Direct Pitch"
        maxWidth="max-w-lg"
      >
        {pitchModal && (
          <div className="space-y-5">
            <div className="rounded-xl border border-[#1F1F24] bg-[#060608] p-4">
              <div className="flex items-center gap-3">
                <img
                  src={pitchModal.product.images[0]}
                  alt={pitchModal.product.title}
                  className="h-14 w-14 rounded-lg object-cover"
                />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {pitchModal.product.title}
                  </p>
                  <p className="text-xs text-platinum">
                    Keyword: {pitchModal.keyword} · {pitchModal.count} matching buyers
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                Target Audience Reach
              </label>
              <div className="flex gap-2">
                {[10, 25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setPitchReach(pct)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-all ${
                      pitchReach === pct
                        ? 'border-[#00E676] bg-[#00E676]/10 text-[#00E676]'
                        : 'border-[#1F1F24] bg-[#060608] text-platinum hover:border-[#2A2A2E]'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-platinum">
                Target Users: {Math.ceil(pitchModal.count * (pitchReach / 100))}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                Extra VIP Bounty (min 25% of ₹{pitchModal.product.autoBounty})
              </label>
              <input
                type="number"
                value={pitchExtraBounty}
                onChange={(e) => setPitchExtraBounty(Number(e.target.value))}
                className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-[#00E676]"
              />
              <p className="mt-2 text-xs text-[#00E676]">
                Total Cash Back: ₹{pitchModal.product.autoBounty + pitchExtraBounty}
              </p>
            </div>

            <button
              onClick={launchPitch}
              disabled={pitchExtraBounty < Math.ceil(pitchModal.product.autoBounty * 0.25)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00E676] px-4 py-3 text-sm font-semibold text-[#060608] transition-all duration-300 hover:bg-[#00C853] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Zap size={16} />
              Launch VIP Pitch to {Math.ceil(pitchModal.count * (pitchReach / 100))} Buyers
            </button>
          </div>
        )}
      </Modal>
    </BrandLayout>
  );
}
