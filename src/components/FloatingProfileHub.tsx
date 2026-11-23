import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  User,
  ShieldCheck,
  ShieldAlert,
  Wallet,
  LogOut,
  Mail,
  Sparkles,
} from 'lucide-react';
import { useMarket } from '../context/MarketContext';

export function FloatingProfileHub() {
  const { session, signOut, consumerWallet, brandWallet, verifyConsumer } =
    useMarket();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSignOut = () => {
    setOpen(false);
    signOut();
    navigate('/');
  };

  const handleVerify = () => {
    verifyConsumer();
  };

  const initial = session.email ? session.email[0].toUpperCase() : '?';
  const isConsumer = session.role === 'consumer';
  const balance = isConsumer
    ? consumerWallet.withdrawable
    : brandWallet.globalBudget;
  const balanceLabel = isConsumer ? 'Withdrawable' : 'Global Budget';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-b from-[#242427] to-[#111114] p-px shadow-lg transition-all duration-300 ease-in-out hover:shadow-[0_0_20px_rgba(0,230,118,0.25)]"
        aria-label="Open profile hub"
      >
        <span className="flex h-full w-full items-center justify-center rounded-full bg-[#111114] text-sm font-semibold text-white">
          {session.email ? initial : <User size={16} className="text-platinum" />}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-[#242427] bg-[#111114]/90 p-5 shadow-2xl backdrop-blur-lg"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-[#242427] to-[#111114] p-px">
                <span className="flex h-full w-full items-center justify-center rounded-full bg-[#111114] text-sm font-semibold text-white">
                  {initial}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {session.email || 'Anonymous'}
                </p>
                <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-[#1F1F24] bg-[#060608] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-platinum">
                  {isConsumer ? 'Consumer' : 'Brand'} Role
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#1F1F24] bg-[#060608] px-3 py-2.5">
              <Mail size={12} className="shrink-0 text-platinum" />
              <p className="truncate text-[11px] text-platinum">
                {session.email || 'No email on file'}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-lg border border-[#1F1F24] bg-[#060608] px-3 py-2.5">
              <div className="flex items-center gap-2 text-platinum">
                <ShieldCheck size={12} />
                <span className="text-[11px]">Profile Status</span>
              </div>
              {session.isVerified ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#00E676]">
                  <ShieldCheck size={11} /> Verified
                </span>
              ) : (
                <button
                  onClick={handleVerify}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-yellow-400 transition-all duration-300 ease-in-out hover:text-yellow-300"
                >
                  <ShieldAlert size={11} /> Verify Account
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-lg border border-[#1F1F24] bg-[#060608] px-3 py-2.5">
              <div className="flex items-center gap-2 text-platinum">
                <Wallet size={12} />
                <span className="text-[11px]">{balanceLabel}</span>
              </div>
              <span className="text-sm font-bold text-[#00E676] shadow-[0_0_20px_rgba(0,230,118,0.15)]">
                ₹{balance.toLocaleString('en-IN')}
              </span>
            </div>

            <button
              onClick={handleSignOut}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-2.5 text-sm font-semibold text-red-400 transition-all duration-300 ease-in-out hover:bg-red-900/40 hover:text-red-300"
            >
              <LogOut size={15} />
              Terminate Session
            </button>

            <p className="mt-3 flex items-center justify-center gap-1 text-[9px] uppercase tracking-[0.2em] text-platinum/60">
              <Sparkles size={9} className="text-[#00E676]" />
              ShadowMarket · zkTLS Secured
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
