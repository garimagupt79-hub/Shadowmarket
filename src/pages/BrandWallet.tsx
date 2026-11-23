import { useState } from 'react';
import { Filter, Wallet, Lock, TrendingUp } from 'lucide-react';
import { BrandLayout } from '../components/BrandLayout';
import { useMarket } from '../context/MarketContext';
import type { WalletTransaction } from '../types';

type LedgerFilter = 'All' | 'Money In' | 'Money Out' | 'Bounties & Refunds';

export function BrandWallet() {
  const { brandWalletBalance, walletTransactions } = useMarket();
  const [filter, setFilter] = useState<LedgerFilter>('All');
  const transactions = walletTransactions
    .filter((tx) => tx.wallet === 'brand' || (!tx.wallet && ['brand_payout', 'platform_fee', 'ESCROW_RELEASE', 'PLATFORM_FEE_DEDUCTION', 'BOUNTY_ESCROW_DEDUCTION', 'WITHDRAWAL'].includes(tx.type)))
    .filter((tx) => {
      if (filter === 'All') return true;
      if (filter === 'Money In') return isCredit(tx);
      if (filter === 'Money Out') return isDebit(tx);
      return ['PRODUCT_BOUNTY_CASHBACK', 'IMAGE_REVIEW_BOUNTY', 'bounty_release', 'image_review_bounty', 'REFUND', 'FAILED_DELIVERY_REFUND', 'admin_refund', 'UNCLAIMED_BOUNTY_RETURN', 'IMAGE_REVIEW_BOUNTY_EXPIRED', 'BOUNTY_ESCROW_DEDUCTION'].includes(tx.type);
    });

  return (
    <BrandLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tighter text-white">Financial Ledger</h1>
        <p className="mt-1.5 text-sm text-platinum">Review every settlement, escrow release, and returned bounty in one place.</p>
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={<Wallet size={16} />} label="Available Settlement" value={`₹${brandWalletBalance.toLocaleString('en-IN')}`} accent="text-[#00E676]" />
        <SummaryCard icon={<Lock size={16} />} label="Escrow Controls" value="7 + 15 days" accent="text-amber-400" />
        <SummaryCard icon={<TrendingUp size={16} />} label="Ledger Entries" value={transactions.length.toLocaleString('en-IN')} accent="text-white" />
      </div>
      <TransactionLedger transactions={transactions} filter={filter} onFilterChange={setFilter} />
    </BrandLayout>
  );
}

function SummaryCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return <div className="rounded-2xl border border-[#1F1F24] bg-[#111114] p-6"><div className="flex items-center gap-2 text-platinum">{icon}<span className="text-xs font-medium uppercase tracking-[0.15em]">{label}</span></div><p className={`mt-4 text-3xl font-bold tracking-tight ${accent}`}>{value}</p></div>;
}

function TransactionLedger({ transactions, filter, onFilterChange }: { transactions: WalletTransaction[]; filter: LedgerFilter; onFilterChange: (filter: LedgerFilter) => void }) {
  const filters: LedgerFilter[] = ['All', 'Money In', 'Money Out', 'Bounties & Refunds'];
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-[#00E676]" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-white">Transaction Audit Ledger</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item}
              onClick={() => onFilterChange(item)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${filter === item ? 'border-[#00E676]/40 bg-[#00E676]/10 text-[#00E676]' : 'border-[#1F1F24] bg-[#111114] text-platinum hover:text-white'}`}
            >
              {item === 'Money In' && '🟢 '}
              {item === 'Money Out' && '🔴 '}
              {item === 'Bounties & Refunds' && '🛡️ '}
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#1F1F24] bg-[#111114]">
        {transactions.length === 0 ? (
          <p className="p-6 text-sm text-platinum">No transactions match this filter.</p>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-[#1F1F24] bg-[#060608]/60">
                  <th className="px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-platinum">Timestamp &amp; Date</th>
                  <th className="px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-platinum">Transaction Tag</th>
                  <th className="px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-platinum">Order Reference</th>
                  <th className="px-5 py-3 text-right text-[10px] uppercase tracking-[0.15em] text-platinum">Amount</th>
                  <th className="px-5 py-3 text-right text-[10px] uppercase tracking-[0.15em] text-platinum">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const credit = isCredit(tx);
                  return (
                    <tr key={tx.id} className="border-b border-[#1F1F24] last:border-0 hover:bg-[#060608]/40">
                      <td className="px-5 py-3 text-xs text-platinum">{new Date(tx.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-[#1F1F24] bg-[#060608] px-2 py-1 font-mono text-[10px] text-sky-300">
                          {credit ? '🟢' : '🔴'} [{getLedgerTag(tx)}]
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] text-platinum">{tx.orderId ? `#${tx.orderId.slice(-6).toUpperCase()}` : '—'}</td>
                      <td className={`px-5 py-3 text-right font-mono text-xs font-bold ${credit ? 'text-emerald-400' : 'text-red-400'}`}>
                        {credit ? '↙️ +' : '↗️ -'}₹{tx.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs text-white">{tx.runningBalance === undefined ? '—' : `₹${tx.runningBalance.toLocaleString('en-IN')}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function getLedgerTag(tx: WalletTransaction): string {
  if (tx.type === 'ORDER_PAYMENT') return 'ORDER_PAYMENT';
  if (tx.type === 'WITHDRAWAL') return 'WITHDRAWAL';
  if (tx.type === 'PLATFORM_FEE_DEDUCTION') return 'PLATFORM_FEE';
  if (tx.type === 'BOUNTY_ESCROW_DEDUCTION') return 'BOUNTY_ESCROW';
  if (tx.type === 'PRODUCT_BOUNTY_CASHBACK' || tx.type === 'bounty_release') return 'PRODUCT_BOUNTY';
  if (tx.type === 'IMAGE_REVIEW_BOUNTY' || tx.type === 'image_review_bounty') return 'IMAGE_BOUNTY';
  if (tx.type === 'ESCROW_RELEASE' || tx.type === 'admin_release' || tx.type === 'brand_payout') return 'ESCROW_RELEASE';
  if (tx.type === 'FAILED_DELIVERY_REFUND') return 'FAILED_DELIVERY_REFUND';
  if (tx.type === 'UNCLAIMED_BOUNTY_RETURN' || tx.type === 'IMAGE_REVIEW_BOUNTY_EXPIRED') return 'UNCLAIMED_BOUNTY_RETURN';
  return 'REFUND';
}

function isCredit(tx: WalletTransaction): boolean {
  if (tx.direction === 'credit' || tx.category === 'credit') return true;
  if (tx.direction === 'debit' || tx.category === 'debit') return false;
  return !['cashout', 'platform_fee', 'brand_payout', 'ESCROW_RELEASE', 'ORDER_PAYMENT', 'WITHDRAWAL', 'PLATFORM_FEE_DEDUCTION', 'BOUNTY_ESCROW_DEDUCTION'].includes(tx.type);
}

function isDebit(tx: WalletTransaction): boolean {
  return !isCredit(tx);
}
