import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Building2,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { AuthModal } from '../components/AuthModal';

type AuthRole = 'consumer' | 'brand';

export function LandingPage() {
  const [activeRole, setActiveRole] = useState<AuthRole | null>(null);

  const handleAuthenticated = () => {
    setActiveRole(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060608] text-gray-100">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-[#00E676]/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#00E676]/5 blur-[100px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-3 flex items-center gap-2 rounded-full border border-[#1F1F24] bg-[#111114]/60 px-4 py-1.5 backdrop-blur-md"
        >
          <Lock size={12} className="text-[#00E676]" />
          <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-platinum">
            Cryptographic Intent Market
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
          className="bg-gradient-to-b from-white to-gray-500 bg-clip-text text-center text-6xl font-bold tracking-tighter text-transparent sm:text-7xl"
        >
          SHADOWMARKET
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
          className="mt-5 max-w-xl text-center text-sm leading-relaxed text-platinum sm:text-base"
        >
          Monetize your commercial intent. Retain 100% cryptographic data
          invisibility.
        </motion.p>

        <div className="mt-14 grid w-full max-w-4xl gap-5 sm:grid-cols-2">
          {/* Consumer entry */}
          <motion.button
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.25 }}
            onClick={() => setActiveRole('consumer')}
            className="group relative overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#111114] p-8 text-left transition-all duration-300 ease-in-out hover:border-[#00E676]/40"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#00E676]/5 blur-3xl transition-all duration-500 group-hover:bg-[#00E676]/10" />
            <div className="relative">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-[#1F1F24] bg-[#060608]">
                <ShieldCheck size={22} className="text-[#00E676]" />
              </div>
              <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-platinum">
                For Individuals
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Access Privacy Vault
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-platinum">
                Broadcast anonymous commercial intent. Receive encrypted
                escrow offers. Verify purchases and claim liquid payouts.
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm font-medium text-[#00E676]">
                Enter as Consumer
                <ArrowRight
                  size={16}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </div>
            </div>
          </motion.button>

          {/* Brand entry */}
          <motion.button
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.35 }}
            onClick={() => setActiveRole('brand')}
            className="group relative overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#111114] p-8 text-left transition-all duration-300 ease-in-out hover:border-[#00E676]/40"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#00E676]/5 blur-3xl transition-all duration-500 group-hover:bg-[#00E676]/10" />
            <div className="relative">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-[#1F1F24] bg-[#060608]">
                <Building2 size={22} className="text-[#00E676]" />
              </div>
              <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-platinum">
                For Brands
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Access Corporate Block
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-platinum">
                Access the live intent feed. Stock your catalog. Submit
                encrypted escrow bids directly to verified liquid humans.
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm font-medium text-[#00E676]">
                Enter as Brand
                <ArrowRight
                  size={16}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </div>
            </div>
          </motion.button>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 text-[10px] uppercase tracking-[0.25em] text-platinum/60"
        >
          Zero-Knowledge Transport Layer · zkTLS
        </motion.p>
      </div>

      <AnimatePresence>
        {activeRole && (
          <AuthModal
            initialRole={activeRole === 'consumer' ? 'buyer' : 'brand'}
            onClose={() => setActiveRole(null)}
            onAuthenticated={handleAuthenticated}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
