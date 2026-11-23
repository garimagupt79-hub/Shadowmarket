import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Zap, ShieldCheck, CreditCard, CheckCircle, MapPin, Store, Flame } from 'lucide-react';
import { Modal } from './Modal';
import { AddressGuardModal } from './AddressGuardModal';
import { useMarket, normalizeBrand, getActiveWaveOrders, getCurrentWaveTier } from '../context/MarketContext';
import type { Intent, Product, BrandToken } from '../types';

export function DirectCheckoutModal({
  intent,
  product,
  open,
  onClose,
  initialSize,
  initialColor,
}: {
  intent: Intent | null;
  product: Product | null;
  open: boolean;
  onClose: () => void;
  initialSize?: string;
  initialColor?: string;
}) {
  const { fulfillIntent, addresses, pushToast, pushNotification, brandCredits, syndicateWaves, orders, brandTokens } = useMarket();
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [addressGuardOpen, setAddressGuardOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [useBrandTokens, setUseBrandTokens] = useState(false);

  const productSizes = product?.sizes ?? [];
  const productColors = product?.colors ?? [];

  useEffect(() => {
    if (open) {
      const size = initialSize && productSizes.includes(initialSize) ? initialSize : productSizes[0] ?? '';
      const color = initialColor && productColors.includes(initialColor) ? initialColor : productColors[0] ?? '';
      setSelectedSize(size);
      setSelectedColor(color);
    }
  }, [open, initialSize, initialColor, productSizes, productColors]);

  if (!intent || !product) return null;

  const activeWave = syndicateWaves.find(
    (w) => w.status === 'active' && w.productId === product.id && Date.now() < w.startTime + w.durationMs,
  );
  const waveActiveOrders = activeWave ? getActiveWaveOrders(activeWave, orders) : [];
  const waveTier = activeWave ? getCurrentWaveTier(activeWave, waveActiveOrders.length) : null;
  const effectiveBounty = waveTier && activeWave
    ? Math.round(activeWave.productPrice * (waveTier.bountyPercent / 100))
    : product.autoBounty;

  const userAddresses = addresses;
  const defaultAddr = userAddresses.find((a) => a.id === selectedAddressId) ?? userAddresses.find((a) => a.isDefault) ?? userAddresses[0];

  const checkoutBrand = normalizeBrand(product.brandName);
  // Sum all matching token rows (email/user key variants) for this brand.
  const brandTokenBalance = brandTokens
    .filter((t: BrandToken) => normalizeBrand(t.brandName) === checkoutBrand)
    .reduce((sum, t) => sum + Number(t.availableCredit ?? 0), 0);
  // Grandfathered redemption: always offered when a balance exists, even if
  // the brand paused new conversions (tokens_enabled === false).
  const activeCredit = brandCredits.find((c) => c.brandId === product.brandName && c.amount > 0);

  const productPrice = product.priceInr;
  const maxUsableCredit = Math.min(brandTokenBalance, productPrice);
  const tokenDiscount = useBrandTokens && brandTokenBalance > 0 ? maxUsableCredit : 0;
  const legacyCreditDiscount = useBrandTokens && activeCredit ? Math.min(activeCredit.amount, Math.max(0, productPrice - tokenDiscount)) : 0;
  const totalDiscount = tokenDiscount + legacyCreditDiscount;
  const netPayable = Math.max(0, productPrice - totalDiscount);
  // Bounty is earned strictly on the cash paid — never on the token-paid portion.
  const escrowBounty = Math.round(netPayable * 0.15);
  const displayBounty = activeWave
    ? effectiveBounty
    : totalDiscount > 0
      ? escrowBounty
      : effectiveBounty;
  const bountyOverride = !activeWave && totalDiscount > 0 ? escrowBounty : undefined;
  const canPay = !!defaultAddr && !!selectedSize && !!selectedColor && !processing;

  const handlePay = () => {
    if (processing) return;
    if (!defaultAddr) {
      setAddressGuardOpen(true);
      return;
    }
    if (!selectedSize || !selectedColor) return;
    setProcessing(true);
    setTimeout(() => {
      fulfillIntent(intent.id, product, selectedSize, selectedColor, defaultAddr.id, totalDiscount, bountyOverride);
      setProcessing(false);
      setDone(true);
      pushToast('success', `Purchase complete! ₹${effectiveBounty.toLocaleString('en-IN')} bounty locked in escrow.`);
      pushNotification({
        type: 'order',
        title: 'Order Placed',
        description: `${product.title} — tracking will update soon.`,
        link: 'Track Package',
      });
      setTimeout(() => {
        setDone(false);
        onClose();
      }, 1500);
    }, 1200);
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Escrow Checkout" maxWidth="max-w-lg">
        {done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center gap-3 py-8"
          >
            <CheckCircle size={48} className="text-[#00E676]" />
            <p className="text-lg font-bold text-white">Order Locked in Escrow!</p>
            <p className="text-sm text-platinum/70">Your order is now active.</p>
          </motion.div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-xl border border-[#1F1F24] bg-[#060608] p-4">
              {product.images[0] && (
                <img
                  src={product.images[0]}
                  alt={product.title}
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{product.title}</p>
                <p className="text-[10px] text-platinum">{product.brandName}</p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-md border border-[#00E676]/30 bg-[#00E676]/10 px-2 py-1 text-[10px] font-semibold text-[#00E676]">
                <Zap size={10} />
                ₹{effectiveBounty.toLocaleString('en-IN')} Cash Back
                {waveTier && activeWave && effectiveBounty > product.autoBounty && (
                  <span className="ml-1 rounded bg-[#FF6B35]/20 px-1 text-[8px] text-[#FF8C42]">
                    Wave +{Math.round(((effectiveBounty - product.autoBounty) / product.autoBounty) * 100)}%
                  </span>
                )}
              </div>
            </div>

            {activeWave && waveTier && (
              <div className="rounded-xl border border-[#FF6B35]/30 bg-gradient-to-r from-[#FF6B35]/10 to-[#FF8C42]/[0.06] p-3">
                <div className="flex items-center gap-2">
                  <Flame size={14} className="text-[#FF6B35]" />
                  <span className="text-xs font-bold text-[#FF8C42]">Syndicate Wave Active</span>
                </div>
                <p className="mt-1 text-[10px] text-platinum">
                  Tier {waveTier.tierNumber} · {waveActiveOrders.length} orders locked · {Math.floor((activeWave.startTime + activeWave.durationMs - Date.now()) / 3600000)}h remaining
                </p>
              </div>
            )}

            {product.sizes.length > 0 && (
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                  Select Size
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSize(s)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                        String(s).trim().toLowerCase() === String(selectedSize).trim().toLowerCase()
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 font-semibold ring-1 ring-emerald-500/40'
                          : 'border-[#1F1F24] bg-[#060608] text-platinum hover:border-[#2A2A2E]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                        String(c).trim().toLowerCase() === String(selectedColor).trim().toLowerCase()
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 font-semibold ring-1 ring-emerald-500/40'
                          : 'border-[#1F1F24] bg-[#060608] text-platinum hover:border-[#2A2A2E]'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {defaultAddr ? (
              <div className="rounded-xl border border-[#1F1F24] bg-[#060608] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">
                      Shipping To
                    </p>
                    <p className="text-sm text-white">{defaultAddr.fullName}</p>
                    <p className="text-xs text-platinum">
                      {defaultAddr.houseNo}, {defaultAddr.area}, {defaultAddr.city}, {defaultAddr.state} {defaultAddr.pincode}
                    </p>
                  </div>
                  <button type="button" onClick={() => setAddressGuardOpen(true)} className="text-xs font-semibold text-[#00E676] hover:text-white">Change</button>
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

            {brandTokenBalance > 0 || activeCredit ? (
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
                <button
                  type="button"
                  onClick={() => setUseBrandTokens((v) => !v)}
                  className="flex w-full items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Store size={14} className="text-amber-400" />
                    <span className="text-left text-xs font-semibold text-amber-300">
                      Use {checkoutBrand} Store Credit<br />
                      <span className="text-[10px] font-normal text-platinum">
                        Available: ₹{(brandTokenBalance + (activeCredit?.amount ?? 0)).toLocaleString('en-IN')} • Apply up to ₹{maxUsableCredit.toLocaleString('en-IN')} to this order (100% of order)
                      </span>
                    </span>
                  </div>
                  <div className={`flex h-5 w-9 items-center rounded-full transition-colors ${useBrandTokens ? 'bg-amber-400/40' : 'bg-[#1F1F24]'}`}>
                    <motion.div
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className={`h-4 w-4 rounded-full bg-white ${useBrandTokens ? 'ml-4' : 'ml-0.5'}`}
                    />
                  </div>
                </button>
              </div>
            ) : (
              <p className="text-center text-[10px] text-platinum/50">
                No {checkoutBrand} Store Credit available — boost earned bounties in your Wallet for +25% credit.
              </p>
            )}

            <div className="space-y-2 rounded-xl border border-[#1F1F24] bg-[#060608] p-4">
              <div className="flex justify-between text-xs">
                <span className="text-platinum">Product Price</span>
                <span className="font-semibold text-white">₹{productPrice.toLocaleString('en-IN')}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#00E676]">{checkoutBrand} Store Credit (Up to 100% of order)</span>
                  <span className="font-semibold text-[#00E676]">-₹{totalDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[#1F1F24] pt-2 text-xs">
                <span className="text-platinum">Total Amount Payable</span>
                <span className="font-bold text-white">₹{netPayable.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-platinum">Cash Back Bounty (Locked in Escrow)</span>
                <span className="font-semibold text-[#00E676]">₹{displayBounty.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-[10px] text-platinum/60">
              <ShieldCheck size={12} className="text-[#00E676]" />
              ₹{displayBounty.toLocaleString('en-IN')} bounty released upon delivery confirmation.
            </div>

            <button
              onClick={handlePay}
              disabled={!canPay}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00E676] px-4 py-3 text-sm font-semibold text-[#060608] transition-all duration-300 hover:bg-[#00C853] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="h-4 w-4 rounded-full border-2 border-[#060608]/30 border-t-[#060608]"
                  />
                  Processing Payment...
                </>
              ) : (
                <>
                  <Lock size={15} />
                  {netPayable === 0 ? 'Confirm Escrow Order (Credit Covers Full Price)' : `Confirm Escrow Order (₹${netPayable.toLocaleString('en-IN')})`}
                </>
              )}
            </button>
            {!selectedSize || !selectedColor ? (
              <p className="text-center text-[10px] text-amber-400">
                Please select a size and color to proceed.
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
        onComplete={(addressId) => { setSelectedAddressId(addressId); setAddressGuardOpen(false); }}
        initialAddress={defaultAddr}
      />
    </>
  );
}
