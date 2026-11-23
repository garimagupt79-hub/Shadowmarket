import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Camera, Clock, TrendingUp, Flame, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  products: Product[];
  activeProductIds: Set<string>;
  onWaveCreated: () => Promise<void>;
  brandId: string;
}

type DraftTier = { tierNumber: number; thresholdUnits: number | ''; bountyPercent: number | '' };
const DURATION_OPTIONS = [24, 48, 72];

export function CreateSyndicateWaveModal({ open, onClose, product, products, activeProductIds, onWaveCreated, brandId }: Props) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [durationHours, setDurationHours] = useState(24);
  const [tiers, setTiers] = useState<DraftTier[]>([
    { tierNumber: 1, thresholdUnits: 1, bountyPercent: 5 },
    { tierNumber: 2, thresholdUnits: 10, bountyPercent: 20 },
    { tierNumber: 3, thresholdUnits: 25, bountyPercent: 30 },
  ]);
  const [hasImageBounty, setHasImageBounty] = useState(false);
  const [imageBountyAmount, setImageBountyAmount] = useState<number | string>(20);
  const [error, setError] = useState('');
  const [prevOpen, setPrevOpen] = useState(false);

  const selected = products.find((item) => item.id === selectedProductId) ?? null;
  const baseBountyPercent = selected ? Math.round((selected.autoBounty / selected.priceInr) * 100) || 5 : 5;

  // Initialize ONLY when modal transitions from closed to open
  useEffect(() => {
    if (open && !prevOpen) {
      const initial = product?.id ?? '';
      if (initial) {
        setSelectedProductId(initial);
      } else if (!selectedProductId && products.length > 0) {
        const firstAvailable = products.find((item) => !activeProductIds.has(item.id));
        setSelectedProductId((firstAvailable ?? products[0]).id);
      }
    }
    if (!open && prevOpen) {
      setSelectedProductId('');
    }
    setPrevOpen(open);
  }, [open, prevOpen, product, products, activeProductIds, selectedProductId]);

  // Sync tier config when product selection changes
  useEffect(() => {
    if (!selected) return;
    setTiers([
      { tierNumber: 1, thresholdUnits: 1, bountyPercent: baseBountyPercent },
      { tierNumber: 2, thresholdUnits: 10, bountyPercent: 20 },
      { tierNumber: 3, thresholdUnits: 25, bountyPercent: 30 },
    ]);
    setHasImageBounty(selected.imageReviewBountyEnabled ?? false);
    setImageBountyAmount(selected.imageReviewBountyAmount ?? 20);
    setError('');
  }, [selectedProductId]);

  const updateTierState = (index: number, field: 'thresholdUnits' | 'bountyPercent', value: number | '') => {
    setTiers((current) => current.map((tier, i) => i === index ? { ...tier, [field]: value } : tier));
  };

  const handleTierChange = (index: number, field: 'thresholdUnits' | 'bountyPercent', value: string) => {
    if (value === '') {
      updateTierState(index, field, '');
      return;
    }
    const num = parseInt(value, 10);
    if (!Number.isNaN(num)) updateTierState(index, field, num);
  };

  const [launching, setLaunching] = useState(false);

  const handleLaunch = async () => {
    if (!selected || launching) return;
    const normalized = tiers.map((tier, index) => ({
      tierNumber: tier.tierNumber,
      thresholdUnits: index === 0 ? 1 : Math.max(1, Number(tier.thresholdUnits) || 1),
      bountyPercent: index === 0 ? baseBountyPercent : Math.min(50, Math.max(1, Number(tier.bountyPercent) || 1)),
    }));
    if (!(normalized[1].thresholdUnits > normalized[0].thresholdUnits && normalized[2].thresholdUnits > normalized[1].thresholdUnits)) {
      setError('Tier 2 must be above Tier 1, and Tier 3 must be above Tier 2.');
      return;
    }
    setLaunching(true);
    setError('');
    try {
      const waveId = crypto.randomUUID();
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id ?? null;

      const { error: waveErr } = await supabase
        .from('syndicate_waves')
        .insert({
          id: waveId,
          product_id: selected.id,
          brand_id: userId,
          status: 'active',
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + durationHours * 3600000).toISOString(),
          has_image_bounty: Boolean(hasImageBounty),
          image_bounty_amount: Math.round(Number(hasImageBounty ? Math.max(20, imageBountyAmount) : 0)),
        });
      if (waveErr) {
        setError(`Database error (wave): ${waveErr.message}`);
        setLaunching(false);
        return;
      }

      const tierPayload = normalized.map((tier, idx) => ({
        wave_id: waveId,
        tier_number: idx + 1,
        threshold_units: Number(tier.thresholdUnits || (idx + 1) * 5),
        bounty_percent: Number(tier.bountyPercent || (idx + 1) * 10),
      }));
      const { error: tierErr } = await supabase.from('wave_tiers').insert(tierPayload);
      if (tierErr) {
        setError(`Database error (tiers): ${tierErr.message}`);
        setLaunching(false);
        return;
      }

      await onWaveCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wave launch failed.');
    } finally {
      setLaunching(false);
    }
  };

  const formatINR = (amount: number) => `₹${Math.round(amount).toLocaleString('en-IN')}`;

  return (
    <Modal open={open} onClose={onClose} title="Launch Autonomous Syndicate Wave" maxWidth="max-w-2xl">
      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-platinum/60">Select Product for Wave</label>
          <select value={selectedProductId} onChange={(event) => { event.stopPropagation(); setSelectedProductId(event.target.value); }} className="w-full rounded-xl border border-[#1F1F24] bg-[#111114] px-3 py-3 text-sm text-white outline-none focus:border-[#00E676]/40">
            <option value="" disabled>Select a product</option>
            {products.map((item) => <option key={item.id} value={item.id} disabled={activeProductIds.has(item.id)}>{item.title}{activeProductIds.has(item.id) ? ' (Wave already active)' : ''}</option>)}
          </select>
        </div>

        {selected && <div className="flex items-center gap-4 rounded-xl border border-[#1F1F24] bg-[#111114] p-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[#1F1F24]">{selected.images[0] && <img src={selected.images[0]} alt={selected.title} className="h-full w-full object-cover" />}</div>
          <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold text-white">{selected.title}</h3><p className="text-xs text-platinum/60">{selected.brandName}</p></div>
          <p className="text-lg font-bold text-white">{formatINR(selected.priceInr)}</p>
        </div>}

        <div><label className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.15em] text-platinum/60"><Clock size={11} /> Wave Duration</label><div className="grid grid-cols-3 gap-2">{DURATION_OPTIONS.map((hours) => <button key={hours} onClick={() => setDurationHours(hours)} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${durationHours === hours ? 'border-[#00E676]/50 bg-[#00E676]/10 text-[#00E676]' : 'border-[#1F1F24] bg-[#111114] text-platinum'}`}>{hours} Hours</button>)}</div></div>

        {selected && <div><label className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.15em] text-platinum/60"><TrendingUp size={11} /> Milestone Tier Configuration</label><div className="space-y-2">{tiers.map((tier, index) => {
          const percent = Number(tier.bountyPercent) || 1;
          const bounty = Math.round(selected.priceInr * percent / 100);
          const payout = Math.round(selected.priceInr - bounty - (hasImageBounty ? imageBountyAmount : 0));
          return <div key={tier.tierNumber} className="rounded-xl border border-[#1F1F24] bg-[#111114] p-3"><div className="mb-2 flex items-center gap-2"><span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[#00E676]/15 text-[10px] font-bold text-[#00E676]">{tier.tierNumber}</span><span className="text-xs font-semibold text-white">Tier {tier.tierNumber}</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div><p className="mb-1 text-[9px] uppercase text-platinum/50">Threshold</p><input type="number" min={1} disabled={index === 0} value={tier.thresholdUnits === '' ? '' : tier.thresholdUnits} onChange={(event) => handleTierChange(index, 'thresholdUnits', event.target.value)} onBlur={() => updateTierState(index, 'thresholdUnits', Math.max(1, Number(tier.thresholdUnits) || 1))} className="w-full rounded-lg border border-[#1F1F24] bg-[#060608] px-2.5 py-2 text-sm text-white disabled:opacity-60" /></div><div><p className="mb-1 text-[9px] uppercase text-platinum/50">Bounty (%)</p><input type="number" min={1} max={50} readOnly={index === 0} disabled={index === 0} value={tier.bountyPercent === '' ? '' : tier.bountyPercent} onChange={(event) => handleTierChange(index, 'bountyPercent', event.target.value)} onBlur={() => updateTierState(index, 'bountyPercent', index === 0 ? baseBountyPercent : Math.min(50, Math.max(1, Number(tier.bountyPercent) || 1)))} className="w-full rounded-lg border border-[#1F1F24] bg-[#060608] px-2.5 py-2 text-sm text-white disabled:opacity-60" />{index === 0 && <span className="mt-1 flex items-center gap-1 text-[9px] text-amber-400"><Lock size={9} /> Locked to Product Catalog Base Bounty ({baseBountyPercent}%)</span>}</div><div><p className="mb-1 text-[9px] uppercase text-platinum/50">Bounty Amount</p><div className="flex h-[38px] items-center rounded-lg border border-[#00E676]/20 bg-[#00E676]/[0.06] px-2.5 text-sm font-semibold text-[#00E676]">{formatINR(bounty)}</div></div><div><p className="mb-1 text-[9px] uppercase text-platinum/50">Brand Net Payout</p><div className="flex h-[38px] items-center rounded-lg border border-[#1F1F24] bg-[#060608] px-2.5 text-sm font-semibold text-white">{formatINR(payout)}</div></div></div></div>;
        })}</div></div>}

        <div className="rounded-xl border border-[#1F1F24] bg-[#111114] p-4"><label className="flex cursor-pointer items-center gap-3"><button type="button" onClick={() => setHasImageBounty(!hasImageBounty)} className={`flex h-5 w-9 items-center rounded-full ${hasImageBounty ? 'bg-[#00E676]' : 'bg-[#1F1F24]'}`}><span className={`h-4 w-4 rounded-full bg-white transition-transform ${hasImageBounty ? 'translate-x-4' : 'translate-x-0.5'}`} /></button><span className="flex items-center gap-1.5 text-xs font-semibold text-white"><Camera size={13} className="text-amber-400" /> Enable Post-Delivery Photo Review Bounty</span></label>{hasImageBounty && <div className="mt-3 flex items-center gap-3"><input type="number" min={20} value={imageBountyAmount} onChange={(event) => setImageBountyAmount(Math.max(20, Number(event.target.value)))} className="w-28 rounded-lg border border-[#1F1F24] bg-[#060608] px-3 py-2 text-sm text-white" /><span className="text-xs text-platinum">₹ held in 15-day sub-escrow</span></div>}</div>
        {error && <p className="text-xs text-[#FFB300]">{error}</p>}
        <button onClick={handleLaunch} disabled={!selected || activeProductIds.has(selected.id) || launching} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FF8C42] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Flame size={16} /> {launching ? 'Launching...' : 'Launch Live Wave'}</button>
      </div>
    </Modal>
  );
}
