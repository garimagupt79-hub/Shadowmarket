import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Boxes,
  Plus,
  Package,
  Building2,
  Zap,
  Edit3,
  X,
  Check,
  Image as ImageIcon,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { BrandLayout } from '../components/BrandLayout';
import type { Product } from '../types';

const PRICE_COOLDOWN_DAYS = 7;

export function BrandCatalog() {
  const { products, updateProduct, toggleImageReviewBounty, pushToast } = useMarket();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftPrice, setDraftPrice] = useState(0);
  const [draftBounty, setDraftBounty] = useState(0);
  const [draftStock, setDraftStock] = useState(0);
  const [reviewAmount, setReviewAmount] = useState(20);
  const [priceError, setPriceError] = useState('');
  const [bountyError, setBountyError] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const selected = products.find((p) => p.id === selectedId) ?? null;

  const openProduct = (p: Product) => {
    setSelectedId(p.id);
    setEditMode(false);
    setDraftTitle(p.title);
    setDraftPrice(p.priceInr);
    setDraftBounty(p.autoBounty);
    setDraftStock(p.stockQuantity ?? p.variants.reduce((s, v) => s + v.stock, 0));
    setReviewAmount(p.imageReviewBountyAmount ?? 20);
    setPriceError('');
    setBountyError('');
  };

  const saveEdits = () => {
    if (!selected) return;
    const currentPrice = selected.priceInr;
    const maxPrice = Math.floor(currentPrice * 1.20);
    let finalPrice = draftPrice;
    let priceBlocked = false;

    if (draftPrice > currentPrice) {
      if (draftPrice > maxPrice) {
        finalPrice = maxPrice;
        setPriceError(`Price increases capped at +20% per update. Adjusted to ₹${maxPrice.toLocaleString('en-IN')}.`);
        priceBlocked = true;
      }
    }

    const minFivePctBounty = Math.ceil(finalPrice * 0.05);
    const currentBounty = selected.autoBounty;
    const minAllowedBounty = Math.max(minFivePctBounty, Math.ceil(currentBounty * 0.80));
    const requiredMinBounty = finalPrice > currentPrice ? minFivePctBounty : minFivePctBounty;
    const catalogBountyAutoAdjusted = finalPrice > currentPrice && currentBounty < requiredMinBounty;
    let finalBounty = catalogBountyAutoAdjusted
      ? requiredMinBounty
      : draftBounty;
    let bountyBlocked = false;

    if (finalBounty < minFivePctBounty) {
      setBountyError(`Product cashback bounty must be at least 5% (₹${minFivePctBounty}).`);
      setDraftBounty(minFivePctBounty);
      return;
    }

    if (draftBounty < minAllowedBounty && draftBounty >= minFivePctBounty) {
      finalBounty = minAllowedBounty;
      setBountyError(`Bounty cannot be reduced by more than 20% at a time. Lowest allowed value for this item is ₹${minAllowedBounty}.`);
      setDraftBounty(minAllowedBounty);
      bountyBlocked = true;
    }

    if (catalogBountyAutoAdjusted) {
      setDraftBounty(finalBounty);
    }

    if (finalBounty < minFivePctBounty) {
      setDraftBounty(minFivePctBounty);
      setBountyError(`Product cashback bounty must be at least 5% (₹${minFivePctBounty}).`);
      return;
    }

    if (bountyBlocked && !catalogBountyAutoAdjusted) return;

    updateProduct(selected.id, {
      title: draftTitle,
      priceInr: finalPrice,
      autoBounty: finalBounty,
      stockQuantity: draftStock,
    });

    if (catalogBountyAutoAdjusted) {
      pushToast('info', `Catalog Cashback Bounty auto-adjusted to ₹${finalBounty.toLocaleString('en-IN')} to meet marketplace listing guidelines.`);
    } else if (priceBlocked) {
      pushToast('info', `Price capped at +20% (₹${maxPrice.toLocaleString('en-IN')}). Price editing is locked for 7 days.`);
    } else if (draftPrice > currentPrice) {
      pushToast('info', 'Price updated. Price editing is locked for 7 days.');
    } else if (finalBounty < currentBounty) {
      pushToast('info', 'Bounty updated. Bounty editing is locked for 7 days.');
    } else {
      pushToast('success', 'Product details updated.');
    }

    setEditMode(false);
  };

  const handleToggleBounty = (enabled: boolean) => {
    if (!selected) return;
    const finalAmount = enabled ? Math.max(20, reviewAmount || 20) : 0;
    toggleImageReviewBounty(selected.id, enabled, finalAmount);
    pushToast(
      enabled ? 'success' : 'info',
      enabled
        ? `Image Review Bounty enabled at ₹${finalAmount}.`
        : 'Image Review Bounty disabled.',
    );
  };

  const handleApplyBountyAmount = () => {
    if (!selected) return;
    const finalAmount = Math.max(20, reviewAmount || 20);
    toggleImageReviewBounty(selected.id, true, finalAmount);
    pushToast('success', `Image Review Bounty updated to ₹${finalAmount}.`);
  };

  const editCooldownMs = PRICE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const priceCooldownLeft = selected?.priceLastEditedAt
    ? Math.max(0, selected.priceLastEditedAt + editCooldownMs - now)
    : 0;
  const bountyCooldownLeft = selected?.bountyLastEditedAt
    ? Math.max(0, selected.bountyLastEditedAt + editCooldownMs - now)
    : 0;
  const isPriceCooldownActive = priceCooldownLeft > 0;
  const isBountyCooldownActive = bountyCooldownLeft > 0;
  const minBountyForDraftPrice = selected ? Math.ceil((draftPrice || 0) * 0.05) : 0;
  const draftBountyTooLow = draftBounty > 0 && draftBounty < minBountyForDraftPrice;
  const canSaveEdits =
    !!selected &&
    draftBounty >= minBountyForDraftPrice &&
    !(selected.imageReviewBountyEnabled && reviewAmount < 20);
  const formatCooldown = (milliseconds: number) => {
    const days = Math.floor(milliseconds / (24 * 60 * 60 * 1000));
    const hours = Math.floor((milliseconds % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return `${days} Days, ${hours} Hours remaining`;
  };

  return (
    <BrandLayout>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter text-white">
            Product Catalog
          </h1>
          <p className="mt-1.5 text-sm text-platinum">
            Browse, edit, and manage cash back bounties across your full product lineup.
          </p>
        </div>
        <a
          href="/brand/catalog/new"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#00E676] px-4 py-2.5 text-sm font-semibold text-[#060608] transition-all duration-300 hover:bg-[#00C853]"
        >
          <Plus size={15} />
          Add New Product
        </a>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-10 text-center">
          <Boxes size={32} className="mx-auto text-platinum/40" />
          <p className="mt-3 text-sm font-semibold text-white">No products yet</p>
          <p className="mt-1 text-xs text-platinum/60">
            Publish your first product to start converting buyers.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p, idx) => {
            const totalStock = p.stockQuantity ?? p.variants.reduce((s, v) => s + v.stock, 0);
            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.04 }}
                onClick={() => openProduct(p)}
                className={`group cursor-pointer overflow-hidden rounded-2xl border bg-[#111114] transition-all duration-300 ${
                  selectedId === p.id
                    ? 'border-[#00E676]/50 shadow-[0_0_24px_rgba(0,230,118,0.12)]'
                    : 'border-[#1F1F24] hover:border-[#00E676]/30'
                }`}
              >
                <div className="relative h-40 overflow-hidden">
                  {p.images[0] ? (
                    <img
                      src={p.images[0]}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#060608] text-platinum/40">
                      <Package size={24} />
                    </div>
                  )}
                  {p.imageReviewBountyEnabled ? (
                    <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-[#00E676]/30 bg-[#060608]/80 px-1.5 py-0.5 text-[9px] font-semibold text-[#00E676] backdrop-blur-sm">
                      <ImageIcon size={9} />
                      📸 Image Bounty: ₹{p.imageReviewBountyAmount ?? 20}
                    </div>
                  ) : (
                    <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-[#1F1F24]/60 bg-[#060608]/80 px-1.5 py-0.5 text-[9px] font-medium text-platinum/60 backdrop-blur-sm">
                      <ImageIcon size={9} />
                      📸 Image Bounty: Disabled
                    </div>
                  )}
                  <div className="absolute left-2 top-2 flex flex-col gap-1">
                    <div className="inline-flex items-center gap-1 rounded-md border border-[#1F1F24]/60 bg-[#060608]/80 px-1.5 py-0.5 text-[9px] font-medium text-platinum/80 backdrop-blur-sm">
                      <Package size={9} />
                      {totalStock} in stock
                    </div>
                    {p.soldCount > 0 && (
                      <div className="inline-flex items-center gap-1 rounded-md border border-[#00E676]/30 bg-[#060608]/80 px-1.5 py-0.5 text-[9px] font-semibold text-[#00E676] backdrop-blur-sm">
                        {p.soldCount.toLocaleString('en-IN')} sold
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.15em] text-platinum/60">
                    <Building2 size={9} />
                    {p.brandName}
                  </div>
                  <h3 className="mt-1 truncate text-sm font-semibold text-white">
                    {p.title}
                  </h3>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-base font-bold text-white">
                      ₹{p.priceInr.toLocaleString('en-IN')}
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-md border border-[#00E676]/30 bg-[#00E676]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#00E676]">
                      <Zap size={8} />
                      ₹{p.autoBounty.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[9px] text-platinum/50">
                    {p.category} · {p.sizes.length} sizes · {p.colors.length} colors
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Product detail / edit drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedId(null)}
            />
            <motion.div
              className="relative h-full w-full max-w-md overflow-y-auto border-l border-[#1F1F24] bg-[#060608] p-6"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-white">
                  Product Details
                </h2>
                <button
                  onClick={() => setSelectedId(null)}
                  className="rounded-lg p-1 text-platinum transition-all hover:bg-[#111114] hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Image */}
              <div className="mb-5 h-48 overflow-hidden rounded-xl border border-[#1F1F24] bg-[#111114]">
                {selected.images[0] ? (
                  <img
                    src={selected.images[0]}
                    alt={selected.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-platinum/40">
                    <Package size={28} />
                  </div>
                )}
              </div>

              {editMode && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                  <p className="text-[11px] text-amber-400/90">
                    Notice: Updating the Base Price or Review Bounty will lock further edits for that specific field for 7 days.
                  </p>
                </div>
              )}

              {editMode && !isPriceCooldownActive && draftPrice > selected.priceInr && selected.autoBounty < Math.ceil(Math.min(draftPrice, Math.floor(selected.priceInr * 1.20)) * 0.05) && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#00E676]/30 bg-[#00E676]/10 p-3">
                  <Zap size={14} className="mt-0.5 shrink-0 text-[#00E676]" />
                  <p className="text-[11px] text-[#00E676]">
                    ℹ️ Catalog Cashback Bounty auto-adjusted to ₹{Math.ceil(Math.min(draftPrice, Math.floor(selected.priceInr * 1.20)) * 0.05).toLocaleString('en-IN')} (5% of new base price ₹{Math.min(draftPrice, Math.floor(selected.priceInr * 1.20)).toLocaleString('en-IN')}) to meet marketplace listing guidelines.
                  </p>
                </div>
              )}

              {editMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">
                      Product Title
                    </label>
                    <input
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      className="w-full rounded-xl border border-[#1F1F24] bg-[#111114] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00E676]/40"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">
                        Price (₹)
                      </label>
                      <input
                        type="number"
                        value={draftPrice || ''}
                        onChange={(e) => {
                          setDraftPrice(e.target.value === '' ? 0 : Number(e.target.value));
                          setPriceError('');
                        }}
                        disabled={isPriceCooldownActive}
                        className="w-full rounded-xl border border-[#1F1F24] bg-[#111114] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00E676]/40 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      {isPriceCooldownActive && (
                        <p className="mt-1 text-[10px] text-amber-400">Price locked for editing for {formatCooldown(priceCooldownLeft)}.</p>
                      )}
                      {priceError && (
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-[#FFB300]">
                          <AlertTriangle size={9} />
                          {priceError}
                        </p>
                      )}
                      {draftPrice > selected.priceInr && (
                        <p className="mt-1 text-[9px] text-platinum/50">
                          Max allowed: ₹{Math.floor(selected.priceInr * 1.20).toLocaleString('en-IN')} (+20%)
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">
                        Auto Bounty (₹)
                      </label>
                      <input
                        type="number"
                        value={draftBounty || ''}
                        onChange={(e) => {
                          setDraftBounty(e.target.value === '' ? 0 : Number(e.target.value));
                          setBountyError('');
                        }}
                        onBlur={() => {
                          const minFivePct = Math.ceil((draftPrice || 0) * 0.05);
                          if (draftBounty < minFivePct) {
                            setDraftBounty(minFivePct);
                            setBountyError(`Product cashback bounty must be at least 5% (₹${minFivePct}).`);
                          }
                        }}
                        disabled={isBountyCooldownActive}
                        min={minBountyForDraftPrice}
                        className="w-full rounded-xl border border-[#1F1F24] bg-[#111114] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00E676]/40 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      {isBountyCooldownActive && (
                        <p className="mt-1 text-[10px] text-amber-400">Bounty locked for editing for {formatCooldown(bountyCooldownLeft)}.</p>
                      )}
                      {bountyError && (
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-[#FFB300]">
                          <AlertTriangle size={9} />
                          {bountyError}
                        </p>
                      )}
                      {draftBountyTooLow && !bountyError && (
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-[#FF3B3B]">
                          <AlertTriangle size={9} />
                          Product cashback bounty must be at least 5% (₹{minBountyForDraftPrice}).
                        </p>
                      )}
                      {draftBounty < selected.autoBounty && !bountyError && (
                        <p className="mt-1 text-[9px] text-platinum/50">
                          Min allowed: ₹{Math.max(minBountyForDraftPrice, Math.ceil(selected.autoBounty * 0.80))} (-20% cap)
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">
                      Stock Quantity
                    </label>
                    <input
                      type="number"
                      value={draftStock || ''}
                      onChange={(e) => setDraftStock(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#1F1F24] bg-[#111114] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00E676]/40"
                    />
                    <p className="mt-1 text-[9px] text-platinum/50">
                      Total units available across all variants
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdits}
                      disabled={!canSaveEdits}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#00E676] px-4 py-2.5 text-sm font-semibold text-[#060608] transition-all hover:bg-[#00C853] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check size={14} />
                      Save Changes
                    </button>
                    <button
                      onClick={() => setEditMode(false)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#1F1F24] bg-[#111114] px-4 py-2.5 text-sm font-medium text-platinum transition-all hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">Title</p>
                    <p className="text-sm font-semibold text-white">{selected.title}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">Price</p>
                      <p className="text-sm font-bold text-white">₹{selected.priceInr.toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">Auto Bounty</p>
                      <p className="inline-flex items-center gap-1 text-sm font-bold text-[#00E676]">
                        <Zap size={11} />
                        ₹{selected.autoBounty.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">Stock Quantity</p>
                    <p className="text-sm font-semibold text-white">
                      {selected.stockQuantity ?? selected.variants.reduce((s, v) => s + v.stock, 0)} units
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">Category</p>
                    <p className="text-sm text-white">{selected.category}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">Keywords</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {selected.keywords.map((kw) => (
                        <span
                          key={kw}
                          className="rounded-md border border-[#1F1F24] bg-[#111114] px-1.5 py-0.5 text-[9px] text-platinum"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">Sizes</p>
                      <p className="text-xs text-white">{selected.sizes.join(', ') || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">Colors</p>
                      <p className="text-xs text-white">{selected.colors.join(', ') || '—'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditMode(true)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#1F1F24] bg-[#111114] px-4 py-2.5 text-sm font-medium text-platinum transition-all hover:border-[#00E676]/30 hover:text-white"
                  >
                    <Edit3 size={14} />
                    Edit Details
                  </button>
                </div>
              )}

              {/* Image Review Bounty toggle */}
              <div className="mt-6 rounded-xl border border-[#1F1F24] bg-[#111114] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck size={14} className="text-[#00E676]" />
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white">
                    Image Review Bounty
                  </h3>
                </div>
                <p className="mb-3 text-[10px] text-platinum/60">
                  Reward consumers with cash back for posting verified photo reviews. Minimum ₹20.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={reviewAmount || ''}
                    onChange={(e) => {
                      setReviewAmount(Number(e.target.value));
                      setBountyError('');
                    }}
                    onBlur={() => {
                      if (reviewAmount < 20) {
                        setReviewAmount(20);
                        setBountyError('Minimum image review bounty is ₹20');
                      }
                    }}
                    disabled={!selected.imageReviewBountyEnabled}
                    min={20}
                    className="w-24 rounded-lg border border-[#1F1F24] bg-[#060608] px-3 py-2 text-sm text-white outline-none focus:border-[#00E676]/40 disabled:opacity-50"
                  />
                  <span className="text-xs text-platinum">₹ per photo review</span>
                  {selected.imageReviewBountyEnabled && (
                    <button
                      onClick={handleApplyBountyAmount}
                      disabled={reviewAmount < 20}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[#00E676]/15 px-3 py-2 text-xs font-semibold text-[#00E676] transition-all hover:bg-[#00E676]/25 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check size={12} /> Apply
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleBounty(!selected.imageReviewBountyEnabled)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                      selected.imageReviewBountyEnabled
                        ? 'border border-[#FF3B3B]/30 bg-[#FF3B3B]/10 text-[#FF3B3B] hover:bg-[#FF3B3B]/20'
                        : 'bg-[#00E676] text-[#060608] hover:bg-[#00C853]'
                    }`}
                  >
                    {selected.imageReviewBountyEnabled ? (
                      <>
                        <X size={12} /> Disable
                      </>
                    ) : (
                      <>
                        <Check size={12} /> Enable
                      </>
                    )}
                  </button>
                </div>
                {bountyError && (
                  <p className="mt-2 flex items-center gap-1 text-[10px] text-[#FF3B3B]">
                    <AlertTriangle size={9} />
                    {bountyError}
                  </p>
                )}
                {selected.imageReviewBountyAmount && reviewAmount < selected.imageReviewBountyAmount && (
                  <p className="mt-1 text-[9px] text-platinum/50">
                    Current saved amount: ₹{selected.imageReviewBountyAmount}. Enter a new amount and click Apply to update.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </BrandLayout>
  );
}
