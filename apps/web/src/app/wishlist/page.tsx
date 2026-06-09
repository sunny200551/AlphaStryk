'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../lib/api';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePrice: string;
  images: string[];
}

export default function WishlistPage() {
  const { user, loading } = useAuth([]); // Allow any signed in user
  
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWishlist = async () => {
    setWishlistLoading(true);
    setError('');
    try {
      const res = await apiFetch('/wishlist');
      const data = await res.json();
      if (res.ok && data.success) {
        setWishlist(data.data);
      } else {
        setError(data.message || 'Failed to fetch wishlist.');
      }
    } catch (err) {
      setError('Connection failure.');
    } finally {
      setWishlistLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchWishlist();
    }
  }, [user]);

  const handleRemove = async (productId: string) => {
    try {
      const res = await apiFetch(`/wishlist/${productId}`, { method: 'DELETE' });
      if (res.ok) {
        setWishlist(wishlist.filter((p) => p.id !== productId));
      } else {
        alert('Failed to remove item.');
      }
    } catch (err) {
      alert('Connection error.');
    }
  };

  if (loading || wishlistLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

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
          <Link href="/wishlist" className="text-sm font-semibold text-brand-400 hover:text-brand-350 transition">
            Wishlist
          </Link>
        </div>
      </header>

      {/* Content Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold font-outfit">My Saved Wishlist</h1>
          <p className="text-xs text-gray-400">Manage your bookmarked athletic uniforms and gear</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {wishlist.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center text-gray-400 space-y-4">
            <span className="text-4xl block">🤍</span>
            <h3 className="font-bold text-white text-base">Your Wishlist is empty</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Explore our premium sports collections and tap the heart icon to save products here.
            </p>
            <div className="pt-2">
              <Link href="/products" className="inline-block py-2.5 px-6 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition text-xs">
                Browse Store Catalog
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {wishlist.map((product) => (
              <div key={product.id} className="glass-card rounded-2xl overflow-hidden flex flex-col justify-between group relative">
                
                {/* Remove button */}
                <button
                  onClick={() => handleRemove(product.id)}
                  className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center text-xs transition"
                  title="Remove from wishlist"
                >
                  ✕
                </button>

                {/* Thumbnail */}
                <div className="h-40 w-full bg-gray-950 flex items-center justify-center border-b border-gray-800">
                  <img
                    src={product.images[0] || 'https://res.cloudinary.com/demo/image/upload/sample.jpg'}
                    alt={product.name}
                    className="object-contain max-h-36 p-4"
                  />
                </div>

                {/* Details */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <Link href={`/products/${product.slug}`} className="hover:underline">
                      <h4 className="font-bold text-sm text-white line-clamp-1 mb-2">{product.name}</h4>
                    </Link>
                    <p className="text-2xs text-gray-400 line-clamp-2 leading-relaxed mb-4">
                      {product.description}
                    </p>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm font-extrabold text-white font-outfit">
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
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
