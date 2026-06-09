'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePrice: string;
  images: string[];
  category: {
    name: string;
    slug: string;
  };
  variants: {
    id: string;
    name: string;
    stock: number;
    attributes: any;
  }[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  children?: Category[];
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [colorFilter, setColorFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/products/categories');
      const data = await res.json();
      if (res.ok && data.success) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  // Fetch wishlist ids for signed in user
  const fetchWishlist = async () => {
    try {
      const res = await apiFetch('/wishlist');
      const data = await res.json();
      if (res.ok && data.success) {
        setWishlistIds(data.data.map((p: any) => p.id));
      }
    } catch (err) {
      // Ignore if unauthenticated
    }
  };

  // Fetch products
  const fetchProducts = async () => {
    setLoading(true);
    try {
      let query = `?page=${currentPage}&limit=6&sortBy=${sortBy}`;
      if (search) query += `&search=${encodeURIComponent(search)}`;
      if (selectedCategory) query += `&categoryId=${selectedCategory}`;
      if (colorFilter) query += `&color=${colorFilter}`;
      if (sizeFilter) query += `&size=${sizeFilter}`;

      const res = await apiFetch(`/products${query}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setProducts(data.data.products);
        setTotalPages(data.data.pagination.pages);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchWishlist();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, sortBy, currentPage, colorFilter, sizeFilter]);

  const toggleWishlist = async (productId: string) => {
    try {
      const isFav = wishlistIds.includes(productId);
      if (isFav) {
        const res = await apiFetch(`/wishlist/${productId}`, { method: 'DELETE' });
        if (res.ok) {
          setWishlistIds(wishlistIds.filter((id) => id !== productId));
        }
      } else {
        const res = await apiFetch('/wishlist', {
          method: 'POST',
          body: JSON.stringify({ productId }),
        });
        if (res.ok) {
          setWishlistIds([...wishlistIds, productId]);
        }
      }
    } catch (err) {
      alert('Authentication required to modify wishlist.');
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Navbar */}
      <header className="glass-card sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <Link href="/" className="font-extrabold text-2xl tracking-wider text-gradient font-outfit">
          ALPHASTRYK
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/products" className="text-sm font-semibold text-brand-400 hover:text-brand-350 transition">
            Store Catalog
          </Link>
          <Link href="/wishlist" className="text-sm font-medium hover:text-brand-500 transition">
            Wishlist ({wishlistIds.length})
          </Link>
          <Link href="/login" className="text-xs font-semibold px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition border border-gray-700">
            Account Portal
          </Link>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Filters */}
        <aside className="w-full md:w-64 space-y-6 flex-shrink-0">
          <div className="glass-card p-5 rounded-2xl space-y-6">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Catalog Search</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Jersey, gear..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                />
                <button
                  onClick={fetchProducts}
                  className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-lg text-xs font-bold"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Categories */}
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Categories</h2>
              <div className="space-y-2 text-xs">
                <button
                  onClick={() => { setSelectedCategory(''); setCurrentPage(1); }}
                  className={`block w-full text-left py-1 hover:text-brand-400 font-medium ${!selectedCategory ? 'text-brand-400' : 'text-gray-400'}`}
                >
                  All Products
                </button>
                {categories.map((cat) => (
                  <div key={cat.id} className="space-y-1 pl-2">
                    <button
                      onClick={() => { setSelectedCategory(cat.id); setCurrentPage(1); }}
                      className={`block w-full text-left py-1 hover:text-brand-400 font-semibold ${selectedCategory === cat.id ? 'text-brand-400' : 'text-gray-300'}`}
                    >
                      {cat.name}
                    </button>
                    {cat.children && cat.children.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => { setSelectedCategory(sub.id); setCurrentPage(1); }}
                        className={`block w-full text-left py-0.5 pl-3 hover:text-brand-400 ${selectedCategory === sub.id ? 'text-brand-400' : 'text-gray-400'}`}
                      >
                        — {sub.name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Sizes & Colors filter mock */}
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Filter Attributes</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-2xs text-gray-500 uppercase font-semibold mb-1">Color</label>
                  <select
                    value={colorFilter}
                    onChange={(e) => { setColorFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-white"
                  >
                    <option value="">All Colors</option>
                    <option value="red">Red</option>
                    <option value="blue">Blue</option>
                    <option value="black">Black</option>
                  </select>
                </div>
                <div>
                  <label className="block text-2xs text-gray-500 uppercase font-semibold mb-1">Size</label>
                  <select
                    value={sizeFilter}
                    onChange={(e) => { setSizeFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-white"
                  >
                    <option value="">All Sizes</option>
                    <option value="S">Small (S)</option>
                    <option value="M">Medium (M)</option>
                    <option value="L">Large (L)</option>
                    <option value="XL">Extra Large (XL)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Product Catalog view */}
        <main className="flex-1 space-y-6">
          <div className="flex justify-between items-center bg-gray-900/10 p-3 rounded-xl border border-gray-800/20">
            <span className="text-xs text-gray-400">Showing {products.length} products</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white font-medium"
            >
              <option value="newest">Sort By: Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="glass-card h-80 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-gray-400">
              No matching products found. Check other filter selections.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => {
                const isFavorite = wishlistIds.includes(product.id);
                return (
                  <div key={product.id} className="glass-card glass-card-hover rounded-2xl overflow-hidden flex flex-col group relative">
                    
                    {/* Wishlist toggle */}
                    <button
                      onClick={() => toggleWishlist(product.id)}
                      className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-gray-950/80 hover:bg-gray-900 flex items-center justify-center border border-gray-800 text-sm transition"
                    >
                      {isFavorite ? '❤️' : '🤍'}
                    </button>

                    {/* Image */}
                    <div className="h-44 w-full bg-gray-950 flex items-center justify-center border-b border-gray-800 relative overflow-hidden">
                      <img
                        src={product.images[0] || 'https://res.cloudinary.com/demo/image/upload/sample.jpg'}
                        alt={product.name}
                        className="object-contain h-full w-full p-4 group-hover:scale-105 transition duration-300"
                      />
                    </div>

                    {/* Product Metadata */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <span className="text-3xs text-brand-400 font-extrabold uppercase tracking-wider block mb-1">
                          {product.category.name}
                        </span>
                        <Link href={`/products/${product.slug}`} className="hover:underline">
                          <h4 className="font-bold text-sm text-white line-clamp-1 mb-2">{product.name}</h4>
                        </Link>
                        <p className="text-2xs text-gray-400 line-clamp-2 leading-relaxed mb-4">
                          {product.description}
                        </p>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <span className="text-base font-extrabold text-white font-outfit">
                          ${parseFloat(product.basePrice).toFixed(2)}
                        </span>
                        <Link
                          href={`/products/${product.slug}`}
                          className="text-2xs bg-brand-600 hover:bg-brand-700 text-white font-bold px-3 py-2 rounded-lg transition"
                        >
                          View Options
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination buttons */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-3 pt-6">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="px-4 py-2 bg-gray-950 border border-gray-800 text-xs font-semibold rounded-lg hover:bg-gray-900 transition disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-gray-400 flex items-center px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="px-4 py-2 bg-gray-950 border border-gray-800 text-xs font-semibold rounded-lg hover:bg-gray-900 transition disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
