import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trash2,
  Radio,
  Fingerprint,
  ChevronRight,
  Package,
  Clock,
  RefreshCw,
  Users,
  ShoppingBag,
  Send,
} from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { ConsumerLayout } from '../components/ConsumerLayout';
import { EmptyState } from '../components/EmptyState';
import { type Intent } from '../types';
import { rankProductsByIntent } from '../utils/intentMatcher';
import { AddressBook } from '../components/AddressBook';

function useCountdown(expiresAt: number): string {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const diff = Math.max(0, expiresAt - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `Active for ${h}h ${m}m`;
}

function IntentRow({ intent, matchCount }: { intent: Intent; matchCount: number }) {
  const { removeIntent, extendIntent, session } = useMarket();
  const navigate = useNavigate();
  const countdown = useCountdown(intent.expiresAt);
  const isExpired = intent.expiresAt < Date.now();

  const poolLink = `/consumer/intent?ref=${session.email}&query=${encodeURIComponent(intent.searchQuery)}`;

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="group flex flex-col gap-3 px-5 py-4 transition-colors duration-300 hover:bg-[#111114] sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1F1F24] bg-[#111114]">
        <Fingerprint size={16} className="text-[#00E676]" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {intent.searchQuery}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] text-platinum">
            <Package size={11} />
            {matchCount} matched product{matchCount === 1 ? '' : 's'}
          </span>
          <span className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${
            isExpired
              ? 'border-red-500/30 text-red-400'
              : 'border-[#1F1F24] text-platinum'
          }`}>
            <Clock size={9} />
            {isExpired ? 'Expired' : countdown}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Pool Demand */}
        <button
          onClick={() => {
            navigator.clipboard?.writeText(`${window.location.origin}${poolLink}`);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1F1F24] bg-[#060608] text-platinum transition-all duration-300 ease-in-out hover:border-[#00E676]/40 hover:text-[#00E676]"
          aria-label="Pool demand with friends"
          title="Pool Demand with Friends"
        >
          <Users size={13} />
        </button>

        {/* Extend */}
        <button
          onClick={() => extendIntent(intent.id)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1F1F24] bg-[#060608] text-platinum transition-all duration-300 ease-in-out hover:border-[#00E676]/40 hover:text-[#00E676]"
          aria-label="Extend intent by 48h"
          title="Extend (+48h)"
        >
          <RefreshCw size={13} />
        </button>

        {/* Delete */}
        <button
          onClick={() => removeIntent(intent.id)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1F1F24] bg-[#060608] text-platinum transition-all duration-300 ease-in-out hover:border-red-500/40 hover:text-red-400"
          aria-label="Delete intent"
        >
          <Trash2 size={13} />
        </button>

        {/* Explore */}
        <button
          onClick={() => navigate(`/consumer/intent/${intent.id}`)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#00E676]/40 bg-[#00E676]/10 px-3.5 py-2 text-xs font-semibold text-[#00E676] transition-all duration-300 ease-in-out hover:bg-[#00E676]/20"
        >
          Explore Results
          <ChevronRight size={13} />
        </button>
      </div>
    </motion.li>
  );
}

export function ConsumerDashboard() {
  const { intents, products } = useMarket();
  const navigate = useNavigate();

  const activeIntents = useMemo(
    () => intents.filter((i) => i.status === 'active' && i.expiresAt > Date.now()),
    [intents],
  );

  const matchCountByIntent = useMemo(() => {
    const map: Record<string, number> = {};
    for (const intent of activeIntents) {
      map[intent.id] = rankProductsByIntent(intent.searchQuery, products).length;
    }
    return map;
  }, [activeIntents, products]);

  return (
    <ConsumerLayout>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter text-white">
            Active Searches
          </h1>
          <p className="mt-1.5 text-sm text-platinum">
            Your live intent threads. Explore matched market results for each.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/consumer/orders')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#1F1F24] bg-[#111114] px-4 py-2.5 text-xs font-medium text-platinum transition-all duration-300 hover:text-white"
          >
            <ShoppingBag size={14} />
            My Purchases
          </button>
          <button
            onClick={() => navigate('/consumer/transmit')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-2.5 text-xs font-semibold text-zinc-300 transition-colors duration-300 ease-in-out hover:border-zinc-700 hover:text-white"
          >
            <Send size={14} />
            Transmit New Intent
          </button>
        </div>
      </div>

      {activeIntents.length === 0 ? (
        <EmptyState
          icon={<Radio size={28} />}
          title="No active searches."
          subtitle="Transmit an intent to trigger the automated matching engine."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#060608]">
          <div className="flex items-center justify-between border-b border-[#1F1F24] px-5 py-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
              Intent
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
              Matches
            </span>
          </div>
          <ul className="divide-y divide-[#1F1F24]">
            {activeIntents.map((intent: Intent) => {
              const matchCount = matchCountByIntent[intent.id] || 0;
              return (
                <IntentRow
                  key={intent.id}
                  intent={intent}
                  matchCount={matchCount}
                />
              );
            })}
          </ul>
        </div>
      )}

      <AddressBook />
    </ConsumerLayout>
  );
}
