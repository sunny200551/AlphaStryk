'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: any;
  newValues: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor?: {
    email: string;
    name: string | null;
    role: string;
  } | null;
}

interface Pagination {
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export default function SuperAdminConsole() {
  const [activeSubTab, setActiveSubTab] = useState<'admins' | 'logs'>('admins');

  // Admins state
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [adminsError, setAdminsError] = useState('');

  // Promote/Create Form state
  const [promoteUserId, setPromoteUserId] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({ success: true, message: '' });

  // Logs state
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Logs filters
  const [filterPage, setFilterPage] = useState(1);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const fetchAdmins = async () => {
    setAdminsLoading(true);
    setAdminsError('');
    try {
      const res = await apiFetch('/analytics/admin/list');
      const data = await res.json();
      if (res.ok && data.success) {
        setAdmins(data.data);
      } else {
        setAdminsError(data.message || 'Failed to retrieve administrative records.');
      }
    } catch (err) {
      setAdminsError('Network error retrieving admins list.');
    } finally {
      setAdminsLoading(false);
    }
  };

  const fetchAuditLogs = async (pageIndex = 1) => {
    setLogsLoading(true);
    setLogsError('');
    let params = `?page=${pageIndex}&limit=10`;
    if (filterSearch) params += `&search=${encodeURIComponent(filterSearch)}`;
    if (filterAction) params += `&action=${encodeURIComponent(filterAction)}`;
    if (filterEntity) params += `&entityType=${encodeURIComponent(filterEntity)}`;
    if (filterStartDate) params += `&startDate=${filterStartDate}`;
    if (filterEndDate) params += `&endDate=${filterEndDate}`;

    try {
      const res = await apiFetch(`/analytics/audit-logs${params}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setLogs(data.data.logs);
        setPagination(data.data.pagination);
        setFilterPage(data.data.pagination.page);
      } else {
        setLogsError(data.message || 'Failed to retrieve system audit logs.');
      }
    } catch (err) {
      setLogsError('Network connection error retrieving audit logs.');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'admins') {
      fetchAdmins();
    } else {
      fetchAuditLogs(1);
    }
  }, [activeSubTab]);

  const handlePromoteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteUserId) return;
    setSubmitLoading(true);
    setSubmitStatus({ success: true, message: '' });

    try {
      const res = await apiFetch('/analytics/admin/promote', {
        method: 'POST',
        body: JSON.stringify({ userId: promoteUserId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitStatus({ success: true, message: data.message || 'User promoted successfully.' });
        setPromoteUserId('');
        fetchAdmins();
      } else {
        setSubmitStatus({ success: false, message: data.message || 'Failed to promote user.' });
      }
    } catch (err) {
      setSubmitStatus({ success: false, message: 'Connection failure promoting user.' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminPassword) return;
    setSubmitLoading(true);
    setSubmitStatus({ success: true, message: '' });

    try {
      const res = await apiFetch('/analytics/admin/create', {
        method: 'POST',
        body: JSON.stringify({
          email: newAdminEmail,
          password: newAdminPassword,
          name: newAdminName,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitStatus({ success: true, message: 'New administrative account registered successfully.' });
        setNewAdminEmail('');
        setNewAdminPassword('');
        setNewAdminName('');
        fetchAdmins();
      } else {
        setSubmitStatus({ success: false, message: data.message || 'Failed to register admin user.' });
      }
    } catch (err) {
      setSubmitStatus({ success: false, message: 'Connection failure registering admin user.' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDemoteAdmin = async (userId: string) => {
    if (!confirm('Are you sure you want to demote this user to a normal customer role?')) return;
    setAdminsLoading(true);
    try {
      const res = await apiFetch('/analytics/admin/demote', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message || 'User demoted successfully.');
        fetchAdmins();
      } else {
        alert(data.message || 'Failed to demote user.');
        setAdminsLoading(false);
      }
    } catch (err) {
      alert('Network failure demoting user.');
      setAdminsLoading(false);
    }
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAuditLogs(1);
  };

  const handleResetFilters = () => {
    setFilterSearch('');
    setFilterAction('');
    setFilterEntity('');
    setFilterStartDate('');
    setFilterEndDate('');
    setTimeout(() => {
      fetchAuditLogs(1);
    }, 50);
  };

  return (
    <div className="space-y-6">
      {/* Sub tabs switcher */}
      <div className="flex gap-4 border-b border-gray-900 pb-3">
        <button
          onClick={() => setActiveSubTab('admins')}
          className={`px-4 py-2 rounded-lg text-2xs font-bold uppercase tracking-wider transition ${
            activeSubTab === 'admins' ? 'bg-purple-650 text-white' : 'text-gray-400 hover:text-white bg-gray-900/50'
          }`}
        >
          Administrator Accounts
        </button>
        <button
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-2 rounded-lg text-2xs font-bold uppercase tracking-wider transition ${
            activeSubTab === 'logs' ? 'bg-purple-650 text-white' : 'text-gray-400 hover:text-white bg-gray-900/50'
          }`}
        >
          Advanced Audit Logs
        </button>
      </div>

      {activeSubTab === 'admins' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Admin Management console table */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Active Administrators</h3>
            {adminsError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-2.5 rounded-lg">
                {adminsError}
              </div>
            )}
            <div className="glass-card rounded-2xl overflow-hidden border border-gray-800/80">
              {adminsLoading ? (
                <div className="p-12 text-center text-xs text-gray-500">Loading admin credentials...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-900/40 border-b border-gray-850 text-2xs text-gray-500 font-bold uppercase">
                        <th className="p-3">Administrator</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Registered Date</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40 text-gray-300">
                      {admins.map((adm) => (
                        <tr key={adm.id} className="hover:bg-gray-900/10 transition">
                          <td className="p-3">
                            <span className="block font-semibold text-white">{adm.name || 'Admin User'}</span>
                            <span className="block text-2xs text-gray-500 font-mono">{adm.email}</span>
                          </td>
                          <td className="p-3">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-3xs font-extrabold uppercase border ${
                              adm.role === 'SUPER_ADMIN'
                                ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                                : 'bg-brand-500/10 border-brand-500/20 text-brand-400'
                            }`}>
                              {adm.role}
                            </span>
                          </td>
                          <td className="p-3 text-gray-400 font-mono">
                            {new Date(adm.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-right">
                            {adm.role !== 'SUPER_ADMIN' ? (
                              <button
                                onClick={() => handleDemoteAdmin(adm.id)}
                                className="px-2.5 py-1 text-3xs font-bold border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition"
                              >
                                Demote to User
                              </button>
                            ) : (
                              <span className="text-3xs text-gray-600 font-semibold uppercase italic">Root Restricted</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Promoting and Register Admin forms */}
          <div className="space-y-6">
            {/* Status alerts */}
            {submitStatus.message && (
              <div className={`p-3 rounded-lg text-xs border ${
                submitStatus.success
                  ? 'bg-green-500/10 border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {submitStatus.message}
              </div>
            )}

            {/* Promote Form */}
            <div className="glass-card p-5 rounded-2xl space-y-4">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Promote Customer</h4>
                <p className="text-4xs text-gray-500 mt-1">Upgrade user account role to Admin level</p>
              </div>
              <form onSubmit={handlePromoteAdmin} className="space-y-3">
                <input
                  type="text"
                  placeholder="Enter User ID"
                  required
                  value={promoteUserId}
                  onChange={(e) => setPromoteUserId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 text-xs px-3.5 py-2.5 rounded-lg text-white focus:outline-none focus:border-purple-550 transition font-mono"
                />
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="w-full py-2.5 bg-purple-650 hover:bg-purple-700 text-white font-bold rounded-lg text-3xs uppercase tracking-wider transition disabled:opacity-50"
                >
                  {submitLoading ? 'Updating role...' : 'Promote User to Admin'}
                </button>
              </form>
            </div>

            {/* Create Admin Form */}
            <div className="glass-card p-5 rounded-2xl space-y-4">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Direct Admin Creation</h4>
                <p className="text-4xs text-gray-500 mt-1">Register new administrative login directly</p>
              </div>
              <form onSubmit={handleCreateAdmin} className="space-y-3">
                <input
                  type="text"
                  placeholder="Admin Full Name (Optional)"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 text-xs px-3.5 py-2.5 rounded-lg text-white focus:outline-none focus:border-purple-550 transition"
                />
                <input
                  type="email"
                  placeholder="Admin Email Address"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 text-xs px-3.5 py-2.5 rounded-lg text-white focus:outline-none focus:border-purple-550 transition font-mono"
                />
                <input
                  type="password"
                  placeholder="Create Secure Password"
                  required
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 text-xs px-3.5 py-2.5 rounded-lg text-white focus:outline-none focus:border-purple-550 transition"
                />
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="w-full py-2.5 bg-purple-650 hover:bg-purple-700 text-white font-bold rounded-lg text-3xs uppercase tracking-wider transition disabled:opacity-50"
                >
                  {submitLoading ? 'Registering...' : 'Register Administrator'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'logs' && (
        <div className="space-y-4">
          {/* Query Filter panel */}
          <form onSubmit={handleApplyFilters} className="glass-card p-4 rounded-xl grid grid-cols-1 sm:grid-cols-5 gap-3 items-end text-3xs">
            <div className="space-y-1">
              <span className="block text-gray-500 font-bold uppercase tracking-wider">Actor Email</span>
              <input
                type="text"
                placeholder="Search actor email"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <span className="block text-gray-500 font-bold uppercase tracking-wider">Action Type</span>
              <input
                type="text"
                placeholder="E.g., PRODUCT_CREATE"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none font-mono"
              />
            </div>
            <div className="space-y-1">
              <span className="block text-gray-500 font-bold uppercase tracking-wider">Entity Model</span>
              <select
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="">All Models</option>
                <option value="User">User</option>
                <option value="Product">Product</option>
                <option value="Order">Order</option>
                <option value="Coupon">Coupon</option>
                <option value="Payment">Payment</option>
                <option value="Refund">Refund</option>
              </select>
            </div>
            <div className="space-y-1">
              <span className="block text-gray-500 font-bold uppercase tracking-wider">Start Date</span>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-white focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-1.5 bg-purple-650 hover:bg-purple-700 text-white font-bold rounded text-3xs uppercase tracking-wider transition"
              >
                Filter
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex-1 py-1.5 bg-gray-900 hover:bg-gray-850 text-gray-400 border border-gray-800 rounded text-3xs uppercase tracking-wider transition"
              >
                Reset
              </button>
            </div>
          </form>

          {/* Audit Logs Table */}
          {logsError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-2.5 rounded-lg">
              {logsError}
            </div>
          )}

          <div className="glass-card rounded-2xl overflow-hidden border border-gray-800/80 shadow-xl">
            {logsLoading ? (
              <div className="p-12 text-center text-xs text-gray-500">Loading audit events log...</div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-500">No matching audit logs found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-900/50 border-b border-gray-800 text-2xs text-gray-500 font-bold uppercase">
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Action</th>
                      <th className="p-4">Actor</th>
                      <th className="p-4">Resource Target</th>
                      <th className="p-4">IP Address</th>
                      <th className="p-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 text-gray-300">
                    {logs.map((log) => (
                      <React.Fragment key={log.id}>
                        <tr
                          className="hover:bg-gray-900/20 transition cursor-pointer"
                          onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                        >
                          <td className="p-4 text-gray-400 font-mono">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded font-bold text-3xs border uppercase ${
                              log.action.includes('FAILED') || log.action.includes('DEMOTE') || log.action.includes('DELETE')
                                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                : log.action.includes('VERIFIED') || log.action.includes('PROMOTE') || log.action.includes('SUCCESS') || log.action.includes('CREATE')
                                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                                : 'bg-brand-500/10 border-brand-500/20 text-brand-400'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="p-4">
                            <div>
                              <span className="block font-semibold text-white">{log.actor?.name || 'System Task'}</span>
                              <span className="block text-2xs text-gray-500 font-mono">{log.actor?.email || 'system@alphastryk.com'}</span>
                            </div>
                          </td>
                          <td className="p-4 font-mono text-gray-400 text-3xs">
                            {log.entityType} ({log.entityId ? `${log.entityId.slice(0, 8)}...` : 'N/A'})
                          </td>
                          <td className="p-4 text-gray-500 font-mono">{log.ipAddress || 'unknown'}</td>
                          <td className="p-4 text-right">
                            <button className="text-purple-400 hover:text-purple-350 font-semibold text-3xs">
                              {expandedLogId === log.id ? 'Collapse' : 'Expand'}
                            </button>
                          </td>
                        </tr>
                        {expandedLogId === log.id && (
                          <tr className="bg-gray-950/60">
                            <td colSpan={6} className="p-4 border-b border-gray-800">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-2xs font-mono">
                                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-850">
                                  <span className="block text-3xs text-gray-500 font-semibold uppercase tracking-wider mb-2">
                                    Original (Old State)
                                  </span>
                                  <pre className="text-gray-400 overflow-x-auto whitespace-pre-wrap">
                                    {log.oldValues ? JSON.stringify(log.oldValues, null, 2) : 'null'}
                                  </pre>
                                </div>
                                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-850">
                                  <span className="block text-3xs text-gray-500 font-semibold uppercase tracking-wider mb-2">
                                    Modified (New State)
                                  </span>
                                  <pre className="text-gray-400 overflow-x-auto whitespace-pre-wrap">
                                    {log.newValues ? JSON.stringify(log.newValues, null, 2) : 'null'}
                                  </pre>
                                </div>
                              </div>
                              <div className="mt-3 text-3xs text-gray-500 font-mono">
                                User Agent: {log.userAgent || 'None'}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {pagination && pagination.pages > 1 && (
            <div className="flex justify-between items-center text-3xs font-bold uppercase tracking-wider text-gray-500 pt-2">
              <span>Page {pagination.page} of {pagination.pages} ({pagination.total} total logs)</span>
              <div className="flex gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => fetchAuditLogs(pagination.page - 1)}
                  className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded hover:text-white transition disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => fetchAuditLogs(pagination.page + 1)}
                  className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded hover:text-white transition disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
