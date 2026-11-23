import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Lock,
  Zap,
  ShieldCheck,
  CreditCard,
  CheckCircle,
  MapPin,
  Store,
  Flame,
  Clock,
  ShoppingBag,
  Sparkles,
  Camera,
} from 'lucide-react';
import { Modal } from './Modal';
import { AddressGuardModal } from './AddressGuardModal';
import { ProductCarousel } from './ProductCarousel';
import { useMarket, getActiveWaveOrders, getCurrentWaveTier } from '../context/MarketContext';
import type { Product, SyndicateWave } from '../types';

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function ProductDetailsModal({
  product,
  wave,
  open,
  onClose,
}: {
  product: Product | null;
  wave?: SyndicateWave | null;
  open: boolean;
  onClose: () => void;
}) {
  const {
    placeDirectOrder,
    addToBag,
    addresses,
    pushToast,
    pushNotification,
    brandCredits,
    consumerWallet,
    syndicateWaves,
    orders,
  } = useMarket();
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [addressGuardOpen, setAddressGuardOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [useCredit, setUseCredit] = useState(false);

  if (!product) return null;

  const activeWave =
    wave ??
    syndicateWaves.find(
      (w) =>
        w.status === 'active' &&
        w.productId === product.id &&
        Date.now() < w.startTime + w.durationMs,
    );

  const waveActiveOrders = activeWave ? getActiveWaveOrders(activeWave, orders) : [];
  const waveCurrentUnits = activeWave ? (activeWave.currentUnits ?? waveActiveOrders.length) : 0;
  const waveTier = activeWave ? getCurrentWaveTier(activeWave, waveCurrentUnits) : null;
  const baseWaveBounty =
    waveTier && activeWave
      ? Math.round(activeWave.productPrice * (waveTier.bountyPercent / 100))
      : product.autoBounty;
  const hasImageBounty = Boolean(activeWave?.hasImageBounty && Number(activeWave?.imageBountyAmount) > 0);
  const imageBountyAmount = hasImageBounty ? Number(activeWave!.imageBountyAmount) : 0;
  const effectiveBounty = baseWaveBounty;

  const userAddresses = addresses;
  const defaultAddr =
    userAddresses.find((a) => a.id === selectedAddressId) ??
    userAddresses.find((a) => a.isDefault) ??
    userAddresses[0];

  const activeCredit = brandCredits.find(
    (c) => c.brandId === product.brandName && c.amount > 0,
  );
  const availableCredit = activeCredit?.amount ?? 0;
  const usableAmount = activeCredit ? Math.min(product.priceInr, availableCredit) : 0;

  const productPrice = product.priceInr;
  const appliedCredit = useCredit && activeCredit ? usableAmount : 0;
  const netPayable = Math.max(0, productPrice - appliedCredit);
  const variantStock = product.variants.find((v) => v.size === selectedSize && v.color === selectedColor)?.stock;
  const availableStock = selectedSize && selectedColor
    ? (variantStock ?? 0)
    : (product.stockQuantity ?? 0);
  const outOfStock = availableStock <= 0;
  const canPay =
    !!defaultAddr &&
    !!selectedSize &&
    !!selectedColor &&
    !processing &&
    !outOfStock;

  const handlePurchase = () => {
    if (!defaultAddr) {
      setAddressGuardOpen(true);
      return;
    }
    if (!selectedSize || !selectedColor) return;
    setProcessing(true);
    setTimeout(() => {
      placeDirectOrder(product, selectedSize, selectedColor, defaultAddr.id, appliedCredit);
      setProcessing(false);
      setDone(true);
      if (!activeWave) {
        pushToast(
          'success',
          `Purchase complete! ₹${baseWaveBounty.toLocaleString('en-IN')} wave bounty locked in escrow.`,
        );
      }
      pushNotification({
        type: 'order',
        title: 'Order Placed',
        description: `${product.title} — ₹${baseWaveBounty.toLocaleString('en-IN')} wave bounty locked.`,
        link: '/consumer/orders',
      });
      setTimeout(() => {
        setDone(false);
        onClose();
      }, 1500);
    }, 1200);
  };

  const handleAddToBag = () => {
    if (!selectedSize || !selectedColor) {
      pushToast('info', 'Please select a size and color first.');
      return;
    }
    addToBag({
      productId: product.id,
      productTitle: product.title,
      brandName: product.brandName,
      image: product.images[0] ?? '',
      priceInr: product.priceInr,
      autoBounty: product.autoBounty,
      size: selectedSize,
      color: selectedColor,
      quantity: 1,
    });
    pushToast('success', `${product.title} added to your bag.`);
    onClose();
  };

  const endTime = activeWave ? activeWave.startTime + activeWave.durationMs : 0;
  const total = Math.max(0, endTime - Date.now());
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);

  return (
    <>
      <Modal open={open} onClose={onClose} title="Product Details" maxWidth="max-w-2xl">
        {done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center gap-3 py-12"
          >
            <CheckCircle size={48} className="text-[#00E676]" />
            <p className="text-lg font-bold text-white">Order Locked in Escrow!</p>
            <p className="text-sm text-platinum/70">
              ₹{baseWaveBounty.toLocaleString('en-IN')} wave bounty locked. Track your order anytime.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-5">
            {/* Product carousel */}
            <ProductCarousel
              images={product.images}
              badge={
                activeWave ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[#FF6B35]/50 bg-[#FF6B35]/25 px-2.5 py-1 text-[10px] font-bold text-[#FF8C42] backdrop-blur-md">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF6B35]" />
                    LIVE WAVE
                  </div>
                ) : undefined
              }
            />

            {/* Product info */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
                {product.brandName}
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-white">
                {product.title}
              </h2>
              {product.teaser && (
                <p className="mt-1.5 text-sm text-platinum">{product.teaser}</p>
              )}
            </div>

            {/* Price + bounty */}
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl font-bold text-white">
                ₹{productPrice.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Dual bounty display — strictly separated */}
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#FF6B35]/30 bg-[#FF6B35]/10 px-3 py-2 text-xs font-bold text-[#FF8C42]">
                <Flame size={13} />
                ₹{baseWaveBounty.toLocaleString('en-IN')} Wave Cashback
                {waveTier && activeWave && baseWaveBounty > product.autoBounty && (
                  <span className="ml-1 rounded bg-[#FF6B35]/20 px-1 text-[9px]">
                    +{Math.round(((baseWaveBounty - product.autoBounty) / product.autoBounty) * 100)}%
                  </span>
                )}
              </div>
              {hasImageBounty && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-400">
                  <Camera size={13} />
                  +₹{imageBountyAmount.toLocaleString('en-IN')} Photo Review Bounty
                  <span className="text-[9px] font-medium text-amber-400/70">(Claimable post-delivery)</span>
                </div>
              )}
            </div>

            {/* Active wave banner */}
            {activeWave && waveTier && (
              <div className="rounded-xl border border-[#FF6B35]/30 bg-gradient-to-r from-[#FF6B35]/10 to-[#FF8C42]/[0.06] p-4">
                <div className="flex items-center gap-2">
                  <Flame size={16} className="text-[#FF6B35]" />
                  <span className="text-sm font-bold text-[#FF8C42]">
                    Syndicate Wave Active — Tier {waveTier.tierNumber}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-platinum">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} />
                    {pad(h)}:{pad(m)}:{pad(s)} remaining
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Sparkles size={11} className="text-[#FF8C42]" />
                    {waveCurrentUnits} orders locked
                  </span>
                  <span className="font-semibold text-[#FF8C42]">
                    ₹{baseWaveBounty.toLocaleString('en-IN')} wave bounty locked at Tier {waveTier.tierNumber}
                  </span>
                </div>
                {hasImageBounty && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-400">
                    <Camera size={10} />
                    +₹{imageBountyAmount.toLocaleString('en-IN')} photo review bonus (held in sub-escrow, claimable post-delivery)
                  </div>
                )}
              </div>
            )}

            {/* Size selection */}
            {product.sizes.length > 0 && (
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                  Select Size
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setSelectedSize(sz)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                        selectedSize === sz
                          ? 'border-[#00E676] bg-[#00E676]/10 text-[#00E676]'
                          : 'border-[#1F1F24] bg-[#060608] text-platinum hover:border-[#2A2A2E]'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color selection */}
            {product.colors.length > 0 && (
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                  Select Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                        selectedColor === c
                          ? 'border-[#00E676] bg-[#00E676]/10 text-[#00E676]'
                          : 'border-[#1F1F24] bg-[#060608] text-platinum hover:border-[#2A2A2E]'
                      }`}
                    >
                      {product.colorHex?.[c] && (
                        <span
                          className="h-3 w-3 rounded-full border border-white/20"
                          style={{ backgroundColor: product.colorHex[c] }}
                        />
                      )}
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Shipping address */}
            {defaultAddr ? (
              <div className="rounded-xl border border-[#1F1F24] bg-[#060608] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">
                      Shipping To
                    </p>
                    <p className="text-sm text-white">{defaultAddr.fullName}</p>
                    <p className="text-xs text-platinum">
                      {defaultAddr.houseNo}, {defaultAddr.area}, {defaultAddr.city},{' '}
                      {defaultAddr.state} {defaultAddr.pincode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddressGuardOpen(true)}
                    className="text-xs font-semibold text-[#00E676] hover:text-white"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                <p className="text-xs text-amber-400">
                  A shipping address is required before this order can be placed.
                </p>
                <button
                  type="button"
                  onClick={() => setAddressGuardOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 px-3 py-2 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-400/10"
                >
                  <MapPin size={13} />
                  Add shipping address
                </button>
              </div>
            )}

            {/* Brand credit toggle */}
            {activeCredit && (
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
                <button
                  type="button"
                  onClick={() => setUseCredit((v) => !v)}
                  className="flex w-full items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Store size={14} className="text-amber-400" />
                    <span className="text-xs font-semibold text-amber-300">
                      Use ₹{usableAmount.toLocaleString('en-IN')} {product.brandName} Credit
                      (Available: ₹{availableCredit.toLocaleString('en-IN')})
                    </span>
                  </div>
                  <div
                    className={`flex h-5 w-9 items-center rounded-full transition-colors ${
                      useCredit ? 'bg-amber-400/40' : 'bg-[#1F1F24]'
                    }`}
                  >
                    <motion.div
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className={`h-4 w-4 rounded-full bg-white ${useCredit ? 'ml-4' : 'ml-0.5'}`}
                    />
                  </div>
                </button>
              </div>
            )}

            {/* Price summary */}
            <div className="space-y-2 rounded-xl border border-[#1F1F24] bg-[#060608] p-4">
              <div className="flex justify-between text-xs">
                <span className="text-platinum">Product Price</span>
                <span className="font-semibold text-white">
                  ₹{productPrice.toLocaleString('en-IN')}
                </span>
              </div>
              {appliedCredit > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-amber-400">Brand Credit</span>
                  <span className="font-semibold text-amber-400">
                    -₹{appliedCredit.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-[#1F1F24] pt-2 text-xs">
                <span className="text-platinum">Total Amount Payable</span>
                <span className="font-bold text-white">
                  ₹{netPayable.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-platinum">Wave Cashback (Locked in Escrow)</span>
                <span className="font-semibold text-[#FF8C42]">
                  ₹{baseWaveBounty.toLocaleString('en-IN')}
                </span>
              </div>
              {hasImageBounty && (
                <div className="flex justify-between text-xs">
                  <span className="text-amber-400">Photo Review Bounty (Sub-escrow, post-delivery)</span>
                  <span className="font-semibold text-amber-400">
                    ₹{imageBountyAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 text-[10px] text-platinum/60">
              <ShieldCheck size={12} className="text-[#00E676]" />
              ₹{baseWaveBounty.toLocaleString('en-IN')} wave cashback released on delivery. Photo review bounty unlocked after image submission.
            </div>

            {/* Stock indicator */}
            {selectedSize && selectedColor && (
              <div className="flex items-center gap-2 text-[11px]">
                {outOfStock ? (
                  <span className="font-semibold text-red-400">Out of Stock</span>
                ) : (
                  <span className="text-platinum/70">{availableStock} in stock</span>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleAddToBag}
                disabled={!selectedSize || !selectedColor || outOfStock}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#1F1F24] bg-[#111114] px-4 py-3 text-sm font-semibold text-white transition-all duration-300 hover:border-[#2A2A2E] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShoppingBag size={15} />
                Add to Bag
              </button>
              <button
                onClick={handlePurchase}
                disabled={!canPay}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00E676] px-4 py-3 text-sm font-semibold text-[#060608] transition-all duration-300 hover:bg-[#00C853] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processing ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="h-4 w-4 rounded-full border-2 border-[#060608]/30 border-t-[#060608]"
                    />
                    Processing...
                  </>
                ) : outOfStock ? (
                  <>
                    <Lock size={15} />
                    Out of Stock
                  </>
                ) : (
                  <>
                    <Lock size={15} />
                    {netPayable === 0
                      ? 'Purchase (Credit Covers Full Price)'
                      : `Purchase (₹${netPayable.toLocaleString('en-IN')})`}
                  </>
                )}
              </button>
            </div>

            {!selectedSize || !selectedColor ? (
              <p className="text-center text-[10px] text-amber-400">
                Please select a size and color to proceed.
              </p>
            ) : outOfStock ? (
              <p className="text-center text-[10px] text-red-400">
                This variant is out of stock. Please select a different size or color.
              </p>
            ) : (
              <p className="flex items-center justify-center gap-1 text-center text-[10px] text-platinum/50">
                <CreditCard size={10} />
                This is a demo checkout. No real payment is processed.
              </p>
            )}
          </div>
        )}
      </Modal>
      <AddressGuardModal
        open={addressGuardOpen}
        onClose={() => setAddressGuardOpen(false)}
        onComplete={(addressId) => {
          setSelectedAddressId(addressId);
          setAddressGuardOpen(false);
        }}
        initialAddress={defaultAddr}
      />
    </>
  );
}
