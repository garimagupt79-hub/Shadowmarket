import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Clock, TrendingUp, Users, ChevronRight, Sparkles, AlertTriangle } from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { ConsumerLayout } from './ConsumerLayout';
import { EmptyState } from './EmptyState';
import { ProductDetailsModal } from './ProductDetailsModal';
import { getActiveWaveOrders, getCurrentWaveTier } from '../context/MarketContext';
import type { SyndicateWave, Product } from '../types';

function useCountdown(endTime: number): { h: number; m: number; s: number; total: number } {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const total = Math.max(0, endTime - now);
  return {
    total,
    h: Math.floor(total / 3600000),
    m: Math.floor((total % 3600000) / 60000),
    s: Math.floor((total % 60000) / 1000),
  };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function TierProgress({ wave, currentUnits }: { wave: SyndicateWave; currentUnits: number }) {
  const sortedTiers = [...(wave.tiers ?? [])].sort((a, b) => a.thresholdUnits - b.thresholdUnits);
  const maxThreshold = sortedTiers[sortedTiers.length - 1]?.thresholdUnits ?? 1;
  const currentTier = getCurrentWaveTier(wave, currentUnits);
  const pct = Math.min(100, Math.round((currentUnits / maxThreshold) * 100));

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-platinum">
          Milestone Progress
        </span>
        <span className="text-[10px] font-bold text-[#FF8C42]">
          {currentUnits} / {maxThreshold} units
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-[#1F1F24]">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#FF8C42]"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sortedTiers.map((tier) => {
          const unlocked = currentUnits >= tier.thresholdUnits;
          const bounty = Math.round(wave.productPrice * (tier.bountyPercent / 100));
          return (
            <div
              key={tier.tierNumber}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-semibold transition-all duration-300 ${
                unlocked
                  ? 'border-[#FF6B35]/40 bg-[#FF6B35]/15 text-[#FF8C42]'
                  : 'border-[#1F1F24] bg-[#060608] text-platinum/50'
              }`}
            >
              <TrendingUp size={9} />
              T{tier.tierNumber}: {tier.thresholdUnits}+ · {tier.bountyPercent}% (₹{bounty.toLocaleString('en-IN')})
              {unlocked && <Sparkles size={8} className="text-[#FF8C42]" />}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-platinum">
        Current tier: <span className="font-bold text-white">T{currentTier.tierNumber}</span> —{' '}
        {currentTier.bountyPercent}% bounty on every order in this wave.
      </p>
    </div>
  );
}

function WaveCard({ wave, product, onJoin }: { wave: SyndicateWave; product?: Product; onJoin: (product: Product, wave: SyndicateWave) => void }) {
  const { orders } = useMarket();
  const endTime = wave.startTime + wave.durationMs;
  const { h, m, s, total } = useCountdown(endTime);
  const isExpired = wave.status !== 'active' || total <= 0;

  const activeWaveOrders = useMemo(
    () => getActiveWaveOrders(wave, orders),
    [wave, orders],
  );
  const currentUnits = wave.currentUnits ?? activeWaveOrders.length;
  const currentTier = getCurrentWaveTier(wave, currentUnits);
  const currentBounty = Math.round((wave.productPrice ?? 0) * (currentTier.bountyPercent / 100));

  const handleJoin = () => {
    if (!product || isExpired) return;
    onJoin(product, wave);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#FF6B35]/25 bg-gradient-to-b from-[#FF6B35]/[0.06] to-[#060608] transition-all duration-300 hover:border-[#FF6B35]/50"
    >
      {/* Urgency bar */}
      <div className="relative h-1 w-full bg-[#1F1F24]">
        <motion.div
          className="absolute inset-y-0 left-0 bg-[#FF6B35]"
          initial={{ width: '100%' }}
          animate={{ width: `${((total / (wave.durationMs || 1)) * 100)}%` }}
          transition={{ duration: 1, ease: 'linear' }}
        />
      </div>

      {/* Product image */}
      {product?.images?.[0] && (
        <div className="relative aspect-video w-full overflow-hidden">
          <img
            src={product.images[0]}
            alt={wave.productTitle}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060608] via-transparent to-transparent" />
          {isExpired ? (
            <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-platinum/30 bg-black/70 px-2.5 py-1 text-[10px] font-bold text-platinum backdrop-blur-md">
              <Clock size={10} />
              WAVE ENDED
            </div>
          ) : (
            <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-[#FF6B35]/50 bg-[#FF6B35]/25 px-2.5 py-1 text-[10px] font-bold text-[#FF8C42] backdrop-blur-md">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF6B35]" />
              LIVE DROP
            </div>
          )}
          {wave.hasImageBounty && (
            <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-black/70 px-2 py-1 text-[9px] font-semibold text-amber-400 backdrop-blur-md">
              <Sparkles size={9} />
              +₹{(wave.imageBountyAmount ?? 0).toLocaleString('en-IN')} Photo Bounty
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        {/* Brand */}
        <div className="flex items-center gap-1">
          <span className="truncate text-[9px] font-medium uppercase tracking-[0.15em] text-platinum">
            {wave.brandName}
          </span>
        </div>

        {/* Title */}
        <h3 className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug text-white">
          {wave.productTitle}
        </h3>

        {/* Price + bounty */}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold text-white">
            ₹{(wave.productPrice ?? 0).toLocaleString('en-IN')}
          </span>
        </div>

        <div className="mt-1.5 flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-md border border-[#FF6B35]/30 bg-[#FF6B35]/10 px-2 py-0.5 text-[10px] font-semibold text-[#FF8C42]">
            <Flame size={10} />
            ₹{currentBounty.toLocaleString('en-IN')} bounty
          </div>
          <div className="inline-flex items-center gap-1 rounded-md border border-[#1F1F24] bg-[#060608] px-2 py-0.5 text-[10px] text-platinum">
            <Users size={10} />
            {currentUnits} joined
          </div>
        </div>

        {/* Countdown */}
        <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-semibold ${total < 3600000 ? 'text-red-400' : 'text-platinum'}`}>
          <Clock size={11} />
          Ends in {pad(h)}:{pad(m)}:{pad(s)}
        </div>

        {/* Tier progress */}
        <TierProgress wave={wave} currentUnits={currentUnits} />

        {/* CTA */}
        <button
          onClick={handleJoin}
          disabled={!product || isExpired}
          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#FF6B35]/40 bg-[#FF6B35]/15 px-3 py-2.5 text-xs font-semibold text-[#FF8C42] transition-all duration-300 hover:bg-[#FF6B35]/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExpired ? (
            <>
              <Clock size={13} />
              Wave Ended
            </>
          ) : (
            <>
              <Flame size={13} />
              Join Wave — Lock Bounty
              <ChevronRight size={13} />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

function findWaveProduct(products: Product[], wave: SyndicateWave): Product {
  const found = products.find((p) => p.id === wave.productId);
  if (found) return found;
  return {
    id: wave.productId,
    brandName: wave.brandName || 'Unknown Brand',
    title: wave.productTitle || 'Active Wave Item',
    priceInr: wave.productPrice ?? 0,
    category: '',
    keywords: [],
    images: [],
    primaryImageIndex: 0,
    sizes: [],
    colors: [],
    colorHex: {},
    autoBounty: 0,
    variants: [],
    isDraft: false,
  };
}

export function SyndicateWavesFeed() {
  const { syndicateWaves, products } = useMarket();
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [modalWave, setModalWave] = useState<SyndicateWave | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleJoinWave = (product: Product, wave: SyndicateWave) => {
    setModalProduct(product);
    setModalWave(wave);
    setIsModalOpen(true);
  };

  const activeWaves = useMemo(
    () =>
      syndicateWaves
        .filter((w) => w.status === 'active' && Date.now() < w.startTime + w.durationMs)
        .sort((a, b) => a.startTime + a.durationMs - (b.startTime + b.durationMs)),
    [syndicateWaves],
  );

  const expiredWaves = useMemo(
    () =>
      syndicateWaves
        .filter((w) => w.status !== 'active' || Date.now() >= w.startTime + w.durationMs)
        .sort((a, b) => b.startTime - a.startTime),
    [syndicateWaves],
  );

  const heroWave = activeWaves[0];
  const restWaves = activeWaves.slice(1);

  return (
    <ConsumerLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Flame size={20} className="text-[#FF6B35]" />
          <h1 className="text-3xl font-bold tracking-tighter text-white">
            Live Syndicate Waves
          </h1>
        </div>
        <p className="mt-1.5 text-sm text-platinum">
          Flash-drop bounty events. Join early to lock tier-based cashback that scales as more shoppers join.
        </p>
      </div>

      {activeWaves.length === 0 && expiredWaves.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle size={28} />}
          title="No live waves right now."
          subtitle="Brands launch flash bounty drops throughout the day. Check back soon — or transmit an intent to trigger a brand pitch."
        />
      ) : (
        <>
          {activeWaves.length === 0 && expiredWaves.length > 0 && (
            <div className="mb-6">
              <EmptyState
                icon={<Clock size={28} />}
                title="No live waves at the moment."
                subtitle="All current waves have ended. Check back soon for the next drop."
              />
            </div>
          )}
          {/* Hero wave */}
          {heroWave && (
            <HeroWave wave={heroWave} product={findWaveProduct(products, heroWave)} onJoin={handleJoinWave} />
          )}

          {/* Rest of waves grid */}
          {restWaves.length > 0 && (
            <>
              <div className="mb-4 mt-8 flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  More Active Drops
                </h2>
                <span className="rounded-full bg-[#FF6B35]/10 px-2 py-0.5 text-[10px] font-bold text-[#FF8C42]">
                  {restWaves.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {restWaves.map((wave) => (
                    <WaveCard
                      key={wave.id}
                      wave={wave}
                      product={findWaveProduct(products, wave)}
                      onJoin={handleJoinWave}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}

          {/* Ended waves */}
          {expiredWaves.length > 0 && (
            <>
              <div className="mb-4 mt-8 flex items-center gap-2">
                <Clock size={16} className="text-platinum" />
                <h2 className="text-lg font-bold tracking-tight text-platinum">
                  Ended Waves
                </h2>
                <span className="rounded-full bg-platinum/10 px-2 py-0.5 text-[10px] font-bold text-platinum">
                  {expiredWaves.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
                <AnimatePresence mode="popLayout">
                  {expiredWaves.map((wave) => (
                    <WaveCard
                      key={wave.id}
                      wave={wave}
                      product={findWaveProduct(products, wave)}
                      onJoin={handleJoinWave}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </>
      )}

      <ProductDetailsModal
        product={modalProduct}
        wave={modalWave}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </ConsumerLayout>
  );
}

function HeroWave({ wave, product, onJoin }: { wave: SyndicateWave; product?: Product; onJoin: (product: Product, wave: SyndicateWave) => void }) {
  const { orders } = useMarket();
  const endTime = wave.startTime + wave.durationMs;
  const { h, m, s, total } = useCountdown(endTime);
  const isExpired = wave.status !== 'active' || total <= 0;

  const activeWaveOrders = useMemo(
    () => getActiveWaveOrders(wave, orders),
    [wave, orders],
  );
  const currentUnits = wave.currentUnits ?? activeWaveOrders.length;
  const currentTier = getCurrentWaveTier(wave, currentUnits);
  const currentBounty = Math.round((wave.productPrice ?? 0) * (currentTier.bountyPercent / 100));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-3xl border border-[#FF6B35]/30 bg-gradient-to-br from-[#FF6B35]/[0.08] via-[#060608] to-[#060608]"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Image side */}
        {product?.images?.[0] && (
          <div className="relative aspect-video lg:aspect-auto lg:min-h-[320px] overflow-hidden">
            <img
              src={product.images[0]}
              alt={wave.productTitle}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#060608] via-transparent to-transparent lg:bg-gradient-to-r" />
          </div>
        )}

        {/* Content side */}
        <div className="flex flex-col justify-center p-6 lg:p-8">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF6B35]/50 bg-[#FF6B35]/25 px-3 py-1 text-[10px] font-bold text-[#FF8C42] backdrop-blur-md">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF6B35]" />
              FEATURED DROP
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
              {wave.brandName}
            </span>
          </div>

          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            {wave.productTitle}
          </h2>

          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-2xl font-bold text-white">
              ₹{(wave.productPrice ?? 0).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#FF6B35]/30 bg-[#FF6B35]/10 px-3 py-1.5 text-sm font-bold text-[#FF8C42]">
              <Flame size={14} />
              ₹{currentBounty.toLocaleString('en-IN')} cashback locked
            </div>
            {wave.hasImageBounty && (
              <div className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-400">
                <Sparkles size={12} />
                +₹{(wave.imageBountyAmount ?? 0).toLocaleString('en-IN')} photo bonus
              </div>
            )}
          </div>

          {/* Countdown */}
          <div className={`mt-4 flex items-center gap-2 text-sm font-semibold ${total < 3600000 ? 'text-red-400' : 'text-platinum'}`}>
            <Clock size={14} />
            <AnimatePresence mode="wait">
              <motion.span
                key={`${h}-${m}-${s}`}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {pad(h)}:{pad(m)}:{pad(s)}
              </motion.span>
            </AnimatePresence>
            <span className="text-platinum/60">remaining</span>
          </div>

          <TierProgress wave={wave} currentUnits={currentUnits} />

          <button
            onClick={() => product && !isExpired && onJoin(product, wave)}
            disabled={!product || isExpired}
            className="mt-5 inline-flex w-fit items-center justify-center gap-2 rounded-xl border border-[#FF6B35]/40 bg-[#FF6B35]/15 px-5 py-3 text-sm font-semibold text-[#FF8C42] transition-all duration-300 hover:bg-[#FF6B35]/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExpired ? (
              <>
                <Clock size={15} />
                Wave Ended
              </>
            ) : (
              <>
                <Flame size={15} />
                Join This Wave
                <ChevronRight size={15} />
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
