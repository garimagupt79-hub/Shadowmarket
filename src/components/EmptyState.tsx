import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#1F1F24] bg-[#111114]/60 text-platinum">
        {icon}
      </div>
      <p className="text-sm font-medium tracking-wide text-platinum">{title}</p>
      {subtitle && <p className="mt-1.5 text-xs text-platinum/60">{subtitle}</p>}
    </motion.div>
  );
}
