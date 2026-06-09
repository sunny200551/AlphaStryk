'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

interface Design {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  createdAt: string;
  user: {
    name: string | null;
    email: string;
  };
  variant: {
    name: string;
    sku: string;
    product: {
      name: string;
    };
  };
  designData: {
    color?: string;
    decalUrl?: string | null;
    placement?: string;
    posX?: number;
    posY?: number;
    scale?: number;
    rotation?: number;
  };
}

export default function AdminDesignConsole() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDesigns = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/designs/admin/all');
      const data = await res.json();
      if (res.ok && data.success) {
        setDesigns(data.designs);
      } else {
        setError(data.message || 'Failed to query design entries.');
      }
    } catch (err) {
      setError('Connection failure loading custom designs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesigns();
  }, []);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg font-semibold animate-pulse">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-gray-400 font-semibold">
          Syncing customized prints registry...
        </div>
      ) : designs.length === 0 ? (
        <div className="glass-card p-8 text-center text-xs text-gray-500 italic rounded-2xl border border-gray-800">
          No custom 3D design configurations placed yet.
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden border border-gray-800 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-900/40 border-b border-gray-800 text-3xs font-extrabold uppercase tracking-wider text-gray-500">
                  <th className="p-4">Design details</th>
                  <th className="p-4">Client user</th>
                  <th className="p-4">Base variant</th>
                  <th className="p-4">Fabric color</th>
                  <th className="p-4">Coordinates map</th>
                  <th className="p-4 text-right">Graphic files</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {designs.map((d) => {
                  const data = d.designData;
                  return (
                    <tr key={d.id} className="hover:bg-gray-900/10">
                      <td className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-gray-950 flex items-center justify-center overflow-hidden border border-gray-800 shrink-0">
                          {d.thumbnailUrl ? (
                            <img
                              src={d.thumbnailUrl}
                              alt="Design preview"
                              className="object-contain max-h-8 max-w-[32px]"
                            />
                          ) : (
                            <span className="text-3xs text-gray-600 font-bold">3D</span>
                          )}
                        </div>
                        <div>
                          <span className="block font-bold text-white">{d.name}</span>
                          <span className="block text-4xs text-gray-500 font-mono">
                            ID: {d.id} | {new Date(d.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="block text-gray-300 font-semibold">{d.user.name || 'Valued User'}</span>
                        <span className="block text-4xs text-gray-500 font-mono">{d.user.email}</span>
                      </td>
                      <td className="p-4 text-gray-400 font-semibold">
                        <span className="block text-white">{d.variant.product.name}</span>
                        <span className="block text-4xs text-gray-500 font-mono">
                          SKU: {d.variant.sku} | Style: {d.variant.name}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {data.color && (
                            <>
                              <div
                                className="w-3.5 h-3.5 rounded-full border border-gray-700"
                                style={{ backgroundColor: data.color }}
                              />
                              <span className="font-mono text-3xs text-gray-300 uppercase font-bold">
                                {data.color}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-gray-400">
                        {data.decalUrl ? (
                          <div className="space-y-0.5 text-3xs font-mono">
                            <span className="block">Placement: {data.placement || 'front'}</span>
                            <span className="block">
                              Translate: [{data.posX?.toFixed(2)}, {data.posY?.toFixed(2)}]
                            </span>
                            <span className="block">
                              Scale: {data.scale?.toFixed(2)} | Rot: {data.rotation}°
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500 italic">No custom decal</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {data.decalUrl ? (
                          <a
                            href={data.decalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-3xs uppercase tracking-wider transition shadow shadow-brand-600/15"
                          >
                            Download Graphic
                          </a>
                        ) : (
                          <span className="text-4xs text-gray-500 font-bold uppercase">Standard Mesh Only</span>
                        )}
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
