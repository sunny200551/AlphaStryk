'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';

interface CartItem {
  id: string; // Database ID or mock ID for guest
  productVariantId: string;
  quantity: number;
  customDesignId?: string | null;
  customDesign?: {
    id: string;
    name: string;
    thumbnailUrl: string | null;
  } | null;
  variant: {
    id: string;
    name: string;
    sku: string;
    priceOffset: string;
    stock: number;
    attributes: any;
    product: {
      name: string;
      basePrice: string;
      images: string[];
      slug: string;
    };
  };
}

export default function CartPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuthAndSync = async () => {
    try {
      const authRes = await apiFetch('/auth/me');
      const authData = await authRes.json();
      
      if (authRes.ok && authData.success) {
        setIsAuthenticated(true);
        // User logged in, check if guest items need sync
        const guestStored = localStorage.getItem('guestCart');
        if (guestStored) {
          const guestItems = JSON.parse(guestStored);
          if (guestItems.length > 0) {
            console.log('Syncing guest items to database...');
            const syncRes = await apiFetch('/cart/sync', {
              method: 'POST',
              body: JSON.stringify({ items: guestItems }),
            });
            if (syncRes.ok) {
              localStorage.removeItem('guestCart'); // Clean guest cart
            }
          }
        }
        // Load database cart
        await fetchDatabaseCart();
      } else {
        setIsAuthenticated(false);
        loadGuestCart();
      }
    } catch (err) {
      setIsAuthenticated(false);
      loadGuestCart();
    } finally {
      setLoading(false);
    }
  };

  const fetchDatabaseCart = async () => {
    try {
      const res = await apiFetch('/cart');
      const data = await res.json();
      if (res.ok && data.success) {
        setCartItems(data.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load cart from DB:', err);
    }
  };

  // Load cart from LocalStorage for guest checkout
  const loadGuestCart = () => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('guestCart');
      if (stored) {
        // In local mock mode, we create structured items with mock product associations
        // If they browsed products and clicked checkout, they are loaded.
        // For onboarding simplicity, we parse local guest items directly.
        setCartItems(JSON.parse(stored));
      } else {
        setCartItems([]);
      }
    } catch (err) {
      console.error('Failed to load guest cart:', err);
    }
  };

  useEffect(() => {
    checkAuthAndSync();
  }, []);

  const handleQtyUpdate = async (itemId: string, newQty: number, productVariantId: string) => {
    if (newQty < 1) return;

    if (isAuthenticated) {
      try {
        const res = await apiFetch(`/cart/${itemId}`, {
          method: 'PUT',
          body: JSON.stringify({ quantity: newQty }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setCartItems(data.data.items || []);
        } else {
          alert(data.message || 'Failed to update quantity.');
        }
      } catch (err) {
        alert('Connection error.');
      }
    } else {
      // Update guest cart locally
      const updated = cartItems.map((item) => {
        if (item.id === itemId) {
          if (item.variant.stock < newQty) {
            alert(`Cannot exceed available stock limit (${item.variant.stock}).`);
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      });
      setCartItems(updated);
      saveGuestCartLocally(updated);
    }
  };

  const handleRemove = async (itemId: string) => {
    if (isAuthenticated) {
      try {
        const res = await apiFetch(`/cart/${itemId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
          setCartItems(data.data.items || []);
        }
      } catch (err) {
        alert('Connection error.');
      }
    } else {
      const updated = cartItems.filter((item) => item.id !== itemId);
      setCartItems(updated);
      saveGuestCartLocally(updated);
    }
  };

  const saveGuestCartLocally = (items: CartItem[]) => {
    const minified = items.map((item) => ({
      productVariantId: item.productVariantId,
      quantity: item.quantity,
      customDesignId: item.customDesignId,
    }));
    localStorage.setItem('guestCart', JSON.stringify(minified));
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((acc, item) => {
      const price = parseFloat(item.variant.product.basePrice) + parseFloat(item.variant.priceOffset);
      return acc + price * item.quantity;
    }, 0);
  };

  const handleCheckoutRedirect = () => {
    if (isAuthenticated) {
      router.push('/checkout');
    } else {
      // Save redirect query params
      router.push('/login?redirect=/checkout');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const subtotal = calculateSubtotal();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header navbar */}
      <header className="glass-card sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <Link href="/" className="font-extrabold text-2xl tracking-wider text-gradient font-outfit">
          ALPHASTRYK
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/products" className="text-sm font-semibold text-brand-400 hover:text-brand-350 transition">
            Store Catalog
          </Link>
          <Link href="/cart" className="text-sm font-semibold text-brand-400 hover:text-brand-350 transition">
            Shopping Cart ({cartItems.reduce((acc, i) => acc + i.quantity, 0)})
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold font-outfit">Shopping Cart</h1>
          <p className="text-xs text-gray-400">Review selected team uniforms and customized gear options</p>
        </div>

        {cartItems.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center text-gray-400 space-y-4">
            <span className="text-4xl block">🛒</span>
            <h3 className="font-bold text-white text-base">Your shopping cart is empty</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Select items from our store catalog or save custom designs to add them here.
            </p>
            <div className="pt-2">
              <Link href="/products" className="inline-block py-2.5 px-6 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition text-xs">
                Browse Store Catalog
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Items table */}
            <div className="flex-1 glass-card rounded-2xl overflow-hidden border border-gray-800 shadow-xl h-fit">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-900/40 border-b border-gray-800 text-3xs font-bold uppercase tracking-wider text-gray-500">
                      <th className="p-4">Uniform Options</th>
                      <th className="p-4">Price</th>
                      <th className="p-4">Quantity</th>
                      <th className="p-4">Total</th>
                      <th className="p-4 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {cartItems.map((item) => {
                      const itemPrice = parseFloat(item.variant.product.basePrice) + parseFloat(item.variant.priceOffset);
                      const imageUrl = item.customDesign?.thumbnailUrl || item.variant.product.images[0] || 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
                      return (
                        <tr key={item.id} className="hover:bg-gray-900/10">
                          <td className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-gray-950 flex items-center justify-center overflow-hidden border border-gray-850">
                              <img src={imageUrl} alt={item.variant.product.name} className="object-contain max-h-9" />
                            </div>
                            <div>
                              <span className="block font-bold text-white text-sm">{item.variant.product.name}</span>
                              <span className="block text-2xs text-gray-400">
                                Variant: {item.variant.name} | SKU: {item.variant.sku}
                              </span>
                              {item.customDesign ? (
                                <span className="inline-block bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-3xs px-1.5 py-0.5 rounded font-bold mt-1 uppercase">
                                  Custom: {item.customDesign.name}
                                </span>
                              ) : item.customDesignId ? (
                                <span className="inline-block bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-3xs px-1.5 py-0.5 rounded font-bold mt-1 uppercase">
                                  Custom 3D Design Applied
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="p-4 font-semibold text-white">${itemPrice.toFixed(2)}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleQtyUpdate(item.id, item.quantity - 1, item.productVariantId)}
                                className="w-6 h-6 rounded bg-gray-950 border border-gray-800 hover:bg-gray-900 flex items-center justify-center text-white"
                              >
                                -
                              </button>
                              <span className="w-8 text-center text-white font-semibold">{item.quantity}</span>
                              <button
                                onClick={() => handleQtyUpdate(item.id, item.quantity + 1, item.productVariantId)}
                                className="w-6 h-6 rounded bg-gray-950 border border-gray-800 hover:bg-gray-900 flex items-center justify-center text-white"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="p-4 font-bold text-white">${(itemPrice * item.quantity).toFixed(2)}</td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleRemove(item.id)}
                              className="text-red-400 hover:text-red-3.50 font-bold"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Checkout Pricing Sidebar */}
            <div className="w-full lg:w-80 space-y-4 flex-shrink-0">
              <div className="glass-card p-6 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400">Order Summary</h3>
                <div className="space-y-2 text-xs border-b border-gray-800/80 pb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="font-semibold text-white">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Estimated Shipping</span>
                    <span className="font-semibold text-white">$15.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tax (10% GST)</span>
                    <span className="font-semibold text-white">${(subtotal * 0.1).toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-white">Estimated Total</span>
                  <span className="text-gradient font-outfit text-lg">${(subtotal * 1.1 + 15).toFixed(2)}</span>
                </div>

                <button
                  onClick={handleCheckoutRedirect}
                  className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition text-xs shadow-lg shadow-brand-600/20 mt-4"
                >
                  {isAuthenticated ? 'Proceed to Checkout' : 'Login to Checkout'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
