'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

interface Variant {
  id?: string;
  name: string;
  sku: string;
  priceOffset: number;
  stock: number;
  attributes: {
    color?: string;
    size?: string;
    [key: string]: any;
  };
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePrice: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  images: string[];
  category: {
    name: string;
  };
  variants: Variant[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

interface LowStockAlert {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  stock: number;
}

export default function AdminProductConsole() {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'categories' | 'alerts'>('list');
  
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms State - Product
  const [prodName, setProdName] = useState('');
  const [prodSlug, setProdSlug] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState(0.00);
  const [prodCatId, setProdCatId] = useState('');
  const [prodStatus, setProdStatus] = useState<'DRAFT' | 'ACTIVE'>('DRAFT');
  const [prodImages, setProdImages] = useState<string[]>([]);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Variant Builder List
  const [variants, setVariants] = useState<Variant[]>([]);
  const [varName, setVarName] = useState('');
  const [varSku, setVarSku] = useState('');
  const [varPriceOffset, setVarPriceOffset] = useState(0.00);
  const [varStock, setVarStock] = useState(0);
  const [varColor, setVarColor] = useState('');
  const [varSize, setVarSize] = useState('');

  // Category Form State
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catParentId, setCatParentId] = useState('');

  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const prodRes = await apiFetch('/products/admin/all');
      const prodData = await prodRes.json();
      
      const catRes = await apiFetch('/products/categories');
      const catData = await catRes.json();

      const alertRes = await apiFetch('/products/admin/low-stock');
      const alertData = await alertRes.json();

      if (prodRes.ok) setProducts(prodData.data);
      if (catRes.ok) {
        // Flatten categories and subcategories
        const list: Category[] = [];
        catData.data.forEach((c: any) => {
          list.push({ id: c.id, name: c.name, slug: c.slug, parentId: null });
          if (c.children) {
            c.children.forEach((sub: any) => {
              list.push({ id: sub.id, name: `└ ${sub.name}`, slug: sub.slug, parentId: c.id });
            });
          }
        });
        setCategories(list);
      }
      if (alertRes.ok) setAlerts(alertData.data);
    } catch (err) {
      console.error('Failed to load admin console data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Handle image upload to Cloudinary
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setFormError('');
    setFormSuccess('');

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('http://localhost:5000/api/v1/products/admin/upload', {
        method: 'POST',
        body: formData,
        headers: {
          // Send cookies for authentication
        },
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setProdImages([...prodImages, data.data.url]);
        setFormSuccess('Image uploaded successfully.');
      } else {
        setFormError(data.message || 'Image upload failed.');
      }
    } catch (err) {
      setFormError('Connection error to upload service.');
    } finally {
      setIsUploading(false);
    }
  };

  const addVariant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!varSku || !varName) {
      alert('SKU and Variant Name are required.');
      return;
    }
    const newVar: Variant = {
      name: varName,
      sku: varSku,
      priceOffset: varPriceOffset,
      stock: varStock,
      attributes: {
        color: varColor || undefined,
        size: varSize || undefined,
      },
    };
    setVariants([...variants, newVar]);
    // Reset variant builder form inputs
    setVarName('');
    setVarSku('');
    setVarPriceOffset(0);
    setVarStock(0);
    setVarColor('');
    setVarSize('');
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!prodName || !prodSlug || !prodCatId || prodPrice <= 0) {
      setFormError('Please fill in name, slug, category, and base price.');
      return;
    }

    try {
      const res = await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: prodName,
          slug: prodSlug,
          description: prodDesc,
          basePrice: prodPrice,
          categoryId: prodCatId,
          status: prodStatus,
          images: prodImages,
          metaTitle,
          metaDesc,
          variants,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFormSuccess('Product created successfully!');
        // Reset form
        setProdName('');
        setProdSlug('');
        setProdDesc('');
        setProdPrice(0);
        setProdCatId('');
        setProdImages([]);
        setMetaTitle('');
        setMetaDesc('');
        setVariants([]);
        setActiveTab('list');
      } else {
        setFormError(data.message || 'Failed to create product.');
      }
    } catch (err) {
      setFormError('Failed to establish API connection.');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!catName || !catSlug) {
      setFormError('Category name and slug are required.');
      return;
    }

    try {
      const res = await apiFetch('/products/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: catName,
          slug: catSlug,
          description: catDesc,
          parentId: catParentId || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFormSuccess(`Category "${catName}" created successfully.`);
        setCatName('');
        setCatSlug('');
        setCatDesc('');
        setCatParentId('');
        fetchData();
      } else {
        setFormError(data.message || 'Failed to create category.');
      }
    } catch (err) {
      setFormError('Failed to establish API connection.');
    }
  };

  const handleArchiveProduct = async (id: string) => {
    if (!confirm('Are you sure you want to archive this product?')) return;
    try {
      const res = await apiFetch(`/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts(products.filter((p) => p.id !== id));
      } else {
        alert('Failed to archive product.');
      }
    } catch (err) {
      alert('Connection error.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation tabs */}
      <div className="flex border-b border-gray-800 text-xs">
        <button
          onClick={() => { setActiveTab('list'); setFormError(''); setFormSuccess(''); }}
          className={`px-4 py-3 font-semibold transition border-b-2 ${activeTab === 'list' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400'}`}
        >
          All Products ({products.length})
        </button>
        <button
          onClick={() => { setActiveTab('create'); setFormError(''); setFormSuccess(''); }}
          className={`px-4 py-3 font-semibold transition border-b-2 ${activeTab === 'create' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400'}`}
        >
          Add Product
        </button>
        <button
          onClick={() => { setActiveTab('categories'); setFormError(''); setFormSuccess(''); }}
          className={`px-4 py-3 font-semibold transition border-b-2 ${activeTab === 'categories' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400'}`}
        >
          Add Categories
        </button>
        <button
          onClick={() => { setActiveTab('alerts'); setFormError(''); setFormSuccess(''); }}
          className={`px-4 py-3 font-semibold transition border-b-2 ${activeTab === 'alerts' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400'} flex items-center gap-1.5`}
        >
          Low Stock Alerts
          {alerts.length > 0 && (
            <span className="bg-orange-500 text-white font-bold rounded-full w-4 h-4 flex items-center justify-center text-3xs">
              {alerts.length}
            </span>
          )}
        </button>
      </div>

      {formError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg">
          {formError}
        </div>
      )}

      {formSuccess && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-4 py-3 rounded-lg">
          {formSuccess}
        </div>
      )}

      {/* Loading state */}
      {loading && activeTab !== 'create' && activeTab !== 'categories' ? (
        <div className="p-8 text-center text-xs text-gray-400">Loading catalog records...</div>
      ) : (
        <>
          {/* TAB 1: Product list table */}
          {activeTab === 'list' && (
            <div className="glass-card rounded-2xl overflow-hidden border border-gray-800">
              {products.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">No products available. Add a product to get started.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-900/40 border-b border-gray-800 text-3xs font-bold uppercase tracking-wider text-gray-500">
                        <th className="p-4">Product</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Base Price</th>
                        <th className="p-4">Variants</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {products.map((p) => {
                        const totalStock = p.variants.reduce((acc, v) => acc + v.stock, 0);
                        return (
                          <tr key={p.id} className="hover:bg-gray-900/10">
                            <td className="p-4 flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-gray-950 flex items-center justify-center overflow-hidden">
                                <img src={p.images[0] || 'https://res.cloudinary.com/demo/image/upload/sample.jpg'} alt={p.name} className="object-contain max-h-7" />
                              </div>
                              <div>
                                <span className="block font-bold text-white">{p.name}</span>
                                <span className="block text-3xs text-gray-500 font-mono">{p.slug}</span>
                              </div>
                            </td>
                            <td className="p-4 text-gray-300 font-semibold">{p.category?.name || 'Unassigned'}</td>
                            <td className="p-4 font-bold text-white">${parseFloat(p.basePrice).toFixed(2)}</td>
                            <td className="p-4">
                              <span className="block text-gray-300">{p.variants.length} Variants</span>
                              <span className={`text-3xs font-semibold ${totalStock < 15 ? 'text-orange-400' : 'text-gray-500'}`}>
                                Total Stock: {totalStock}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`inline-block px-2 py-0.5 rounded text-3xs font-bold ${
                                p.status === 'ACTIVE'
                                  ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                                  : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleArchiveProduct(p.id)}
                                className="text-red-400 hover:text-red-350 font-bold ml-2"
                              >
                                Archive
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Create product form */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateProduct} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Form left */}
                <div className="glass-card p-6 rounded-2xl space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400 mb-2">Basic Info</h3>
                  <div>
                    <label className="block text-2xs text-gray-500 uppercase font-semibold mb-1">Product Name</label>
                    <input
                      type="text"
                      value={prodName}
                      onChange={(e) => {
                        setProdName(e.target.value);
                        setProdSlug(e.target.value.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''));
                      }}
                      placeholder="Pro Training Shorts"
                      required
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs text-gray-500 uppercase font-semibold mb-1">Slug URL</label>
                    <input
                      type="text"
                      value={prodSlug}
                      onChange={(e) => setProdSlug(e.target.value)}
                      placeholder="pro-training-shorts"
                      required
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs text-gray-500 uppercase font-semibold mb-1">Description</label>
                    <textarea
                      value={prodDesc}
                      onChange={(e) => setProdDesc(e.target.value)}
                      placeholder="Product descriptions details..."
                      rows={3}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-2xs text-gray-500 uppercase font-semibold mb-1">Base Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={prodPrice}
                        onChange={(e) => setProdPrice(parseFloat(e.target.value) || 0)}
                        required
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs text-gray-500 uppercase font-semibold mb-1">Category</label>
                      <select
                        value={prodCatId}
                        onChange={(e) => setProdCatId(e.target.value)}
                        required
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        <option value="">Select Category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-2xs text-gray-500 uppercase font-semibold mb-1">Status</label>
                      <select
                        value={prodStatus}
                        onChange={(e: any) => setProdStatus(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        <option value="DRAFT">Draft</option>
                        <option value="ACTIVE">Active / Published</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-2xs text-gray-500 uppercase font-semibold mb-1">Image Upload (Cloudinary)</label>
                      <input
                        type="file"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                        className="w-full text-3xs text-gray-400 bg-gray-950 border border-gray-800 rounded-lg file:bg-brand-600 file:border-none file:text-white file:font-semibold file:px-2 file:py-1 file:rounded file:mr-2 cursor-pointer"
                      />
                      {isUploading && <span className="text-3xs text-brand-400 block mt-1">Uploading asset to Cloudinary...</span>}
                    </div>
                  </div>

                  {/* Image previews */}
                  {prodImages.length > 0 && (
                    <div>
                      <span className="block text-3xs text-gray-500 font-semibold mb-2">Uploaded Images</span>
                      <div className="flex gap-2 overflow-x-auto py-1">
                        {prodImages.map((img, i) => (
                          <div key={i} className="w-12 h-12 rounded border border-gray-850 overflow-hidden relative flex-shrink-0 bg-black">
                            <img src={img} className="object-contain w-full h-full" />
                            <button
                              type="button"
                              onClick={() => setProdImages(prodImages.filter((_, idx) => idx !== i))}
                              className="absolute top-0 right-0 bg-red-600 text-white w-4 h-4 rounded-bl flex items-center justify-center text-3xs"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Right: Variant builder */}
                <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400 mb-2">Variant Builder</h3>
                    
                    {/* Inline Variant builder inputs */}
                    <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-800/80 grid grid-cols-2 gap-3 text-3xs">
                      <div className="col-span-2">
                        <label className="block text-3xs text-gray-500 uppercase font-bold mb-1">Variant Name</label>
                        <input
                          type="text"
                          value={varName}
                          onChange={(e) => setVarName(e.target.value)}
                          placeholder="Red / Medium"
                          className="w-full bg-gray-950 border border-gray-850 rounded px-2.5 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-3xs text-gray-500 uppercase font-bold mb-1">Variant SKU</label>
                        <input
                          type="text"
                          value={varSku}
                          onChange={(e) => setVarSku(e.target.value)}
                          placeholder="AS-TR-RED-M"
                          className="w-full bg-gray-950 border border-gray-850 rounded px-2.5 py-1.5 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-3xs text-gray-500 uppercase font-bold mb-1">Price Offset ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={varPriceOffset}
                          onChange={(e) => setVarPriceOffset(parseFloat(e.target.value) || 0)}
                          className="w-full bg-gray-950 border border-gray-850 rounded px-2.5 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-3xs text-gray-500 uppercase font-bold mb-1">Stock Quantity</label>
                        <input
                          type="number"
                          value={varStock}
                          onChange={(e) => setVarStock(parseInt(e.target.value) || 0)}
                          className="w-full bg-gray-950 border border-gray-850 rounded px-2.5 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-3xs text-gray-500 uppercase font-bold mb-1">Size Option</label>
                        <input
                          type="text"
                          value={varSize}
                          onChange={(e) => setVarSize(e.target.value)}
                          placeholder="M"
                          className="w-full bg-gray-950 border border-gray-850 rounded px-2.5 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-3xs text-gray-500 uppercase font-bold mb-1">Color Option</label>
                        <input
                          type="text"
                          value={varColor}
                          onChange={(e) => setVarColor(e.target.value)}
                          placeholder="Red"
                          className="w-full bg-gray-950 border border-gray-850 rounded px-2.5 py-1.5 text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addVariant}
                        className="col-span-2 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold rounded hover:bg-indigo-500/20 transition text-2xs uppercase mt-2"
                      >
                        Add Variant to List
                      </button>
                    </div>

                    {/* Added variants display */}
                    <div>
                      <span className="block text-3xs text-gray-500 font-semibold mb-2">Configured Variants ({variants.length})</span>
                      <div className="max-h-48 overflow-y-auto space-y-2 text-3xs">
                        {variants.map((v, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2.5 bg-gray-950/20 border border-gray-850 rounded-lg">
                            <div>
                              <span className="block font-bold text-white">{v.name}</span>
                              <span className="block font-mono text-gray-500">SKU: {v.sku} | Price Offset: +${v.priceOffset.toFixed(2)} | Stock: {v.stock}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeVariant(idx)}
                              className="text-red-400 hover:text-red-350 font-bold px-2"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition text-xs shadow-lg shadow-brand-600/20 mt-6"
                  >
                    Save & Create Product Catalog
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 3: Add categories form */}
          {activeTab === 'categories' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Category creation */}
              <form onSubmit={handleCreateCategory} className="glass-card p-6 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400 mb-2">New Category Form</h3>
                <div>
                  <label className="block text-2xs text-gray-500 uppercase font-semibold mb-1">Category Name</label>
                  <input
                    type="text"
                    value={catName}
                    onChange={(e) => {
                      setCatName(e.target.value);
                      setCatSlug(e.target.value.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''));
                    }}
                    placeholder="Shorts"
                    required
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-2xs text-gray-500 uppercase font-semibold mb-1">Slug URL</label>
                  <input
                    type="text"
                    value={catSlug}
                    onChange={(e) => setCatSlug(e.target.value)}
                    placeholder="shorts"
                    required
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-2xs text-gray-500 uppercase font-semibold mb-1">Description</label>
                  <textarea
                    value={catDesc}
                    onChange={(e) => setCatDesc(e.target.value)}
                    placeholder="Shorts description catalog details..."
                    rows={2}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-2xs text-gray-500 uppercase font-semibold mb-1">Parent Category (For Subcategory creation)</label>
                  <select
                    value={catParentId}
                    onChange={(e) => setCatParentId(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="">None (Is Root Category)</option>
                    {categories.filter(c => !c.parentId).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg transition text-xs shadow shadow-brand-600/20 mt-4"
                >
                  Create Category
                </button>
              </form>

              {/* View current Category Hierarchy */}
              <div className="glass-card p-6 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400 mb-2">Category Hierarchy</h3>
                <div className="max-h-96 overflow-y-auto space-y-2 text-xs divide-y divide-gray-850">
                  {categories.map((c) => (
                    <div key={c.id} className="py-2.5 flex justify-between font-mono">
                      <span className={c.parentId ? 'text-gray-400 pl-4' : 'text-white font-bold'}>{c.name}</span>
                      <span className="text-3xs text-gray-500">{c.slug}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Low stock alerts */}
          {activeTab === 'alerts' && (
            <div className="glass-card rounded-2xl overflow-hidden border border-gray-800">
              {alerts.length === 0 ? (
                <div className="p-12 text-center text-xs text-gray-400 space-y-2">
                  <span className="text-2xl">🎉</span>
                  <p className="font-semibold text-white">All variant inventories are in healthy status.</p>
                  <p className="text-3xs text-gray-500">Zero active products have variant stock levels under 10.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-900/40 border-b border-gray-800 text-3xs font-bold uppercase tracking-wider text-gray-500">
                        <th className="p-4">Product Name</th>
                        <th className="p-4">Variant Specifications</th>
                        <th className="p-4">SKU</th>
                        <th className="p-4">Remaining Inventory</th>
                        <th className="p-4 text-right">Status Alert</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {alerts.map((alert) => (
                        <tr key={alert.variantId} className="hover:bg-gray-900/10">
                          <td className="p-4 font-bold text-white">{alert.productName}</td>
                          <td className="p-4 text-gray-300 font-semibold">{alert.variantName}</td>
                          <td className="p-4 font-mono text-gray-400">{alert.sku}</td>
                          <td className="p-4 font-bold text-white">{alert.stock} left</td>
                          <td className="p-4 text-right">
                            <span className={`inline-block px-2.5 py-0.5 rounded font-bold text-3xs uppercase ${
                              alert.stock === 0
                                ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                                : 'bg-orange-500/10 border border-orange-500/20 text-orange-400'
                            }`}>
                              {alert.stock === 0 ? 'Out of Stock' : 'Low Inventory'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
