import { motion, AnimatePresence } from 'framer-motion';
import { Boxes, Check, Package, Building2, Trash2 } from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { BrandLayout } from '../components/BrandLayout';

export function BrandInventory() {
  const { products, removeProduct, brandProfile } = useMarket();

  return (
    <BrandLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tighter text-white">
          Inventory Console
        </h1>
        <p className="mt-1.5 text-sm text-platinum">
          Your active catalog. Use the Publish studio to add new products.
        </p>
      </div>

      <div className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-6">
        <div className="mb-5 flex items-center gap-2">
          <Boxes size={15} className="text-[#00E676]" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-white">
            Live Catalog
          </h2>
          <span className="ml-1 rounded-full border border-[#1F1F24] bg-[#060608] px-2 py-0.5 text-[10px] text-platinum">
            {products.length} items
          </span>
        </div>

        {products.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-[#00E676]/20 bg-[#00E676]/[0.03] p-6"
          >
            <div className="mb-5 flex items-center gap-2">
              <span className="text-xl">🚀</span>
              <h3 className="text-sm font-semibold text-white">
                Welcome to ShadowMarket!
              </h3>
            </div>
            <p className="mb-5 text-xs text-platinum">
              Complete these 3 steps to start converting buyers:
            </p>
            <div className="space-y-3">
              {[
                {
                  step: 1,
                  text: 'Add your first catalog item (Minimum 5% base auto-bounty required).',
                  done: false,
                },
                {
                  step: 2,
                  text: 'Complete corporate KYB verification (+25 point Fair-Value ranking boost).',
                  done: brandProfile.isCorporateVerified,
                },
                {
                  step: 3,
                  text: 'Dispatch your first VIP pitch on the Intent Radar.',
                  done: false,
                },
              ].map((s) => (
                <div
                  key={s.step}
                  className="flex items-start gap-3 rounded-xl border border-[#1F1F24] bg-[#060608] p-3"
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      s.done
                        ? 'bg-[#00E676]/15 text-[#00E676]'
                        : 'border border-[#1F1F24] bg-[#111114] text-platinum'
                    }`}
                  >
                    {s.done ? <Check size={14} /> : s.step}
                  </div>
                  <p className="pt-1 text-xs text-platinum">{s.text}</p>
                </div>
              ))}
            </div>
            <a
              href="/brand/catalog/new"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00E676] px-4 py-3 text-sm font-semibold text-[#060608] transition-all duration-300 hover:bg-[#00C853]"
            >
              Publish First Product
            </a>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {products.map((p) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="overflow-hidden rounded-xl border border-[#1F1F24] bg-[#060608]"
                >
                  <div className="flex gap-4 p-3">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg">
                      {p.images[0] ? (
                        <img
                          src={p.images[0]}
                          alt={p.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#111114] text-platinum">
                          <Package size={18} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
                          <Building2 size={10} />
                          {p.brandName}
                        </div>
                        <button
                          onClick={() => removeProduct(p.id)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#1F1F24] bg-[#060608] text-platinum transition-all duration-300 ease-in-out hover:border-red-500/40 hover:text-red-400"
                          aria-label="Remove product"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <h3 className="mt-1 truncate text-sm font-semibold text-white">
                        {p.title}
                      </h3>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-base font-bold text-[#00E676]">
                          ₹{p.priceInr.toLocaleString('en-IN')}
                        </span>
                        <span className="rounded-md border border-[#1F1F24] bg-[#111114] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-platinum">
                          {p.category}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.keywords.slice(0, 4).map((kw) => (
                          <span
                            key={kw}
                            className="rounded-md border border-[#1F1F24] bg-[#111114] px-1.5 py-0.5 text-[9px] text-platinum"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-[10px] text-platinum/70">
                        Bounty:{' '}
                        <span className="text-[#00E676]">
                          ₹{p.autoBounty.toLocaleString('en-IN')}
                        </span>{' '}
                        · Sizes: {p.sizes.join(', ') || '—'} · Colors:{' '}
                        {p.colors.join(', ') || '—'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </BrandLayout>
  );
}
