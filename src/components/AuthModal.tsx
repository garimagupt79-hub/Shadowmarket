import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Building2,
  ArrowRight,
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  X,
  User,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type AuthRole = 'buyer' | 'brand';
type Mode = 'sign-in' | 'sign-up';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthModal({
  initialRole = 'buyer',
  onClose,
  onAuthenticated,
}: {
  initialRole?: AuthRole;
  onClose: () => void;
  onAuthenticated?: () => void;
}) {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [role, setRole] = useState<AuthRole>(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isBuyer = role === 'buyer';
  const Icon = isBuyer ? ShieldCheck : Building2;
  const heading = isBuyer ? 'Privacy Vault' : 'Corporate Block';

  const emailValid = EMAIL_RE.test(email.trim());
  const pwValid = password.length >= 6;
  const nameValid = mode === 'sign-in' || displayName.trim().length >= 2;
  const canSubmit = emailValid && pwValid && nameValid && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!emailValid) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'sign-up' && displayName.trim().length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'sign-up') {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: displayName.trim(),
              role,
              initial_balance: 25000,
            },
          },
        });
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
      onAuthenticated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      setError(msg.includes('already registered')
        ? 'This email is already registered. Try signing in instead.'
        : msg.includes('Invalid login')
          ? 'Invalid email or password.'
          : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#111114] p-8"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#00E676]/5 blur-3xl" />

        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-platinum transition-all duration-300 ease-in-out hover:bg-[#060608] hover:text-white"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="relative">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-[#1F1F24] bg-[#060608]">
            <Icon size={22} className="text-[#00E676]" />
          </div>
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-platinum">
            {isBuyer ? 'For Individuals' : 'For Brands'}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {mode === 'sign-in' ? `Sign In — ${heading}` : `Create Account — ${heading}`}
          </h2>

          {/* Role toggle */}
          <div className="mt-4 flex gap-2 rounded-xl border border-[#1F1F24] bg-[#060608] p-1">
            <button
              type="button"
              onClick={() => setRole('buyer')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-300 ${
                role === 'buyer'
                  ? 'bg-[#00E676]/10 text-[#00E676]'
                  : 'text-platinum hover:text-white'
              }`}
            >
              <ShieldCheck size={13} />
              Buyer
            </button>
            <button
              type="button"
              onClick={() => setRole('brand')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-300 ${
                role === 'brand'
                  ? 'bg-[#00E676]/10 text-[#00E676]'
                  : 'text-platinum hover:text-white'
              }`}
            >
              <Building2 size={13} />
              Brand
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <AnimatePresence>
              {mode === 'sign-up' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
                    Display Name
                  </label>
                  <div className="relative">
                    <User
                      size={15}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-platinum/60"
                    />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] py-3 pl-10 pr-3.5 text-sm text-white placeholder:text-platinum/50 transition-all duration-300 ease-in-out focus:outline-none focus:ring-1 focus:ring-[#00E676]"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-platinum/60"
                />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] py-3 pl-10 pr-3.5 text-sm text-white placeholder:text-platinum/50 transition-all duration-300 ease-in-out focus:outline-none focus:ring-1 focus:ring-[#00E676]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
                Password
              </label>
              <div className="relative">
                <KeyRound
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-platinum/60"
                />
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] py-3 pl-10 pr-10 text-sm text-white placeholder:text-platinum/50 transition-all duration-300 ease-in-out focus:outline-none focus:ring-1 focus:ring-[#00E676]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-platinum/60 transition-all duration-300 ease-in-out hover:text-white"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 rounded-xl border border-red-900/60 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-400"
                >
                  <AlertCircle size={13} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#00E676]/40 bg-[#00E676]/10 px-4 py-3 text-sm font-semibold text-[#00E676] shadow-[0_0_20px_rgba(0,230,118,0.15)] transition-all duration-300 ease-in-out hover:bg-[#00E676]/20 disabled:cursor-not-allowed disabled:border-[#1F1F24] disabled:bg-[#060608] disabled:text-platinum disabled:shadow-none"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {mode === 'sign-in' ? 'Signing in…' : 'Creating account…'}
                </>
              ) : (
                <>
                  {mode === 'sign-in' ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-platinum">
            <span>
              {mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?'}
            </span>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
                setError(null);
              }}
              className="font-medium text-[#00E676] transition-colors hover:text-[#00E676]/80"
            >
              {mode === 'sign-in' ? 'Sign up' : 'Sign in'}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-platinum/60">
            <Lock size={10} />
            Secured by Supabase Auth
          </div>
        </div>
      </motion.div>
    </div>
  );
}
