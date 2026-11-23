import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2, MapPin, Navigation, X } from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import type { Address, AddressType } from '../types';

type AddressForm = Omit<Address, 'id' | 'consumerEmail' | 'isDefault'> & { isDefault: boolean };
type AddressErrors = Partial<Record<keyof AddressForm, string>>;

const emptyForm: AddressForm = {
  fullName: '', phone: '', pincode: '', houseNo: '', area: '', landmark: '', city: '', state: '', addressType: 'Home', isDefault: false,
};

export function AddressGuardModal({
  open, onClose, onComplete, initialAddress, title = 'Delivery Address Required',
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (addressId: string) => void;
  initialAddress?: Address | null;
  title?: string;
}) {
  const { saveAddress, pushToast } = useMarket();
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [errors, setErrors] = useState<AddressErrors>({});
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(initialAddress ? {
      fullName: initialAddress.fullName, phone: initialAddress.phone, pincode: initialAddress.pincode,
      houseNo: initialAddress.houseNo, area: initialAddress.area, landmark: initialAddress.landmark,
      city: initialAddress.city, state: initialAddress.state, addressType: initialAddress.addressType, isDefault: initialAddress.isDefault,
    } : emptyForm);
    setErrors({});
    setLocationError('');
  }, [open, initialAddress]);

  const setField = <K extends keyof AddressForm>(field: K, value: AddressForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Unable to retrieve exact location. Please enter address manually.');
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(coords.latitude)}&lon=${encodeURIComponent(coords.longitude)}`);
        if (!response.ok) throw new Error('Location lookup failed');
        const result = await response.json() as { address?: Record<string, string> };
        const address = result.address ?? {};
        setForm((current) => ({
          ...current,
          area: address.road ?? address.suburb ?? address.neighbourhood ?? current.area,
          city: address.city ?? address.town ?? address.village ?? address.county ?? current.city,
          state: address.state ?? current.state,
          pincode: address.postcode ?? current.pincode,
        }));
      } catch {
        setLocationError('Unable to retrieve exact location. Please enter address manually.');
      } finally {
        setLocating(false);
      }
    }, () => {
      setLocating(false);
      setLocationError('Unable to retrieve exact location. Please enter address manually.');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  };

  const validate = (): AddressErrors => {
    const next: AddressErrors = {};
    const required: Array<[keyof AddressForm, string]> = [
      ['fullName', 'Full name is required'], ['phone', 'Enter a valid 10-digit mobile number'], ['houseNo', 'Flat or house details are required'],
      ['area', 'Area or street is required'], ['pincode', 'Enter a valid 6-digit pincode'], ['city', 'Town or city is required'], ['state', 'State is required'],
    ];
    for (const [field, message] of required) if (!String(form[field]).trim()) next[field] = message;
    if (form.phone.trim() && !/^\d{10}$/.test(form.phone)) next.phone = 'Enter a valid 10-digit mobile number';
    if (form.pincode.trim() && !/^\d{6}$/.test(form.pincode)) next.pincode = 'Enter a valid 6-digit pincode';
    return next;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const saved = await saveAddress({ ...form, id: initialAddress?.id });
    pushToast('success', initialAddress ? 'Address updated' : 'Address saved');
    onComplete(saved.id);
  };

  const inputClass = (field: keyof AddressForm) => `w-full rounded-xl border bg-[#060608] px-3.5 py-2.5 text-sm text-white placeholder:text-platinum/50 focus:outline-none focus:ring-1 focus:ring-[#00E676] ${errors[field] ? 'border-red-400/70' : 'border-[#1F1F24]'}`;
  const field = (name: keyof AddressForm, label: string, placeholder: string, type = 'text') => (
    <div>
      <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">{label}</label>
      <input type={type} value={String(form[name])} onChange={(event) => setField(name, event.target.value as AddressForm[typeof name])} placeholder={placeholder} className={inputClass(name)} />
      {errors[name] && <p className="mt-1 text-[10px] text-red-400">{errors[name]}</p>}
    </div>
  );

  return <AnimatePresence>{open && <motion.div className="fixed inset-0 z-[90] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
    <motion.div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#1F1F24] bg-[#111114] p-6 shadow-2xl" initial={{ opacity: 0, scale: .95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .95, y: 12 }}>
      <div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2"><MapPin size={18} className="text-[#00E676]" /><h3 className="text-sm font-semibold text-white">{initialAddress ? 'Edit Address' : title}</h3></div><button onClick={onClose} className="text-platinum/60 hover:text-white" aria-label="Close"><X size={18} /></button></div>
      {!initialAddress && <p className="mb-4 text-xs text-platinum">Save a delivery address for faster, safer checkout.</p>}
      <button type="button" onClick={useCurrentLocation} disabled={locating} className="mb-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#00E676]/40 bg-[#00E676]/10 px-4 py-3 text-xs font-semibold text-[#00E676] hover:bg-[#00E676]/20 disabled:opacity-60">{locating ? <><Loader2 size={15} className="animate-spin" />Fetching GPS coordinates and address...</> : <><Navigation size={15} />Use my current location</>}</button>
      {locationError && <p className="-mt-2 mb-4 text-xs text-red-400">{locationError}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">{field('fullName', 'Full Name', 'John Doe')}{field('phone', 'Mobile Number', '10-digit number', 'tel')}</div>
        {field('houseNo', 'Flat, House no., Building, Company', 'Flat 402, Skyline Apartments')}
        {field('area', 'Area, Street, Sector, Village', 'Indiranagar 100ft Road')}
        {field('landmark', 'Landmark (Optional)', 'Near Metro Station')}
        <div className="grid grid-cols-2 gap-3">{field('pincode', 'Pincode', '560001', 'text')}{field('city', 'Town / City', 'Bengaluru')}</div>
        {field('state', 'State', 'Karnataka')}
        <div><label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">Address Type</label><div className="flex gap-2">{(['Home', 'Work', 'Other'] as AddressType[]).map((type) => <button key={type} type="button" onClick={() => setField('addressType', type)} className={`rounded-lg border px-4 py-2 text-xs font-medium ${form.addressType === type ? 'border-[#00E676] bg-[#00E676]/10 text-[#00E676]' : 'border-[#1F1F24] text-platinum hover:text-white'}`}>{form.addressType === type && <Check size={12} className="mr-1 inline" />}{type}</button>)}</div></div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-platinum"><input type="checkbox" checked={form.isDefault} onChange={(event) => setField('isDefault', event.target.checked)} className="h-4 w-4 accent-[#00E676]" />Make this my default address</label>
        <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00E676] px-4 py-3 text-sm font-bold text-black hover:bg-[#00C853]"><MapPin size={16} />{initialAddress ? 'Update Address' : 'Save Address'}</button>
      </form>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}
