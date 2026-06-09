'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  gstin: string | null;
  cgst: string;
  sgst: string;
  igst: string;
  taxRate: string;
  amount: string;
  createdAt: string;
  customer: {
    name: string | null;
    email: string;
  };
  order: {
    orderNumber: string;
    billingAddress: any;
  };
}

interface Aggregates {
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalGst: number;
  totalAmount: number;
  stateDistribution: Record<string, number>;
}

export default function AdminInvoiceConsole() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [aggregates, setAggregates] = useState<Aggregates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/invoices/admin/all');
      const data = await res.json();
      if (res.ok && data.success) {
        setInvoices(data.data.invoices);
        setAggregates(data.data.aggregates);
      } else {
        setError(data.message || 'Failed to retrieve administrative GST invoice records.');
      }
    } catch (err) {
      setError('Connection failure accessing invoices analytical services.');
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
        setSuccessMessage(`Invoice PDF successfully emailed to customer!`);
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
    return <div className="p-8 text-center text-xs text-gray-400">Loading tax invoices and metrics aggregates...</div>;
  }

  return (
    <div className="space-y-6">
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

      {/* Analytics highlights */}
      {aggregates && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-800/80">
            <span className="block text-3xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Total Sales (Inc Tax)</span>
            <span className="text-lg font-extrabold text-white">${aggregates.totalAmount.toFixed(2)}</span>
          </div>
          <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-800/80">
            <span className="block text-3xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Total GST Collected</span>
            <span className="text-lg font-extrabold text-indigo-400">${aggregates.totalGst.toFixed(2)}</span>
          </div>
          <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-800/80">
            <span className="block text-3xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Central CGST (9%)</span>
            <span className="text-lg font-extrabold text-brand-400">${aggregates.totalCgst.toFixed(2)}</span>
          </div>
          <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-800/80">
            <span className="block text-3xs text-gray-500 font-semibold uppercase tracking-wider mb-1">State SGST (9%)</span>
            <span className="text-lg font-extrabold text-brand-400">${aggregates.totalSgst.toFixed(2)}</span>
          </div>
          <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-800/80 col-span-2 md:col-span-1">
            <span className="block text-3xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Integrated IGST (18%)</span>
            <span className="text-lg font-extrabold text-indigo-400">${aggregates.totalIgst.toFixed(2)}</span>
          </div>
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="p-8 text-center text-xs text-gray-400">No GST invoices created in system yet.</div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden border border-gray-800 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-900/40 border-b border-gray-800 text-3xs font-bold uppercase tracking-wider text-gray-500">
                  <th className="p-4">Invoice details</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">State / GSTIN</th>
                  <th className="p-4">CGST / SGST</th>
                  <th className="p-4">IGST</th>
                  <th className="p-4">Total Paid</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {invoices.map((inv) => {
                  const billingAddr: any = inv.order?.billingAddress;
                  const state = billingAddr?.state || 'N/A';

                  return (
                    <tr key={inv.id} className="hover:bg-gray-900/10">
                      <td className="p-4 font-mono">
                        <span className="block font-bold text-white">#{inv.invoiceNumber}</span>
                        <span className="block text-3xs text-gray-500">
                          {new Date(inv.createdAt).toLocaleString()} | Order #{inv.order.orderNumber}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="block text-gray-300 font-semibold">{inv.customer.name || 'Athlete'}</span>
                        <span className="block text-3xs text-gray-500 font-mono">{inv.customer.email}</span>
                      </td>
                      <td className="p-4">
                        <span className="block text-gray-300 font-semibold">{state}</span>
                        {inv.gstin ? (
                          <span className="block text-3xs font-bold text-brand-400 font-mono">GSTIN: {inv.gstin}</span>
                        ) : (
                          <span className="block text-3xs text-gray-500 italic">No GSTIN</span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-gray-400">
                        {parseFloat(inv.cgst) > 0 ? (
                          <>
                            <span className="block">C: ${parseFloat(inv.cgst).toFixed(2)}</span>
                            <span className="block">S: ${parseFloat(inv.sgst).toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-gray-400">
                        {parseFloat(inv.igst) > 0 ? (
                          <span>${parseFloat(inv.igst).toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="p-4 font-bold text-white font-mono">
                        ${parseFloat(inv.amount).toFixed(2)}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => handleDownload(inv.invoiceNumber, inv.id)}
                          disabled={actionLoadingId !== null}
                          className="text-2xs text-brand-400 hover:text-brand-350 transition font-bold"
                        >
                          {actionLoadingId === inv.id ? 'Loading...' : 'Download'}
                        </button>
                        <button
                          onClick={() => handleEmail(inv.invoiceNumber, inv.id)}
                          disabled={actionLoadingId !== null}
                          className="text-2xs text-gray-400 hover:text-white transition font-bold"
                        >
                          Email PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
