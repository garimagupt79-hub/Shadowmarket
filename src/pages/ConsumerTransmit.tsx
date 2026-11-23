import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio,
  Send,
  CheckCircle2,
  Loader2,
  Search,
  X,
  Zap,
} from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { ConsumerLayout } from '../components/ConsumerLayout';

export function ConsumerTransmit() {
  const { addIntent, intents, removeIntent, session, pushToast } = useMarket();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'idle' | 'broadcasting' | 'done'>('idle');
  const [broadcasting, setBroadcasting] = useState(false);

  const activeIntents = intents.filter(
    (i) => i.status === 'active' && i.consumerEmail === session.email,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || status !== 'idle') return;

    setStatus('broadcasting');
    setBroadcasting(true);
    await addIntent({ searchQuery: query.trim() });
    setStatus('done');
    pushToast('success', `Intent signal active: "${query.trim()}"`);
    window.setTimeout(() => {
      setStatus('idle');
      setBroadcasting(false);
      setQuery('');
      navigate('/consumer/dashboard');
    }, 800);
  };

  return (
    <ConsumerLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tighter text-white">
          Intent Signal Broadcaster
        </h1>
        <p className="mt-1.5 text-sm text-platinum">
          Broadcast what you're looking for. The matching engine surfaces
          inventory automatically.
        </p>
      </div>

      <div className="max-w-2xl">
        {/* Broadcaster Dock */}
        <div className="relative">
          {/* Ambient radar pulse ring */}
          <AnimatePresence>
            {broadcasting && (
              <>
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-[#00E676]"
                  initial={{ opacity: 0.6, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.15 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                />
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-2xl border border-[#00E676]"
                  initial={{ opacity: 0.4, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.25 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
                />
              </>
            )}
          </AnimatePresence>

          <form
            onSubmit={handleSubmit}
            className="relative rounded-2xl border border-[#27272a] bg-[#121214]/80 p-6 backdrop-blur-md"
          >
            {/* Live badge */}
            <AnimatePresence>
              {broadcasting && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-4 flex items-center gap-2"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00E676]/40 bg-[#00E676]/10 px-3 py-1 text-[10px] font-semibold text-[#00E676]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00E676]" />
                    Intent Signal Active: '{query}'
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.15em] text-platinum">
              Search Query
            </label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-platinum/60"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What specific item are you looking for? (e.g. 'wireless earbuds', 'heavyweight hoodie')"
                className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-platinum/50 transition-all duration-300 ease-in-out focus:outline-none focus:ring-1 focus:ring-[#00E676]"
              />
            </div>

            {/* Live matching status subtext */}
            <AnimatePresence>
              {broadcasting && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 flex items-center gap-2 text-[11px] text-platinum"
                >
                  <Loader2 size={11} className="animate-spin text-[#00E676]" />
                  Searching 142 Verified Brands... matching highest cash bounties.
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={!query.trim() || status !== 'idle'}
              className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 ${
                !query.trim()
                  ? 'border-[#1F1F24] bg-[#060608] text-platinum/40'
                  : 'border-[#00E676]/40 bg-[#00E676]/10 text-[#00E676] shadow-[0_0_20px_rgba(0,230,118,0.15)] hover:bg-[#00E676]/20'
              }`}
            >
              {status === 'broadcasting' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Broadcasting…
                </>
              ) : status === 'done' ? (
                <>
                  <CheckCircle2 size={16} />
                  Intent Broadcast
                </>
              ) : (
                <>
                  <Send size={16} />
                  Transmit Intent
                </>
              )}
            </button>
          </form>
        </div>

        {/* Active Intent Tag Chips */}
        {activeIntents.length > 0 && (
          <div className="mt-6">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
              Active Signals
            </p>
            <div className="flex flex-wrap gap-2">
              <AnimatePresence mode="popLayout">
                {activeIntents.map((intent) => (
                  <motion.div
                    key={intent.id}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.2 }}
                    className="group inline-flex items-center gap-2 rounded-full border border-[#00E676]/40 bg-[#00E676]/10 py-1.5 pl-3 pr-1.5 text-xs font-medium text-[#00E676] shadow-[0_0_12px_rgba(0,230,118,0.1)]"
                  >
                    <Zap size={11} />
                    {intent.searchQuery}
                    <button
                      onClick={() => {
                        void removeIntent(intent.id);
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-platinum/60 transition-all duration-300 hover:bg-[#00E676]/20 hover:text-[#00E676]"
                      aria-label="Cancel signal"
                    >
                      <X size={11} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Info card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-5 flex items-start gap-3 rounded-xl border border-[#1F1F24] bg-[#111114]/60 p-4"
        >
          <Radio size={16} className="mt-0.5 shrink-0 text-[#00E676]" />
          <p className="text-xs leading-relaxed text-platinum">
            Your search query is sealed and committed to your local vault before
            redirect. The matching engine scans all brand inventory for keyword
            overlaps and surfaces matches on your dashboard. Active signals
            auto-expire after 48 hours.
          </p>
        </motion.div>
      </div>
    </ConsumerLayout>
  );
}
