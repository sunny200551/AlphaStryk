'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import { apiFetch } from '../../../lib/api';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  payableAmount: string;
  createdAt: string;
  items: {
    quantity: number;
    variant: {
      product: {
        name: string;
      };
    };
  }[];
}

export default function OrderHistoryPage() {
  const { user, loading } = useAuth([]);
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrderHistory = async () => {
    setOrdersLoading(true);
    try {
      const res = await apiFetch('/orders/history');
      const data = await res.json();
      if (res.ok && data.success) {
        setOrders(data.data);
      } else {
        setError(data.message || 'Failed to load order logs.');
      }
    } catch (err) {
      setError('Connection failure.');
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchOrderHistory();
    }
  }, [user]);

  if (loading || ordersLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="glass-card sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <Link href="/" className="font-extrabold text-2xl tracking-wider text-gradient font-outfit">
          ALPHASTRYK
        </Link>
        <Link href="/products" className="text-sm font-semibold text-brand-400 hover:text-brand-350 transition">
          Store Catalog
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold font-outfit">Order History</h1>
          <p className="text-xs text-gray-400">Track current status of uniform orders and checkout metrics</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center text-gray-400 space-y-4">
            <span className="text-4xl block">📦</span>
            <h3 className="font-bold text-white text-base">You haven't placed any orders yet</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Ready to gear up? Select jerseys or custom team athletic apparel from our store catalog.
            </p>
            <div className="pt-2">
              <Link href="/products" className="inline-block py-2.5 px-6 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition text-xs">
                Browse Store Catalog
              </Link>
            </div>
          </div>
        ) : (
          <div className="glass-card rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-900/40 border-b border-gray-800 text-3xs font-bold uppercase tracking-wider text-gray-500">
                    <th className="p-4">Order Number</th>
                    <th className="p-4">Date Placed</th>
                    <th className="p-4">Products</th>
                    <th className="p-4">Amount Paid</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {orders.map((ord) => {
                    const firstItemName = ord.items[0]?.variant.product.name || 'Uniform Item';
                    const itemsLabel = ord.items.length > 1 ? `${firstItemName} + ${ord.items.length - 1} items` : firstItemName;
                    return (
                      <tr key={ord.id} className="hover:bg-gray-900/10">
                        <td className="p-4 font-mono font-bold text-white">#{ord.orderNumber}</td>
                        <td className="p-4 text-gray-400">{new Date(ord.createdAt).toLocaleDateString()}</td>
                        <td className="p-4 text-gray-300 font-semibold">{itemsLabel}</td>
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
                          <Link href={`/orders/${ord.orderNumber}`} className="text-brand-400 hover:text-brand-350 font-bold">
                            View Invoice
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
