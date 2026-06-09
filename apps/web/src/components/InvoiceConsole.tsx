'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: string;
  createdAt: string;
  order: {
    orderNumber: string;
  };
}

export default function InvoiceConsole() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/invoices/history');
      const data = await res.json();
      if (res.ok && data.success) {
        setInvoices(data.data);
      } else {
        setError(data.message || 'Failed to retrieve tax invoice logs.');
      }
    } catch (err) {
      setError('Connection failure accessing invoice services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleDownload = async (invoiceNumber: string, invoiceId: string) => {
    setActionLoadingId(invoiceId);
    setSuccessMessage('');
    setError('');
    try {
      const res = await apiFetch(`/invoices/download/${invoiceNumber}`);
      if (!res.ok) {
        setError('Failed to fetch pdf download document.');
        setActionLoadingId(null);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setSuccessMessage(`Invoice ${invoiceNumber} downloaded successfully.`);
    } catch (err) {
      setError('Download network error.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEmail = async (invoiceNumber: string, invoiceId: string) => {
    setActionLoadingId(invoiceId);
    setSuccessMessage('');
    setError('');
    try {
      const res = await apiFetch(`/invoices/email/${invoiceNumber}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`Invoice PDF successfully emailed!`);
      } else {
        setError(data.message || 'Failed to send email.');
      }
    } catch (err) {
      setError('Email connection failure.');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-gray-400">Loading historical tax invoices...</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg font-semibold">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-4 py-3 rounded-lg font-semibold">
          {successMessage}
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="border border-dashed border-gray-800 rounded-xl p-8 text-center flex flex-col items-center justify-center text-gray-400">
          <span className="text-2xl mb-2">📄</span>
          <p className="text-sm font-semibold">No tax invoices generated yet</p>
          <p className="text-2xs text-gray-500 max-w-xs mt-1">
            Invoices are generated automatically after payment verification. Place an order to generate one.
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden border border-gray-800 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-900/40 border-b border-gray-800 text-3xs font-bold uppercase tracking-wider text-gray-500">
                  <th className="p-4">Invoice Number</th>
                  <th className="p-4">Order Ref</th>
                  <th className="p-4">Billing Date</th>
                  <th className="p-4">Amount Paid</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-900/10">
                    <td className="p-4 font-mono font-bold text-white">#{inv.invoiceNumber}</td>
                    <td className="p-4 font-mono text-gray-300">#{inv.order.orderNumber}</td>
                    <td className="p-4 text-gray-400">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="p-4 font-bold text-white">${parseFloat(inv.amount).toFixed(2)}</td>
                    <td className="p-4 text-right space-x-3">
                      <button
                        onClick={() => handleDownload(inv.invoiceNumber, inv.id)}
                        disabled={actionLoadingId !== null}
                        className="text-2xs text-brand-400 hover:text-brand-350 transition font-bold"
                      >
                        {actionLoadingId === inv.id ? 'Loading...' : 'Download PDF'}
                      </button>
                      <button
                        onClick={() => handleEmail(inv.invoiceNumber, inv.id)}
                        disabled={actionLoadingId !== null}
                        className="text-2xs text-gray-400 hover:text-white transition font-bold"
                      >
                        Email Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
