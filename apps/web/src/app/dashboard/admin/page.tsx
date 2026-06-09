'use client';

import React from 'react';
import { useAuth } from '../../../hooks/useAuth';
import AdminProductConsole from '../../../components/AdminProductConsole';
import AdminOrderConsole from '../../../components/AdminOrderConsole';
import AdminPaymentConsole from '../../../components/AdminPaymentConsole';
import AdminInvoiceConsole from '../../../components/AdminInvoiceConsole';
import AdminShippingConsole from '../../../components/AdminShippingConsole';
import AdminCouponConsole from '../../../components/AdminCouponConsole';
import AdminDesignConsole from '../../../components/AdminDesignConsole';
import AdminAnalyticsConsole from '../../../components/AdminAnalyticsConsole';




export default function AdminDashboard() {
  const { user, loading, logout } = useAuth(['ADMIN', 'SUPER_ADMIN']);

  if (loading) {
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
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-2xl tracking-wider text-gradient font-outfit">ALPHASTRYK</span>
          <span className="bg-red-500/10 text-red-400 text-3xs font-extrabold tracking-wider px-1.5 py-0.5 rounded border border-red-500/20 uppercase">
            Admin Portal
          </span>
        </div>
        <button
          onClick={logout}
          className="text-xs font-semibold px-4 py-2 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition"
        >
          Logout
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Welcome */}
        <div className="glass-card p-8 rounded-3xl relative overflow-hidden border border-brand-500/10 shadow-lg shadow-brand-500/5">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -z-10"></div>
          
          <span className="bg-indigo-500/10 text-indigo-400 text-2xs font-extrabold tracking-wider px-2.5 py-1 rounded-md border border-indigo-500/20 uppercase">
            Administrative Controller
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold font-outfit mt-4 mb-2">
            Admin Console: {user?.name || 'Administrator'}
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-xl leading-relaxed">
            Manage product inventories, configure categories, process order logs, and analyze sales.
          </p>
        </div>

        {/* Dashboard Panels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Admin Details */}
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Credentials Details</h3>
            <div className="space-y-3">
              <div>
                <span className="block text-2xs text-gray-500">EMAIL ADDRESS</span>
                <span className="text-sm font-semibold text-white">{user?.email}</span>
              </div>
              <div>
                <span className="block text-2xs text-gray-500">USER LEVEL</span>
                <span className="inline-block bg-brand-500/10 border border-brand-500/20 text-brand-400 text-2xs px-2 py-0.5 rounded font-bold mt-1">
                  {user?.role}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="glass-card p-6 rounded-2xl md:col-span-2 grid grid-cols-2 gap-4">
            <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-800/80">
              <span className="block text-2xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Active Catalog</span>
              <span className="text-2xl font-bold text-white">Active</span>
              <span className="block text-3xs text-gray-400 mt-2">Product categories & variants configured</span>
            </div>
            <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-800/80">
              <span className="block text-2xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Customer Orders</span>
              <span className="text-2xl font-bold text-white">Active</span>
              <span className="block text-3xs text-gray-400 mt-2">Checkouts and shipping statuses active</span>
            </div>
          </div>
        </div>

        {/* Analytics Console Area */}
        <div className="glass-card p-6 rounded-3xl border border-brand-500/5">
          <h2 className="text-lg font-bold font-outfit mb-4">Platform Growth & Business Analytics</h2>
          <AdminAnalyticsConsole />
        </div>

        {/* Product Console Area */}
        <div className="glass-card p-6 rounded-3xl border border-brand-500/5">
          <h2 className="text-lg font-bold font-outfit mb-4">Store Inventory Controls</h2>
          <AdminProductConsole />
        </div>

        {/* Order Console Area */}
        <div className="glass-card p-6 rounded-3xl border border-brand-500/5">
          <h2 className="text-lg font-bold font-outfit mb-4">Customer Order Logs & Workflows</h2>
          <AdminOrderConsole />
        </div>

        {/* Payment Console Area */}
        <div className="glass-card p-6 rounded-3xl border border-brand-500/5">
          <h2 className="text-lg font-bold font-outfit mb-4">Payment Transactions & Gateway Audits</h2>
          <AdminPaymentConsole />
        </div>

        {/* GST Invoice Console Area */}
        <div className="glass-card p-6 rounded-3xl border border-brand-500/5">
          <h2 className="text-lg font-bold font-outfit mb-4">GST Tax Invoices & Sales Audits</h2>
          <AdminInvoiceConsole />
        </div>

        {/* Shipping Fulfillment Console Area */}
        <div className="glass-card p-6 rounded-3xl border border-brand-500/5">
          <h2 className="text-lg font-bold font-outfit mb-4">Carrier Integrations & Shipping Fulfillments</h2>
          <AdminShippingConsole />
        </div>

        {/* Coupon Console Area */}
        <div className="glass-card p-6 rounded-3xl border border-brand-500/5">
          <h2 className="text-lg font-bold font-outfit mb-4">Promotional Coupon Codes & Analytics</h2>
          <AdminCouponConsole />
        </div>

        {/* Custom 3D Designs Console Area */}
        <div className="glass-card p-6 rounded-3xl border border-brand-500/5">
          <h2 className="text-lg font-bold font-outfit mb-4">Customer Custom 3D Uniform Designs</h2>
          <AdminDesignConsole />
        </div>



      </main>
    </div>
  );
}
