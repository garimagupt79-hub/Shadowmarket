import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import type { Toast } from '../types';

const ICONS: Record<Toast['type'], React.ReactNode> = {
  success: <CheckCircle2 size={16} className="text-[#00E676]" />,
  info: <Info size={16} className="text-blue-400" />,
  error: <AlertCircle size={16} className="text-red-400" />,
};

const BORDERS: Record<Toast['type'], string> = {
  success: 'border-[#00E676]/30',
  info: 'border-blue-500/30',
  error: 'border-red-500/30',
};

export function ToastContainer() {
  const { toasts, dismissToast } = useMarket();
  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5 sm:right-6">
      <AnimatePresence>
        {toasts.map((toast: Toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border ${BORDERS[toast.type]} bg-[#111114]/90 p-3.5 shadow-2xl backdrop-blur-lg`}
          >
            {ICONS[toast.type]}
            <p className="flex-1 text-xs font-medium text-white">{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-platinum/60 transition-colors duration-300 hover:text-white"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
