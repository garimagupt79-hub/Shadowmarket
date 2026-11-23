import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Zap, ShieldCheck, CreditCard, CheckCircle, MapPin, Store } from 'lucide-react';
import { Modal } from './Modal';
import { AddressGuardModal } from './AddressGuardModal';
import { useMarket, normalizeBrand } from '../context/MarketContext';
import { getPitchTierStatus } from '../context/MarketContext';
import type { Pitch, Product, BrandToken } from '../types';

export function EscrowCheckoutModal({
  pitch,
  product,
  open,
  onClose,
  initialSize,
  initialColor,
  initialQuantity = 1,
}: {
  pitch: Pitch | null;
  product: Product | null;
  open: boolean;
  onClose: () => void;
  initialSize?: string;
  initialColor?: string;
  initialQuantity?: number;
}) {
  const { acceptPitchWithOrder, addresses, pushToast, brandCredits, brandTokens } = useMarket();
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [addressGuardOpen, setAddressGuardOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [useCredit, setUseCredit] = useState(false);

  const offeredSizes = pitch?.offeredSizes ?? product?.sizes ?? [];
  const offeredColors = pitch?.offeredColors ?? product?.colors ?? [];

  useEffect(() => {
    if (open) {
      setSelectedSize(initialSize && offeredSizes.includes(initialSize) ? initialSize : offeredSizes[0] ?? '');
      setSelectedColor(initialColor && offeredColors.includes(initialColor) ? initialColor : offeredColors[0] ?? '');
      setQuantity(initialQuantity);
    }
  }, [open, initialSize, initialColor, initialQuantity, offeredSizes, offeredColors]);

  if (!pitch || !product) return null;

  const userAddresses = addresses;
  const defaultAddr = userAddresses.find((a) => a.id === selectedAddressId) ?? userAddresses.find((a) => a.isDefault) ?? userAddresses[0];

  // Brand credit auto-detection
  const targetBrandId = pitch.brandName;
  const activeCredit = brandCredits.find((c) => c.brandId === targetBrandId && c.amount > 0);
  // Grandfathered token redemption: shown whenever credit exists, even if the brand paused conversions.
  const brandTokenRow = brandTokens.find(
    (t: BrandToken) => normalizeBrand(t.brandName) === normalizeBrand(pitch.brandName) && t.availableCredit > 0,
  );
  const tokenCredit = brandTokenRow?.availableCredit ?? 0;
  const availableCredit = (activeCredit?.amount ?? 0) + tokenCredit;

  const productPrice = product.priceInr;
  const maxRedeemable = Math.min(availableCredit, productPrice);
  const tokenDiscount = useCredit && tokenCredit > 0 ? Math.min(tokenCredit, maxRedeemable) : 0;
  const legacyCreditDiscount = useCredit && activeCredit ? Math.min(activeCredit.amount, Math.max(0, maxRedeemable - tokenDiscount)) : 0;
  const totalDiscount = tokenDiscount + legacyCreditDiscount;
  const netPayable = Math.max(0, productPrice - totalDiscount);
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
      const appliedCredit = useCredit ? totalDiscount : 0;
      acceptPitchWithOrder(pitch.id, defaultAddr.id, selectedSize, selectedColor, appliedCredit);
      setProcessing(false);
      setDone(true);
      pushToast('success', 'Payment complete! VIP deal locked in escrow.');
      setTimeout(() => {
        setDone(false);
        onClose();
      }, 1500);
    }, 1200);
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="VIP Escrow Checkout" maxWidth="max-w-lg">
        {done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center gap-3 py-8"
          >
            <CheckCircle size={48} className="text-[#00E676]" />
            <p className="text-lg font-bold text-white">Order Locked in Escrow!</p>
            <p className="text-sm text-platinum/70">Your VIP deal is now active.</p>
          </motion.div>
        ) : (
          <div className="space-y-5">
            {/* Product summary */}
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
                ₹{getPitchTierStatus(pitch).currentBounty.toLocaleString('en-IN')} VIP Bounty ({getPitchTierStatus(pitch).tierName})
              </div>
            </div>

            {/* Size & Color selection */}
            {offeredSizes.length > 0 && (
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                  Select Size
                </label>
                <div className="flex flex-wrap gap-2">
                  {offeredSizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSize(s)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                        selectedSize === s
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

            {offeredColors.length > 0 && (
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                  Select Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {offeredColors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                        selectedColor === c
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

            {/* Shipping address */}
            {defaultAddr ? (
              <div className="rounded-xl border border-[#1F1F24] bg-[#060608] p-4">
                <div className="flex items-start justify-between gap-3"><div>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/60">
                  Shipping To
                </p>
                <p className="text-sm text-white">{defaultAddr.fullName}</p>
                <p className="text-xs text-platinum">
                  {defaultAddr.houseNo}, {defaultAddr.area}, {defaultAddr.city}, {defaultAddr.state} {defaultAddr.pincode}
                </p></div><button type="button" onClick={() => setAddressGuardOpen(true)} className="text-xs font-semibold text-[#00E676] hover:text-white">Change</button></div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                <p className="text-xs text-amber-400">
                  A shipping address is required before this VIP order can be placed.
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

            {/* Store Credit Auto-Apply Toggle (grandfathered — never gated on tokens_enabled) */}
            {tokenCredit > 0 || activeCredit ? (
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
                <button
                  type="button"
                  onClick={() => setUseCredit((v) => !v)}
                  className="flex w-full items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Store size={14} className="text-amber-400" />
                    <span className="text-left text-xs font-semibold text-amber-300">
                      Apply {pitch.brandName} Store Credit (Available: ₹{availableCredit.toLocaleString('en-IN')} • Up to 100% of order: ₹{maxRedeemable.toLocaleString('en-IN')})
                    </span>
                  </div>
                  <div className={`flex h-5 w-9 items-center rounded-full transition-colors ${useCredit ? 'bg-amber-400/40' : 'bg-[#1F1F24]'}`}>
                    <motion.div
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className={`h-4 w-4 rounded-full bg-white ${useCredit ? 'ml-4' : 'ml-0.5'}`}
                    />
                  </div>
                </button>
              </div>
            ) : null}

            {/* Price summary */}
            <div className="space-y-2 rounded-xl border border-[#1F1F24] bg-[#060608] p-4">
              <div className="flex justify-between text-xs">
                <span className="text-platinum">Product</span>
                <span className="font-semibold text-white">{product.title}</span>
              </div>
              {selectedSize && selectedColor && (
                <div className="flex justify-between text-xs">
                  <span className="text-platinum">Variant</span>
                  <span className="font-semibold text-white">Size: {selectedSize} | Color: {selectedColor}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-platinum">Subtotal</span>
                <span className="font-semibold text-white">₹{productPrice.toLocaleString('en-IN')}</span>
              </div>
              {useCredit && totalDiscount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#00E676]">Brand Token Credit Applied (Up to 100% of order)</span>
                  <span className="font-semibold text-[#00E676]">-₹{totalDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[#1F1F24] pt-2 text-xs">
                <span className="text-platinum">Total Amount Payable</span>
                <span className="font-bold text-white">₹{netPayable.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-platinum">VIP Bounty (Locked at Tier {getPitchTierStatus(pitch).tierNumber})</span>
                <span className="font-semibold text-[#00E676]">₹{getPitchTierStatus(pitch).currentBounty.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Escrow trust badge */}
            <div className="flex items-center justify-center gap-2 text-[10px] text-platinum/60">
              <ShieldCheck size={12} className="text-[#00E676]" />
              ₹{getPitchTierStatus(pitch).currentBounty.toLocaleString('en-IN')} VIP bounty released upon delivery confirmation.
            </div>

            {/* Pay button */}
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
                  {netPayable === 0 ? 'Lock Escrow (Credit Covers Full Price)' : `Pay ₹${netPayable.toLocaleString('en-IN')} & Lock Escrow`}
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
