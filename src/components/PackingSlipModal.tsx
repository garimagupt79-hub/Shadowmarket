import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, Package, Truck, MapPin, User, Phone, Hash } from 'lucide-react';
import type { Order, Address } from '../types';

export function PackingSlipModal({
  order,
  address,
  open,
  onClose,
}: {
  order: Order | null;
  address: Address | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!order) return null;

  const slipNumber = `PS-${order.id.slice(-8).toUpperCase()}`;
  const slipDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const orderDate = new Date(order.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const size = order.selectedSize ?? order.size;
  const color = order.selectedColor ?? order.color;
  const priceAtPurchase = order.priceAtPurchase ?? order.priceInr;

  const handlePrint = () => window.print();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:bg-white print:static print:p-0 print:block"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#1F1F24] bg-white text-black shadow-2xl scrollbar-thin print:max-h-none print:overflow-visible print:border-0 print:shadow-none print:w-full print:max-w-none"
          >
            {/* Modal controls */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 print:hidden">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">Packing Slip</h2>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-gray-700"
                >
                  <Printer size={14} />
                  Print Packing Slip
                </button>
                <button onClick={onClose} className="text-gray-500 transition-colors hover:text-black">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Slip content */}
            <div className="p-8 print:p-0">
              {/* Header */}
              <div className="flex items-start justify-between border-b-2 border-gray-800 pb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-900">
                    <Package size={24} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">ShadowMarket</h1>
                    <p className="text-xs text-gray-500">Fulfillment Center · Bengaluru, KA</p>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold text-gray-900">PACKING SLIP</h2>
                  <p className="mt-1 text-xs text-gray-600">Slip No: <span className="font-mono font-semibold">{slipNumber}</span></p>
                  <p className="text-xs text-gray-600">Date: {slipDate}</p>
                </div>
              </div>

              {/* Order & Dispatch Info */}
              <div className="mt-6 grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Hash size={14} className="text-gray-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Order Details</span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <p>Order ID: <span className="font-mono font-semibold text-gray-800">#{order.id.slice(-6).toUpperCase()}</span></p>
                    <p>Order Date: {orderDate}</p>
                    <p>Brand: <span className="font-medium text-gray-800">{order.brandName}</span></p>
                    <p>Tracking: <span className="font-mono">{order.trackingNumber}</span></p>
                    {order.carrier && <p>Carrier: <span className="font-medium">{order.carrier}</span></p>}
                    {order.estimatedDelivery && (
                      <p>Est. Delivery: {new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Truck size={14} className="text-gray-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Dispatch Status</span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <p>Status: <span className="font-semibold capitalize text-gray-800">{order.trackingStatus}</span></p>
                    <p>Settlement: <span className="capitalize">{order.settlementStatus?.replace(/_/g, ' ') ?? 'pending'}</span></p>
                    <p>Escrow: {order.escrowStatus === 'released' ? 'Released' : 'Locked'}</p>
                    {order.refunded && <p className="font-semibold text-red-600">Refunded</p>}
                    {order.reshipped && <p className="font-semibold text-amber-600">Reshipped</p>}
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <MapPin size={14} className="text-gray-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Ship To</span>
                </div>
                <div className="text-xs text-gray-700">
                  <p className="font-semibold text-gray-800">{address?.fullName ?? order.consumerEmail}</p>
                  <p>{address?.houseNo ?? address?.flatHouseNo ?? ''} {address?.streetArea ?? address?.area ?? ''}</p>
                  <p>{address?.city ?? ''}, {address?.state ?? ''} {address?.pincode ?? ''}</p>
                  <div className="mt-1 flex items-center gap-3">
                    {address?.phoneNumber ?? address?.phone ? (
                      <span className="flex items-center gap-1"><Phone size={11} /> {address?.phoneNumber ?? address?.phone}</span>
                    ) : null}
                    <span className="flex items-center gap-1"><User size={11} /> {order.consumerEmail}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <table className="mt-6 w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <th className="px-3 py-2 text-[10px] font-bold uppercase text-gray-500">Product</th>
                    <th className="px-3 py-2 text-[10px] font-bold uppercase text-gray-500">Variant</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-gray-500">Qty</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-gray-500">Packed</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-gray-500">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="px-3 py-3 font-medium text-gray-800">{order.productTitle}</td>
                    <td className="px-3 py-3 text-gray-600">{size} / {color}</td>
                    <td className="px-3 py-3 text-center text-gray-600">1</td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded border-2 border-gray-400 text-[10px] font-bold text-gray-600">&#10003;</span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-gray-700">₹{priceAtPurchase.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>

              {/* Barcode */}
              <div className="mt-6 flex flex-col items-center gap-2">
                <div className="flex h-16 items-center gap-0.5 rounded-lg border-2 border-gray-800 bg-white px-4 py-2">
                  {order.trackingNumber.split('').map((char, i) => {
                    const widths = [1, 2, 1, 3, 1, 2, 2, 1, 3, 1];
                    const w = widths[char.charCodeAt(0) % widths.length];
                    return (
                      <div
                        key={i}
                        className="h-full bg-gray-900"
                        style={{ width: `${w}px`, marginLeft: i > 0 ? '1px' : '0' }}
                      />
                    );
                  })}
                </div>
                <p className="font-mono text-xs font-bold tracking-widest text-gray-700">{order.trackingNumber}</p>
                <p className="text-[10px] text-gray-400">Scan or enter tracking number at carrier portal</p>
              </div>

              {/* Footer */}
              <div className="mt-8 border-t border-gray-200 pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Packing Notes</p>
                    <p className="mt-1 max-w-xs text-[10px] leading-relaxed text-gray-400">
                      Pack item with protective wrapping. Include this slip inside the package. Seal with tamper-evident tape. Attach shipping label to the exterior.
                    </p>
                    {order.returnOldItemRequired && (
                      <p className="mt-2 text-[10px] font-semibold text-amber-600">
                        DOORSTEP EXCHANGE: Collect old item from buyer upon delivery.
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="mb-1 h-12 w-24 rounded border-2 border-dashed border-gray-300" />
                    <p className="text-[10px] font-semibold text-gray-500">Packed By</p>
                    <p className="text-[10px] text-gray-400">For {order.brandName}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
