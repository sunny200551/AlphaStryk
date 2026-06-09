'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  payableAmount: string;
  createdAt: string;
  customer: {
    email: string;
    name: string | null;
  };
  items: {
    quantity: number;
    variant: {
      product: {
        name: string;
      };
    };
  }[];
}

export default function AdminOrderConsole() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/orders/admin/all');
      const data = await res.json();
      if (res.ok && data.success) {
        setOrders(data.data);
      } else {
        setError(data.message || 'Failed to load system orders.');
      }
    } catch (err) {
      setError('Connection failure to orders services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setError('');
    setSuccess('');
    try {
      const res = await apiFetch(`/orders/admin/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(`Order status updated successfully.`);
        // Update local status
        setOrders(orders.map((ord) => (ord.id === orderId ? { ...ord, status: newStatus } : ord)));
      } else {
        setError(data.message || 'Failed to update order status.');
      }
    } catch (err) {
      setError('Connection failure.');
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
        <div className="p-8 text-center text-xs text-gray-400">Loading system orders...</div>
      ) : orders.length === 0 ? (
        <div className="p-8 text-center text-xs text-gray-400">No orders placed on the platform yet.</div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden border border-gray-800 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-900/40 border-b border-gray-800 text-3xs font-bold uppercase tracking-wider text-gray-500">
                  <th className="p-4">Order Details</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Items Count</th>
                  <th className="p-4">Amount Paid</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Update Workflow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {orders.map((ord) => {
                  const qty = ord.items.reduce((acc, i) => acc + i.quantity, 0);
                  return (
                    <tr key={ord.id} className="hover:bg-gray-900/10">
                      <td className="p-4 font-mono">
                        <span className="block font-bold text-white">#{ord.orderNumber}</span>
                        <span className="block text-3xs text-gray-500">
                          {new Date(ord.createdAt).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="block text-gray-300 font-semibold">{ord.customer.name || 'N/A'}</span>
                        <span className="block text-3xs text-gray-500 font-mono">{ord.customer.email}</span>
                      </td>
                      <td className="p-4 text-gray-400 font-semibold">{qty} units</td>
                      <td className="p-4 font-bold text-white">${parseFloat(ord.payableAmount).toFixed(2)}</td>
                      <td className="p-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded font-bold text-3xs uppercase ${
                          ord.status === 'DELIVERED'
                            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                            : ord.status === 'CANCELLED' || ord.status === 'REFUNDED'
                            ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                            : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                        }`}>
                          {ord.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <select
                          value={ord.status}
                          onChange={(e) => handleStatusChange(ord.id, e.target.value)}
                          className="bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="PAID">PAID</option>
                          <option value="CONFIRMED">CONFIRMED</option>
                          <option value="PROCESSING">PROCESSING</option>
                          <option value="SHIPPED">SHIPPED</option>
                          <option value="DELIVERED">DELIVERED</option>
                          <option value="CANCELLED">CANCELLED</option>
                        </select>
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
