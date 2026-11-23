import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Trash2,
  Plus,
  Minus,
  Lock,
  ShoppingBag,
  Zap,
  Store,
  Flame,
} from 'lucide-react';
import { useMarket, getActiveWaveOrders, getCurrentWaveTier } from '../context/MarketContext';
import { ConsumerLayout } from '../components/ConsumerLayout';
import { AddressGuardModal } from '../components/AddressGuardModal';
import { EmptyState } from '../components/EmptyState';
import type { SyndicateWave } from '../types';

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '0h 0m';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

export function ConsumerBag() {
  const {
    bagItems,
    removeFromBag,
    updateBagQuantity,
    checkoutBag,
    addresses,
    pushToast,
    brandCredits,
    consumerWallet,
    syndicateWaves,
    orders,
  } = useMarket();
  const [addressGuardOpen, setAddressGuardOpen] = useState(false);
  const [useCreditByBrand, setUseCreditByBrand] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const brandCreditMap = useMemo(() => {
    const map = new Map<string, number>();
    brandCredits.forEach((c) => {
      if (c.amount > 0) map.set(c.brandId, c.amount);
    });
    return map;
  }, [brandCredits]);

  const getItemWaveInfo = (productId: string) => {
    const wave = syndicateWaves.find(
      (w: SyndicateWave) => w.status === 'active' && w.productId === productId && Date.now() < w.startTime + w.durationMs,
    );
    if (!wave) return null;
    const activeOrders = getActiveWaveOrders(wave, orders);
    const currentTier = getCurrentWaveTier(wave, activeOrders.length);
    const currentBounty = Math.round(wave.productPrice * (currentTier.bountyPercent / 100));
    const sortedTiers = [...wave.tiers].sort((a, b) => a.thresholdUnits - b.thresholdUnits);
    const nextTier = sortedTiers.find((t) => t.thresholdUnits > activeOrders.length);
    const timeRemaining = wave.startTime + wave.durationMs - Date.now();
    return { wave, activeCount: activeOrders.length, currentTier, currentBounty, nextTier, timeRemaining };
  };

  const totalRetail = bagItems.reduce((sum, b) => sum + b.priceInr * b.quantity, 0);

  const itemWaveInfos = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getItemWaveInfo>>();
    bagItems.forEach((item) => {
      if (!map.has(item.productId)) {
        map.set(item.productId, getItemWaveInfo(item.productId));
      }
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bagItems, syndicateWaves, orders]);

  const totalBounty = bagItems.reduce((sum, b) => {
    const waveInfo = itemWaveInfos.get(b.productId);
    const effectiveBounty = waveInfo ? waveInfo.currentBounty : b.autoBounty;
    return sum + effectiveBounty * b.quantity;
  }, 0);
  const hasAnyWave = Array.from(itemWaveInfos.values()).some((w) => w !== null);

  const brandTotalsByBrand: Record<string, number> = {};
  bagItems.forEach((item) => {
    brandTotalsByBrand[item.brandName] = (brandTotalsByBrand[item.brandName] ?? 0) + item.priceInr * item.quantity;
  });

  const appliedCreditsByBrand: Record<string, number> = {};
  Object.entries(brandTotalsByBrand).forEach(([brand, brandTotal]) => {
    const credit = brandCreditMap.get(brand);
    if (credit && credit > 0 && useCreditByBrand[brand]) {
      appliedCreditsByBrand[brand] = Math.min(credit, brandTotal);
    }
  });

  const totalCreditApplied = Object.values(appliedCreditsByBrand).reduce((sum, v) => sum + v, 0);
  const grandTotal = Math.max(0, totalRetail - totalCreditApplied);
  const balanceShortfall = Math.max(0, grandTotal - consumerWallet.withdrawable);
  const canCheckout = consumerWallet.withdrawable >= grandTotal;

  const handleCheckout = () => {
    if (isSubmitting) return;
    const userAddresses = addresses;
    if (userAddresses.length === 0) {
      setAddressGuardOpen(true);
      return;
    }
    setIsSubmitting(true);
    const defaultAddr = userAddresses.find((a) => a.isDefault) ?? userAddresses[0];
    checkoutBag(defaultAddr.id, appliedCreditsByBrand);
    pushToast('success', 'Checkout complete! Orders placed and bounties locked in escrow.');
    setTimeout(() => setIsSubmitting(false), 1500);
  };

  return (
    <ConsumerLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tighter text-white">
          Shopping Bag
        </h1>
        <p className="mt-1.5 text-sm text-platinum">
          Review your items and proceed to escrow checkout.
        </p>
      </div>

      {bagItems.length === 0 ? (
        <div className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-6">
          <EmptyState
            icon={<ShoppingBag size={28} />}
            title="Your Shopping Bag is empty"
            subtitle="Browse active market intents to find products with cash back."
          />
          <div className="flex justify-center">
            <a
              href="/consumer/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-[#00E676] px-5 py-2.5 text-sm font-semibold text-[#060608] transition-all hover:bg-[#00C853]"
            >
              <Zap size={15} />
              Explore Market Intents
            </a>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Item list */}
          <div className="flex-1 space-y-3">
            {bagItems.map((item, idx) => {
              const credit = brandCreditMap.get(item.brandName);
              const hasCredit = credit && credit > 0;
              const creditOn = useCreditByBrand[item.brandName] ?? false;
              const usableCredit = hasCredit && creditOn ? Math.min(credit, item.priceInr) : 0;
              const waveInfo = itemWaveInfos.get(item.productId);
              const effectiveBounty = waveInfo ? waveInfo.currentBounty : item.autoBounty;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-4"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={item.image}
                      alt={item.productTitle}
                      className="h-16 w-16 shrink-0 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{item.productTitle}</p>
                      <p className="text-[10px] text-platinum">{item.brandName}</p>
                      <p className="text-[10px] text-platinum">
                        {item.size} · {item.color}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          ₹{item.priceInr.toLocaleString('en-IN')}
                        </span>
                        <span className="inline-flex items-center gap-0.5 rounded-md border border-[#00E676]/30 bg-[#00E676]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#00E676]">
                          <Zap size={8} />
                          ₹{effectiveBounty.toLocaleString('en-IN')}
                          {waveInfo && waveInfo.currentBounty > item.autoBounty && (
                            <span className="ml-0.5 text-[7px] text-[#FF8C42]">
                              +{Math.round(((waveInfo.currentBounty - item.autoBounty) / item.autoBounty) * 100)}%
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Quantity selector */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateBagQuantity(item.id, item.quantity - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#1F1F24] bg-[#060608] text-platinum transition-all hover:text-white"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateBagQuantity(item.id, item.quantity + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#1F1F24] bg-[#060608] text-platinum transition-all hover:text-white"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromBag(item.id)}
                      className="rounded-lg p-1.5 text-platinum transition-all duration-300 hover:bg-[#FF3B3B]/10 hover:text-[#FF3B3B]"
                      aria-label="Remove item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Live Syndicate Wave banner + 3-tier roadmap */}
                  {waveInfo && (
                    <div className="mt-3 rounded-xl border border-[#FF6B35]/25 bg-[#0A0A0C]/80 p-3 space-y-2.5">
                      <div className="flex items-center justify-between text-[10px] font-semibold">
                        <span className="inline-flex items-center gap-1.5 text-[#FF8C42]">
                          <Flame size={12} />
                          Syndicate Wave Active · Reward ₹{waveInfo.currentBounty.toLocaleString('en-IN')} ({waveInfo.currentTier.bountyPercent}%)
                        </span>
                        <span className="font-mono text-platinum/70">
                          {formatTimeRemaining(waveInfo.timeRemaining)} left
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {waveInfo.wave.tiers.map((tier) => {
                          const tierCash = Math.round(item.priceInr * (tier.bountyPercent / 100));
                          const isCurrent = waveInfo.currentTier.tierNumber === tier.tierNumber;
                          const isPassed = waveInfo.activeCount >= tier.thresholdUnits;
                          return (
                            <div
                              key={tier.tierNumber}
                              className={`rounded-lg border p-2.5 flex flex-col items-center justify-between transition-all ${
                                isCurrent
                                  ? 'bg-[#00E676]/10 border-[#00E676]/50 shadow-[0_0_12px_rgba(0,230,118,0.15)]'
                                  : isPassed
                                    ? 'bg-[#111114] border-[#2A2A2E] opacity-80'
                                    : 'bg-[#060608]/60 border-[#1F1F24] opacity-50'
                              }`}
                            >
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] uppercase font-bold text-platinum">Tier {tier.tierNumber}</span>
                                {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-[#00E676] animate-pulse" />}
                              </div>
                              <span className="text-[10px] text-platinum/70 mt-0.5">{tier.thresholdUnits}+ orders</span>
                              <span className={`text-sm font-extrabold mt-1 ${isCurrent ? 'text-[#00E676]' : 'text-white'}`}>
                                ₹{tierCash.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[9px] text-platinum/50">({tier.bountyPercent}% Cash)</span>
                            </div>
                          );
                        })}
                      </div>
                      {waveInfo.nextTier ? (
                        <p className="text-[10px] text-platinum/60 text-center">
                          Only <span className="text-[#00E676] font-bold">{waveInfo.nextTier.thresholdUnits - waveInfo.activeCount} more orders</span> to upgrade everyone to <span className="text-[#00E676] font-bold">₹{Math.round(item.priceInr * (waveInfo.nextTier.bountyPercent / 100)).toLocaleString('en-IN')}</span>!
                        </p>
                      ) : (
                        <p className="text-[10px] text-[#00E676] font-medium text-center">
                          Maximum Peak Tier 3 unlocked for all buyers!
                        </p>
                      )}
                    </div>
                  )}

                  {/* Brand credit toggle per brand */}
                  {hasCredit && (
                    <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3">
                      <button
                        type="button"
                        onClick={() => setUseCreditByBrand((prev) => ({ ...prev, [item.brandName]: !creditOn }))}
                        className="flex w-full items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Store size={13} className="text-amber-400" />
                          <span className="text-[11px] font-semibold text-amber-300">
                            Use ₹{Math.min(credit, item.priceInr).toLocaleString('en-IN')} {item.brandName} Credit (Available: ₹{credit.toLocaleString('en-IN')})
                          </span>
                        </div>
                        <div className={`flex h-4 w-8 items-center rounded-full transition-colors ${creditOn ? 'bg-amber-400/40' : 'bg-[#1F1F24]'}`}>
                          <motion.div
                            layout
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className={`h-3 w-3 rounded-full bg-white ${creditOn ? 'ml-4' : 'ml-0.5'}`}
                          />
                        </div>
                      </button>
                      {creditOn && usableCredit > 0 && (
                        <p className="mt-2 text-[10px] text-amber-400/70">
                          ₹{usableCredit.toLocaleString('en-IN')} will be deducted from your {item.brandName} store credit at checkout.
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Order summary */}
          <div className="lg:w-80 lg:shrink-0">
            <div className="sticky top-24 rounded-2xl border border-[#1F1F24] bg-[#111114] p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-white">
                Order Summary
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-platinum">Subtotal</span>
                  <span className="font-semibold text-white">
                    ₹{totalRetail.toLocaleString('en-IN')}
                  </span>
                </div>
                {totalCreditApplied > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-amber-400">Brand Credit Discount</span>
                    <span className="font-semibold text-amber-400">
                      -₹{totalCreditApplied.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-platinum">Total Cash Back Bounty</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#00E676] shadow-[0_0_12px_rgba(0,230,118,0.2)]">
                    <Zap size={11} />
                    ₹{totalBounty.toLocaleString('en-IN')}
                    {hasAnyWave && (
                      <span className="ml-1 rounded bg-[#FF6B35]/20 px-1 text-[8px] text-[#FF8C42]">
                        Wave
                      </span>
                    )}
                  </span>
                </div>
                {hasAnyWave && (
                  <p className="text-[10px] leading-relaxed text-platinum/50">
                    Retroactive boost: If more buyers join before the wave ends, your cashback automatically increases.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isSubmitting || !canCheckout}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00E676] px-4 py-3 text-sm font-semibold text-[#060608] transition-all duration-300 hover:bg-[#00C853] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Lock size={15} />
                {grandTotal === 0 ? 'Checkout (Credit Covers Full Price)' : `Proceed to Escrow Checkout (₹${grandTotal.toLocaleString('en-IN')})`}
              </button>
              {!canCheckout ? (
                <p className="mt-3 text-center text-[10px] text-amber-400">
                  Insufficient wallet balance. You need ₹{balanceShortfall.toLocaleString('en-IN')} more.
                </p>
              ) : (
                <p className="mt-3 text-center text-[10px] text-platinum/60">
                  Checkout verifies your shipping address and locks all bounties into escrow.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <AddressGuardModal
        open={addressGuardOpen}
        onClose={() => setAddressGuardOpen(false)}
        onComplete={() => {
          setAddressGuardOpen(false);
          handleCheckout();
        }}
      />
    </ConsumerLayout>
  );
}
