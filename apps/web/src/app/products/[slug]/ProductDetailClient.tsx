'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';

interface Variant {
  id: string;
  name: string;
  sku: string;
  priceOffset: string;
  stock: number;
  attributes: any;
  model3dUrl?: string | null;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePrice: string;
  images: string[];
  variants: Variant[];
}

export default function ProductDetailClient({
  slug,
  initialData,
}: {
  slug: string;
  initialData: any;
}) {
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(initialData?.product || null);
  const [recommended, setRecommended] = useState<Product[]>(initialData?.recommended || []);
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([]);

  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');

  // Selected variant options
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [activeVariant, setActiveVariant] = useState<Variant | null>(null);
  const [isWishlisted, setIsWishlisted] = useState(false);

  const fetchProductDetail = async () => {
    if (initialData) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/products/detail/${slug}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setProduct(data.data.product);
        setRecommended(data.data.recommended);
        
        const variants: Variant[] = data.data.product.variants;
        if (variants.length > 0) {
          const first = variants[0];
          setSelectedColor(first.attributes.color || '');
          setSelectedSize(first.attributes.size || '');
          setActiveVariant(first);
        }

        updateRecentlyViewed(data.data.product);
      } else {
        setError(data.message || 'Failed to retrieve product details.');
      }
    } catch (err) {
      setError('Connection failure.');
    } finally {
      setLoading(false);
    }
  };

  const updateRecentlyViewed = (prod: Product) => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('recentlyViewed');
      let list = stored ? JSON.parse(stored) : [];
      list = list.filter((p: any) => p.id !== prod.id);
      list.unshift({
        id: prod.id,
        name: prod.name,
        slug: prod.slug,
        basePrice: prod.basePrice,
        image: prod.images[0] || 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      });
      list = list.slice(0, 4);
      localStorage.setItem('recentlyViewed', JSON.stringify(list));
      setRecentlyViewed(list.filter((p: any) => p.id !== prod.id));
    } catch (err) {
      console.error('Recently viewed update failed:', err);
    }
  };

  const checkWishlistStatus = async (prodId: string) => {
    try {
      const res = await apiFetch('/wishlist');
      const data = await res.json();
      if (res.ok && data.success) {
        const isFav = data.data.some((p: any) => p.id === prodId);
        setIsWishlisted(isFav);
      }
    } catch (err) {
      // Ignore if unauthenticated
    }
  };

  const handleAddToCart = async () => {
    if (!activeVariant) return;
    try {
      const res = await apiFetch('/cart', {
        method: 'POST',
        body: JSON.stringify({
          productVariantId: activeVariant.id,
          quantity: 1,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push('/cart');
      } else {
        alert(data.message || 'Failed to add item to cart.');
      }
    } catch (err) {
      alert('Checkout network connection error.');
    }
  };

  const handleWishlistToggle = async () => {
    if (!product) return;
    try {
      if (isWishlisted) {
        const res = await apiFetch(`/wishlist/${product.id}`, { method: 'DELETE' });
        if (res.ok) setIsWishlisted(false);
      } else {
        const res = await apiFetch('/wishlist', {
          method: 'POST',
          body: JSON.stringify({ productId: product.id }),
        });
        if (res.ok) setIsWishlisted(true);
      }
    } catch (err) {
      alert('Please login to use wishlists.');
      router.push('/login');
    }
  };

  useEffect(() => {
    if (!initialData) {
      fetchProductDetail();
    } else if (product) {
      // Auto-select options from initial data
      const variants = product.variants;
      if (variants.length > 0 && !selectedColor && !selectedSize) {
        const first = variants[0];
        setSelectedColor(first.attributes.color || '');
        setSelectedSize(first.attributes.size || '');
        setActiveVariant(first);
      }
      updateRecentlyViewed(product);
    }
  }, [slug, initialData]);

  useEffect(() => {
    if (product) {
      checkWishlistStatus(product.id);
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('recentlyViewed');
        if (stored) {
          const list = JSON.parse(stored);
          setRecentlyViewed(list.filter((p: any) => p.id !== product.id));
        }
      }
    }
  }, [product]);

  useEffect(() => {
    if (product && product.variants.length > 0) {
      const variant = product.variants.find(
        (v) => v.attributes.color === selectedColor && v.attributes.size === selectedSize
      );
      setActiveVariant(variant || null);
    }
  }, [selectedColor, selectedSize, product]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <span className="text-3xl mb-4">⚠️</span>
        <h2 className="text-xl font-bold">{error || 'Product not found'}</h2>
        <Link href="/products" className="mt-4 text-brand-400 hover:underline text-sm font-semibold">
          Return to Catalog
        </Link>
      </div>
    );
  }

  const activePrice = activeVariant
    ? parseFloat(product.basePrice) + parseFloat(activeVariant.priceOffset)
    : parseFloat(product.basePrice);

  const colors = Array.from(new Set(product.variants.map((v) => v.attributes.color).filter(Boolean)));
  const sizes = Array.from(new Set(product.variants.map((v) => v.attributes.size).filter(Boolean)));

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navbar */}
      <header className="glass-card sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <Link href="/" className="font-extrabold text-2xl tracking-wider text-gradient font-outfit">
          ALPHASTRYK
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/products" className="text-sm font-semibold text-brand-400 hover:text-brand-350 transition">
            Store Catalog
          </Link>
          <Link href="/wishlist" className="text-sm font-medium hover:text-brand-500 transition">
            Wishlist
          </Link>
        </div>
      </header>

      {/* Product Detail Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-12">
        {/* SEO Breadcrumbs visual */}
        <nav aria-label="Breadcrumb" className="text-4xs text-gray-500 uppercase font-bold tracking-wider space-x-2">
          <Link href="/" className="hover:text-white transition">Home</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-white transition">Products</Link>
          <span>/</span>
          <span className="text-brand-400 font-extrabold">{product.name}</span>
        </nav>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Gallery View */}
          <div className="flex-1 glass-card p-6 rounded-2xl flex items-center justify-center bg-gray-950/20 h-96">
            <img
              src={product.images[0] || 'https://res.cloudinary.com/demo/image/upload/sample.jpg'}
              alt={product.name}
              loading="lazy"
              decoding="async"
              width="320"
              height="320"
              className="object-contain h-full max-h-80"
            />
          </div>

          {/* Details Panel */}
          <div className="flex-1 space-y-6">
            <div>
              <h1 className="text-3xl font-extrabold font-outfit mb-2">{product.name}</h1>
              <span className="text-2xl font-extrabold text-gradient font-outfit">
                ${activePrice.toFixed(2)}
              </span>
            </div>

            <p className="text-sm text-gray-400 leading-relaxed border-t border-b border-gray-800/80 py-4">
              {product.description}
            </p>

            {/* Variant Option Selectors */}
            <div className="space-y-4">
              {colors.length > 0 && (
                <div>
                  <span className="block text-2xs text-gray-500 uppercase font-semibold mb-2">Color Option</span>
                  <div className="flex gap-2">
                    {colors.map((col: any) => (
                      <button
                        key={col}
                        onClick={() => setSelectedColor(col)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold uppercase transition ${
                          selectedColor === col
                            ? 'bg-brand-600 border-brand-500 text-white'
                            : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                        }`}
                      >
                        {col}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {sizes.length > 0 && (
                <div>
                  <span className="block text-2xs text-gray-500 uppercase font-semibold mb-2">Size Option</span>
                  <div className="flex gap-2">
                    {sizes.map((sz: any) => (
                      <button
                        key={sz}
                        onClick={() => setSelectedSize(sz)}
                        className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                          selectedSize === sz
                            ? 'bg-brand-600 border-brand-500 text-white'
                            : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Selected Variant Status Checks */}
            <div className="bg-gray-950/60 p-4 rounded-xl border border-gray-800/80 text-xs space-y-2">
              {activeVariant ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-semibold">VARIANT SKU:</span>
                    <span className="font-mono text-gray-300">{activeVariant.sku}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">STOCK AVAILABILITY:</span>
                    {activeVariant.stock < 10 ? (
                      <span className="text-orange-400 font-bold bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded text-3xs">
                        LOW STOCK: ONLY {activeVariant.stock} LEFT
                      </span>
                    ) : (
                      <span className="text-green-400 font-bold bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded text-3xs">
                        IN STOCK ({activeVariant.stock})
                      </span>
                    )}
                  </div>
                  {activeVariant.model3dUrl && (
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-gray-500 font-semibold">3D MODEL ASSETS:</span>
                      <span className="text-indigo-400 font-bold text-3xs bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                        3D READY
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-red-400 font-semibold text-center">Selected variant layout is not available.</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={handleAddToCart}
                disabled={!activeVariant || activeVariant.stock === 0}
                className="flex-1 py-3.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-800 text-white font-semibold rounded-xl transition text-sm shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2"
              >
                Add To Shopping Cart
              </button>
              
              {activeVariant?.model3dUrl && (
                <Link
                  href="/customize"
                  className="px-6 bg-indigo-650 hover:bg-indigo-700 text-white font-semibold rounded-xl transition text-xs flex items-center justify-center border border-indigo-500/30"
                >
                  Customize 3D
                </Link>
              )}

              <button
                onClick={handleWishlistToggle}
                className={`w-14 rounded-xl border flex items-center justify-center text-lg transition ${
                  isWishlisted
                    ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                    : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                {isWishlisted ? '❤️' : '🤍'}
              </button>
            </div>
          </div>
        </div>

        {/* Recommended Products */}
        {recommended.length > 0 && (
          <section className="space-y-4 pt-8 border-t border-gray-800/80">
            <h2 className="text-lg font-bold font-outfit">Recommended Products</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {recommended.map((p) => (
                <div key={p.id} className="glass-card p-4 rounded-xl flex flex-col justify-between hover:border-gray-700 transition">
                  <div className="h-28 w-full flex items-center justify-center bg-gray-950/10 rounded-lg overflow-hidden mb-3">
                    <img
                      src={p.images[0] || 'https://res.cloudinary.com/demo/image/upload/sample.jpg'}
                      alt={p.name}
                      loading="lazy"
                      decoding="async"
                      width="100"
                      height="100"
                      className="object-contain max-h-24"
                    />
                  </div>
                  <div>
                    <Link href={`/products/${p.slug}`} className="hover:underline">
                      <h4 className="font-bold text-xs text-white line-clamp-1 mb-1">{p.name}</h4>
                    </Link>
                    <span className="text-xs text-brand-400 font-bold">${parseFloat(p.basePrice).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recently Viewed Products */}
        {recentlyViewed.length > 0 && (
          <section className="space-y-4 pt-4">
            <h2 className="text-lg font-bold font-outfit">Recently Viewed</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {recentlyViewed.map((p) => (
                <div key={p.id} className="glass-card p-4 rounded-xl flex flex-col justify-between hover:border-gray-700 transition">
                  <div className="h-28 w-full flex items-center justify-center bg-gray-950/10 rounded-lg overflow-hidden mb-3">
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      decoding="async"
                      width="100"
                      height="100"
                      className="object-contain max-h-24"
                    />
                  </div>
                  <div>
                    <Link href={`/products/${p.slug}`} className="hover:underline">
                      <h4 className="font-bold text-xs text-white line-clamp-1 mb-1">{p.name}</h4>
                    </Link>
                    <span className="text-xs text-brand-400 font-bold">${parseFloat(p.basePrice).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
