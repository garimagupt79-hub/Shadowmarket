import { useState } from 'react';
import { Edit3, MapPin, Plus, Star, Trash2 } from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { AddressGuardModal } from './AddressGuardModal';
import type { Address } from '../types';

export function AddressBook() {
  const { addresses, removeAddress, setDefaultAddress } = useMarket();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const mine = addresses;
  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (address: Address) => { setEditing(address); setEditorOpen(true); };

  return <section className="mt-8 rounded-2xl border border-[#1F1F24] bg-[#111114] p-5">
    <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.15em] text-white"><MapPin size={15} className="text-[#00E676]" />Your Addresses</h2><p className="mt-1 text-xs text-platinum">Manage delivery addresses for checkout.</p></div><button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-xl border border-[#00E676]/40 bg-[#00E676]/10 px-3 py-2 text-xs font-semibold text-[#00E676] hover:bg-[#00E676]/20"><Plus size={14} />Add New</button></div>
    {mine.length === 0 ? <div className="rounded-xl border border-dashed border-[#1F1F24] px-4 py-6 text-center text-xs text-platinum">No saved addresses yet. Add one to speed up checkout.</div> : <div className="grid gap-3 md:grid-cols-2">{mine.map((address) => <div key={address.id} className={`rounded-xl border p-4 ${address.isDefault ? 'border-[#00E676]/40 bg-[#00E676]/5' : 'border-[#1F1F24] bg-[#060608]'}`}><div className="flex items-start justify-between gap-2"><div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-white">{address.fullName}</p><span className="rounded-md border border-[#1F1F24] px-1.5 py-0.5 text-[9px] text-platinum">{address.addressType}</span></div><p className="mt-1 text-xs leading-5 text-platinum">{address.houseNo}, {address.area}{address.landmark ? `, ${address.landmark}` : ''}, {address.city}, {address.state} {address.pincode}</p><p className="mt-1 text-[11px] text-platinum/70">Mobile: {address.phone}</p></div>{address.isDefault && <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#00E676]"><Star size={11} fill="currentColor" />Default</span>}</div><div className="mt-3 flex items-center gap-2 border-t border-[#1F1F24] pt-3"><button onClick={() => openEdit(address)} className="inline-flex items-center gap-1 text-xs text-platinum hover:text-white"><Edit3 size={12} />Edit</button>{!address.isDefault && <button onClick={() => setDefaultAddress(address.id)} className="ml-auto text-xs text-[#00E676] hover:text-white">Set as default</button>}<button onClick={() => removeAddress(address.id)} className="text-xs text-red-400 hover:text-red-300"><Trash2 size={13} /></button></div></div>)}</div>}
    <AddressGuardModal open={editorOpen} onClose={() => setEditorOpen(false)} onComplete={() => setEditorOpen(false)} initialAddress={editing} title="Add New Address" />
  </section>;
}
