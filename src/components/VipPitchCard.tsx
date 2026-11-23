import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Zap, Sparkles, Building2, X, Lock, Timer } from 'lucide-react';
import { getPitchTierStatus } from '../context/MarketContext';
import type { Intent, Pitch } from '../types';

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0h 0m 0s';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

const TIER_COLORS: Record<number, string> = {
  1: 'border-[#00E676]/30 bg-[#00E676]/10 text-[#00E676]',
  2: 'border-amber-400/30 bg-amber-400/10 text-amber-400',
  3: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  4: 'border-[#1F1F24] bg-[#060608] text-platinum',
};

export function VipPitchCard({
  pitch,
  intent,
  idx,
  onAccept,
  onDecline,
}: {
  pitch: Pitch;
  intent?: Intent;
  idx: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const status = getPitchTierStatus(pitch);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(idx * 0.06, 0.3) }}
      className="flex flex-col overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-b from-amber-400/[0.06] to-[#060608]"
    >
      {pitch.productImage ? (
        <div className="aspect-video w-full overflow-hidden">
          <img
            src={pitch.productImage}
            alt={pitch.productTitle}
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
            onError={(e) => {
              e.currentTarget.src =
                'https://images.unsplash.com/photo-1521572163436-4c8c5f5f5f5d?w=800';
            }}
          />
        </div>
      ) : (
        <div className="aspect-video w-full overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1521572163436-4c8c5f5f5f5d?w=800"
            alt={pitch.productTitle}
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-1">
          <Building2 size={10} className="text-platinum" />
          <span className="truncate text-[9px] font-medium uppercase tracking-[0.15em] text-platinum">
            {pitch.brandName}
          </span>
        </div>
        <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-white">
          {pitch.productTitle}
        </h3>
        {intent && (
          <p className="mt-1 text-[10px] text-platinum/70">
            Matched intent: "{intent.searchQuery}"
          </p>
        )}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-sm font-bold text-white">
            ₹{pitch.originalPrice.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Active Bounty Badge with Tier */}
        <div className={`mt-1.5 inline-flex items-center gap-1 self-start rounded-md border px-2 py-0.5 text-[10px] font-semibold ${TIER_COLORS[status.tierNumber]}`}>
          <Zap size={10} />
          ₹{status.currentBounty.toLocaleString('en-IN')} Cashback ({status.tierName})
        </div>

        {/* Countdown Timer */}
        {status.tierNumber < 4 ? (
          <div className="mt-2 flex items-center gap-1.5 rounded-md border border-[#1F1F24] bg-[#060608] px-2 py-1.5">
            <Timer size={11} className="text-amber-400" />
            <span className="text-[10px] text-platinum">
              {status.nextTierLabel}:
            </span>
            <span className="font-mono text-[10px] font-bold text-amber-400">
              {formatCountdown(status.msRemainingInTier)}
            </span>
            <span className="ml-auto text-[9px] text-platinum/60">
              → ₹{status.nextTierBounty.toLocaleString('en-IN')}
            </span>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1.5 rounded-md border border-sky-400/20 bg-sky-400/[0.06] px-2 py-1.5">
            <Lock size={11} className="text-sky-300" />
            <span className="text-[10px] font-medium text-sky-300">
              Standard Bounty Active: ₹{status.currentBounty.toLocaleString('en-IN')}
            </span>
          </div>
        )}

        {pitch.offeredSizes && pitch.offeredSizes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {pitch.offeredSizes.map((s) => (
              <span key={s} className="rounded-md border border-[#1F1F24] bg-[#060608] px-1.5 py-0.5 text-[9px] text-platinum">
                {s}
              </span>
            ))}
          </div>
        )}
        {pitch.offeredColors && pitch.offeredColors.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {pitch.offeredColors.map((c) => (
              <span key={c} className="rounded-md border border-[#1F1F24] bg-[#060608] px-1.5 py-0.5 text-[9px] text-platinum">
                {c}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={onAccept}
          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#00E676]/40 bg-[#00E676]/10 px-3 py-2.5 text-xs font-semibold text-[#00E676] shadow-[0_0_20px_rgba(0,230,118,0.15)] transition-all duration-300 hover:bg-[#00E676]/20"
        >
          <Sparkles size={13} />
          Accept VIP Pitch
        </button>
        <button
          onClick={onDecline}
          className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#1F1F24] bg-transparent px-3 py-2 text-xs font-medium text-platinum/60 transition-all duration-300 hover:border-[#FF3B3B]/30 hover:text-[#FF3B3B]"
        >
          <X size={12} />
          Decline Offer
        </button>
      </div>
    </motion.div>
  );
}
