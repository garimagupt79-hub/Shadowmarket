import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Flame,
  Building2,
  CheckCircle,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Lock,
  Star,
  Zap,
  Filter,
  ArrowUpDown,
  Crown,
  ShoppingBag,
} from 'lucide-react';
import { useMarket, getActiveWaveOrders, getCurrentWaveTier } from '../context/MarketContext';
import { ConsumerLayout } from '../components/ConsumerLayout';
import { ProductCarousel } from '../components/ProductCarousel';
import { VariantSelector } from '../components/VariantSelector';
import { ReviewModal } from '../components/ReviewModal';
import { AddressGuardModal } from '../components/AddressGuardModal';
import { DirectCheckoutModal } from '../components/DirectCheckoutModal';
import { EmptyState } from '../components/EmptyState';
import { Lightbox } from '../components/Lightbox';
import { type Intent, type Product, type SyndicateWave } from '../types';
import { rankProductsByIntent } from '../utils/intentMatcher';

type PriceFilter = 'all' | 'under2k' | '2k5k' | '5kplus';
type SortMode = 'relevance' | 'fairValue' | 'sales' | 'priceLowHigh' | 'priceHighLow';

type ScoredProduct = Product & {
  fairValueScore: number;
  netPrice: number;
  yieldPercentage: number;
  salesCount: number;
  avgRating: number;
  reviewCount: number;
  isPremiumTier: boolean;
};

