'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

interface Refund {
  id: string;
  amount: string;
  reason: string;
  status: string;
  createdAt: string;
}

interface Payment {
  id: string;
  orderId: string;
  gateway: string;
  transactionId: string;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  amount: string;
  status: string;
  rawResponse: any;
  createdAt: string;
  order: {
    orderNumber: string;
    customer: {
      name: string | null;
      email: string;
    };
  };
  refunds: Refund[];
}

export default function AdminPaymentConsole() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Refund dialog states
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);

  // Expanded JSON logs states
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/payments/admin/logs');
      const data = await res.json();
      if (res.ok && data.success) {
        setPayments(data.data);
      } else {
        setError(data.message || 'Failed to retrieve administrative payment logs.');
      }
    } catch (err) {
      setError('Connection error accessing payments services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;

    setRefundLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await apiFetch(`/payments/admin/${selectedPayment.id}/refund`, {
        method: 'POST',
        body: JSON.stringify({
          reason: refundReason,
          amount: refundAmount || undefined, // undefined uses full amount
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(`Refund for payment ID ${selectedPayment.transactionId} processed successfully!`);
        setSelectedPayment(null);
        setRefundReason('');
        setRefundAmount('');
        // Reload list
        fetchPayments();
      } else {
        setError(data.message || 'Failed to process refund.');
      }
    } catch (err) {
      setError('Connection failure trying to issue refund.');
    } finally {
      setRefundLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-gray-400">Loading system payment logs...</div>
      ) : payments.length === 0 ? (
        <div className="p-8 text-center text-xs text-gray-400">No payment records saved on the platform yet.</div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden border border-gray-800 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-900/40 border-b border-gray-800 text-3xs font-bold uppercase tracking-wider text-gray-500">
                  <th className="p-4">Txn Ref / Date</th>
                  <th className="p-4">Order Ref</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Gateway</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {payments.map((pay) => {
                  const hasRefund = pay.refunds && pay.refunds.length > 0;
                  const refundAmountVal = hasRefund
                    ? pay.refunds.reduce((acc, r) => acc + parseFloat(r.amount), 0)
                    : 0;

                  return (
                    <React.Fragment key={pay.id}>
                      <tr className="hover:bg-gray-900/10">
                        <td className="p-4 font-mono">
                          <span className="block font-bold text-white max-w-[150px] truncate" title={pay.transactionId}>
                            {pay.transactionId}
                          </span>
                          <span className="block text-3xs text-gray-500">
                            {new Date(pay.createdAt).toLocaleString()}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-gray-300 font-bold">
                          #{pay.order.orderNumber}
                        </td>
                        <td className="p-4">
                          <span className="block text-gray-300 font-semibold">{pay.order.customer.name || 'Athlete'}</span>
                          <span className="block text-3xs text-gray-500 font-mono">{pay.order.customer.email}</span>
                        </td>
                        <td className="p-4 font-bold text-brand-400 uppercase">
                          {pay.gateway}
                        </td>
                        <td className="p-4 font-bold text-white">
                          ${parseFloat(pay.amount).toFixed(2)}
                          {hasRefund && (
                            <span className="block text-3xs text-red-400 font-normal">
                              Refunded: -${refundAmountVal.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`inline-block px-2 py-0.5 rounded font-bold text-3xs uppercase ${
                            pay.status === 'COMPLETED'
                              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                              : pay.status === 'REFUNDED'
                              ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                              : pay.status === 'FAILED'
                              ? 'bg-red-500/10 border border-red-550/20 text-red-500'
                              : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                          }`}>
                            {pay.status}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => setExpandedPaymentId(expandedPaymentId === pay.id ? null : pay.id)}
                            className="text-2xs text-brand-400 hover:text-brand-350 transition font-bold"
                          >
                            {expandedPaymentId === pay.id ? 'Hide Logs' : 'View Payload'}
                          </button>
                          {pay.status === 'COMPLETED' && (
                            <button
                              onClick={() => {
                                setSelectedPayment(pay);
                                setRefundAmount(parseFloat(pay.amount).toString());
                              }}
                              className="text-2xs text-red-400 hover:text-red-350 transition font-bold"
                            >
                              Issue Refund
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Raw JSON View */}
                      {expandedPaymentId === pay.id && (
                        <tr>
                          <td colSpan={7} className="p-4 bg-gray-950/60 border-y border-gray-800">
                            <div className="space-y-3">
                              <span className="block text-3xs text-gray-500 font-extrabold uppercase tracking-wider">
                                Gateway Transaction Metadata Logs
                              </span>
                              <pre className="text-3xs text-gray-400 font-mono bg-black/40 p-3 rounded-lg overflow-x-auto max-h-48 leading-relaxed border border-gray-800/50">
                                {JSON.stringify(pay.rawResponse || { info: 'No details logged' }, null, 2)}
                              </pre>
                              {hasRefund && (
                                <div className="space-y-2 border-t border-gray-800 pt-3">
                                  <span className="block text-3xs text-red-400 font-bold uppercase tracking-wider">
                                    Refund Logs
                                  </span>
                                  {pay.refunds.map((ref) => (
                                    <div key={ref.id} className="text-3xs text-gray-400 leading-normal">
                                      <span className="font-bold text-white font-mono">{ref.id}</span> - Refunded 
                                      <span className="font-bold text-white"> ${parseFloat(ref.amount).toFixed(2)}</span> on 
                                      <span> {new Date(ref.createdAt).toLocaleDateString()}</span>. Reason: 
                                      <span className="italic text-gray-300"> "{ref.reason}"</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Refund Trigger Modal overlay */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRefundSubmit} className="glass-card max-w-md w-full rounded-2xl border border-red-500/30 p-6 space-y-4 shadow-2xl">
            <div className="border-b border-gray-800 pb-3 flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-red-400 font-outfit">Confirm Gateway Refund</h3>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="text-gray-500 hover:text-white font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-2">
              <p className="text-gray-300">
                You are initiating a refund process for Transaction Reference:
                <span className="block font-mono font-bold text-white mt-1">{selectedPayment.transactionId}</span>
              </p>
              <p className="text-3xs text-gray-500 leading-relaxed">
                This operation will request the respective gateway ({selectedPayment.gateway}) to return funds, update the order to REFUNDED, and increment product stock back into the catalog.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Refund Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={parseFloat(selectedPayment.amount)}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  required
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white font-mono"
                />
                <span className="text-4xs text-gray-500 mt-1 block">Maximum refundable amount: ${selectedPayment.amount}</span>
              </div>
              <div>
                <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Reason for Refund</label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Order cancelled, custom jersey sizing change"
                  required
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                type="submit"
                disabled={refundLoading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-850 text-white font-bold rounded-lg text-xs transition uppercase flex items-center justify-center gap-2"
              >
                {refundLoading ? (
                  <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
                ) : (
                  'Execute Refund'
                )}
              </button>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-800 text-gray-400 border border-gray-800 rounded-lg text-xs font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
