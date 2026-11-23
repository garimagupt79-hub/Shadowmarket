import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Radar,
  Search,
  Zap,
  Trash2,
  Target,
  Bell,
  Lock,
  TrendingUp,
  IndianRupee,
  AlertTriangle,
  Tag,
} from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { BrandLayout } from '../components/BrandLayout';
import { EmptyState } from '../components/EmptyState';

const MAX_CAMPAIGNS = 3;
const REACH_OPTIONS = [10, 25, 50, 75, 100];

export function BrandRadar() {
  const {
    intents,
    products,
    campaigns,
    addCampaign,
    removeCampaign,
    keywordAlerts,
    addKeywordAlert,
    removeKeywordAlert,
    launchVIPPitch,
  } = useMarket();

  const [keyword, setKeyword] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [bountyAmount, setBountyAmount] = useState(0);
  const [reach, setReach] = useState(25);
  const [offeredSizes, setOfferedSizes] = useState<string[]>([]);
  const [offeredColors, setOfferedColors] = useState<string[]>([]);
  const [bountyError, setBountyError] = useState('');

  const activeProducts = products.filter((p) => !p.isDraft);

  const matchingIntents = useMemo(() => {
    if (!keyword.trim()) return [];
    const kw = keyword.toLowerCase();
    return intents.filter(
      (i) =>
        i.status === 'active' &&
        i.searchQuery.toLowerCase().includes(kw),
    );
  }, [intents, keyword]);

  const matchingCount = matchingIntents.length;

  const selectedProduct = activeProducts.find(
    (p) => p.id === selectedProductId,
  );

  const productMatchesKeyword = useMemo(() => {
    if (!selectedProduct || !keyword.trim()) return false;
    const kw = keyword.toLowerCase().trim();
    const titleMatch = selectedProduct.title.toLowerCase().includes(kw);
    const categoryMatch = selectedProduct.category.toLowerCase().includes(kw);
    const keywordMatch = selectedProduct.keywords.some((k) =>
      k.toLowerCase().includes(kw) || kw.includes(k.toLowerCase()),
    );
    return titleMatch || categoryMatch || keywordMatch;
  }, [selectedProduct, keyword]);

  const baseBounty = selectedProduct
    ? selectedProduct.autoBounty || Math.ceil(selectedProduct.priceInr * 0.05)
    : 0;
  const minVipBounty = selectedProduct ? Math.ceil(baseBounty * 1.20) : 0;
  const totalCashBack = selectedProduct ? bountyAmount : 0;
  const effectiveMatchingCount = productMatchesKeyword ? matchingCount : 0;
  const targetUsers = Math.ceil(effectiveMatchingCount * (reach / 100));

  const atCampaignLimit = campaigns.length >= MAX_CAMPAIGNS;

  const canLaunch =
    !!selectedProduct &&
    bountyAmount >= minVipBounty &&
    bountyAmount > 0 &&
    effectiveMatchingCount > 0 &&
    offeredSizes.length > 0 &&
    offeredColors.length > 0 &&
    !atCampaignLimit;

  const toggleSize = (s: string) =>
    setOfferedSizes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  const toggleColor = (c: string) =>
    setOfferedColors((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const handleBountyChange = (val: number) => {
    setBountyAmount(val);
    if (selectedProduct && val > 0 && val < minVipBounty) {
      setBountyError(`VIP Bounty must be at least 20% higher than the catalog bounty (Minimum ₹${minVipBounty}).`);
    } else {
      setBountyError('');
    }
  };

  const launchCampaign = () => {
    if (!canLaunch || !selectedProduct) return;
    if (bountyAmount < minVipBounty) {
      setBountyError(`VIP Bounty must be at least 20% higher than the catalog bounty (Minimum ₹${minVipBounty}).`);
      return;
    }
    addCampaign({
      productId: selectedProduct.id,
      productTitle: selectedProduct.title,
      keyword: keyword.toLowerCase(),
      reachPercent: reach,
      targetCount: targetUsers,
      totalVipBounty: totalCashBack,
    });
    const allMatching = intents.filter(
      (i) =>
        i.status === 'active' &&
        i.searchQuery.toLowerCase().includes(keyword.toLowerCase().trim()),
    );
    const shuffled = [...allMatching];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selectedIntents = shuffled.slice(0, targetUsers);
    selectedIntents.forEach((intent) => {
      launchVIPPitch({
        intentId: intent.id,
        productId: selectedProduct.id,
        productTitle: selectedProduct.title,
        brandName: selectedProduct.brandName,
        productImage: selectedProduct.images[0] ?? '',
        originalPrice: intent.productSnapshots?.find((snapshot) => snapshot.productId === selectedProduct.id)?.baselinePrice ?? selectedProduct.priceInr,
        bountyAmount,
        offeredSizes,
        offeredColors,
      });
    });
    setSelectedProductId('');
    setBountyAmount(0);
    setReach(25);
    setOfferedSizes([]);
    setOfferedColors([]);
    setBountyError('');
  };

  return (
    <BrandLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tighter text-white">
          Intent Radar & Direct Pitch Engine
        </h1>
        <p className="mt-1.5 text-sm text-platinum">
          Scan live buyer demand and dispatch targeted VIP pitches.
        </p>
      </div>

      {/* Campaign limit badge */}
      <div className="mb-6 flex items-center gap-3">
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
            atCampaignLimit
              ? 'border-[#FF3B3B]/30 bg-[#FF3B3B]/10 text-[#FF3B3B]'
              : 'border-[#00E676]/30 bg-[#00E676]/10 text-[#00E676]'
          }`}
        >
          <Target size={13} />
          Active Campaigns: {campaigns.length}/{MAX_CAMPAIGNS}
        </div>
      </div>

      {/* Keyword Volume Inspector */}
      <div className="mb-6 rounded-2xl border border-[#1F1F24] bg-[#111114] p-6">
        <div className="mb-4 flex items-center gap-2">
          <Radar size={16} className="text-[#00E676]" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-white">
            Keyword Volume Inspector
          </h2>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-platinum" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Type a keyword (e.g. tshirt, sneakers, earbuds)"
            className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] pl-10 pr-4 py-2.5 text-sm text-white outline-none transition-all focus:border-[#00E676]"
          />
        </div>
        {keyword.trim() && (
          <div className="mt-4">
            <p className="text-sm text-platinum">
              Live Active Intents Matching{' '}
              <span className="font-semibold text-white">'{keyword}'</span>:{' '}
              <span className="font-bold text-[#00E676]">{matchingCount} Buyers</span>
            </p>
          </div>
        )}
      </div>

      {/* Zero-match state */}
      {keyword.trim() && matchingCount === 0 && (
        <div className="mb-6 rounded-2xl border border-[#1F1F24] bg-[#111114] p-6">
          <EmptyState
            icon={<Radar size={28} />}
            title={`No live buyer broadcasts matching '${keyword}' right now.`}
            subtitle="Set a keyword alert to get pinged when buyer traffic spikes."
          />
          <div className="flex justify-center">
            <button
              onClick={() => addKeywordAlert(keyword)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#00E676] px-5 py-2.5 text-sm font-semibold text-[#060608] transition-all hover:bg-[#00C853]"
            >
              <Bell size={15} />
              Set Category Keyword Alert
            </button>
          </div>
        </div>
      )}

      {/* Keyword Alerts */}
      {keywordAlerts.length > 0 && (
        <div className="mb-6 rounded-2xl border border-[#1F1F24] bg-[#111114] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-platinum">
            Active Keyword Alerts
          </p>
          <div className="flex flex-wrap gap-2">
            {keywordAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center gap-2 rounded-lg border border-[#1F1F24] bg-[#060608] py-1 pl-3 pr-1"
              >
                <Bell size={12} className="text-[#FFB300]" />
                <span className="text-xs text-platinum">{alert.keyword}</span>
                <button
                  onClick={() => removeKeywordAlert(alert.id)}
                  className="rounded p-1 text-platinum/50 transition-all hover:text-[#FF3B3B]"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pitch creation form */}
      <div className="mb-8 rounded-2xl border border-[#1F1F24] bg-[#111114] p-6">
        <div className="mb-5 flex items-center gap-2">
          <Zap size={16} className="text-[#00E676]" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-white">
            Programmatic Pitch Creation
          </h2>
        </div>

        {atCampaignLimit && (
          <div className="mb-4 rounded-xl border border-[#FF3B3B]/30 bg-[#FF3B3B]/[0.06] p-3 text-xs text-[#FF3B3B]">
            Limit reached ({campaigns.length}/{MAX_CAMPAIGNS}). Delete an existing
            campaign to launch a new pitch.
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
              Select Product
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                const p = activeProducts.find((x) => x.id === e.target.value);
                if (p) {
                  const base = p.autoBounty || Math.ceil(p.priceInr * 0.05);
                  const minVip = Math.ceil(base * 1.20);
                  setBountyAmount(minVip);
                  setBountyError('');
                  setOfferedSizes([]);
                  setOfferedColors([]);
                }
              }}
              disabled={atCampaignLimit || activeProducts.length === 0}
              className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-2.5 text-sm text-white outline-none focus:border-[#00E676] disabled:opacity-50"
            >
              <option value="">Choose from your catalog...</option>
              {activeProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} — ₹{p.priceInr.toLocaleString('en-IN')}
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                    Retail Price (Locked)
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-2.5">
                    <Lock size={13} className="text-platinum/50" />
                    <span className="text-sm text-platinum">
                      ₹{selectedProduct.priceInr.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                    Inherited Keywords
                  </label>
                  <div className="flex flex-wrap gap-1 rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2.5">
                    {selectedProduct.keywords.map((k) => (
                      <span
                        key={k}
                        className="rounded-md border border-[#1F1F24] bg-[#111114] px-1.5 py-0.5 text-[10px] text-platinum"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-[#00E676]/30 bg-[#00E676]/10 p-3">
                  <Tag size={14} className="mt-0.5 shrink-0 text-[#00E676]" />
                  <div className="text-[11px] leading-relaxed text-[#00E676]">
                    <p>🏷️ Standard Catalog Bounty: ₹{baseBounty.toLocaleString('en-IN')}</p>
                    <p>⚡ VIP pitches require at least +20% extra bounty (Minimum: ₹{minVipBounty.toLocaleString('en-IN')})</p>
                  </div>
                </div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                  VIP Bounty Amount (Minimum ₹{minVipBounty.toLocaleString('en-IN')})
                </label>
                <div className="relative">
                  <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-platinum" />
                  <input
                    type="number"
                    min={minVipBounty}
                    value={bountyAmount || ''}
                    onChange={(e) => handleBountyChange(Number(e.target.value))}
                    onBlur={() => {
                      if (selectedProduct && bountyAmount < minVipBounty) {
                        setBountyAmount(minVipBounty);
                        setBountyError('');
                      }
                    }}
                    className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-[#00E676]"
                  />
                </div>
                {bountyError && (
                  <p className="mt-2 flex items-center gap-1 text-xs font-medium text-[#FF3B3B]">
                    <AlertTriangle size={11} />
                    {bountyError}
                  </p>
                )}
                {bountyAmount >= minVipBounty && bountyAmount > 0 && (
                  <p className="mt-2 text-xs text-[#00E676]">
                    Total VIP Bounty: ₹{totalCashBack.toLocaleString('en-IN')}
                  </p>
                )}
              </div>

              {selectedProduct.sizes.length > 0 && (
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                    Offered Sizes (select one or more)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.sizes.map((s) => (
                      <button
                        key={s}
                        onClick={() => toggleSize(s)}
                        className={offeredSizes.includes(s) ? 'rounded-lg border border-[#00E676] bg-[#00E676]/10 px-3 py-1.5 text-xs font-semibold text-[#00E676] transition-all' : 'rounded-lg border border-[#1F1F24] bg-[#060608] px-3 py-1.5 text-xs font-semibold text-platinum transition-all hover:border-[#2A2A2E]'}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedProduct.colors.length > 0 && (
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                    Offered Colors (select one or more)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.colors.map((c) => (
                      <button
                        key={c}
                        onClick={() => toggleColor(c)}
                        className={offeredColors.includes(c) ? 'rounded-lg border border-[#00E676] bg-[#00E676]/10 px-3 py-1.5 text-xs font-semibold text-[#00E676] transition-all' : 'rounded-lg border border-[#1F1F24] bg-[#060608] px-3 py-1.5 text-xs font-semibold text-platinum transition-all hover:border-[#2A2A2E]'}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                  Target Audience Reach
                </label>
                <div className="flex gap-2">
                  {REACH_OPTIONS.map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setReach(pct)}
                      className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-all ${
                        reach === pct
                          ? 'border-[#00E676] bg-[#00E676]/10 text-[#00E676]'
                          : 'border-[#1F1F24] bg-[#060608] text-platinum hover:border-[#2A2A2E]'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-platinum">
                  Target Users: {targetUsers} (of {matchingCount} matching buyers)
                </p>
                {selectedProduct && !productMatchesKeyword && keyword.trim() && (
                  <p className="mt-2 text-xs font-medium text-[#FF3B3B]">
                    Product keywords do not match active buyer intent.
                  </p>
                )}
              </div>

              <button
                onClick={launchCampaign}
                disabled={!canLaunch}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00E676] px-4 py-3 text-sm font-semibold text-[#060608] transition-all duration-300 hover:bg-[#00C853] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Zap size={16} />
                {`Launch VIP Pitch to ${targetUsers} Buyers`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Active Campaigns Table */}
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp size={16} className="text-platinum" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-white">
          Active Campaigns
        </h2>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-6">
          <EmptyState
            icon={<Target size={28} />}
            title="No active pitch campaigns."
            subtitle="Search a keyword above and launch your first VIP pitch."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#111114]">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-[#1F1F24] bg-[#060608]/60">
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Product</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Keyword</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Reach</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">Target</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum">VIP Bounty</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, idx) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.05 }}
                    className="border-b border-[#1F1F24] last:border-0 hover:bg-[#060608]/40"
                  >
                    <td className="px-5 py-4 text-sm font-medium text-white">{c.productTitle}</td>
                    <td className="px-5 py-4 text-xs text-platinum">{c.keyword}</td>
                    <td className="px-5 py-4 text-xs text-platinum">{c.reachPercent}%</td>
                    <td className="px-5 py-4 text-xs text-platinum">{c.targetCount}</td>
                    <td className="px-5 py-4 text-xs font-semibold text-[#00E676]">₹{c.totalVipBounty}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => removeCampaign(c.id)}
                        className="rounded-lg p-1.5 text-platinum transition-all duration-300 hover:bg-[#FF3B3B]/10 hover:text-[#FF3B3B]"
                        aria-label="Delete campaign"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </BrandLayout>
  );
}
