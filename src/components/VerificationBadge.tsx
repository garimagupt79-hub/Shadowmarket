import { ShieldCheck } from 'lucide-react';
import { useMarket } from '../context/MarketContext';

export function VerificationBadge() {
  const { session } = useMarket();
  if (session.isVerified) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-[#00E676]/30 bg-[#00E676]/10 px-3 py-1.5">
        <ShieldCheck size={14} className="text-[#00E676]" />
        <span className="text-xs font-semibold tracking-wide text-[#00E676]">
          Verified Liquid Human (&gt;₹30,000)
        </span>
      </div>
    );
  }
  return null;
}
