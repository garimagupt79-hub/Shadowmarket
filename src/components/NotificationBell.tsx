import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Trash2, CheckCheck, Package, Zap, Wallet, AlertTriangle, X, Info } from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import type { AppNotification, NotificationType } from '../types';

const ICONS: Record<NotificationType, React.ReactNode> = {
  order: <Package size={14} className="text-[#00E676]" />,
  vip_pitch: <Zap size={14} className="text-amber-400" />,
  wallet_cashout: <Wallet size={14} className="text-[#00E676]" />,
  dispute: <AlertTriangle size={14} className="text-red-400" />,
  intent: <Zap size={14} className="text-amber-400" />,
  system: <Info size={14} className="text-platinum" />,
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const {
    notifications,
    markAllNotificationsRead,
    removeNotification,
    markNotificationRead,
    session,
  } = useMarket();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  const userNotifs = notifications.filter(
    (n) => n.consumerEmail === session.email,
  );
  const unreadCount = userNotifs.filter((n) => !n.read).length;
  const display = tab === 'unread' ? userNotifs.filter((n) => !n.read) : userNotifs;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#1F1F24] bg-[#111114] text-platinum transition-all duration-300 ease-in-out hover:border-platinum/30 hover:text-white"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00E676] px-1 text-[9px] font-bold text-black shadow-[0_0_8px_rgba(0,230,118,0.6)]">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute right-0 top-12 z-50 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#111114]/95 shadow-2xl backdrop-blur-lg"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#1F1F24] px-4 py-3">
                <h3 className="text-sm font-semibold text-white">Activity Center</h3>
                <button
                  onClick={() => setOpen(false)}
                  className="text-platinum/60 transition-colors duration-300 hover:text-white"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-[#1F1F24] px-4 py-2">
                {(['all', 'unread'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all duration-300 ${
                      tab === t
                        ? 'bg-[#00E676]/10 text-[#00E676]'
                        : 'text-platinum hover:text-white'
                    }`}
                  >
                    {t === 'all' ? 'All Activity' : 'Unread'}
                  </button>
                ))}
                <button
                  onClick={markAllNotificationsRead}
                  className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] text-platinum transition-colors duration-300 hover:text-[#00E676]"
                >
                  <CheckCheck size={12} />
                  Mark all read
                </button>
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {display.length === 0 ? (
                  <p className="py-10 text-center text-xs text-platinum/60">
                    No notifications.
                  </p>
                ) : (
                  display.map((n: AppNotification) => (
                    <div
                      key={n.id}
                      className={`group flex items-start gap-3 border-b border-[#1F1F24] px-4 py-3 transition-colors duration-300 hover:bg-[#060608]/60 ${
                        !n.read ? 'bg-[#00E676]/[0.03]' : ''
                      }`}
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#1F1F24] bg-[#060608]">
                        {ICONS[n.type]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white">{n.title}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-platinum">
                          {n.description}
                        </p>
                        <div className="mt-1.5 flex items-center gap-3">
                          <span className="text-[10px] text-platinum/50">
                            {timeAgo(n.timestamp)}
                          </span>
                          {n.link && (
                            <span className="text-[10px] font-medium text-[#00E676]">
                              {n.link}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        {!n.read && (
                          <button
                            onClick={() => markNotificationRead(n.id)}
                            className="h-2 w-2 rounded-full bg-[#00E676] shadow-[0_0_6px_rgba(0,230,118,0.6)] transition-transform duration-300 hover:scale-125"
                            aria-label="Mark read"
                          />
                        )}
                        <button
                          onClick={() => removeNotification(n.id)}
                          className="text-platinum/40 transition-colors duration-300 hover:text-red-400"
                          aria-label="Delete notification"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
