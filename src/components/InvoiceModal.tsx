import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, ShieldCheck } from 'lucide-react';
import type { Order, Address } from '../types';

export function InvoiceModal({
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

  const priceAtPurchase = order.priceAtPurchase ?? order.priceInr;
  const cgst = Math.round(priceAtPurchase * 0.09);
  const sgst = Math.round(priceAtPurchase * 0.09);
  const productBounty = order.productBounty ?? order.bountyAmount;
  const imageReviewBounty = order.imageReviewBounty ?? 0;
  const invoiceNumber = `INV-${order.id.slice(-8).toUpperCase()}`;
  const invoiceDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const orderDate = new Date(order.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const size = order.selectedSize ?? order.size;
  const color = order.selectedColor ?? order.color;

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
            {/* Modal controls - hidden in print */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 print:hidden">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">Tax Invoice</h2>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-gray-700"
                >
                  <Printer size={14} />
                  Print / Save as PDF
                </button>
                <button onClick={onClose} className="text-gray-500 transition-colors hover:text-black">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Invoice content */}
            <div className="p-8 print:p-0">
              {/* Header */}
              <div className="flex items-start justify-between border-b-2 border-gray-800 pb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">ShadowMarket</h1>
                  <p className="mt-1 text-xs text-gray-500">123 Commerce Street, Bengaluru, KA 560001</p>
                  <p className="text-xs text-gray-500">GSTIN: 29ABCDE1234F1Z5</p>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold text-gray-900">TAX INVOICE</h2>
                  <p className="mt-1 text-xs text-gray-600">Invoice No: <span className="font-mono font-semibold">{invoiceNumber}</span></p>
                  <p className="text-xs text-gray-600">Invoice Date: {invoiceDate}</p>
                  <p className="text-xs text-gray-600">Order Date: {orderDate}</p>
                </div>
              </div>

              {/* Bill To / Ship To */}
              <div className="mt-6 grid grid-cols-2 gap-6">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">Bill To</p>
                  <p className="text-sm font-semibold text-gray-800">{address?.fullName ?? order.consumerEmail}</p>
                  <p className="text-xs text-gray-600">{address?.houseNo ?? address?.flatHouseNo ?? ''} {address?.streetArea ?? address?.area ?? ''}</p>
                  <p className="text-xs text-gray-600">{address?.city ?? ''}, {address?.state ?? ''} {address?.pincode ?? ''}</p>
                  <p className="text-xs text-gray-600">Phone: {address?.phoneNumber ?? address?.phone ?? 'N/A'}</p>
                  <p className="text-xs text-gray-600">Email: {order.consumerEmail}</p>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">Ship To (Brand)</p>
                  <p className="text-sm font-semibold text-gray-800">{order.brandName}</p>
                  <p className="text-xs text-gray-600">Sold via ShadowMarket Platform</p>
                  <p className="text-xs text-gray-600">Order ID: <span className="font-mono">#{order.id.slice(-6).toUpperCase()}</span></p>
                  <p className="text-xs text-gray-600">Tracking: {order.trackingNumber}</p>
                </div>
              </div>

              {/* Itemized Table */}
              <table className="mt-6 w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <th className="px-3 py-2 text-[10px] font-bold uppercase text-gray-500">Product</th>
                    <th className="px-3 py-2 text-[10px] font-bold uppercase text-gray-500">Size</th>
                    <th className="px-3 py-2 text-[10px] font-bold uppercase text-gray-500">Color</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-gray-500">Qty</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-gray-500">Unit Price</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="px-3 py-3 font-medium text-gray-800">{order.productTitle}</td>
                    <td className="px-3 py-3 text-gray-600">{size}</td>
                    <td className="px-3 py-3 text-gray-600">{color}</td>
                    <td className="px-3 py-3 text-center text-gray-600">1</td>
                    <td className="px-3 py-3 text-right font-mono text-gray-700">₹{priceAtPurchase.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-gray-800">₹{priceAtPurchase.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>

              {/* Tax Breakdown */}
              <div className="mt-4 ml-auto w-72 space-y-1.5">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-mono">₹{priceAtPurchase.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>CGST (9%)</span>
                  <span className="font-mono">₹{cgst.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>SGST (9%)</span>
                  <span className="font-mono">₹{sgst.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between border-t border-gray-300 pt-1.5 text-sm font-bold text-gray-800">
                  <span>Total (Incl. GST)</span>
                  <span className="font-mono">₹{(priceAtPurchase + cgst + sgst).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Escrow & Bounty Summary */}
              <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-gray-500">Escrow &amp; Bounty Summary</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Product Catalog Bounty</span>
                    <span className="font-mono font-semibold text-gray-700">₹{productBounty.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Image Review Bounty</span>
                    <span className="font-mono font-semibold text-gray-700">₹{imageReviewBounty.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-300 pt-2 text-sm font-bold">
                    <span className="text-gray-800">Net Amount Paid</span>
                    <span className="font-mono text-gray-800">₹{priceAtPurchase.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-8 border-t border-gray-200 pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-600" />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Escrow Verified</span>
                    </div>
                    <p className="max-w-xs text-[10px] leading-relaxed text-gray-400">
                      This invoice is electronically generated via the ShadowMarket zkTLS escrow system. Payment has been verified and held in secure escrow pending delivery confirmation.
                    </p>
                    <p className="mt-2 text-[10px] text-gray-400">Terms: Goods once sold are subject to 7-day dispute window. Cashback bounties are released upon delivery approval.</p>
                  </div>
                  <div className="text-right">
                    <div className="mb-1 h-12 w-24 rounded border-2 border-dashed border-gray-300" />
                    <p className="text-[10px] font-semibold text-gray-500">Authorized Signatory</p>
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
