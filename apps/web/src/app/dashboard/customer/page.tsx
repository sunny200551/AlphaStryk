'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import InvoiceConsole from '../../../components/InvoiceConsole';

export default function CustomerDashboard() {
  const { user, loading, logout } = useAuth(['CUSTOMER']);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Dashboard Header */}
      <header className="glass-card sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <span className="font-extrabold text-2xl tracking-wider text-gradient font-outfit">ALPHASTRYK</span>
        <button
          onClick={logout}
          className="text-xs font-semibold px-4 py-2 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition"
        >
          Logout
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Welcome Banner */}
        <div className="glass-card p-8 rounded-3xl relative overflow-hidden border border-brand-500/10 shadow-lg shadow-brand-500/5">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -z-10"></div>
          
          <span className="bg-brand-500/10 text-brand-400 text-2xs font-extrabold tracking-wider px-2.5 py-1 rounded-md border border-brand-500/20 uppercase">
            Customer Dashboard
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold font-outfit mt-4 mb-2">
            Welcome back, {user?.name || 'Athlete'}!
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-xl leading-relaxed">
            Ready to design your custom kit? Check out our 3D uniform customized canvas tools in the next phases.
          </p>
        </div>

        {/* User Card & Features Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Details */}
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Account Information</h3>
            <div className="space-y-3">
              <div>
                <span className="block text-2xs text-gray-500">EMAIL ADDRESS</span>
                <span className="text-sm font-semibold text-white">{user?.email}</span>
              </div>
              <div>
                <span className="block text-2xs text-gray-500">ASSIGNED ROLE</span>
                <span className="inline-block bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-2xs px-2 py-0.5 rounded font-bold mt-1">
                  {user?.role}
                </span>
              </div>
            </div>
          </div>

          {/* Design custom designs placeholder */}
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">My Custom 3D Designs</h3>
            <div className="border border-dashed border-gray-800 rounded-xl p-8 text-center flex flex-col items-center justify-center">
              <span className="text-2xl mb-2">🎨</span>
              <p className="text-sm font-semibold text-gray-300">No designs yet</p>
              <p className="text-2xs text-gray-500 max-w-xs mt-1">
                Phase 5 (3D Canvas Designer) will enable design saving.
              </p>
            </div>
          </div>

          {/* Orders summary redirect */}
          <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Purchase History</h3>
              <p className="text-sm font-semibold text-gray-300">Track Uniform Orders</p>
              <p className="text-2xs text-gray-500 mt-1 leading-relaxed">
                Review your current order status, shipment tracking updates, and download transaction invoices.
              </p>
            </div>
            <Link
              href="/orders/history"
              className="w-full inline-block text-center py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-2xs transition mt-4"
            >
              View Order History
            </Link>
          </div>
        </div>

        {/* Billing & Tax Invoices Area */}
        <div className="glass-card p-6 rounded-3xl border border-brand-500/5">
          <h2 className="text-lg font-bold font-outfit mb-4">Tax Invoices & Billing History</h2>
          <InvoiceConsole />
        </div>
      </main>
    </div>
  );
}