export function ConsumerIntentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  void navigate;
  const {
    intents,
    products,
    salesAnalytics,
    brandProfile,
    reviews,
    pushToast,
    addToBag,
    syndicateWaves,
    orders,
  } = useMarket();

  const [selections, setSelections] = useState<
    Record<string, { size: string | null; color: string | null }>
  >({});
  const [reviewModal, setReviewModal] = useState<{ open: boolean; productId: string }>({
    open: false,
    productId: '',
  });
  const [pendingPurchase, setPendingPurchase] = useState<{
    intent: Intent;
    product: Product;
  } | null>(null);
  const [addressGuardOpen, setAddressGuardOpen] = useState(false);
  const [directCheckout, setDirectCheckout] = useState<{
    intent: Intent;
    product: Product;
    initialSize: string;
    initialColor: string;
  } | null>(null);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [ratingFilter, setRatingFilter] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  const [lightbox, setLightbox] = useState<{
    images: string[];
    startIndex: number;
    alt: string;
  } | null>(null);
  const carouselIndexes = useRef<Record<string, number>>({});

  const intent = useMemo(
    () => intents.find((i) => i.id === id),
    [intents, id],
  );

  const matchedProducts = useMemo(() => {
    if (!intent) return [];
    return rankProductsByIntent(intent.searchQuery, products);
  }, [intent, products]);

  const rankedOrder = useMemo(
    () => new Map(matchedProducts.map((p, i) => [p.id, i])),
    [matchedProducts],
  );

  const salesCountByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const sale of salesAnalytics) {
      map[sale.productTitle] = (map[sale.productTitle] || 0) + 1;
    }
    for (const order of orders) {
      if (order.status === 'cancelled') continue;
      map[order.productTitle] = (map[order.productTitle] || 0) + 1;
    }
    return map;
  }, [salesAnalytics, orders]);

  // Fair-Value calculator + scoring
  const scoredProducts = useMemo<ScoredProduct[]>(() => {
    const isVerified = brandProfile.isCorporateVerified;

    // category median for premium tier detection
    const categoryNetPrices: Record<string, number[]> = {};
    for (const p of matchedProducts) {
      const net = Math.max(p.priceInr - p.autoBounty, 1);
      if (!categoryNetPrices[p.category]) categoryNetPrices[p.category] = [];
      categoryNetPrices[p.category].push(net);
    }
    const categoryMedians: Record<string, number> = {};
    for (const [cat, prices] of Object.entries(categoryNetPrices)) {
      const sorted = [...prices].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      categoryMedians[cat] = sorted[mid] ?? 0;
    }

    return matchedProducts.map((p) => {
      const netPrice = Math.max(p.priceInr - p.autoBounty, 1);
      const yieldPercentage = (p.autoBounty / p.priceInr) * 100;
      const valueDensity = (yieldPercentage / netPrice) * 10000;
      const trustBoost = isVerified ? 25 : 0;
      const productReviews = reviews.filter((r) => r.productId === p.id);
      const avgRating =
        productReviews.length > 0
          ? productReviews.reduce((sum, r) => sum + r.rating, 0) /
            productReviews.length
          : 5.0;
      const ratingScore = avgRating * 20;
      const salesCount = salesCountByProduct[p.title] || 0;
      const salesWeight = Math.min(salesCount, 50);
      const fairValueScore =
        valueDensity + trustBoost + ratingScore + salesWeight;
      const median = categoryMedians[p.category] ?? 0;
      const isPremiumTier = median > 0 && netPrice > median * 1.5;
      return {
        ...p,
        fairValueScore,
        netPrice,
        yieldPercentage,
        salesCount,
        avgRating: productReviews.length > 0 ? avgRating : 0,
        reviewCount: productReviews.length,
        isPremiumTier,
      };
    });
  }, [matchedProducts, brandProfile.isCorporateVerified, reviews, salesCountByProduct]);

  // Filter + sort
  const displayProducts = useMemo(() => {
    let result = [...scoredProducts];

    // price filter
    if (priceFilter !== 'all') {
      result = result.filter((p) => {
        if (priceFilter === 'under2k') return p.priceInr < 2000;
        if (priceFilter === '2k5k') return p.priceInr >= 2000 && p.priceInr <= 5000;
        return p.priceInr > 5000;
      });
    }

    // rating filter
    if (ratingFilter) {
      result = result.filter(
        (p) => p.reviewCount === 0 || p.avgRating >= 4,
      );
    }

    // sort
    if (sortMode === 'relevance') {
      // rankedProducts already carries the engine's relevance order
      result.sort((a, b) => rankedOrder.get(a.id)! - rankedOrder.get(b.id)!);
      return result;
    }

    result.sort((a, b) => {
      switch (sortMode) {
        case 'sales':
          return b.salesCount - a.salesCount;
        case 'priceLowHigh':
          return a.priceInr - b.priceInr;
        case 'priceHighLow':
          return b.priceInr - a.priceInr;
        default:
          return b.fairValueScore - a.fairValueScore;
      }
    });

    return result;
  }, [scoredProducts, rankedOrder, priceFilter, ratingFilter, sortMode]);

  const getSel = (key: string) =>
    selections[key] || { size: null, color: null };
  const updateSel = (
    key: string,
    patch: Partial<{ size: string; color: string }>,
  ) =>
    setSelections((s) => ({
      ...s,
      [key]: { ...getSel(key), ...patch },
    }));

  const getWaveInfo = (productId: string) => {
    const wave = syndicateWaves.find(
      (w: SyndicateWave) => w.status === 'active' && w.productId === productId && Date.now() < w.startTime + w.durationMs,
    );
    if (!wave) return null;
    const activeOrders = getActiveWaveOrders(wave, orders);
    const currentUnits = wave.currentUnits ?? activeOrders.length;
    const currentTier = getCurrentWaveTier(wave, currentUnits);
    const currentBounty = Math.round(wave.productPrice * (currentTier.bountyPercent / 100));
    const sortedTiers = [...wave.tiers].sort((a, b) => a.thresholdUnits - b.thresholdUnits);
    const nextTier = sortedTiers.find((t) => t.thresholdUnits > activeOrders.length);
    const timeRemaining = wave.startTime + wave.durationMs - Date.now();
    return { wave, activeCount: currentUnits, currentTier, currentBounty, nextTier, timeRemaining };
  };

  const handleClaim = (intentObj: Intent, product: Product) => {
    const sel = getSel(product.id);
    setDirectCheckout({
      intent: intentObj,
      product,
      initialSize: sel.size ?? product.sizes[0] ?? '',
      initialColor: sel.color ?? product.colors[0] ?? '',
    });
  };

  const handleAddToBag = (product: Product) => {
    const sel = getSel(product.id);
    addToBag({
      productId: product.id,
      productTitle: product.title,
      brandName: product.brandName,
      image: product.images[0] ?? '',
      priceInr: product.priceInr,
      autoBounty: product.autoBounty,
      size: sel.size ?? product.sizes[0] ?? '',
      color: sel.color ?? product.colors[0] ?? '',
      quantity: 1,
    });
    pushToast('success', 'Added to Bag! 🛍️');
  };

  const handleAddressComplete = (_addressId: string) => {
    setAddressGuardOpen(false);
    if (pendingPurchase) {
      const sel = getSel(pendingPurchase.product.id);
      setDirectCheckout({
        intent: pendingPurchase.intent,
        product: pendingPurchase.product,
        initialSize: sel.size ?? pendingPurchase.product.sizes[0] ?? '',
        initialColor: sel.color ?? pendingPurchase.product.colors[0] ?? '',
      });
      setPendingPurchase(null);
    }
  };

  if (!intent) {
    return (
      <ConsumerLayout>
        <EmptyState
          icon={<AlertTriangle size={28} />}
          title="Intent not found."
          subtitle="This search thread no longer exists."
        />
      </ConsumerLayout>
    );
  }

  return (
    <ConsumerLayout>
      {/* Back navigation */}
      <button
        onClick={() => navigate('/consumer/dashboard')}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-platinum transition-colors duration-300 hover:text-white"
      >
        <ChevronLeft size={16} />
        Back to Active Searches
      </button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tighter text-white">
          Market Results for:{' '}
          <span className="text-[#00E676]">{intent.searchQuery}</span>
        </h1>
        <p className="mt-1.5 text-sm text-platinum">
          {displayProducts.length} product{displayProducts.length === 1 ? '' : 's'}{' '}
          matched · Sorted by{' '}
          {sortMode === 'relevance'
            ? 'Relevance'
            : sortMode === 'fairValue'
            ? 'Fair-Value Score'
            : sortMode === 'sales'
              ? 'Sales Volume (A9)'
              : sortMode === 'priceLowHigh'
                ? 'Price: Low-High'
                : 'Price: High-Low'}
        </p>
      </div>

      {/* Filter & Sort Bar */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#1F1F24] bg-[#111114] p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Price filters */}
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-platinum" />
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">Price:</span>
          {([
            { key: 'all', label: 'All' },
            { key: 'under2k', label: 'Under ₹2k' },
            { key: '2k5k', label: '₹2k-₹5k' },
            { key: '5kplus', label: '₹5k+' },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setPriceFilter(f.key)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all duration-300 ${
                priceFilter === f.key
                  ? 'bg-[#00E676]/10 text-[#00E676]'
                  : 'text-platinum hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Rating filter */}
        <button
          onClick={() => setRatingFilter((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all duration-300 ${
            ratingFilter
              ? 'bg-amber-400/10 text-amber-400'
              : 'text-platinum hover:text-white'
          }`}
        >
          <Star size={12} className={ratingFilter ? 'fill-amber-400' : ''} />
          4★+
        </button>

        {/* Sort dropdown */}
        <div className="flex items-center gap-2">
          <ArrowUpDown size={13} className="text-platinum" />
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rounded-lg border border-[#1F1F24] bg-[#060608] px-3 py-1.5 text-[11px] font-medium text-white transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-[#00E676]"
          >
            <option value="relevance" className="bg-[#060608]">Relevance</option>
            <option value="fairValue" className="bg-[#060608]">Fair-Value Score</option>
            <option value="sales" className="bg-[#060608]">Highest Sales (A9)</option>
            <option value="priceLowHigh" className="bg-[#060608]">Price: Low-High</option>
            <option value="priceHighLow" className="bg-[#060608]">Price: High-Low</option>
          </select>
        </div>
      </div>

      {displayProducts.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle size={28} />}
          title="No matched products."
          subtitle="The catalog has no listings matching this intent (or current filters)."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {displayProducts.map((product: ScoredProduct, idx: number) => {
            const sel = getSel(product.id);
            const canBuy = !!sel.size && !!sel.color && brandProfile.isCorporateVerified;
            const isClaiming = false;
            const isBrandVerified = brandProfile.isCorporateVerified;
            const waveInfo = getWaveInfo(product.id);
            const displayBounty = waveInfo ? waveInfo.currentBounty : product.autoBounty;

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#060608] transition-all duration-300 hover:border-platinum/20"
              >
                <div
                  onClick={() =>
                    setLightbox({
                      images: product.images,
                      startIndex: carouselIndexes.current[product.id] ?? 0,
                      alt: product.title,
                    })
                  }
                  className="cursor-pointer"
                >
                  <ProductCarousel
                    images={product.images}
                    onIndexChange={(i) => {
                      carouselIndexes.current[product.id] = i;
                    }}
                    badge={
                      <>
                        {waveInfo && (
                          <div className="inline-flex items-center gap-1 rounded-full border border-[#FF6B35]/50 bg-[#FF6B35]/25 px-2 py-1 text-[9px] font-bold text-[#FF8C42] backdrop-blur-md">
                            <Flame size={9} />
                            Wave Tier {waveInfo.currentTier.tierNumber}
                          </div>
                        )}
                        {product.isPremiumTier && (
                          <div className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-black/70 px-2 py-1 text-[9px] font-semibold text-amber-400 backdrop-blur-md">
                            <Crown size={9} />
                            Premium Tier
                          </div>
                        )}
                      </>
                    }
                  />
                </div>

                <div className="flex flex-1 flex-col p-3 md:p-4">
                  {/* Brand name + verification shield */}
                  <div className="flex items-center gap-1">
                    <Building2 size={10} className="text-platinum" />
                    <span className="truncate text-[9px] font-medium uppercase tracking-[0.15em] text-platinum">
                      {product.brandName}
                    </span>
                    {isBrandVerified && (
                      <span className="group relative inline-flex shrink-0">
                        <ShieldCheck
                          size={12}
                          className="text-[#635BFF] drop-shadow-[0_0_4px_rgba(99,91,255,0.5)]"
                        />
                        <span className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-48 whitespace-normal rounded-lg border border-[#1F1F24] bg-[#111114] px-3 py-2 text-[9px] font-medium text-platinum opacity-0 shadow-xl transition-opacity duration-300 group-hover:opacity-100">
                          Corporate Identity Verified by Middesk. Funds Secured
                          by Stripe Escrow.
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Product title */}
                  <h3 className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug text-white md:text-sm">
                    {product.title}
                  </h3>

                  {/* Product description */}
                  {product.teaser && (
                    <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-platinum/60">
                      {product.teaser}
                    </p>
                  )}

                  {/* Rating & Reviews trigger */}
                  <button
                    onClick={() =>
                      setReviewModal({ open: true, productId: product.id })
                    }
                    className="mt-1 inline-flex items-center gap-1 text-left"
                  >
                    {product.reviewCount > 0 ? (
                      <>
                        <Star size={11} className="fill-amber-400 text-amber-400" />
                        <span className="text-[10px] font-semibold text-white">
                          {product.avgRating.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-platinum">
                          ({product.reviewCount})
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] text-platinum/70 transition-colors duration-300 hover:text-platinum">
                        Be the first to review
                      </span>
                    )}
                  </button>

                  {/* Price + Cash Back */}
                  <p className="mt-2 text-sm font-bold text-white md:text-base">
                    ₹{product.priceInr.toLocaleString('en-IN')}
                  </p>
                  <div className="mt-1 inline-flex items-center gap-1 self-start rounded-md border border-[#00E676]/30 bg-[#00E676]/10 px-2 py-0.5 text-[10px] font-semibold text-[#00E676]">
                    <Zap size={10} />
                    Cash Back: ₹{displayBounty.toLocaleString('en-IN')}
                    {waveInfo && waveInfo.currentBounty > product.autoBounty && (
                      <span className="ml-1 rounded bg-[#FF6B35]/20 px-1 text-[8px] text-[#FF8C42]">
                        +{Math.round(((waveInfo.currentBounty - product.autoBounty) / product.autoBounty) * 100)}%
                      </span>
                    )}
                  </div>
                  {waveInfo && (
                    <div className="mt-2 rounded-xl border border-[#FF6B35]/25 bg-[#0A0A0C]/80 p-3 space-y-2.5">
                      <div className="flex items-center justify-between text-[9px] font-semibold">
                        <span className="inline-flex items-center gap-1 text-[#FF8C42]">
                          <Flame size={10} />
                          Live Wave · {waveInfo.activeCount} orders
                        </span>
                        <span className="font-mono text-platinum/70">
                          {Math.floor(waveInfo.timeRemaining / 3600000)}h {Math.floor((waveInfo.timeRemaining % 3600000) / 60000)}m left
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        {waveInfo.wave.tiers.map((tier) => {
                          const tierCash = Math.round(product.priceInr * (tier.bountyPercent / 100));
                          const isCurrent = waveInfo.currentTier.tierNumber === tier.tierNumber;
                          const isPassed = waveInfo.activeCount >= tier.thresholdUnits;
                          return (
                            <div
                              key={tier.tierNumber}
                              className={`rounded-lg border p-2 flex flex-col items-center justify-between transition-all ${
                                isCurrent
                                  ? 'bg-[#00E676]/10 border-[#00E676]/50 shadow-[0_0_12px_rgba(0,230,118,0.15)]'
                                  : isPassed
                                    ? 'bg-[#111114] border-[#2A2A2E] opacity-80'
                                    : 'bg-[#060608]/60 border-[#1F1F24] opacity-50'
                              }`}
                            >
                              <div className="flex items-center gap-1">
                                <span className="text-[8px] uppercase font-bold text-platinum">T{tier.tierNumber}</span>
                                {isCurrent && <span className="h-1 w-1 rounded-full bg-[#00E676] animate-pulse" />}
                              </div>
                              <span className="text-[8px] text-platinum/70 mt-0.5">{tier.thresholdUnits}+ ord</span>
                              <span className={`text-[11px] font-extrabold mt-0.5 ${isCurrent ? 'text-[#00E676]' : 'text-white'}`}>
                                ₹{tierCash.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[8px] text-platinum/50">{tier.bountyPercent}%</span>
                            </div>
                          );
                        })}
                      </div>
                      {waveInfo.nextTier ? (
                        <p className="text-[9px] text-platinum/60 text-center">
                          Only <span className="text-[#00E676] font-bold">{waveInfo.nextTier.thresholdUnits - waveInfo.activeCount} more orders</span> to upgrade everyone to <span className="text-[#00E676] font-bold">₹{Math.round(product.priceInr * (waveInfo.nextTier.bountyPercent / 100)).toLocaleString('en-IN')}</span>
                        </p>
                      ) : (
                        <p className="text-[9px] text-[#00E676] font-medium text-center">
                          Maximum Peak Tier 3 unlocked for all buyers!
                        </p>
                      )}
                    </div>
                  )}

                  {/* Verification status */}
                  {isBrandVerified ? (
                    <div className="group mt-1.5 inline-flex items-center gap-1 text-[9px] font-semibold text-amber-400">
                      <CheckCircle size={10} className="text-amber-400" />
                      Official Brand
                      <span className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-48 whitespace-normal rounded-lg border border-[#1F1F24] bg-[#111114] px-3 py-2 text-[9px] text-platinum opacity-0 shadow-xl transition-opacity duration-300 group-hover:opacity-100">
                        Verified Legal Entity:{' '}
                        {brandProfile.legalCorporateName} via D-U-N-S
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-semibold text-red-400">
                      <AlertTriangle size={10} className="text-red-400" />
                      Unverified Seller
                    </div>
                  )}

                  {/* Variant selectors */}
                  <div className="mt-3 space-y-2.5">
                    <VariantSelector
                      label="Size"
                      options={product.sizes}
                      selected={sel.size}
                      onSelect={(v) => updateSel(product.id, { size: v })}
                    />
                    <VariantSelector
                      label="Color"
                      options={product.colors}
                      selected={sel.color}
                      onSelect={(v) => updateSel(product.id, { color: v })}
                    />
                  </div>

                  {/* Purchase + Add to Bag buttons */}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleClaim(intent, product)}
                      disabled={!canBuy || isClaiming}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-300 ease-in-out disabled:cursor-not-allowed md:text-sm ${
                        !isBrandVerified
                          ? 'border border-red-500/30 bg-red-500/5 text-red-400/70'
                          : 'border border-[#00E676]/40 bg-[#00E676]/10 text-[#00E676] shadow-[0_0_20px_rgba(0,230,118,0.15)] hover:bg-[#00E676]/20 disabled:border-[#1F1F24] disabled:bg-[#060608] disabled:text-platinum disabled:shadow-none'
                      }`}
                    >
                      {!isBrandVerified ? (
                        <>
                          <Lock size={13} />
                          Unverified
                        </>
                      ) : (
                        <>
                          <Sparkles size={13} />
                          Purchase
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleAddToBag(product)}
                      disabled={!sel.size || !sel.color}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2.5 text-xs font-semibold text-platinum transition-all duration-300 hover:border-[#00E676] hover:text-[#00E676] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShoppingBag size={13} />
                      Add to Bag
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <ReviewModal
        open={reviewModal.open}
        onClose={() => setReviewModal({ open: false, productId: '' })}
        productId={reviewModal.productId}
      />
      <DirectCheckoutModal
        intent={directCheckout?.intent ?? null}
        product={directCheckout?.product ?? null}
        open={!!directCheckout}
        initialSize={directCheckout?.initialSize}
        initialColor={directCheckout?.initialColor}
        onClose={() => setDirectCheckout(null)}
      />
      <AddressGuardModal
        open={addressGuardOpen}
        onClose={() => {
          setAddressGuardOpen(false);
          setPendingPurchase(null);
        }}
        onComplete={handleAddressComplete}
      />
      <Lightbox
        images={lightbox?.images ?? []}
        startIndex={lightbox?.startIndex ?? 0}
        alt={lightbox?.alt ?? ''}
        open={!!lightbox}
        onClose={() => setLightbox(null)}
      />
    </ConsumerLayout>
  );
}
