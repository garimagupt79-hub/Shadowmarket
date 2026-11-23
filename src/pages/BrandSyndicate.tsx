import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Clock, Users, TrendingUp, Zap, Camera, Package, CheckCircle2 } from 'lucide-react';
import { useMarket, getActiveWaveOrders, getCurrentWaveTier } from '../context/MarketContext';
import { BrandLayout } from '../components/BrandLayout';
import { CreateSyndicateWaveModal } from '../components/CreateSyndicateWaveModal';
import type { Product } from '../types';

export function BrandSyndicate() {
  const { syndicateWaves, orders, products, session, authUser, refreshSyndicateWaves, pushToast } = useMarket();
  const [now, setNow] = useState(Date.now());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeWaves = useMemo(
    () => syndicateWaves.filter((w) => w.status === 'active' && now < w.startTime + w.durationMs),
    [syndicateWaves, now],
  );
  const activeProductIds = useMemo(() => new Set(activeWaves.map((wave) => wave.productId)), [activeWaves]);
  const pastWaves = useMemo(
    () => syndicateWaves.filter((w) => w.status !== 'active' || now >= w.startTime + w.durationMs),
    [syndicateWaves, now],
  );

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return 'Expired';
    const h = Math.floor(ms / (60 * 60 * 1000));
    const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    const s = Math.floor((ms % (60 * 1000)) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  const handleLaunchClick = () => {
    setSelectedProduct(null);
    setModalOpen(true);
  };

  const handleCreate = async () => {
    await refreshSyndicateWaves();
  };

  return (
    <BrandLayout>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tighter text-white">
            <Flame size={28} className="text-[#FF6B35]" />
            Syndicate Waves
          </h1>
          <p className="mt-1.5 text-sm text-platinum">
            Launch autonomous community bounty waves and monitor live participation in real time.
          </p>
        </div>
      </div>

      <div className="mb-8 flex justify-end">
        <button onClick={handleLaunchClick} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FF8C42] px-4 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(255,107,53,0.25)] transition-all hover:shadow-[0_0_28px_rgba(255,107,53,0.4)]">
          <Flame size={16} /> Launch New Syndicate Wave
        </button>
      </div>

      {/* Active Waves */}
      <div className="mb-8">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.15em] text-white">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF6B35] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF6B35]" />
          </span>
          Active Waves
        </h2>
        <div className="mb-4 text-sm font-mono text-amber-400 py-2">
          Connected Waves in State: {syndicateWaves.length} · Active: {activeWaves.length}
        </div>
        {activeWaves.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-[#111114] p-6 text-center">
            <Flame size={28} className="mx-auto text-platinum/30" />
            <p className="mt-2 text-sm font-semibold text-white">No active waves found in database. Launch one above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeWaves.map((wave, idx) => {
              const activeOrders = getActiveWaveOrders(wave, orders);
              const activeCount = activeOrders.length;
              const currentTier = getCurrentWaveTier(wave, activeCount);
              const remainingMs = wave.startTime + wave.durationMs - now;
              const sortedTiers = [...(wave.tiers ?? [])].sort((a, b) => a.thresholdUnits - b.thresholdUnits);
              const nextTier = sortedTiers.find((t) => t.thresholdUnits > activeCount);
              const unitsNeeded = nextTier ? nextTier.thresholdUnits - activeCount : 0;
              const maxThreshold = sortedTiers[sortedTiers.length - 1]?.thresholdUnits ?? 1;
              const progressPct = Math.min(100, (activeCount / maxThreshold) * 100);
              const product = products.find((p) => p.id === (wave.productId || (wave as Record<string, unknown>).product_id)) ?? {
                id: wave.productId || 'item',
                brandName: wave.brandName ?? '',
                title: wave.productTitle ?? 'Active Syndicate Item',
                priceInr: wave.productPrice ?? 4999,
                images: [],
              } as Product;

              return (
                <motion.div
                  key={wave.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="overflow-hidden rounded-2xl border border-[#FF6B35]/30 bg-gradient-to-br from-[#1a1208] to-[#111114] p-5"
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[#1F1F24]">
                        {product?.images[0] ? (
                          <img src={product.images[0]} alt={wave.productTitle} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[#060608] text-platinum/40">
                            <Package size={18} />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">{wave.productTitle}</h3>
                        <p className="text-[10px] uppercase tracking-wider text-platinum/50">₹{wave.productPrice.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#FF6B35]/40 bg-[#FF6B35]/10 px-2.5 py-1 text-xs font-bold text-[#FF6B35]">
                        <Clock size={11} />
                        {formatCountdown(remainingMs)}
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-[#1F1F24] bg-[#060608] p-3">
                      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-platinum/50">
                        <Users size={10} /> Units Claimed
                      </div>
                      <p className="mt-1 text-xl font-bold text-white">{activeCount}</p>
                    </div>
                    <div className="rounded-xl border border-[#00E676]/20 bg-[#00E676]/[0.06] p-3">
                      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-platinum/50">
                        <Zap size={10} /> Active Tier
                      </div>
                      <p className="mt-1 text-xl font-bold text-[#00E676]">Tier {currentTier.tierNumber} ({currentTier.bountyPercent}%)</p>
                    </div>
                    <div className="rounded-xl border border-[#1F1F24] bg-[#060608] p-3">
                      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-platinum/50">
                        <TrendingUp size={10} /> Next Milestone
                      </div>
                      <p className="mt-1 text-sm font-bold text-white">
                        {nextTier ? `${unitsNeeded} more → Tier ${nextTier.tierNumber} (${nextTier.bountyPercent}%)` : 'Max tier reached'}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="relative h-3 overflow-hidden rounded-full bg-[#060608]">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#FFB347]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.5 }}
                      />
                      {sortedTiers.map((t) => {
                        const markerPct = (t.thresholdUnits / maxThreshold) * 100;
                        return (
                          <div
                            key={t.tierNumber}
                            className="absolute top-0 h-full w-0.5 bg-white/40"
                            style={{ left: `${Math.min(100, markerPct)}%` }}
                            title={`Tier ${t.tierNumber}: ${t.thresholdUnits} units`}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-1.5 flex justify-between text-[9px] text-platinum/50">
                      {sortedTiers.map((t) => (
                        <span key={t.tierNumber}>T{t.tierNumber}: {t.thresholdUnits}u</span>
                      ))}
                    </div>
                  </div>

                  {/* Image bounty indicator */}
                  {wave.hasImageBounty && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold text-amber-400">
                      <Camera size={10} />
                      Photo Review Bounty: ₹{wave.imageBountyAmount.toLocaleString('en-IN')} (15-day escrow)
                    </div>
                  )}

                  {/* Recent participants */}
                  {activeOrders.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.15em] text-platinum/50">Recent Participants</p>
                      <div className="space-y-1.5">
                        {activeOrders.slice(0, 5).map((o) => (
                          <div key={o.id} className="flex items-center justify-between rounded-lg border border-[#1F1F24] bg-[#060608] px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-platinum">#{o.id.slice(-6).toUpperCase()}</span>
                              <span className="text-[11px] text-white">{o.consumerEmail}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-md border border-[#00E676]/30 bg-[#00E676]/10 px-2 py-0.5 text-[9px] font-semibold text-[#00E676]">
                                <Zap size={8} />
                                ₹{(o.productBounty ?? o.bountyAmount).toLocaleString('en-IN')}
                              </span>
                              {o.hasImageBounty && (
                                <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold text-amber-400">
                                  <Camera size={8} />
                                  ₹{(o.imageReviewBounty ?? 0).toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Waves */}
      {pastWaves.length > 0 && (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.15em] text-platinum/60">
            <CheckCircle2 size={14} /> Past Waves
          </h2>
          <div className="space-y-3">
            {pastWaves.map((wave) => {
              const waveOrders = getActiveWaveOrders(wave, orders);
              const pastTiers = wave.tiers ?? [];
              const totalUnits = waveOrders.length;
              const totalEscrow = waveOrders.reduce((sum, o) => sum + (o.productBounty ?? o.bountyAmount), 0);
              return (
                <div key={wave.id} className="flex items-center justify-between rounded-xl border border-[#1F1F24] bg-[#111114] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#1F1F24] bg-[#060608] text-platinum/60">
                      <Package size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{wave.productTitle}</p>
                      <p className="text-[10px] text-platinum/50">
                        {new Date(wave.startTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[9px] uppercase text-platinum/50">Escrow Released</p>
                      <p className="text-sm font-bold text-[#00E676]">₹{totalEscrow.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CreateSyndicateWaveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        product={selectedProduct}
        products={products}
        activeProductIds={activeProductIds}
        onWaveCreated={handleCreate}
        brandId={authUser?.id ?? session.email}
      />
    </BrandLayout>
  );
}
