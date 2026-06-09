'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

interface TrackingUpdate {
  id: string;
  status: string;
  location: string;
  details: string;
  createdAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  payableAmount: string;
  carrier: string | null;
  trackingNumber: string | null;
  estimatedDelivery: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  customer: {
    name: string | null;
    email: string;
  };
  trackingUpdates: TrackingUpdate[];
}

export default function AdminShippingConsole() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'queue' | 'active' | 'history'>('queue');

  // Shipment Trigger States
  const [carrierMap, setCarrierMap] = useState<Record<string, 'SHIPROCKET' | 'DELHIVERY' | 'BLUEDART' | 'CUSTOM'>>({});
  const [customAwbMap, setCustomAwbMap] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Checkpoint Drawer States
  const [selectedOrderForCheckpoint, setSelectedOrderForCheckpoint] = useState<Order | null>(null);
  const [checkpointStatus, setCheckpointStatus] = useState('IN_TRANSIT');
  const [checkpointLocation, setCheckpointLocation] = useState('');
  const [checkpointDetails, setCheckpointDetails] = useState('');

  // Checkpoint History View Modal
  const [selectedOrderForHistory, setSelectedOrderForHistory] = useState<Order | null>(null);

  const fetchFulfillments = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/shipping/admin/fulfillments');
      const data = await res.json();
      if (res.ok && data.success) {
        setOrders(data.fulfillments);
      } else {
        setError(data.message || 'Failed to retrieve shipping pipelines.');
      }
    } catch (err) {
      setError('Connection failed. Shipping service offline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFulfillments();
  }, []);

  const handleShipOrder = async (orderId: string) => {
    const carrier = carrierMap[orderId] || 'SHIPROCKET';
    const trackingNumber = customAwbMap[orderId] || '';

    setActionLoading((prev) => ({ ...prev, [orderId]: true }));
    setError('');
    setSuccess('');

    try {
      const res = await apiFetch('/shipping/admin/fulfill', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          carrier,
          trackingNumber,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(`Successfully dispatched Order via ${carrier}. AWB: ${data.order.trackingNumber}`);
        fetchFulfillments();
      } else {
        setError(data.message || 'Fulfillment request failed.');
      }
    } catch (err) {
      setError('Network failure dispatching shipment.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const handleAddCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForCheckpoint) return;

    setError('');
    setSuccess('');

    try {
      const res = await apiFetch('/shipping/admin/checkpoint', {
        method: 'POST',
        body: JSON.stringify({
          orderId: selectedOrderForCheckpoint.id,
          status: checkpointStatus,
          location: checkpointLocation,
          details: checkpointDetails,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(`Checkpoint successfully added for order #${selectedOrderForCheckpoint.orderNumber}`);
        setSelectedOrderForCheckpoint(null);
        setCheckpointLocation('');
        setCheckpointDetails('');
        fetchFulfillments();
      } else {
        setError(data.message || 'Checkpoint generation failed.');
      }
    } catch (err) {
      setError('Checkpoint connection failure.');
    }
  };

  // Categorize orders
  const queueOrders = orders.filter((o) => ['PAID', 'CONFIRMED', 'PROCESSING'].includes(o.status));
  const activeShipments = orders.filter((o) => o.status === 'SHIPPED');
  const deliveryHistory = orders.filter((o) => o.status === 'DELIVERED');

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg font-semibold animate-pulse">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-4 py-3 rounded-lg font-semibold">
          ✓ {success}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-3">
        <button
          onClick={() => setActiveTab('queue')}
          className={`py-2 px-4 rounded-lg text-xs font-bold transition flex items-center gap-2 border ${
            activeTab === 'queue'
              ? 'border-brand-500/30 bg-brand-500/5 text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Fulfillment Queue
          <span className="px-1.5 py-0.5 rounded text-4xs bg-brand-500/20 text-brand-300 font-extrabold font-mono">
            {queueOrders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('active')}
          className={`py-2 px-4 rounded-lg text-xs font-bold transition flex items-center gap-2 border ${
            activeTab === 'active'
              ? 'border-brand-500/30 bg-brand-500/5 text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Active Shipments
          <span className="px-1.5 py-0.5 rounded text-4xs bg-indigo-500/20 text-indigo-300 font-extrabold font-mono">
            {activeShipments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-2 px-4 rounded-lg text-xs font-bold transition flex items-center gap-2 border ${
            activeTab === 'history'
              ? 'border-brand-500/30 bg-brand-500/5 text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Delivery History
          <span className="px-1.5 py-0.5 rounded text-4xs bg-green-500/20 text-green-300 font-extrabold font-mono">
            {deliveryHistory.length}
          </span>
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="p-12 text-center text-xs text-gray-400 font-semibold">
          Syncing delivery pipelines...
        </div>
      ) : (
        <>
          {/* QUEUE TAB */}
          {activeTab === 'queue' && (
            <div className="space-y-4">
              {queueOrders.length === 0 ? (
                <div className="glass-card p-12 text-center text-xs text-gray-500 italic rounded-2xl border border-gray-800">
                  No orders awaiting carrier dispatch.
                </div>
              ) : (
                <div className="glass-card rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-900/40 border-b border-gray-800 text-3xs font-extrabold uppercase tracking-wider text-gray-500">
                          <th className="p-4">Order Details</th>
                          <th className="p-4">Customer Info</th>
                          <th className="p-4">Amount</th>
                          <th className="p-4">Carrier Integration</th>
                          <th className="p-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {queueOrders.map((ord) => {
                          const carrier = carrierMap[ord.id] || 'SHIPROCKET';
                          const isActionLoading = actionLoading[ord.id] || false;

                          return (
                            <tr key={ord.id} className="hover:bg-gray-900/10">
                              <td className="p-4">
                                <span className="block font-bold text-white font-mono">#{ord.orderNumber}</span>
                                <span className="block text-4xs text-gray-500">
                                  {new Date(ord.createdAt).toLocaleString()}
                                </span>
                              </td>
                              <td className="p-4">
                                <span className="block text-gray-300 font-semibold">{ord.customer.name || 'Valued User'}</span>
                                <span className="block text-4xs text-gray-500 font-mono">{ord.customer.email}</span>
                              </td>
                              <td className="p-4 font-bold text-white">${parseFloat(ord.payableAmount).toFixed(2)}</td>
                              <td className="p-4 space-y-2">
                                <select
                                  value={carrier}
                                  onChange={(e) =>
                                    setCarrierMap((prev) => ({
                                      ...prev,
                                      [ord.id]: e.target.value as any,
                                    }))
                                  }
                                  className="bg-gray-950 border border-gray-850 rounded-lg px-2.5 py-1 text-2xs text-white outline-none focus:border-brand-500 transition"
                                >
                                  <option value="SHIPROCKET">Shiprocket Aggregator</option>
                                  <option value="DELHIVERY">Delhivery Express</option>
                                  <option value="BLUEDART">Blue Dart Waybill</option>
                                  <option value="CUSTOM">Manual Custom/Awb</option>
                                </select>

                                {carrier === 'CUSTOM' && (
                                  <input
                                    type="text"
                                    placeholder="Enter Tracking AWB"
                                    value={customAwbMap[ord.id] || ''}
                                    onChange={(e) =>
                                      setCustomAwbMap((prev) => ({
                                        ...prev,
                                        [ord.id]: e.target.value,
                                      }))
                                    }
                                    className="block bg-gray-950 border border-gray-850 rounded-lg px-2.5 py-1 text-2xs text-white placeholder-gray-600 font-mono outline-none focus:border-brand-500 w-full max-w-[180px]"
                                  />
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => handleShipOrder(ord.id)}
                                  disabled={isActionLoading || (carrier === 'CUSTOM' && !customAwbMap[ord.id])}
                                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold rounded-xl text-3xs uppercase tracking-wide transition shadow shadow-brand-600/15"
                                >
                                  {isActionLoading ? 'Manifesting...' : 'Fulfill & Ship'}
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

          {/* ACTIVE TAB */}
          {activeTab === 'active' && (
            <div className="space-y-4">
              {activeShipments.length === 0 ? (
                <div className="glass-card p-12 text-center text-xs text-gray-500 italic rounded-2xl border border-gray-800">
                  No active carrier dispatches on road.
                </div>
              ) : (
                <div className="glass-card rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-900/40 border-b border-gray-800 text-3xs font-extrabold uppercase tracking-wider text-gray-500">
                          <th className="p-4">Order & AWB</th>
                          <th className="p-4">Carrier info</th>
                          <th className="p-4">Latest Log</th>
                          <th className="p-4">ETD</th>
                          <th className="p-4 text-right font-semibold">Workflow controls</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {activeShipments.map((ord) => {
                          const latestLog = ord.trackingUpdates[0];

                          return (
                            <tr key={ord.id} className="hover:bg-gray-900/10">
                              <td className="p-4">
                                <span className="block font-bold text-white font-mono">#{ord.orderNumber}</span>
                                <span className="block text-4xs text-brand-300 font-mono">AWB: {ord.trackingNumber}</span>
                              </td>
                              <td className="p-4">
                                <span className="px-2 py-0.5 rounded text-4xs font-bold border bg-indigo-500/10 border-indigo-500/20 text-indigo-400 font-mono">
                                  {ord.carrier}
                                </span>
                              </td>
                              <td className="p-4 max-w-[200px] truncate">
                                {latestLog ? (
                                  <div>
                                    <span className="block font-bold text-white text-3xs uppercase tracking-wide">
                                      {latestLog.status.replace(/_/g, ' ')}
                                    </span>
                                    <span className="block text-4xs text-gray-500">
                                      {latestLog.location} - {latestLog.details}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-500 italic">No checkpoints recorded</span>
                                )}
                              </td>
                              <td className="p-4 text-gray-300 font-semibold">
                                {ord.estimatedDelivery
                                  ? new Date(ord.estimatedDelivery).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                                  : 'N/A'}
                              </td>
                              <td className="p-4 text-right space-x-2">
                                <button
                                  onClick={() => setSelectedOrderForHistory(ord)}
                                  className="px-3 py-1.5 bg-gray-900 hover:bg-gray-850 text-gray-400 border border-gray-850 rounded-lg text-3xs font-semibold uppercase tracking-wider transition"
                                >
                                  Logs
                                </button>
                                <button
                                  onClick={() => setSelectedOrderForCheckpoint(ord)}
                                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-3xs uppercase tracking-wider transition"
                                >
                                  + Update Status
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

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {deliveryHistory.length === 0 ? (
                <div className="glass-card p-12 text-center text-xs text-gray-500 italic rounded-2xl border border-gray-800">
                  No deliveries accomplished yet.
                </div>
              ) : (
                <div className="glass-card rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-900/40 border-b border-gray-800 text-3xs font-extrabold uppercase tracking-wider text-gray-500">
                          <th className="p-4">Order Details</th>
                          <th className="p-4">Carrier & AWB</th>
                          <th className="p-4">Delivered At</th>
                          <th className="p-4 text-right">Logs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {deliveryHistory.map((ord) => (
                          <tr key={ord.id} className="hover:bg-gray-900/10">
                            <td className="p-4">
                              <span className="block font-bold text-white font-mono">#{ord.orderNumber}</span>
                              <span className="block text-4xs text-gray-500">By {ord.customer.name || 'Valued User'}</span>
                            </td>
                            <td className="p-4">
                              <span className="block text-gray-300 font-mono text-3xs">{ord.carrier}</span>
                              <span className="block text-4xs text-gray-500 font-mono">AWB: {ord.trackingNumber}</span>
                            </td>
                            <td className="p-4 font-bold text-green-400">
                              {ord.deliveredAt ? new Date(ord.deliveredAt).toLocaleString() : 'N/A'}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => setSelectedOrderForHistory(ord)}
                                className="px-3 py-1.5 bg-gray-900 hover:bg-gray-850 text-gray-400 border border-gray-850 rounded-lg text-3xs font-semibold uppercase tracking-wider transition"
                              >
                                View Logs
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
          )}
        </>
      )}

      {/* CHECKPOINT UPDATE DRAWERS/MODALS */}
      {selectedOrderForCheckpoint && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddCheckpoint}
            className="glass-card max-w-md w-full rounded-2xl border border-brand-500/30 p-6 space-y-6 shadow-2xl relative"
          >
            <div className="border-b border-gray-800 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400 font-outfit">
                  Record Tracking Checkpoint
                </h3>
                <span className="text-4xs text-gray-400 font-mono">
                  Order: #{selectedOrderForCheckpoint.orderNumber} | AWB: {selectedOrderForCheckpoint.trackingNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForCheckpoint(null)}
                className="text-gray-500 hover:text-white font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Status Event</label>
                <select
                  value={checkpointStatus}
                  onChange={(e) => setCheckpointStatus(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-brand-500 transition"
                >
                  <option value="IN_TRANSIT">IN TRANSIT</option>
                  <option value="OUT_FOR_DELIVERY">OUT FOR DELIVERY</option>
                  <option value="DELIVERED">DELIVERED (Fulfillment Completed)</option>
                  <option value="FAILED_ATTEMPT">FAILED ATTEMPT / UNREACHABLE</option>
                  <option value="RETURNED">RETURNED TO ORIGIN (RTO)</option>
                </select>
              </div>

              <div>
                <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Location City/Hub</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mumbai Hub, Delhi Sorting Center"
                  value={checkpointLocation}
                  onChange={(e) => setCheckpointLocation(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-white outline-none focus:border-brand-500 transition placeholder-gray-600"
                />
              </div>

              <div>
                <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Detailed Logs/Remarks</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Shipment sorted and dispatched to local distribution delivery network."
                  value={checkpointDetails}
                  onChange={(e) => setCheckpointDetails(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-white outline-none focus:border-brand-500 transition placeholder-gray-600"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition uppercase tracking-wider"
              >
                Log Checkpoint
              </button>
              <button
                type="button"
                onClick={() => setSelectedOrderForCheckpoint(null)}
                className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-850 text-gray-400 border border-gray-800 rounded-xl text-xs transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DETAILED CHECKPOINT LOGS VIEW MODAL */}
      {selectedOrderForHistory && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl border border-gray-800 p-6 space-y-6 shadow-2xl relative">
            <div className="border-b border-gray-800 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400 font-outfit">
                  Detailed Checkpoint History
                </h3>
                <span className="text-4xs text-gray-400 font-mono">
                  Order: #{selectedOrderForHistory.orderNumber} | Carrier: {selectedOrderForHistory.carrier}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForHistory(null)}
                className="text-gray-500 hover:text-white font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-800/80 pr-2">
              {selectedOrderForHistory.trackingUpdates && selectedOrderForHistory.trackingUpdates.length > 0 ? (
                selectedOrderForHistory.trackingUpdates.map((update, index) => {
                  const isCurrent = index === 0;
                  return (
                    <div key={update.id} className="flex gap-4 relative items-start pl-1">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center z-10 shrink-0 border ${
                        isCurrent
                          ? 'bg-brand-600 border-brand-500 text-white shadow-lg'
                          : 'bg-gray-950 border-gray-850 text-gray-500'
                      }`}>
                        <div className={`w-1 h-1 rounded-full ${isCurrent ? 'bg-white' : 'bg-gray-600'}`} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className={`text-3xs font-extrabold tracking-wide uppercase ${isCurrent ? 'text-brand-400' : 'text-gray-300'}`}>
                            {update.status.replace(/_/g, ' ')}
                          </span>
                          <span className="text-4xs text-gray-500 font-mono">
                            {new Date(update.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <span className="block text-3xs text-gray-400 font-semibold">{update.location}</span>
                        <p className="text-4xs text-gray-500">{update.details}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="pl-6 text-2xs text-gray-500 italic text-center py-4">
                  No milestones captured yet.
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-gray-850">
              <button
                type="button"
                onClick={() => setSelectedOrderForHistory(null)}
                className="w-full py-2 bg-gray-900 hover:bg-gray-850 text-gray-400 border border-gray-800 rounded-xl text-2xs transition font-semibold"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
