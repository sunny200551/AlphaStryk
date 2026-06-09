'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

interface TimelineData {
  label: string;
  value: number;
}

interface CategoryBreakdown {
  category: string;
  revenue: number;
}

interface StatusBreakdown {
  status: string;
  count: number;
}

interface TopCustomer {
  id: string;
  name: string;
  email: string;
  totalSpend: number;
  ordersCount: number;
}

interface LowStockItem {
  id: string;
  sku: string;
  name: string;
  stock: number;
}

interface CouponMetric {
  code: string;
  count: number;
  totalDiscount: number;
  revenueGenerated: number;
}

export default function AdminAnalyticsConsole() {
  const [timeRange, setTimeRange] = useState('30'); // 7, 30, 90 days
  const [activeTab, setActiveTab] = useState<'kpis' | 'revenue' | 'customers' | 'inventory' | 'coupons'>('kpis');

  // Datasets
  const [widgets, setWidgets] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<{ revenueTimeline: TimelineData[]; categoryBreakdown: CategoryBreakdown[] } | null>(null);
  const [orderData, setOrderData] = useState<{ statusBreakdown: StatusBreakdown[]; orderTimeline: TimelineData[] } | null>(null);
  const [customerData, setCustomerData] = useState<{ registrationTimeline: TimelineData[]; topCustomers: TopCustomer[] } | null>(null);
  const [inventoryData, setInventoryData] = useState<{ totalValuation: number; lowStockItems: LowStockItem[]; categoryDistribution: any[] } | null>(null);
  const [couponData, setCouponData] = useState<CouponMetric[]>([]);
  const [refundData, setRefundData] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);

  const calculateDateRange = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - parseInt(timeRange));
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  };

  const fetchAllAnalytics = async () => {
    setLoading(true);
    setError('');
    const { startDate, endDate } = calculateDateRange();
    const params = `?startDate=${startDate}&endDate=${endDate}`;

    try {
      // 1. Fetch dashboard widgets
      const widgetsRes = await apiFetch(`/analytics/dashboard${params}`);
      const widgetsJson = await widgetsRes.json();

      // 2. Fetch revenue data
      const revRes = await apiFetch(`/analytics/revenue${params}`);
      const revJson = await revRes.json();

      // 3. Fetch orders data
      const orderRes = await apiFetch(`/analytics/orders${params}`);
      const orderJson = await orderRes.json();

      // 4. Fetch customers data
      const custRes = await apiFetch(`/analytics/customers${params}`);
      const custJson = await custRes.json();

      // 5. Fetch inventory
      const invRes = await apiFetch('/analytics/inventory');
      const invJson = await invRes.json();

      // 6. Fetch coupons
      const coupRes = await apiFetch(`/analytics/coupons${params}`);
      const coupJson = await coupRes.json();

      // 7. Fetch refunds
      const refRes = await apiFetch(`/analytics/refunds${params}`);
      const refJson = await refRes.json();

      if (widgetsRes.ok && revRes.ok && orderRes.ok && custRes.ok && invRes.ok && coupRes.ok && refRes.ok) {
        setWidgets(widgetsJson.data);
        setRevenueData(revJson.data);
        setOrderData(orderJson.data);
        setCustomerData(custJson.data);
        setInventoryData(invJson.data);
        setCouponData(coupJson.data);
        setRefundData(refJson.data);
      } else {
        setError('Failed to fetch platform metrics.');
      }
    } catch (err) {
      setError('Connection failure updating dashboard charts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAnalytics();
  }, [timeRange]);

  const handleExportCSV = async (type: 'revenue' | 'orders' | 'customers' | 'inventory') => {
    setExporting(type);
    try {
      const res = await apiFetch(`/analytics/export/${type}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_${type}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to construct CSV worksheet export.');
      }
    } catch (err) {
      alert('Network failure triggering data export.');
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-gray-400">Loading analytical metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-6 rounded-xl text-center">
        ⚠️ {error}
        <button onClick={fetchAllAnalytics} className="block mx-auto mt-3 bg-red-500/20 border border-red-500/40 px-3 py-1.5 rounded hover:bg-red-500/30 transition text-2xs font-semibold">
          Retry Sync
        </button>
      </div>
    );
  }

  // Pre-calculate line chart dimensions for SVGs
  const getLineChartPath = (timeline: TimelineData[], width: number, height: number) => {
    if (!timeline || timeline.length === 0) return '';
    const values = timeline.map((t) => t.value);
    const maxVal = Math.max(...values, 100);
    const minVal = Math.min(...values, 0);
    const range = maxVal - minVal;

    const points = timeline.map((t, index) => {
      const x = (index / (timeline.length - 1)) * width;
      const y = height - ((t.value - minVal) / range) * height;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  return (
    <div className="space-y-6">
      {/* Date filter & exports menu */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-900 pb-4">
        <div className="flex gap-2">
          {['7', '30', '90'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3.5 py-1.5 rounded-lg text-3xs font-bold uppercase tracking-wider transition ${
                timeRange === range
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-900 border border-gray-850 text-gray-400 hover:text-white'
              }`}
            >
              Last {range} Days
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 text-3xs font-bold uppercase tracking-wider">
          <button
            onClick={() => handleExportCSV('revenue')}
            disabled={!!exporting}
            className="px-3 py-1.5 bg-gray-900 hover:bg-gray-850 text-indigo-400 border border-indigo-500/20 rounded-lg transition disabled:opacity-50"
          >
            {exporting === 'revenue' ? 'Exporting...' : 'Export Revenue'}
          </button>
          <button
            onClick={() => handleExportCSV('orders')}
            disabled={!!exporting}
            className="px-3 py-1.5 bg-gray-900 hover:bg-gray-850 text-emerald-400 border border-emerald-500/20 rounded-lg transition disabled:opacity-50"
          >
            {exporting === 'orders' ? 'Exporting...' : 'Export Orders'}
          </button>
          <button
            onClick={() => handleExportCSV('customers')}
            disabled={!!exporting}
            className="px-3 py-1.5 bg-gray-900 hover:bg-gray-850 text-cyan-400 border border-cyan-500/20 rounded-lg transition disabled:opacity-50"
          >
            {exporting === 'customers' ? 'Exporting...' : 'Export Users'}
          </button>
          <button
            onClick={() => handleExportCSV('inventory')}
            disabled={!!exporting}
            className="px-3 py-1.5 bg-gray-900 hover:bg-gray-850 text-orange-400 border border-orange-500/20 rounded-lg transition disabled:opacity-50"
          >
            {exporting === 'inventory' ? 'Exporting...' : 'Export Stock'}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-850/60 hover:border-brand-500/20 transition duration-300">
          <span className="block text-4xs text-gray-500 font-bold uppercase tracking-wider mb-1">Total Revenue</span>
          <span className="text-lg font-black text-gradient font-outfit">${widgets?.totalRevenue?.toFixed(2)}</span>
          <span className="block text-5xs text-gray-600 mt-2 font-mono">Gross Payable Sales</span>
        </div>
        <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-850/60 hover:border-emerald-500/20 transition duration-300">
          <span className="block text-4xs text-gray-500 font-bold uppercase tracking-wider mb-1">Total Orders</span>
          <span className="text-lg font-black text-emerald-400 font-outfit">{widgets?.totalOrders}</span>
          <span className="block text-5xs text-gray-600 mt-2 font-mono">Volume Count</span>
        </div>
        <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-850/60 hover:border-indigo-500/20 transition duration-300">
          <span className="block text-4xs text-gray-500 font-bold uppercase tracking-wider mb-1">Avg Order Value</span>
          <span className="text-lg font-black text-indigo-400 font-outfit">${widgets?.aov?.toFixed(2)}</span>
          <span className="block text-5xs text-gray-600 mt-2 font-mono">Basket Value KPI</span>
        </div>
        <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-850/60 hover:border-cyan-500/20 transition duration-300">
          <span className="block text-4xs text-gray-500 font-bold uppercase tracking-wider mb-1">Unique Buyers</span>
          <span className="text-lg font-black text-cyan-400 font-outfit">{widgets?.uniqueCustomers}</span>
          <span className="block text-5xs text-gray-600 mt-2 font-mono">Active Shoppers</span>
        </div>
        <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-850/60 hover:border-orange-500/20 transition duration-300">
          <span className="block text-4xs text-gray-500 font-bold uppercase tracking-wider mb-1">Low Stock SKUs</span>
          <span className={`text-lg font-black font-outfit ${widgets?.lowStockCount > 0 ? 'text-orange-400' : 'text-gray-400'}`}>
            {widgets?.lowStockCount}
          </span>
          <span className="block text-5xs text-gray-600 mt-2 font-mono">Stock Warnings</span>
        </div>
        <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-850/60 hover:border-brand-500/20 transition duration-300">
          <span className="block text-4xs text-gray-500 font-bold uppercase tracking-wider mb-1">Active Coupons</span>
          <span className="text-lg font-black text-brand-400 font-outfit">{widgets?.activeCouponsCount}</span>
          <span className="block text-5xs text-gray-600 mt-2 font-mono">Promotional Codes</span>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 border-b border-gray-900/60 pb-px">
        {([
          { id: 'kpis', name: 'General Overview' },
          { id: 'revenue', name: 'Revenue & Sales' },
          { id: 'customers', name: 'Customer LTV' },
          { id: 'inventory', name: 'Inventory & Alerts' },
          { id: 'coupons', name: 'Coupons Usage' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-2xs font-bold uppercase tracking-widest border-b-2 transition duration-300 ${
              activeTab === tab.id
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        {/* KPI & Order overview panel */}
        {activeTab === 'kpis' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SVG Order Timeline Chart */}
            <div className="lg:col-span-2 glass-card p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Order Volume Timeline</h4>
                <span className="text-3xs text-gray-500">Timeline trends from last {timeRange} days</span>
              </div>
              <div className="h-48 w-full mt-4 relative">
                {orderData && orderData.orderTimeline.length > 1 ? (
                  <svg className="w-full h-full" viewBox="0 0 500 120" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={`${getLineChartPath(orderData.orderTimeline, 500, 100)} L 500,120 L 0,120 Z`}
                      fill="url(#orderGrad)"
                    />
                    <path
                      d={getLineChartPath(orderData.orderTimeline, 500, 100)}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.2"
                    />
                  </svg>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-gray-500">Not enough timeline data.</div>
                )}
              </div>
              <div className="flex justify-between text-5xs text-gray-600 font-mono mt-2 pt-2 border-t border-gray-900">
                <span>{calculateDateRange().startDate}</span>
                <span>{calculateDateRange().endDate}</span>
              </div>
            </div>

            {/* Orders Status Share */}
            <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Status Breakdown</h4>
                <span className="text-3xs text-gray-500">Orders state distributions</span>
              </div>
              <div className="space-y-3 mt-4">
                {orderData?.statusBreakdown && orderData.statusBreakdown.length > 0 ? (
                  orderData.statusBreakdown.map((s) => (
                    <div key={s.status} className="space-y-1">
                      <div className="flex justify-between text-4xs font-bold uppercase text-gray-400">
                        <span>{s.status}</span>
                        <span>{s.count} orders</span>
                      </div>
                      <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min((s.count / (widgets?.totalOrders || 1)) * 100, 100)}%` }}
                          className={`h-full rounded-full ${
                            s.status === 'DELIVERED'
                              ? 'bg-green-500'
                              : s.status === 'CANCELLED'
                              ? 'bg-red-500'
                              : s.status === 'SHIPPED'
                              ? 'bg-blue-500'
                              : 'bg-brand-500'
                          }`}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-xs text-gray-500 py-8">No status data available.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Revenue specific analytics */}
        {activeTab === 'revenue' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Trend */}
            <div className="lg:col-span-2 glass-card p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Gross Revenue Stream</h4>
                <span className="text-3xs text-gray-500">Sales value curve</span>
              </div>
              <div className="h-48 w-full mt-4 relative">
                {revenueData && revenueData.revenueTimeline.length > 1 ? (
                  <svg className="w-full h-full" viewBox="0 0 500 120" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={`${getLineChartPath(revenueData.revenueTimeline, 500, 100)} L 500,120 L 0,120 Z`}
                      fill="url(#revGrad)"
                    />
                    <path
                      d={getLineChartPath(revenueData.revenueTimeline, 500, 100)}
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="2.2"
                    />
                  </svg>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-gray-500">Not enough revenue data.</div>
                )}
              </div>
              <div className="flex justify-between text-5xs text-gray-600 font-mono mt-2 pt-2 border-t border-gray-900">
                <span>{calculateDateRange().startDate}</span>
                <span>{calculateDateRange().endDate}</span>
              </div>
            </div>

            {/* Category share */}
            <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Revenue by Category</h4>
                <span className="text-3xs text-gray-500">Total volume share</span>
              </div>
              <div className="space-y-4 mt-4">
                {revenueData?.categoryBreakdown && revenueData.categoryBreakdown.length > 0 ? (
                  revenueData.categoryBreakdown.map((c) => (
                    <div key={c.category} className="space-y-1">
                      <div className="flex justify-between text-4xs font-bold text-gray-400 uppercase">
                        <span>{c.category}</span>
                        <span>${c.revenue.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min((c.revenue / (widgets?.totalRevenue || 1)) * 100, 100)}%`,
                          }}
                          className="h-full bg-indigo-500 rounded-full"
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-xs text-gray-500 py-8">No categories sales found.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Customer Cohort LTV */}
        {activeTab === 'customers' && (
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Top Spend Customers</h4>
              <p className="text-3xs text-gray-500 mt-1">Platform customer lifetime value (CLV) bands</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-900/40 border-b border-gray-850 text-2xs text-gray-500 font-bold uppercase">
                    <th className="p-3">Customer</th>
                    <th className="p-3">Email</th>
                    <th className="p-3 text-center">Orders Count</th>
                    <th className="p-3 text-right">Lifetime Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40 text-gray-300">
                  {customerData?.topCustomers && customerData.topCustomers.length > 0 ? (
                    customerData.topCustomers.map((cust) => (
                      <tr key={cust.id} className="hover:bg-gray-900/10 transition">
                        <td className="p-3 font-semibold text-white">{cust.name}</td>
                        <td className="p-3 font-mono text-gray-450">{cust.email}</td>
                        <td className="p-3 text-center font-bold text-gray-400">{cust.ordersCount}</td>
                        <td className="p-3 text-right font-bold text-gradient font-outfit">${cust.totalSpend.toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-gray-500">No customer spend histories.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Inventory low stock alert list */}
        {activeTab === 'inventory' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-card p-6 rounded-2xl space-y-4">
              <div>
                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-widest">Low Stock SKU Monitor</h4>
                <p className="text-3xs text-gray-500 mt-1">Items currently below the threshold of 10 units</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-900/40 border-b border-gray-850 text-2xs text-gray-500 font-bold uppercase">
                      <th className="p-3">SKU</th>
                      <th className="p-3">Product Item</th>
                      <th className="p-3 text-center">Remaining Stock</th>
                      <th className="p-3 text-right">Fulfillment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40 text-gray-300">
                    {inventoryData?.lowStockItems && inventoryData.lowStockItems.length > 0 ? (
                      inventoryData.lowStockItems.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-900/10 transition">
                          <td className="p-3 font-mono font-semibold text-gray-400">{item.sku}</td>
                          <td className="p-3 text-white">{item.name}</td>
                          <td className="p-3 text-center font-bold text-orange-400 bg-orange-500/5">{item.stock}</td>
                          <td className="p-3 text-right">
                            <span className="inline-block bg-orange-500/10 border border-orange-500/20 text-orange-400 text-3xs font-extrabold px-1.5 py-0.5 rounded uppercase">
                              Restock Required
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-green-400 font-semibold">
                          🎉 All product stocks are healthy! No low stock warnings.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inventory Valuation card */}
            <div className="glass-card p-6 rounded-2xl space-y-4 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Inventory Valuation</h4>
                <p className="text-3xs text-gray-500 mt-1">Total capital bound in warehouses</p>
              </div>
              <div className="bg-gray-950/40 p-6 rounded-xl border border-gray-850/60 text-center">
                <span className="block text-4xs text-gray-500 font-bold uppercase tracking-wider mb-2">
                  Total Asset Value
                </span>
                <span className="text-3xl font-black text-gradient font-outfit">
                  ${inventoryData?.totalValuation?.toFixed(2) || '0.00'}
                </span>
                <span className="block text-5xs text-gray-600 mt-2 font-mono">
                  Sum of (Variant Price * Variant Stock)
                </span>
              </div>
              <div className="text-4xs text-gray-500 leading-relaxed text-center">
                Review this valuation to allocate budget offsets and manage category allocations for active uniforms.
              </div>
            </div>
          </div>
        )}

        {/* Coupons performance metrics */}
        {activeTab === 'coupons' && (
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Coupon Conversion & ROI</h4>
              <p className="text-3xs text-gray-500 mt-1">Performance tracking for promotional codes and referral marketing</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-900/40 border-b border-gray-850 text-2xs text-gray-500 font-bold uppercase">
                    <th className="p-3">Coupon Code</th>
                    <th className="p-3 text-center">Usages</th>
                    <th className="p-3 text-right">Discount Applied</th>
                    <th className="p-3 text-right">Revenue Earned</th>
                    <th className="p-3 text-right">Net ROI Yield</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40 text-gray-300">
                  {couponData && couponData.length > 0 ? (
                    couponData.map((c) => {
                      const yieldVal = c.revenueGenerated - c.totalDiscount;
                      return (
                        <tr key={c.code} className="hover:bg-gray-900/10 transition">
                          <td className="p-3 font-mono font-bold text-brand-400">{c.code}</td>
                          <td className="p-3 text-center font-semibold text-gray-400">{c.count}</td>
                          <td className="p-3 text-right text-red-400">-${c.totalDiscount.toFixed(2)}</td>
                          <td className="p-3 text-right text-green-400">${c.revenueGenerated.toFixed(2)}</td>
                          <td className={`p-3 text-right font-bold font-outfit ${yieldVal >= 0 ? 'text-gradient' : 'text-red-500'}`}>
                            ${yieldVal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-gray-500">No coupon usage histories.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
