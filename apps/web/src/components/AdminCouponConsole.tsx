'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Coupon {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: string;
  minOrderValue: string;
  maxDiscount: string | null;
  startsAt: string;
  expiresAt: string;
  usageLimit: number | null;
  usageCount: number;
  userUsageLimit: number;
  isActive: boolean;
  categoryId: string | null;
  category: { name: string } | null;
  referrerId: string | null;
  referrer: { email: string; name: string | null } | null;
  isFirstOrderOnly: boolean;
  createdAt: string;
}

interface CouponAnalytics {
  id: string;
  code: string;
  type: string;
  value: string;
  usageCount: number;
  usageLimit: number | null;
  userUsageLimit: number;
  isActive: boolean;
  expiresAt: string;
  categoryName: string;
  referrerName: string | null;
  totalDiscount: number;
  totalRevenue: number;
  ordersCount: number;
}

export default function AdminCouponConsole() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [analytics, setAnalytics] = useState<CouponAnalytics[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'registry' | 'create' | 'analytics'>('registry');

  // Form State
  const [code, setCode] = useState('');
  const [type, setType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [minOrderValue, setMinOrderValue] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [userUsageLimit, setUserUsageLimit] = useState('1');
  const [categoryId, setCategoryId] = useState('');
  const [referrerEmail, setReferrerEmail] = useState('');
  const [isFirstOrderOnly, setIsFirstOrderOnly] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const catRes = await apiFetch('/products/categories');
      const catData = await catRes.json();
      if (catRes.ok) {
        setCategories(catData.data || []);
      }

      await refreshRegistry();
      await refreshAnalytics();
    } catch (err) {
      setError('Connection failure loading coupon management metadata.');
    } finally {
      setLoading(false);
    }
  };

  const refreshRegistry = async () => {
    try {
      const res = await apiFetch('/coupons/admin/all');
      const data = await res.json();
      if (res.ok && data.success) {
        setCoupons(data.coupons);
      }
    } catch (err) {
      console.error('Failed to reload registry list.');
    }
  };

  const refreshAnalytics = async () => {
    try {
      const res = await apiFetch('/coupons/admin/analytics');
      const data = await res.json();
      if (res.ok && data.success) {
        setAnalytics(data.analytics);
      }
    } catch (err) {
      console.error('Failed to load performance metrics.');
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        code,
        type,
        value: parseFloat(value),
        minOrderValue: minOrderValue ? parseFloat(minOrderValue) : 0.0,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        startsAt: new Date(startsAt).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
        usageLimit: usageLimit ? parseInt(usageLimit, 10) : undefined,
        userUsageLimit: userUsageLimit ? parseInt(userUsageLimit, 10) : 1,
        categoryId: categoryId || undefined,
        referrerEmail: referrerEmail || undefined,
        isFirstOrderOnly,
      };

      const res = await apiFetch('/coupons/admin/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(`Coupon "${code.toUpperCase()}" registered successfully!`);
        // Reset form
        setCode('');
        setType('PERCENTAGE');
        setValue('');
        setMinOrderValue('');
        setMaxDiscount('');
        setStartsAt('');
        setExpiresAt('');
        setUsageLimit('');
        setUserUsageLimit('1');
        setCategoryId('');
        setReferrerEmail('');
        setIsFirstOrderOnly(false);

        await refreshRegistry();
        await refreshAnalytics();
        setActiveTab('registry');
      } else {
        setError(data.message || 'Creation request rejected.');
      }
    } catch (err) {
      setError('Connection failure saving coupon.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate or delete this coupon?')) return;
    setError('');
    setSuccess('');

    try {
      const res = await apiFetch(`/coupons/admin/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(data.message || 'Coupon processed successfully.');
        await refreshRegistry();
        await refreshAnalytics();
      } else {
        setError(data.message || 'Deactivation request failed.');
      }
    } catch (err) {
      setError('Connection failure.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg font-semibold">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-4 py-3 rounded-lg font-semibold">
          ✓ {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-3">
        <button
          onClick={() => setActiveTab('registry')}
          className={`py-2 px-4 rounded-lg text-xs font-bold transition flex items-center gap-2 border ${
            activeTab === 'registry'
              ? 'border-brand-500/30 bg-brand-500/5 text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Coupon Registry
          <span className="px-1.5 py-0.5 rounded text-4xs bg-brand-500/20 text-brand-300 font-extrabold font-mono">
            {coupons.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('create')}
          className={`py-2 px-4 rounded-lg text-xs font-bold transition border ${
            activeTab === 'create'
              ? 'border-brand-500/30 bg-brand-500/5 text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          + Add New Code
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`py-2 px-4 rounded-lg text-xs font-bold transition border ${
            activeTab === 'analytics'
              ? 'border-brand-500/30 bg-brand-500/5 text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Redemption Analytics
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-gray-400 font-semibold animate-pulse">
          Syncing Coupon configurations...
        </div>
      ) : (
        <>
          {/* REGISTRY TAB */}
          {activeTab === 'registry' && (
            <div className="space-y-4">
              {coupons.length === 0 ? (
                <div className="glass-card p-12 text-center text-xs text-gray-500 italic rounded-2xl border border-gray-800">
                  No coupon codes registered in database.
                </div>
              ) : (
                <div className="glass-card rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-900/40 border-b border-gray-800 text-3xs font-extrabold uppercase tracking-wider text-gray-500">
                          <th className="p-4">Coupon Code</th>
                          <th className="p-4">Discount Value</th>
                          <th className="p-4">Min. Required</th>
                          <th className="p-4">Limits (Used/Max)</th>
                          <th className="p-4">Restrictions</th>
                          <th className="p-4 text-right">State</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {coupons.map((c) => {
                          const hasExpired = new Date(c.expiresAt) < new Date();
                          return (
                            <tr key={c.id} className="hover:bg-gray-900/10">
                              <td className="p-4">
                                <span className="block font-bold text-white font-mono">{c.code}</span>
                                <span className="block text-4xs text-gray-500 font-mono">
                                  Expires: {new Date(c.expiresAt).toLocaleDateString()}
                                </span>
                              </td>
                              <td className="p-4">
                                <span className="font-semibold text-gray-300">
                                  {c.type === 'PERCENTAGE' ? `${c.value}%` : `$${c.value}`}
                                </span>
                                {c.maxDiscount && (
                                  <span className="block text-4xs text-gray-500">Max Cap: ${c.maxDiscount}</span>
                                )}
                              </td>
                              <td className="p-4 text-gray-400 font-semibold">${parseFloat(c.minOrderValue).toFixed(2)}</td>
                              <td className="p-4 text-gray-400">
                                <span className="block font-semibold">
                                  Global: {c.usageCount} / {c.usageLimit || '∞'}
                                </span>
                                <span className="block text-4xs text-gray-500">Per User: {c.userUsageLimit}</span>
                              </td>
                              <td className="p-4 text-gray-400">
                                {c.categoryId && (
                                  <span className="block text-3xs text-brand-300 uppercase font-bold">
                                    Cat: {c.category?.name}
                                  </span>
                                )}
                                {c.referrerId && (
                                  <span className="block text-3xs text-indigo-400 uppercase font-bold">
                                    Referral: {c.referrer?.email}
                                  </span>
                                )}
                                {c.isFirstOrderOnly && (
                                  <span className="block text-4xs text-yellow-500 font-bold">First Order Only</span>
                                )}
                                {!c.categoryId && !c.referrerId && !c.isFirstOrderOnly && (
                                  <span className="text-gray-500 italic">None</span>
                                )}
                              </td>
                              <td className="p-4 text-right space-x-3">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-4xs font-bold border uppercase tracking-wider ${
                                    c.isActive && !hasExpired
                                      ? 'bg-green-500/10 border-green-500/20 text-green-400'
                                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                                  }`}
                                >
                                  {hasExpired ? 'Expired' : c.isActive ? 'Active' : 'Disabled'}
                                </span>
                                <button
                                  onClick={() => handleDeleteCoupon(c.id)}
                                  className="text-red-400 hover:text-red-300 font-bold text-3xs uppercase tracking-wide transition border border-red-500/10 hover:border-red-500/30 px-2 py-1 bg-red-500/5 rounded"
                                >
                                  Delete
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
          )}

          {/* CREATE TAB */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateCoupon} className="glass-card p-6 rounded-2xl border border-gray-800 space-y-6 max-w-2xl mx-auto">
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400 border-b border-gray-800 pb-2">
                Register New Coupon Code
              </h3>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Coupon Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FLASH20, REF_JOHN"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-white font-mono uppercase outline-none focus:border-brand-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Coupon Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-brand-500 transition"
                  >
                    <option value="PERCENTAGE">PERCENTAGE (%)</option>
                    <option value="FIXED_AMOUNT">FIXED AMOUNT ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">
                    Value ({type === 'PERCENTAGE' ? '%' : '$'})
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0.01"
                    placeholder={type === 'PERCENTAGE' ? '20' : '50'}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-white outline-none focus:border-brand-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Min Order Subtotal ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="100.00"
                    value={minOrderValue}
                    onChange={(e) => setMinOrderValue(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-white outline-none focus:border-brand-500 transition"
                  />
                </div>

                {type === 'PERCENTAGE' && (
                  <div>
                    <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Max Cap Discount ($) (Optional)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="150"
                      value={maxDiscount}
                      onChange={(e) => setMaxDiscount(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-855 rounded-lg px-3 py-2 text-white outline-none focus:border-brand-500 transition"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">User Usage Limit</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="1"
                    value={userUsageLimit}
                    onChange={(e) => setUserUsageLimit(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-855 rounded-lg px-3 py-2 text-white outline-none focus:border-brand-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Global Limit (Redemptions)</label>
                  <input
                    type="number"
                    placeholder="1000"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-white outline-none focus:border-brand-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Category Restriction</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-white outline-none focus:border-brand-500 transition"
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Starts At (Date/Time)</label>
                  <input
                    type="datetime-local"
                    required
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-855 rounded-lg px-3 py-2 text-white outline-none focus:border-brand-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Expires At (Date/Time)</label>
                  <input
                    type="datetime-local"
                    required
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-855 rounded-lg px-3 py-2 text-white outline-none focus:border-brand-500 transition"
                  />
                </div>

                <div className="col-span-2 border-t border-gray-850 pt-4 space-y-4">
                  <h4 className="text-3xs font-extrabold uppercase tracking-wider text-indigo-400">
                    Referral Settings (Optional)
                  </h4>
                  
                  <div>
                    <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Referrer User Email</label>
                    <input
                      type="email"
                      placeholder="referrer@domain.com"
                      value={referrerEmail}
                      onChange={(e) => setReferrerEmail(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-white placeholder-gray-700 outline-none focus:border-brand-500 transition"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isFirstOrderOnly"
                      checked={isFirstOrderOnly}
                      onChange={(e) => setIsFirstOrderOnly(e.target.checked)}
                      className="rounded border-gray-850 bg-gray-950"
                    />
                    <label htmlFor="isFirstOrderOnly" className="text-3xs text-gray-400 font-semibold uppercase">
                      Restrict to first-time customer orders only
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-850 text-white font-bold rounded-xl text-xs transition uppercase tracking-wider shadow shadow-brand-600/15"
                >
                  {formLoading ? 'Registering...' : 'Register Code'}
                </button>
              </div>
            </form>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <div className="space-y-4">
              {analytics.length === 0 ? (
                <div className="glass-card p-12 text-center text-xs text-gray-500 italic rounded-2xl border border-gray-800">
                  No redemption logs processed on platform.
                </div>
              ) : (
                <div className="glass-card rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-900/40 border-b border-gray-800 text-3xs font-extrabold uppercase tracking-wider text-gray-500">
                          <th className="p-4">Coupon Details</th>
                          <th className="p-4">Redemptions</th>
                          <th className="p-4">Category / Referrer</th>
                          <th className="p-4">Total Discount Given</th>
                          <th className="p-4 text-right">Revenue Generated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {analytics.map((a) => (
                          <tr key={a.id} className="hover:bg-gray-900/10">
                            <td className="p-4">
                              <span className="block font-bold text-white font-mono">{a.code}</span>
                              <span className="block text-4xs text-gray-500 uppercase font-mono">
                                {a.type === 'PERCENTAGE' ? `${a.value}% percentage` : `$${a.value} flat`}
                              </span>
                            </td>
                            <td className="p-4 font-mono font-semibold text-gray-300">
                              {a.ordersCount} checkouts
                            </td>
                            <td className="p-4 text-gray-400">
                              <span className="block text-3xs">{a.categoryName}</span>
                              {a.referrerName && (
                                <span className="block text-4xs text-indigo-400 font-mono">Ref: {a.referrerName}</span>
                              )}
                            </td>
                            <td className="p-4 font-bold text-red-400 font-mono">
                              -${a.totalDiscount.toFixed(2)}
                            </td>
                            <td className="p-4 text-right font-bold text-green-400 font-mono">
                              +${a.totalRevenue.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
