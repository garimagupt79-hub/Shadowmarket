import { NavLink, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Radio, ShieldCheck, ShoppingBag, Wallet, Inbox, Flame, LogOut, UserCircle } from 'lucide-react';
import { FloatingProfileHub } from './FloatingProfileHub';
import { NotificationBell } from './NotificationBell';
import { ToastContainer } from './ToastContainer';
import { useMarket } from '../context/MarketContext';
import { Shield } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/consumer/dashboard', label: 'Active Searches', icon: LayoutDashboard },
  { to: '/consumer/transmit', label: 'Transmit Intent', icon: Radio },
  { to: '/consumer/waves', label: 'Live Waves', icon: Flame },
  { to: '/consumer/orders', label: 'My Purchases', icon: ShoppingBag },
  { to: '/consumer/wallet', label: 'Wallet', icon: Wallet },
];

export function ConsumerLayout({ children }: { children: React.ReactNode }) {
  const { bagItems, notifications, syndicateWaves, session, authProfile, supabaseSignOut } = useMarket();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeWaves = syndicateWaves.filter(
    (w) => w.status === 'active' && Date.now() < w.startTime + w.durationMs,
  );

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabaseSignOut();
    setSigningOut(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-base text-gray-100">
      <header className="sticky top-0 z-40 flex w-full items-center gap-1 border-b border-[#1F1F24] bg-[#060608] px-2 py-3 sm:gap-3 sm:px-4 md:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1F1F24] bg-[#111114]">
            <ShieldCheck size={18} className="text-[#00E676]" />
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-semibold tracking-tight text-white">
              ShadowMarket
            </p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-platinum">
              Privacy Vault
            </p>
          </div>
        </div>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-thin [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-w-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-sm transition-all duration-300 ease-in-out sm:px-3 ${
                  isActive
                    ? 'bg-[#00E676]/10 text-[#00E676] shadow-[0_0_12px_rgba(0,230,118,0.25)]'
                    : 'text-platinum hover:bg-[#111114] hover:text-white'
                }`
              }
            >
              {item.label === 'Live Waves' && activeWaves.length > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF6B35] px-1 text-[9px] font-bold text-white">
                  <span className="mr-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  {activeWaves.length}
                </span>
              )}
              <item.icon size={15} />
              <span className="hidden md:inline">{item.label}</span>
            </NavLink>
          ))}

          {/* Inbox with unread badge */}
          <NavLink
            to="/consumer/inbox"
            className={({ isActive }) =>
              `relative flex min-w-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-sm transition-all duration-300 ease-in-out sm:px-3 ${
                isActive
                  ? 'bg-[#00E676]/10 text-[#00E676] shadow-[0_0_12px_rgba(0,230,118,0.25)]'
                  : 'text-platinum hover:bg-[#111114] hover:text-white'
              }`
            }
          >
            <Inbox size={15} />
            <span className="hidden md:inline">Inbox</span>
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00E676] px-1 text-[9px] font-bold text-[#060608]">
                {unreadCount}
              </span>
            )}
          </NavLink>

          {/* Shopping Bag with item count badge */}
          <NavLink
            to="/consumer/bag"
            className={({ isActive }) =>
              `relative flex min-w-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-sm transition-all duration-300 ease-in-out sm:px-3 ${
                isActive
                  ? 'bg-[#00E676]/10 text-[#00E676] shadow-[0_0_12px_rgba(0,230,118,0.25)]'
                  : 'text-platinum hover:bg-[#111114] hover:text-white'
              }`
            }
          >
            <ShoppingBag size={15} />
            <span className="hidden md:inline">Bag</span>
            {bagItems.length > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00E676] px-1 text-[9px] font-bold text-[#060608]">
                {bagItems.length}
              </span>
            )}
          </NavLink>
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <FloatingProfileHub />
          <NotificationBell />
          <div className="hidden items-center gap-1.5 rounded-xl border border-[#1F1F24] bg-[#111114] px-2.5 py-1.5 sm:flex">
            <UserCircle size={14} className="text-[#00E676]" />
            <span className="max-w-[120px] truncate text-xs font-medium text-platinum">
              {authProfile?.display_name || session.email || 'Account'}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex min-w-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2 text-xs font-medium text-platinum transition-all duration-300 hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
            aria-label="Sign out"
          >
            <LogOut size={13} />
            <span className="hidden lg:inline">Sign Out</span>
          </button>
          <Link
            to="/admin"
            className="inline-flex min-w-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-400 transition-all hover:bg-amber-400/20"
          >
            <Shield size={13} />
            <span className="hidden lg:inline">Super Admin</span>
          </Link>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="mx-auto max-w-7xl px-4 pt-4 pb-20 lg:px-8"
      >
        {children}
      </motion.main>
      <ToastContainer />
    </div>
  );
}
