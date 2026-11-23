import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, CheckCheck, Bell, ArrowRight, Crown, Zap, Sparkles, Building2, MessageSquare, X } from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { ConsumerLayout } from '../components/ConsumerLayout';
import { EmptyState } from '../components/EmptyState';
import { DisputeChatModal } from '../components/DisputeChatModal';
import { EscrowCheckoutModal } from '../components/EscrowCheckoutModal';
import { VipPitchCard } from '../components/VipPitchCard';
import type { Order, Pitch, Product } from '../types';

type Tab = 'unread' | 'all';

const TYPE_ICON: Record<string, typeof Bell> = {
  order: Bell,
  vip_pitch: Bell,
  wallet_cashout: Bell,
  dispute: Bell,
  intent: Bell,
  system: Bell,
};

export function ConsumerInbox() {
  const {
    notifications,
    pitches,
    intents,
    session,
    products,
    orders,
    markNotificationRead,
    markAllNotificationsRead,
    declinePitch,
    addConsumerDisputeMessage,
    pushToast,
  } = useMarket();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('unread');
  const [chatOrder, setChatOrder] = useState<Order | null>(null);
  const [escrowPitch, setEscrowPitch] = useState<Pitch | null>(null);
  const [escrowProduct, setEscrowProduct] = useState<Product | null>(null);
  const [escrowInitialSize, setEscrowInitialSize] = useState<string | undefined>(undefined);
  const [escrowInitialColor, setEscrowInitialColor] = useState<string | undefined>(undefined);

  const myNotifications = useMemo(
    () => notifications.filter((n) => n.consumerEmail === session.email),
    [notifications, session.email],
  );

  const unread = myNotifications.filter((n) => !n.read);
  const currentList = tab === 'unread' ? unread : myNotifications;

  const myActivePitches = useMemo(
    () =>
      pitches.filter(
        (p) => p.consumerEmail === session.email && p.status === 'active',
      ),
    [pitches, session.email],
  );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'unread', label: 'Unread', count: unread.length },
    { key: 'all', label: 'All', count: myNotifications.length },
  ];

  const handleAccept = (pitchId: string) => {
    const pitch = pitches.find((p) => p.id === pitchId);
    const product = products.find((p) => p.id === pitch?.productId);
    if (pitch && product) {
      setEscrowPitch(pitch);
      setEscrowProduct(product);
      setEscrowInitialSize(pitch.offeredSizes?.[0] ?? product.sizes[0]);
      setEscrowInitialColor(pitch.offeredColors?.[0] ?? product.colors[0]);
    }
  };

  const handleDecline = (pitchId: string) => {
    declinePitch(pitchId);
    pushToast('info', 'Offer declined');
  };

  const handleOpenChat = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (order) setChatOrder(order);
  };

  const handleSendChatMessage = (text: string, images?: string[]) => {
    if (!chatOrder) return;
    addConsumerDisputeMessage(chatOrder.id, text, images);
  };

  return (
    <ConsumerLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter text-white">Inbox</h1>
          <p className="mt-1.5 text-sm text-platinum">
            Updates on your orders, bounties, and intent matches.
          </p>
        </div>
        {unread.length > 0 && (
          <button
            onClick={markAllNotificationsRead}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#1F1F24] bg-[#111114] px-4 py-2.5 text-xs font-medium text-platinum transition-all duration-300 hover:text-white"
          >
            <CheckCheck size={14} />
            Mark all read
          </button>
        )}
      </div>

      {/* VIP Pitches */}
      {myActivePitches.length > 0 && (
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Crown size={16} className="text-amber-400" />
            <h2 className="text-lg font-bold tracking-tight text-white">
              Active VIP Pitches
            </h2>
            <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
              {myActivePitches.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myActivePitches.map((pitch, idx) => {
              const intent = intents.find((i) => i.id === pitch.intentId);
              return (
                <VipPitchCard
                  key={pitch.id}
                  pitch={pitch}
                  intent={intent}
                  idx={idx}
                  onAccept={() => handleAccept(pitch.id)}
                  onDecline={() => handleDecline(pitch.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto scrollbar-thin">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
              tab === t.key
                ? 'border-[#00E676]/30 bg-[#00E676]/10 text-[#00E676]'
                : 'border-[#1F1F24] bg-[#111114] text-platinum hover:border-[#2A2A2E]'
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                tab === t.key ? 'bg-[#00E676]/20 text-[#00E676]' : 'bg-[#060608] text-platinum'
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {currentList.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-6"
          >
            <EmptyState
              icon={<Inbox size={28} />}
              title={tab === 'unread' ? 'No unread messages.' : 'Your inbox is empty.'}
              subtitle="Notifications about your orders and bounties will show up here."
            />
          </motion.div>
        ) : (
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {currentList.map((n, idx) => {
              const Icon = TYPE_ICON[n.type] ?? Bell;
              const disputeOrder = n.type === 'dispute' && n.link
                ? orders.find((o) => o.id === n.link!.replace('/consumer/orders', ''))
                : null;
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  className={`flex items-start gap-4 rounded-2xl border p-4 transition-all duration-300 ${
                    n.read
                      ? 'border-[#1F1F24] bg-[#111114]'
                      : 'border-[#00E676]/20 bg-[#00E676]/[0.04]'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1F1F24] bg-[#060608]">
                    <Icon size={16} className={n.read ? 'text-platinum' : 'text-[#00E676]'} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-sm font-semibold ${n.read ? 'text-platinum' : 'text-white'}`}>
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-xs text-platinum">{n.description}</p>
                      </div>
                      {!n.read && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#00E676]" />
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <span className="text-[10px] text-platinum/60">
                        {new Date(n.timestamp).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {n.link && (
                        <button
                          onClick={() => {
                            if (!n.read) markNotificationRead(n.id);
                            navigate(n.link!);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#00E676] transition-all hover:text-[#00C853]"
                        >
                          View
                          <ArrowRight size={10} />
                        </button>
                      )}
                      {n.type === 'dispute' && disputeOrder && (
                        <button
                          onClick={() => {
                            if (!n.read) markNotificationRead(n.id);
                            handleOpenChat(disputeOrder.id);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#00E676]/40 bg-[#00E676]/10 px-2.5 py-1 text-[10px] font-semibold text-[#00E676] transition-all hover:bg-[#00E676]/20"
                        >
                          <MessageSquare size={11} />
                          Open Support Chat
                        </button>
                      )}
                      {!n.read && (
                        <button
                          onClick={() => markNotificationRead(n.id)}
                          className="text-[10px] font-medium text-platinum transition-all hover:text-white"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <DisputeChatModal
        order={chatOrder}
        open={!!chatOrder}
        onClose={() => setChatOrder(null)}
        onSend={handleSendChatMessage}
        senderRole="consumer"
      />

      <EscrowCheckoutModal
        pitch={escrowPitch}
        product={escrowProduct}
        open={!!escrowPitch}
        initialSize={escrowInitialSize}
        initialColor={escrowInitialColor}
        onClose={() => {
          setEscrowPitch(null);
          setEscrowProduct(null);
          setEscrowInitialSize(undefined);
          setEscrowInitialColor(undefined);
        }}
      />
    </ConsumerLayout>
  );
}
