import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Building2,
  Check,
  Loader2,
  Lock,
  ExternalLink,
  Award,
  FileText,
} from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { BrandLayout } from '../components/BrandLayout';

export function BrandSettings() {
  const {
    brandProfile,
    verifyGstin,
    setMiddeskVerified,
    connectStripe,
  } = useMarket();

  const [gstinInput, setGstinInput] = useState('');
  const [gstinChecking, setGstinChecking] = useState(false);
  const [stripeConnecting, setStripeConnecting] = useState(false);

  const handleVerifyGstin = () => {
    if (!gstinInput.trim()) return;
    setGstinChecking(true);
    window.setTimeout(() => {
      verifyGstin(gstinInput);
      setGstinChecking(false);
    }, 2500);
  };

  const handleConnectStripe = () => {
    setStripeConnecting(true);
    window.setTimeout(() => {
      connectStripe('4092');
      setStripeConnecting(false);
    }, 3000);
  };

  const steps = [
    {
      n: 1,
      title: 'Business Tax / GSTIN Verification',
      icon: FileText,
      done: brandProfile.gstinVerified,
      content: (
        <div className="flex gap-2">
          <input
            value={gstinInput}
            onChange={(e) => setGstinInput(e.target.value.toUpperCase())}
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
            className="flex-1 rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-2.5 font-mono text-sm text-white outline-none focus:border-[#00E676]"
          />
          <button
            onClick={handleVerifyGstin}
            disabled={gstinChecking || !gstinInput.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#00E676] px-5 py-2.5 text-sm font-semibold text-[#060608] transition-all hover:bg-[#00C853] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {gstinChecking ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Check size={15} />
            )}
            Verify GSTIN
          </button>
        </div>
      ),
    },
    {
      n: 2,
      title: 'Middesk KYB Business Audit',
      icon: Building2,
      done: brandProfile.middeskVerified,
      content: brandProfile.middeskVerified ? null : (
        <button
          onClick={() => setMiddeskVerified()}
          className="inline-flex items-center gap-2 rounded-xl border border-[#635BFF] bg-[#635BFF]/10 px-5 py-2.5 text-sm font-semibold text-[#635BFF] transition-all hover:bg-[#635BFF]/20"
        >
          <Building2 size={15} />
          Run Middesk KYB Audit
        </button>
      ),
    },
    {
      n: 3,
      title: 'Stripe Connect Payout Gateway',
      icon: Lock,
      done: brandProfile.stripeConnected,
      content: brandProfile.stripeConnected ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-platinum">
            Connected Account: Bank ending in ****{brandProfile.stripeAccountLast4}
          </p>
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1F1F24] bg-[#060608] px-3 py-1.5 text-xs font-medium text-platinum transition-all hover:border-[#635BFF] hover:text-[#635BFF]"
          >
            Manage Stripe Payouts
            <ExternalLink size={12} />
          </a>
        </div>
      ) : (
        <button
          onClick={handleConnectStripe}
          disabled={stripeConnecting}
          className="inline-flex items-center gap-2 rounded-xl bg-[#635BFF] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(99,91,255,0.25)] transition-all hover:bg-[#5851E5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {stripeConnecting ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Lock size={15} />
          )}
          Connect Stripe Account
        </button>
      ),
    },
  ];

  return (
    <BrandLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tighter text-white">
          Trust & KYB Verification Center
        </h1>
        <p className="mt-1.5 text-sm text-platinum">
          Complete verification to unlock Gold Trust Badges and escrow-protected payouts.
        </p>
      </div>

      {/* Status header */}
      {brandProfile.isCorporateVerified && brandProfile.gstinVerified && brandProfile.middeskVerified && brandProfile.stripeConnected ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 overflow-hidden rounded-2xl border border-[#FFB300]/30 bg-gradient-to-br from-[#FFB300]/[0.08] to-[#FFD700]/[0.04] p-6 shadow-[0_0_32px_rgba(255,179,0,0.12)]"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#FFB300]/40 bg-[#FFB300]/15">
              <Award size={24} className="text-[#FFB300]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Gold Verified Merchant Badge Active
              </p>
              <p className="mt-1 text-xs text-platinum">
                Visible to all consumers. Full escrow protection and priority grid ranking enabled.
              </p>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="mb-8 rounded-2xl border border-[#1F1F24] bg-[#111114] p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#1F1F24] bg-[#060608]">
              <ShieldCheck size={24} className="text-platinum/50" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Verification In Progress
              </p>
              <p className="mt-1 text-xs text-platinum">
                Complete all 3 steps below to activate your Gold Verified Merchant Badge.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Verification steps */}
      <div className="space-y-4">
        {steps.map((step, idx) => (
          <motion.div
            key={step.n}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.08 }}
            className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-5"
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  step.done
                    ? 'bg-[#00E676]/15 text-[#00E676]'
                    : 'border border-[#1F1F24] bg-[#060608] text-platinum'
                }`}
              >
                {step.done ? <Check size={18} /> : <step.icon size={18} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">
                    {step.n}. {step.title}
                  </p>
                  {step.done && (
                    <span className="text-xs font-semibold text-[#00E676]">
                      Verified ✓
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  {step.done ? (
                    <p className="text-xs text-platinum">
                      {step.n === 1 && `GSTIN: ${brandProfile.gstin}`}
                      {step.n === 2 && 'Corporate Registration Verified ✓'}
                      {step.n === 3 &&
                        `Connected Account: Bank ending in ****${brandProfile.stripeAccountLast4}`}
                    </p>
                  ) : (
                    step.content
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </BrandLayout>
  );
}
