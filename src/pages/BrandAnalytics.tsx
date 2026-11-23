import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Target,
  Wallet,
  LineChart as LineChartIcon,
  Camera,
  Search,
  Calendar,
  IndianRupee,
  Package,
} from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { BrandLayout } from '../components/BrandLayout';
import type { DbOrder, DailyAnalytics, Product } from '../types';

type TimeRange = '7d' | '30d' | 'month' | 'all' | 'custom';

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

function computeBounds(range: TimeRange, customStart?: string, customEnd?: string): { start: number; end: number } {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  switch (range) {
    case '7d':
      return { start: now - 7 * day, end: now };
    case '30d':
      return { start: now - 30 * day, end: now };
    case 'month': {
      const d = new Date();
      return { start: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), end: now };
    }
    case 'all':
      return { start: 0, end: now };
    case 'custom': {
      const s = customStart ? new Date(customStart).getTime() : 0;
      const e = customEnd ? new Date(customEnd).getTime() + day : now;
      return { start: s, end: e };
    }
  }
}

const isRefundedOrder = (o: DbOrder) =>
  o.status === 'refunded' || o.status === 'resolved_refunded' || o.status === 'resolved_refunded_by_admin';

export function BrandAnalytics() {
  const { products, pitches, reviews, dbOrders, dailyAnalytics } = useMarket();

  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const { start, end } = useMemo(
    () => computeBounds(timeRange, customStart, customEnd),
    [timeRange, customStart, customEnd],
  );

  // --- Product filter (applies to product-derived KPIs) ---
  const filteredProducts = useMemo<Product[]>(() => {
    if (selectedProductId === 'all') return products;
    return products.filter((p) => String(p.id) === String(selectedProductId));
  }, [products, selectedProductId]);

  // --- Supabase-backed daily_analytics rows, filtered by product + timeline range ---
  const filteredDailyAnalytics = useMemo<DailyAnalytics[]>(() => {
    return dailyAnalytics.filter((row) => {
      if (selectedProductId !== 'all' && String(row.productId) !== String(selectedProductId)) return false;
      const rowDate = new Date(row.analyticsDate + 'T00:00:00').getTime();
      if (Number.isNaN(rowDate)) return true;
      if (rowDate < start || rowDate > end + 24 * 60 * 60 * 1000) return false;
      return true;
    });
  }, [dailyAnalytics, start, end, selectedProductId]);

  const hasDailyAnalytics = filteredDailyAnalytics.length > 0;

  // --- Gross Revenue: prefer daily_analytics, fall back to products + orders ---
  const daGrossRevenue = useMemo(
    () => filteredDailyAnalytics.reduce((sum, r) => sum + Number(r.grossRevenue || 0), 0),
    [filteredDailyAnalytics],
  );
  const daBountiesPaid = useMemo(
    () => filteredDailyAnalytics.reduce((sum, r) => sum + Number(r.bountiesPaid || 0), 0),
    [filteredDailyAnalytics],
  );
  const daNetMargin = useMemo(
    () => filteredDailyAnalytics.reduce((sum, r) => sum + Number(r.netMargin || 0), 0),
    [filteredDailyAnalytics],
  );
  const daOrdersCount = useMemo(
    () => filteredDailyAnalytics.reduce((sum, r) => sum + Number(r.ordersCount || 0), 0),
    [filteredDailyAnalytics],
  );
  const daUnitsSold = useMemo(
    () => filteredDailyAnalytics.reduce((sum, r) => sum + Number(r.unitsSold || 0), 0),
    [filteredDailyAnalytics],
  );

  // --- Reactive order filter pipeline: uses dbOrders (Supabase-backed) with date + product + refund exclusion ---
  const filteredOrders = useMemo<DbOrder[]>(() => {
    return dbOrders.filter((o) => {
      const orderDate = new Date(o.createdAt || Date.now());
      const ts = orderDate.getTime();
      if (Number.isNaN(ts)) return true; // include if date invalid/missing
      if (ts < start || ts > end) return false;
      if (selectedProductId !== 'all' && String(o.productId) !== String(selectedProductId)) return false;
      if (isRefundedOrder(o)) return false;
      return true;
    });
  }, [dbOrders, start, end, selectedProductId]);

  const filteredPitches = useMemo(() => {
    return pitches.filter((p) => {
      const ts = new Date(p.createdAt).getTime();
      if (Number.isNaN(ts)) return true;
      if (ts < start || ts > end) return false;
      if (selectedProductId !== 'all' && p.productId !== selectedProductId) return false;
      return true;
    });
  }, [pitches, start, end, selectedProductId]);

  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (r.timestamp < start || r.timestamp > end) return false;
      if (selectedProductId !== 'all' && r.productId !== selectedProductId) return false;
      return true;
    });
  }, [reviews, start, end, selectedProductId]);

  // --- Gross Revenue: prefer daily_analytics, else max of products-derived and orders-derived ---
  const ordersGross = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + Number(o.totalPrice ?? 0), 0),
    [filteredOrders],
  );
  const productsGross = useMemo(
    () =>
      filteredProducts.reduce((sum, p) => {
        const sold = Number(p.soldCount ?? 0);
        const price = Number(p.priceInr ?? 0);
        return sum + Number(p.grossSales ?? sold * price);
      }, 0),
    [filteredProducts],
  );
  const grossRevenue = hasDailyAnalytics ? daGrossRevenue : Math.max(productsGross, ordersGross);

  // --- Bounties Paid: VIP (product/auto bounty) + Photo (image review bounty) ---
  const ordersVipBounties = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + Number(o.productBounty ?? 0), 0),
    [filteredOrders],
  );
  const ordersPhotoBounties = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + Number(o.imageReviewBounty ?? 0), 0),
    [filteredOrders],
  );
  const productsVipBounties = useMemo(
    () =>
      filteredProducts.reduce((sum, p) => {
        const sold = Number(p.soldCount ?? 0);
        const bounty = Number(p.autoBounty ?? 0);
        return sum + Number(p.bountiesPaid ?? sold * bounty);
      }, 0),
    [filteredProducts],
  );
  // Photo bounties from reviews (claimed with image)
  const reviewsPhotoBounties = useMemo(
    () =>
      filteredReviews
        .filter((r) => r.bountyClaimed && r.image)
        .reduce((sum, r) => {
          const product = products.find((p) => p.id === r.productId);
          return sum + (product?.imageReviewBountyAmount ?? 0);
        }, 0),
    [filteredReviews, products],
  );

  const vipBountiesPaid = hasDailyAnalytics ? daBountiesPaid : Math.max(productsVipBounties, ordersVipBounties);
  const photoReviewBounties = hasDailyAnalytics ? 0 : Math.max(reviewsPhotoBounties, ordersPhotoBounties);
  const totalBountiesPaid = hasDailyAnalytics ? daBountiesPaid : vipBountiesPaid + photoReviewBounties;

  const netProfit = hasDailyAnalytics ? daNetMargin : grossRevenue - totalBountiesPaid;

  // --- Pitch conversion ---
  const acceptedPitches = useMemo(
    () => filteredPitches.filter((p) => p.status === 'accepted').length,
    [filteredPitches],
  );
  const pitchConversionRate = useMemo(
    () => (filteredPitches.length > 0 ? (acceptedPitches / filteredPitches.length) * 100 : 0),
    [acceptedPitches, filteredPitches.length],
  );

  // --- Orders / Units badge: prefer daily_analytics ---
  const totalUnitsOrOrders = hasDailyAnalytics
    ? Math.max(daOrdersCount, daUnitsSold)
    : Math.max(
        filteredOrders.reduce((sum, o) => sum + 1, 0),
        filteredProducts.reduce((sum, p) => sum + Number(p.soldCount ?? 0), 0),
      );

  // --- Revenue Trend: prefer daily_analytics rows grouped by date; fall back to dbOrders ---
  const trendData = useMemo(() => {
    if (hasDailyAnalytics) {
      // Group filtered daily_analytics rows by date, chronologically.
      const byDate = new Map<string, { revenue: number; sent: number; accepted: number; units: number; bounties: number; net: number }>();
      for (const row of filteredDailyAnalytics) {
        const existing = byDate.get(row.analyticsDate) ?? { revenue: 0, sent: 0, accepted: 0, units: 0, bounties: 0, net: 0 };
        existing.revenue += Number(row.grossRevenue || 0);
        existing.bounties += Number(row.bountiesPaid || 0);
        existing.net += Number(row.netMargin || 0);
        existing.units += Number(row.unitsSold || 0);
        byDate.set(row.analyticsDate, existing);
      }
      const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
      return sorted.map(([date, vals]) => ({
        label: new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        revenue: vals.revenue,
        bounties: vals.bounties,
        net: vals.net,
        units: vals.units,
        sent: 0,
        accepted: 0,
      }));
    }
    // Fallback: bucket dbOrders by day.
    const day = 24 * 60 * 60 * 1000;
    const buckets: { label: string; revenue: number; bounties: number; net: number; units: number; sent: number; accepted: number }[] = [];
    const span = Math.max(day, end - start);
    const bucketCount = Math.min(14, Math.max(1, Math.ceil(span / day)));
    const bucketSize = span / bucketCount;
    for (let i = 0; i < bucketCount; i++) {
      const bStart = start + i * bucketSize;
      const bEnd = bStart + bucketSize;
      const label = new Date(bStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const inBucket = filteredOrders.filter((o) => {
        const ts = new Date(o.createdAt || Date.now()).getTime();
        return ts >= bStart && ts < bEnd;
      });
      const revenue = inBucket.reduce((sum, o) => sum + Number(o.totalPrice ?? 0), 0);
      const bounties = inBucket.reduce((sum, o) => sum + Number(o.productBounty ?? 0) + Number(o.imageReviewBounty ?? 0), 0);
      const sent = filteredPitches.filter((p) => {
        const ts = new Date(p.createdAt).getTime();
        return ts >= bStart && ts < bEnd;
      }).length;
      const accepted = filteredPitches.filter((p) => {
        const ts = new Date(p.createdAt).getTime();
        return ts >= bStart && ts < bEnd && p.status === 'accepted';
      }).length;
      buckets.push({ label, revenue, bounties, net: revenue - bounties, units: inBucket.length, sent, accepted });
    }
    return buckets;
  }, [filteredDailyAnalytics, hasDailyAnalytics, filteredOrders, filteredPitches, start, end]);

  const maxRevenue = Math.max(1, ...trendData.map((d) => d.revenue));

  // --- Photo Review Engagement ---
  const deliveredOrders = useMemo(
    () => filteredOrders.filter((o) => o.status === 'delivered').length,
    [filteredOrders],
  );
  const photoReviews = useMemo(
    () => filteredReviews.filter((r) => r.image && r.bountyClaimed).length,
    [filteredReviews],
  );
  const engagementRate = useMemo(
    () => (deliveredOrders > 0 ? (photoReviews / deliveredOrders) * 100 : 0),
    [photoReviews, deliveredOrders],
  );

  // --- Top Keywords driving conversions ---
  const keywordData = useMemo(() => {
    const counts: Record<string, { count: number; revenue: number }> = {};
    const orderProductIds = new Set(filteredOrders.map((o) => o.productId));
    products
      .filter((p) => orderProductIds.has(p.id))
      .forEach((p) => {
        p.keywords.forEach((kw) => {
          if (!counts[kw]) counts[kw] = { count: 0, revenue: 0 };
          counts[kw].count += 1;
          counts[kw].revenue += filteredOrders
            .filter((o) => o.productId === p.id)
            .reduce((sum, o) => sum + Number(o.totalPrice ?? 0), 0);
        });
      });
    return Object.entries(counts)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 8);
  }, [filteredOrders, products]);

  const maxKeywordRevenue = Math.max(1, ...keywordData.map(([, v]) => v.revenue));

  // --- Per-product breakdown (live from filteredProducts + filteredOrders) ---
  const productBreakdown = useMemo(
    () =>
      filteredProducts
        .map((p) => {
          const sold = Number(p.soldCount ?? 0);
          const price = Number(p.priceInr ?? 0);
          const bounty = Number(p.autoBounty ?? 0);
          const orderGross = filteredOrders
            .filter((o) => o.productId === p.id)
            .reduce((sum, o) => sum + Number(o.totalPrice ?? 0), 0);
          const orderBounty = filteredOrders
            .filter((o) => o.productId === p.id)
            .reduce((sum, o) => sum + Number(o.productBounty ?? 0), 0);
          return {
            id: p.id,
            title: p.title,
            image: p.images[0] ?? '',
            sold,
            gross: Math.max(Number(p.grossSales ?? sold * price), orderGross),
            bounty: Math.max(Number(p.bountiesPaid ?? sold * bounty), orderBounty),
            net: Math.max(Number(p.netRevenue ?? sold * price - sold * bounty), orderGross - orderBounty),
          };
        })
        .sort((a, b) => b.gross - a.gross),
    [filteredProducts, filteredOrders],
  );

  const maxBreakdownGross = Math.max(1, ...productBreakdown.map((p) => p.gross));

  return (
    <BrandLayout>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">Analytics Dashboard</h1>
          <p className="text-sm text-platinum/70">
            Real-time ROI metrics, conversion trends, and engagement insights.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-[#1F1F24] bg-[#0C0C0F] p-4">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">
              Product
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-[#00E676]/50 [color-scheme:dark]"
            >
              <option value="all">All Products (Overall)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">
              Timeline
            </label>
            <div className="relative">
              <Calendar size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-platinum" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className="w-full appearance-none rounded-xl border border-[#1F1F24] bg-[#060608] py-2.5 pl-9 pr-8 text-sm text-white outline-none transition-all focus:border-[#00E676]/50 [color-scheme:dark]"
              >
                {RANGE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {timeRange === 'custom' && (
            <div className="flex items-end gap-3">
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-[#00E676]/50 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">
                  End Date
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-[#00E676]/50 [color-scheme:dark]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Active Filter Summary */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-platinum/50">
          <span>Showing:</span>
          <span className="rounded-full bg-[#00E676]/10 px-2.5 py-1 font-medium text-[#00E676]">
            {selectedProductId === 'all' ? 'All Products' : products.find((p) => p.id === selectedProductId)?.title ?? 'All Products'}
          </span>
          <span className="rounded-full bg-blue-400/10 px-2.5 py-1 font-medium text-blue-400">
            {RANGE_OPTIONS.find((r) => r.value === timeRange)?.label}
          </span>
          <span className="rounded-full bg-[#1F1F24] px-2.5 py-1 font-medium text-platinum/70">
            {totalUnitsOrOrders} orders · {filteredPitches.length} pitches
          </span>
        </div>

        {/* Stat Cards — all values re-render live with filters */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Gross Revenue"
            value={`₹${grossRevenue.toLocaleString('en-IN')}`}
            icon={<IndianRupee size={18} />}
            accent="emerald"
          />
          <StatCard
            label="Pitch Conversion"
            value={`${pitchConversionRate.toFixed(1)}%`}
            sub={`${acceptedPitches} / ${filteredPitches.length} pitches`}
            icon={<Target size={18} />}
            accent="blue"
          />
          <StatCard
            label="Bounties Paid"
            value={`₹${totalBountiesPaid.toLocaleString('en-IN')}`}
            sub={`VIP: ₹${vipBountiesPaid.toLocaleString('en-IN')} · Photo: ₹${photoReviewBounties.toLocaleString('en-IN')}`}
            icon={<Wallet size={18} />}
            accent="amber"
          />
          <StatCard
            label="Net Brand Margin"
            value={`₹${netProfit.toLocaleString('en-IN')}`}
            icon={<TrendingUp size={18} />}
            accent="violet"
          />
        </div>

        {/* Per-Product Breakdown — live from filteredProducts + filteredOrders */}
        <div className="rounded-2xl border border-[#1F1F24] bg-[#0C0C0F] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Package size={16} className="text-[#00E676]" />
            <h3 className="text-sm font-semibold text-white">Product Performance Breakdown</h3>
          </div>
          {productBreakdown.length === 0 ? (
            <ChartEmptyState message="No products match the current filter." />
          ) : (
            <div className="space-y-3">
              {productBreakdown.map((p) => (
                <div key={p.id} className="flex items-center gap-4">
                  {p.image && (
                    <img src={p.image} alt={p.title} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-white">{p.title}</span>
                      <span className="shrink-0 text-xs font-semibold text-[#00E676]">₹{p.gross.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-lg bg-[#1F1F24]">
                      <motion.div
                        key={`${p.id}-${p.gross}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${(p.gross / maxBreakdownGross) * 100}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full rounded-lg bg-gradient-to-r from-[#00E676]/40 to-[#00E676]"
                      />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-platinum/60">
                      <span>{p.sold} sold</span>
                      <span className="text-amber-400/80">Bounty: ₹{p.bounty.toLocaleString('en-IN')}</span>
                      <span className="text-blue-400/80">Net: ₹{p.net.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Revenue & Pitch Trend — re-renders on filter change */}
          <div className="rounded-2xl border border-[#1F1F24] bg-[#0C0C0F] p-5">
            <div className="mb-4 flex items-center gap-2">
              <LineChartIcon size={16} className="text-[#00E676]" />
              <h3 className="text-sm font-semibold text-white">Revenue Trend & Pitch Performance</h3>
            </div>
            {trendData.every((d) => d.revenue === 0) ? (
              <div className="space-y-3">
                <div className="flex items-end gap-1.5 border-b border-l border-[#1F1F24] px-2 pb-0 pt-8" style={{ height: 180 }}>
                  {trendData.map((bucket) => (
                    <div key={bucket.label} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                      <span className="absolute -top-6 text-[9px] font-medium text-platinum/60">₹0</span>
                      <div className="h-1/4 w-full rounded-t border border-dashed border-[#00E676]/30 bg-transparent" />
                      <span className="absolute -bottom-5 max-w-full truncate text-[9px] text-platinum/50">
                        {bucket.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between px-2 text-[9px] text-platinum/40">
                  <span>₹0</span>
                  <span>Revenue by period</span>
                  <span>₹0</span>
                </div>
                <p className="pt-2 text-center text-xs text-platinum/60">
                  No recorded sales for this product in selected timeline.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-end gap-1.5 border-b border-l border-[#1F1F24] px-2 pb-0 pt-8" style={{ height: 180 }}>
                  {trendData.map((bucket) => {
                    const height = Math.max((bucket.revenue / maxRevenue) * 100, 4);
                    return (
                      <div key={bucket.label} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                        <span className="absolute -top-6 whitespace-nowrap text-[9px] font-medium text-white">
                          ₹{bucket.revenue.toLocaleString('en-IN')}
                        </span>
                        <div
                          className="w-full rounded-t border border-[#00E676]/50 bg-[#00E676]/60 transition-colors duration-200 group-hover:bg-[#00E676]"
                          style={{ height: `${height}%` }}
                          title={`Revenue: ₹${bucket.revenue.toLocaleString('en-IN')}`}
                        />
                        <span className="absolute -bottom-5 max-w-full truncate text-[9px] text-platinum/50">
                          {bucket.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between px-2 text-[9px] text-platinum/40">
                  <span>₹0</span>
                  <span>Revenue by period</span>
                  <span>₹{maxRevenue.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center gap-4 pt-2 text-[10px] text-platinum/60">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-[#00E676]" /> Sales revenue
                  </span>
                  <span>Bars show filtered orders; pitch count: {filteredPitches.length}</span>
                </div>
              </div>
            )}
          </div>

          {/* Photo Review Engagement — dynamically computed */}
          <div className="rounded-2xl border border-[#1F1F24] bg-[#0C0C0F] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Camera size={16} className="text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Photo Review Engagement</h3>
            </div>
            <div className="flex flex-col items-center justify-center gap-4 py-4">
              {deliveredOrders === 0 && photoReviews === 0 ? (
                <ChartEmptyState
                  compact
                  message={
                    selectedProductId !== 'all'
                      ? 'No reviews or deliveries for this product in the selected date range'
                      : 'No review data in this range.'
                  }
                />
              ) : (<>
              {/* Donut */}
              <div className="relative h-40 w-40">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#1F1F24" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="#FFB300"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(engagementRate / 100) * 264} 264`}
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-white">{engagementRate.toFixed(0)}%</span>
                  <span className="text-[10px] uppercase tracking-wider text-platinum/50">Engagement</span>
                </div>
              </div>
              <div className="grid w-full grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#1F1F24] bg-[#060608] p-3 text-center">
                  <p className="text-lg font-semibold text-white">{deliveredOrders}</p>
                  <p className="text-[10px] uppercase tracking-wider text-platinum/50">Delivered Orders</p>
                </div>
                <div className="rounded-xl border border-[#1F1F24] bg-[#060608] p-3 text-center">
                  <p className="text-lg font-semibold text-amber-400">{photoReviews}</p>
                  <p className="text-[10px] uppercase tracking-wider text-platinum/50">Photo Reviews</p>
                </div>
              </div>
              </>
              )}
            </div>
          </div>
        </div>

        {/* Top Keywords — dynamically computed from filtered orders */}
        <div className="rounded-2xl border border-[#1F1F24] bg-[#0C0C0F] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Search size={16} className="text-[#00E676]" />
            <h3 className="text-sm font-semibold text-white">Top Performing Keywords & Demand Intents</h3>
          </div>
          {keywordData.length === 0 ? (
            <ChartEmptyState
              message={
                selectedProductId !== 'all'
                  ? 'No keyword conversions for this product in the selected date range'
                  : 'No conversions in this filter range.'
              }
            />
          ) : (
            <div className="space-y-2.5">
              {keywordData.map(([keyword, data]) => (
                <div key={keyword} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-sm text-platinum">{keyword}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-lg bg-[#1F1F24]">
                    <motion.div
                      key={`${keyword}-${data.revenue}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(data.revenue / maxKeywordRevenue) * 100}%` }}
                      transition={{ duration: 0.5 }}
                      className="flex h-full items-center justify-end rounded-lg bg-gradient-to-r from-[#00E676]/20 to-[#00E676]/60 pr-2"
                    >
                      <span className="text-[10px] font-medium text-white">₹{data.revenue.toLocaleString('en-IN')}</span>
                    </motion.div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </BrandLayout>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: 'emerald' | 'blue' | 'amber' | 'violet';
}) {
  const accents: Record<string, string> = {
    emerald: 'text-[#00E676] bg-[#00E676]/10 border-[#00E676]/20',
    blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    amber: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    violet: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  };
  return (
    <motion.div
      key={`${label}-${value}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-[#1F1F24] bg-[#0C0C0F] p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${accents[accent]}`}>
          {icon}
        </div>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-platinum/50">{sub}</p>}
    </motion.div>
  );
}

function ChartEmptyState({ message, compact }: { message: string; compact?: boolean }) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#1F1F24] bg-[#060608] text-center ${compact ? 'py-6' : 'py-10'}`}
    >
      <div className="h-8 w-8 rounded-full border-2 border-[#1F1F24] border-t-[#00E676]/40" />
      <p className="max-w-xs text-xs text-platinum/50">{message}</p>
    </div>
  );
}
