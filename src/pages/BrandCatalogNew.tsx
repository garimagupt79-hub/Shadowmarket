import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  ChevronRight,
  ImagePlus,
  Star,
  Trash2,
  Rocket,
  Save,
  IndianRupee,
  ShieldCheck,
  Sparkles,
  Plus,
  Camera,
  AlertTriangle,
} from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { BrandLayout } from '../components/BrandLayout';
import type { VariantStock } from '../types';

const CATEGORIES = [
  'Streetwear',
  'Tech',
  'Footwear',
  'Accessories',
  'Home',
  'Beauty',
  'Sports',
  'Electronics',
];

const SIZE_PRESETS = ['S', 'M', 'L', 'XL', 'XXL', 'Custom'];
const BOUNTY_PRESETS = [5, 10, 15, 25, 35];

type WizardStep = 1 | 2 | 3 | 4;

export function BrandCatalogNew() {
  const { addProduct, brandProfile } = useMarket();

  const [step, setStep] = useState<WizardStep>(1);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [title, setTitle] = useState('');
  const [teaser, setTeaser] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subcategory, setSubcategory] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [primaryIndex, setPrimaryIndex] = useState(0);

  const [sizes, setSizes] = useState<string[]>(['M']);
  const [colors, setColors] = useState<{ name: string; hex: string }[]>([
    { name: 'Black', hex: '#0A0A0A' },
  ]);
  const [colorName, setColorName] = useState('');
  const [colorHex, setColorHex] = useState('#0A0A0A');
  const [variants, setVariants] = useState<VariantStock[]>([]);

  const [price, setPrice] = useState(0);
  const [autoBounty, setAutoBounty] = useState(0);
  const [bountyPct, setBountyPct] = useState(10);
  const [imageReviewBountyEnabled, setImageReviewBountyEnabled] = useState(true);
  const [imageReviewBountyAmount, setImageReviewBountyAmount] = useState(20);

  // Rebuild variants when sizes/colors change
  const regenerateVariants = (newSizes: string[], newColors: { name: string; hex: string }[]) => {
    const out: VariantStock[] = [];
    for (const size of newSizes) {
      for (const color of newColors) {
        const existing = variants.find(
          (v) => v.size === size && v.color === color.name,
        );
        out.push({
          size,
          color: color.name,
          sku: existing?.sku ?? `${size}-${color.name.slice(0, 3).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
          stock: existing?.stock ?? 50,
          outOfStock: existing?.outOfStock ?? false,
        });
      }
    }
    setVariants(out);
  };

  const toggleSize = (size: string) => {
    const next = sizes.includes(size)
      ? sizes.filter((s) => s !== size)
      : [...sizes, size];
    setSizes(next);
    regenerateVariants(next, colors);
  };

  const addColor = () => {
    if (!colorName.trim()) return;
    if (colors.some((c) => c.name.toLowerCase() === colorName.toLowerCase())) return;
    const next = [...colors, { name: colorName.trim(), hex: colorHex }];
    setColors(next);
    regenerateVariants(sizes, next);
    setColorName('');
  };

  const removeColor = (name: string) => {
    const next = colors.filter((c) => c.name !== name);
    setColors(next);
    regenerateVariants(sizes, next);
  };

  const addImage = () => {
    if (!imageUrl.trim()) return;
    setImages([...images, imageUrl.trim()]);
    setImageUrl('');
  };

  const removeImage = (idx: number) => {
    const next = images.filter((_, i) => i !== idx);
    setImages(next);
    if (primaryIndex >= next.length) setPrimaryIndex(0);
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[idx], next[target]] = [next[target], next[idx]];
    setImages(next);
    if (primaryIndex === idx) setPrimaryIndex(target);
    else if (primaryIndex === target) setPrimaryIndex(idx);
  };

  // Economics calculations
  const fee = Math.round(price * 0.03);
  const netToBuyer = price - autoBounty;
  const brandProfit = price - autoBounty - fee;
  const bountyPercent = price > 0 ? Math.round((autoBounty / price) * 100) : 0;
  const rankTier =
    bountyPercent >= 20
      ? '🟢 High Visibility Tier'
      : bountyPercent >= 10
        ? '🟡 Standard Visibility Tier'
        : '🔴 Low Visibility Tier';

  const minBountyForPrice = Math.ceil(price * 0.05);
  const canPublish =
    title.trim() &&
    images.length > 0 &&
    price > 0 &&
    autoBounty >= minBountyForPrice &&
    !(imageReviewBountyEnabled && imageReviewBountyAmount < 20);

  const setBountyByPct = (pct: number) => {
    setBountyPct(pct);
    setAutoBounty(Math.round((price * pct) / 100));
  };

  const publishProduct = async (asDraft: boolean) => {
    if (!canPublish || isPublishing) return;
    setPublishError(null);
    setIsPublishing(true);
    const colorHexMap: Record<string, string> = {};
    colors.forEach((c) => (colorHexMap[c.name] = c.hex));
    const { error } = await addProduct({
      brandName: brandProfile.displayName || brandProfile.legalCorporateName || 'NOIR ATELIER',
      title: title.trim(),
      teaser: teaser.trim(),
      subcategory: subcategory.trim(),
      priceInr: price,
      category,
      keywords: [category.toLowerCase(), subcategory.toLowerCase()].filter(Boolean),
      images,
      primaryImageIndex: primaryIndex,
      sizes,
      colors: colors.map((c) => c.name),
      colorHex: colorHexMap,
      autoBounty,
      variants,
      isDraft: asDraft,
      imageReviewBountyEnabled,
      imageReviewBountyAmount: imageReviewBountyEnabled ? imageReviewBountyAmount : 0,
    });
    setIsPublishing(false);
    if (error) {
      setPublishError(error);
      return;
    }
    window.location.href = '/brand/inventory';
  };

  const steps = [
    { n: 1, label: 'Essentials & Media' },
    { n: 2, label: 'Variant Matrix' },
    { n: 3, label: 'Bounty Economics' },
    { n: 4, label: 'Review & Launch' },
  ] as const;

  return (
    <BrandLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tighter text-white">
          Product Publishing Studio
        </h1>
        <p className="mt-1.5 text-sm text-platinum">
          Build your catalog listing with a live consumer preview.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Wizard */}
        <div className="lg:w-[60%]">
          {/* Progress bar */}
          <div className="mb-6 flex items-center gap-1 rounded-2xl border border-[#1F1F24] bg-[#111114] p-2">
            {steps.map((s, idx) => (
              <div key={s.n} className="flex flex-1 items-center">
                <button
                  onClick={() => setStep(s.n)}
                  className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                    step === s.n
                      ? 'bg-[#00E676]/10 text-[#00E676]'
                      : step > s.n
                        ? 'text-platinum'
                        : 'text-platinum/50'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      step > s.n
                        ? 'bg-[#00E676] text-[#060608]'
                        : step === s.n
                          ? 'border border-[#00E676] text-[#00E676]'
                          : 'border border-[#1F1F24] text-platinum/50'
                    }`}
                  >
                    {step > s.n ? <Check size={11} /> : s.n}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {idx < steps.length - 1 && (
                  <ChevronRight size={14} className="mx-0.5 text-platinum/30" />
                )}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-6">
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-5"
              >
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                    Product Title
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Heavyweight Shadow Hoodie"
                    className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-[#00E676]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                    Short Teaser Description
                  </label>
                  <textarea
                    value={teaser}
                    onChange={(e) => setTeaser(e.target.value)}
                    placeholder="400gsm brushed fleece with a structured boxy fit."
                    rows={2}
                    className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-[#00E676]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-2.5 text-sm text-white outline-none focus:border-[#00E676]"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                      Subcategory
                    </label>
                    <input
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      placeholder="Hoodies"
                      className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-[#00E676]"
                    />
                  </div>
                </div>

                {/* Image gallery */}
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                    Image Gallery
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="flex-1 rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-[#00E676]"
                    />
                    <button
                      onClick={addImage}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-2.5 text-sm font-medium text-platinum transition-all hover:border-[#00E676] hover:text-[#00E676]"
                    >
                      <ImagePlus size={15} />
                      Add
                    </button>
                  </div>
                  {images.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {images.map((img, idx) => (
                        <div
                          key={idx}
                          className="group relative overflow-hidden rounded-xl border border-[#1F1F24] bg-[#060608]"
                        >
                          <img src={img} alt="" className="h-24 w-full object-cover" />
                          {idx === primaryIndex && (
                            <div className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#00E676] text-[#060608]">
                              <Star size={12} fill="currentColor" />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-2 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="flex gap-1">
                              <button
                                onClick={() => moveImage(idx, -1)}
                                className="rounded px-1 text-[10px] text-white"
                              >
                                ←
                              </button>
                              <button
                                onClick={() => moveImage(idx, 1)}
                                className="rounded px-1 text-[10px] text-white"
                              >
                                →
                              </button>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setPrimaryIndex(idx)}
                                className="rounded p-0.5 text-[#FFB300]"
                              >
                                <Star size={11} fill={idx === primaryIndex ? 'currentColor' : 'none'} />
                              </button>
                              <button
                                onClick={() => removeImage(idx)}
                                className="rounded p-0.5 text-[#FF3B3B]"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#00E676] px-5 py-2.5 text-sm font-semibold text-[#060608] transition-all hover:bg-[#00C853]"
                  >
                    Next: Variant Matrix
                    <ChevronRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-5"
              >
                {/* Size pills */}
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                    Size Pills
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SIZE_PRESETS.map((size) => (
                      <button
                        key={size}
                        onClick={() => toggleSize(size)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                          sizes.includes(size)
                            ? 'border-[#00E676] bg-[#00E676]/10 text-[#00E676]'
                            : 'border-[#1F1F24] bg-[#060608] text-platinum hover:border-[#2A2A2E]'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color swatches */}
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                    Color Swatches
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((c) => (
                      <div
                        key={c.name}
                        className="flex items-center gap-2 rounded-lg border border-[#1F1F24] bg-[#060608] py-1 pl-1 pr-2"
                      >
                        <div
                          className="h-5 w-5 rounded border border-[#1F1F24]"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span className="text-xs text-platinum">{c.name}</span>
                        <button
                          onClick={() => removeColor(c.name)}
                          className="text-platinum/50 hover:text-[#FF3B3B]"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={colorName}
                      onChange={(e) => setColorName(e.target.value)}
                      placeholder="Color name"
                      className="flex-1 rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2 text-sm text-white outline-none focus:border-[#00E676]"
                    />
                    <input
                      type="color"
                      value={colorHex}
                      onChange={(e) => setColorHex(e.target.value)}
                      className="h-10 w-12 rounded-lg border border-[#1F1F24] bg-[#060608]"
                    />
                    <button
                      onClick={addColor}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-2 text-sm font-medium text-platinum transition-all hover:border-[#00E676] hover:text-[#00E676]"
                    >
                      <Plus size={15} />
                      Add
                    </button>
                  </div>
                </div>

                {/* Variant grid */}
                {variants.length > 0 && (
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                      Generated Variant Grid ({variants.length} combinations)
                    </label>
                    <div className="max-h-64 overflow-y-auto scrollbar-thin rounded-xl border border-[#1F1F24]">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-[#060608]">
                          <tr className="border-b border-[#1F1F24]">
                            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-platinum">Size</th>
                            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-platinum">Color</th>
                            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-platinum">SKU</th>
                            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-platinum">Stock</th>
                            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-platinum">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variants.map((v, idx) => (
                            <tr key={`${v.size}-${v.color}`} className="border-b border-[#1F1F24] last:border-0">
                              <td className="px-3 py-2 text-xs text-white">{v.size}</td>
                              <td className="px-3 py-2 text-xs text-platinum">{v.color}</td>
                              <td className="px-3 py-2">
                                <input
                                  value={v.sku}
                                  onChange={(e) =>
                                    setVariants((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, sku: e.target.value } : x)),
                                    )
                                  }
                                  className="w-24 rounded border border-[#1F1F24] bg-[#060608] px-2 py-1 font-mono text-[10px] text-white outline-none focus:border-[#00E676]"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={v.stock}
                                  onChange={(e) =>
                                    setVariants((prev) =>
                                      prev.map((x, i) =>
                                        i === idx ? { ...x, stock: Number(e.target.value) } : x,
                                      ),
                                    )
                                  }
                                  className="w-16 rounded border border-[#1F1F24] bg-[#060608] px-2 py-1 text-xs text-white outline-none focus:border-[#00E676]"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() =>
                                    setVariants((prev) =>
                                      prev.map((x, i) =>
                                        i === idx ? { ...x, outOfStock: !x.outOfStock } : x,
                                      ),
                                    )
                                  }
                                  className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                                    v.outOfStock || v.stock === 0
                                      ? 'bg-[#FF3B3B]/15 text-[#FF3B3B]'
                                      : 'bg-[#00E676]/15 text-[#00E676]'
                                  }`}
                                >
                                  {v.outOfStock || v.stock === 0 ? 'Out of Stock' : 'In Stock'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#1F1F24] bg-[#060608] px-5 py-2.5 text-sm font-medium text-platinum transition-all hover:border-[#2A2A2E]"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#00E676] px-5 py-2.5 text-sm font-semibold text-[#060608] transition-all hover:bg-[#00C853]"
                  >
                    Next: Bounty Economics
                    <ChevronRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-5"
              >
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                    Retail Price (INR)
                  </label>
                  <div className="relative">
                    <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-platinum" />
                    <input
                      type="number"
                      value={price || ''}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      placeholder="8999"
                      className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-[#00E676]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-platinum">
                    Auto-Bounty ({bountyPct}% of retail)
                  </label>
                  <div className="flex gap-2">
                    {BOUNTY_PRESETS.map((pct) => (
                      <button
                        key={pct}
                        onClick={() => setBountyByPct(pct)}
                        className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-all ${
                          bountyPct === pct
                            ? 'border-[#00E676] bg-[#00E676]/10 text-[#00E676]'
                            : 'border-[#1F1F24] bg-[#060608] text-platinum hover:border-[#2A2A2E]'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                  <div className="relative mt-3">
                    <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-platinum" />
                    <input
                      type="number"
                      value={autoBounty || ''}
                      onChange={(e) => {
                        setAutoBounty(Number(e.target.value));
                        setBountyPct(price > 0 ? Math.round((Number(e.target.value) / price) * 100) : 0);
                      }}
                      min={minBountyForPrice}
                      className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-[#00E676]"
                    />
                  </div>
                  {price > 0 && autoBounty < minBountyForPrice && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-[#FF3B3B]">
                      <AlertTriangle size={11} />
                      Product cashback bounty must be at least 5% (₹{minBountyForPrice}).
                    </p>
                  )}
                </div>

                {/* Image Review Bounty */}
                <div className="rounded-xl border border-[#1F1F24] bg-[#060608] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera size={14} className="text-[#00E676]" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-white">
                        Image Review Bounty
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const next = !imageReviewBountyEnabled;
                        setImageReviewBountyEnabled(next);
                        if (next && imageReviewBountyAmount < 20) setImageReviewBountyAmount(20);
                      }}
                      className={`relative h-6 w-11 rounded-full transition-colors ${imageReviewBountyEnabled ? 'bg-[#00E676]' : 'bg-[#1F1F24]'}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${imageReviewBountyEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <p className="mb-3 text-[11px] text-platinum">
                    Offer extra cash back to buyers who attach a photo review after delivery.
                  </p>
                  {imageReviewBountyEnabled && (
                    <div>
                      <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
                        Bounty Amount (₹)
                      </label>
                      <input
                        type="number"
                        value={imageReviewBountyAmount || ''}
                        onChange={(e) => setImageReviewBountyAmount(Number(e.target.value))}
                        onBlur={() => {
                          if (imageReviewBountyAmount < 20) setImageReviewBountyAmount(20);
                        }}
                        min={20}
                        className="w-full rounded-xl border border-[#1F1F24] bg-[#060608] px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-[#00E676]/50"
                      />
                      {imageReviewBountyAmount < 20 && (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#FF3B3B]">
                          <AlertTriangle size={10} />
                          Minimum image review bounty is ₹20.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Margin simulator */}
                <div className="rounded-xl border border-[#1F1F24] bg-[#060608] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles size={14} className="text-[#00E676]" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-white">
                      Live Margin Simulator
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-platinum">Net Cost to Buyer</span>
                      <span className="font-semibold text-white">₹{netToBuyer.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-platinum">Platform & Processing Fee (3%)</span>
                      <span className="font-semibold text-[#FFB300]">₹{fee.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between border-t border-[#1F1F24] pt-2.5 text-xs">
                      <span className="text-platinum">Net Brand Retained Profit</span>
                      <span className="font-semibold text-[#00E676]">₹{brandProfit.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-platinum">Estimated Grid Rank Metric</span>
                      <span className="font-semibold text-white">{rankTier}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#1F1F24] bg-[#060608] px-5 py-2.5 text-sm font-medium text-platinum transition-all hover:border-[#2A2A2E]"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(4)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#00E676] px-5 py-2.5 text-sm font-semibold text-[#060608] transition-all hover:bg-[#00C853]"
                  >
                    Next: Review & Launch
                    <ChevronRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-5"
              >
                <div className="rounded-xl border border-[#1F1F24] bg-[#060608] p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white">
                    Final Inspection Checklist
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { label: `Images uploaded (${images.length})`, done: images.length > 0 },
                      { label: `Variant combinations (${variants.length})`, done: variants.length > 0 },
                      { label: `Total stock: ${variants.reduce((s, v) => s + v.stock, 0)} units`, done: variants.reduce((s, v) => s + v.stock, 0) > 0 },
                      { label: `Auto-bounty: ₹${autoBounty} (${bountyPercent}%)`, done: autoBounty >= Math.ceil(price * 0.05) && price > 0 },
                      { label: `Retail price: ₹${price.toLocaleString('en-IN')}`, done: price > 0 },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2.5">
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full ${
                            item.done ? 'bg-[#00E676]/15 text-[#00E676]' : 'border border-[#FF3B3B]/30 text-[#FF3B3B]'
                          }`}
                        >
                          {item.done ? <Check size={12} /> : <span className="text-[10px]">!</span>}
                        </div>
                        <span className="text-xs text-platinum">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {publishError && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-400">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span className="font-mono leading-relaxed">{publishError}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => publishProduct(true)}
                    disabled={!canPublish || isPublishing}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#1F1F24] bg-[#060608] px-4 py-3 text-sm font-medium text-platinum transition-all hover:border-[#2A2A2E] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save size={16} />
                    {isPublishing ? 'Saving...' : 'Save as Draft'}
                  </button>
                  <button
                    onClick={() => publishProduct(false)}
                    disabled={!canPublish || isPublishing}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00E676] px-4 py-3 text-sm font-semibold text-[#060608] transition-all hover:bg-[#00C853] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Rocket size={16} />
                    {isPublishing ? 'Publishing...' : 'Publish to Market'}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="lg:w-[40%]">
          <div className="lg:sticky lg:top-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-platinum">
              Live Consumer Preview
            </p>
            <div className="mx-auto max-w-[340px] overflow-hidden rounded-3xl border border-[#1F1F24] bg-[#111114] shadow-2xl">
              {/* Image */}
              <div className="relative aspect-square bg-[#060608]">
                {images.length > 0 ? (
                  <img
                    src={images[primaryIndex] ?? images[0]}
                    alt={title || 'Product preview'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-platinum/30">
                    <ImagePlus size={36} />
                  </div>
                )}
                {brandProfile.isCorporateVerified && (
                  <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#060608]/80 px-2 py-1 text-[10px] font-semibold text-[#00E676] backdrop-blur-sm">
                    <ShieldCheck size={11} />
                    Verified
                  </div>
                )}
                {autoBounty > 0 && (
                  <div className="absolute right-3 top-3 rounded-full bg-[#00E676] px-2.5 py-1 text-[10px] font-bold text-[#060608]">
                    ₹{autoBounty} Cash Back
                  </div>
                )}
              </div>
              {/* Details */}
              <div className="p-4">
                <p className="text-[10px] uppercase tracking-wide text-platinum">
                  {category}{subcategory ? ` · ${subcategory}` : ''}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {title || 'Product Title'}
                </p>
                {teaser && (
                  <p className="mt-1 text-xs text-platinum line-clamp-2">{teaser}</p>
                )}
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-lg font-bold text-white">
                    ₹{price > 0 ? price.toLocaleString('en-IN') : '0'}
                  </span>
                  {autoBounty > 0 && (
                    <span className="text-xs text-[#00E676]">
                      Net ₹{(price - autoBounty).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                {/* Variant pills */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {sizes.map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-[#1F1F24] bg-[#060608] px-2 py-1 text-[10px] text-platinum"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {colors.map((c) => (
                    <div key={c.name} className="flex items-center gap-1">
                      <div
                        className="h-4 w-4 rounded-full border border-[#1F1F24]"
                        style={{ backgroundColor: c.hex }}
                      />
                    </div>
                  ))}
                </div>
                <button
                  disabled
                  className="mt-4 w-full rounded-xl bg-[#00E676]/20 py-2.5 text-xs font-semibold text-[#00E676]"
                >
                  Preview Only
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BrandLayout>
  );
}
