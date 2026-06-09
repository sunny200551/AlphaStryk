'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../lib/api';

interface Address {
  id: string;
  type: 'BILLING' | 'SHIPPING';
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  isDefault: boolean;
}

interface CartItem {
  id: string;
  quantity: number;
  variant: {
    priceOffset: string;
    product: {
      basePrice: string;
    };
  };
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading } = useAuth([]); // Require auth

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState('');
  const [selectedBillingId, setSelectedBillingId] = useState('');
  
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(true);

  // Address Form State
  const [addrType, setAddrType] = useState<'SHIPPING' | 'BILLING'>('SHIPPING');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrCountry, setAddrCountry] = useState('');
  const [addrPostalCode, setAddrPostalCode] = useState('');
  const [addrIsDefault, setAddrIsDefault] = useState(false);

  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState('');
  const [gstin, setGstin] = useState('');

  // Coupon States
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');


  const fetchAddressesAndCart = async () => {
    try {
      const addrRes = await apiFetch('/addresses');
      const addrData = await addrRes.json();
      
      const cartRes = await apiFetch('/cart');
      const cartData = await cartRes.json();

      if (addrRes.ok) {
        setAddresses(addrData.data);
        const shipping = addrData.data.find((a: Address) => a.type === 'SHIPPING');
        const billing = addrData.data.find((a: Address) => a.type === 'BILLING');
        if (shipping) setSelectedShippingId(shipping.id);
        if (billing) setSelectedBillingId(billing.id);
      }

      if (cartRes.ok) {
        setCartItems(cartData.data.items || []);
        if (!cartData.data.items || cartData.data.items.length === 0) {
          router.push('/cart');
        }
      }
    } catch (err) {
      console.error('Failed to load checkout context:', err);
    } finally {
      setCartLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAddressesAndCart();
    }
  }, [user]);

  const handleAddAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!addrStreet || !addrCity || !addrState || !addrCountry || !addrPostalCode) {
      setError('Please fill in all address parameters.');
      return;
    }

    try {
      const res = await apiFetch('/addresses', {
        method: 'POST',
        body: JSON.stringify({
          type: addrType,
          street: addrStreet,
          city: addrCity,
          state: addrState,
          country: addrCountry,
          postalCode: addrPostalCode,
          isDefault: addrIsDefault,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAddresses([...addresses, data.data]);
        if (addrType === 'SHIPPING') setSelectedShippingId(data.data.id);
        if (addrType === 'BILLING') setSelectedBillingId(data.data.id);
        
        // Reset form
        setAddrStreet('');
        setAddrCity('');
        setAddrState('');
        setAddrCountry('');
        setAddrPostalCode('');
        setAddrIsDefault(false);
        setIsAddingAddress(false);
      } else {
        setError(data.message || 'Failed to save address.');
      }
    } catch (err) {
      setError('Connection failure.');
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setCouponLoading(true);
    setCouponError('');
    setCouponSuccess('');
    try {
      const res = await apiFetch('/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code: couponCode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAppliedCoupon(data.data);
        setCouponSuccess(`Redeemed: $${data.data.discount.toFixed(2)} discount`);
      } else {
        setCouponError(data.message || 'Invalid coupon code.');
      }
    } catch (err) {
      setCouponError('Validation connection error.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponSuccess('');
    setCouponError('');
  };

  const handlePlaceOrder = async () => {
    if (!selectedShippingId || !selectedBillingId) {
      setError('Please configure and select both shipping and billing addresses.');
      return;
    }

    setCheckoutLoading(true);
    setError('');

    try {
      const res = await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({
          shippingAddressId: selectedShippingId,
          billingAddressId: selectedBillingId,
          gstin: gstin || undefined,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Order created successfully, redirect to summary
        router.push(`/orders/${data.data.orderNumber}`);
      } else {
        setError(data.message || 'Checkout failed. Please inspect order requirements.');
      }
    } catch (err) {
      setError('Connection failure.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading || cartLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const subtotal = cartItems.reduce((acc, item) => {
    const price = parseFloat(item.variant.product.basePrice) + parseFloat(item.variant.priceOffset);
    return acc + price * item.quantity;
  }, 0);

  const discountAmount = appliedCoupon ? parseFloat(appliedCoupon.discount) : 0.0;
  const shippingCost = 15.0;
  const tax = Math.max(0, subtotal - discountAmount) * 0.18;
  const total = Math.max(0, subtotal - discountAmount) + shippingCost + tax;


  const shippingAddresses = addresses.filter((a) => a.type === 'SHIPPING');
  const billingAddresses = addresses.filter((a) => a.type === 'BILLING');

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="glass-card sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <Link href="/" className="font-extrabold text-2xl tracking-wider text-gradient font-outfit">
          ALPHASTRYK
        </Link>
        <span className="text-xs font-semibold px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-md">
          Checkout Flow
        </span>
      </header>

      {/* Main Grid Layout */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left Form controls */}
        <div className="flex-1 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Step 1: Shipping addresses */}
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400">1. Shipping Address</h3>
              {!isAddingAddress && (
                <button
                  onClick={() => { setIsAddingAddress(true); setAddrType('SHIPPING'); }}
                  className="text-2xs text-brand-400 hover:underline font-bold"
                >
                  + Add Address
                </button>
              )}
            </div>

            {shippingAddresses.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No saved shipping addresses. Click "+ Add Address" to configure.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {shippingAddresses.map((addr) => (
                  <div
                    key={addr.id}
                    onClick={() => setSelectedShippingId(addr.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      selectedShippingId === addr.id
                        ? 'border-brand-500 bg-brand-500/5'
                        : 'border-gray-800 bg-gray-950/40 hover:border-gray-700'
                    }`}
                  >
                    <div className="text-2xs space-y-1 text-gray-300">
                      <span className="block font-bold text-white">Recipient Shipping Address</span>
                      <span className="block">{addr.street}</span>
                      <span className="block">{addr.city}, {addr.state} - {addr.postalCode}</span>
                      <span className="block font-semibold uppercase text-3xs text-gray-500">{addr.country}</span>
                    </div>
                    {addr.isDefault && (
                      <span className="inline-block mt-2 text-3xs text-indigo-400 font-bold uppercase">Default</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Billing addresses */}
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400">2. Billing Address</h3>
              {!isAddingAddress && (
                <button
                  onClick={() => { setIsAddingAddress(true); setAddrType('BILLING'); }}
                  className="text-2xs text-brand-400 hover:underline font-bold"
                >
                  + Add Address
                </button>
              )}
            </div>

            {billingAddresses.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No saved billing addresses. Click "+ Add Address" to configure.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {billingAddresses.map((addr) => (
                  <div
                    key={addr.id}
                    onClick={() => setSelectedBillingId(addr.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      selectedBillingId === addr.id
                        ? 'border-brand-500 bg-brand-500/5'
                        : 'border-gray-800 bg-gray-950/40 hover:border-gray-700'
                    }`}
                  >
                    <div className="text-2xs space-y-1 text-gray-300">
                      <span className="block font-bold text-white">Invoice Billing Address</span>
                      <span className="block">{addr.street}</span>
                      <span className="block">{addr.city}, {addr.state} - {addr.postalCode}</span>
                      <span className="block font-semibold uppercase text-3xs text-gray-500">{addr.country}</span>
                    </div>
                    {addr.isDefault && (
                      <span className="inline-block mt-2 text-3xs text-indigo-400 font-bold uppercase">Default</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inline Add Address Form */}
          {isAddingAddress && (
            <form onSubmit={handleAddAddressSubmit} className="glass-card p-6 rounded-2xl space-y-4 border border-brand-500/10">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-gray-800 pb-2">
                Configure New {addrType} Address
              </h3>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="col-span-2">
                  <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Street Address</label>
                  <input
                    type="text"
                    value={addrStreet}
                    onChange={(e) => setAddrStreet(e.target.value)}
                    placeholder="123 Main St"
                    required
                    className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">City</label>
                  <input
                    type="text"
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                    placeholder="Sydney"
                    required
                    className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">State / Province</label>
                  <input
                    type="text"
                    value={addrState}
                    onChange={(e) => setAddrState(e.target.value)}
                    placeholder="NSW"
                    required
                    className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Country</label>
                  <input
                    type="text"
                    value={addrCountry}
                    onChange={(e) => setAddrCountry(e.target.value)}
                    placeholder="Australia"
                    required
                    className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={addrPostalCode}
                    onChange={(e) => setAddrPostalCode(e.target.value)}
                    placeholder="2000"
                    required
                    className="w-full bg-gray-950 border border-gray-855 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="addr-default"
                  checked={addrIsDefault}
                  onChange={(e) => setAddrIsDefault(e.target.checked)}
                  className="rounded border-gray-800 bg-gray-950"
                />
                <label htmlFor="addr-default" className="text-3xs text-gray-400 font-semibold uppercase">
                  Mark as default address
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-xs"
                >
                  Save Address
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingAddress(false)}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-gray-400 border border-gray-800 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right summary board */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="glass-card p-6 rounded-2xl space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400 border-b border-gray-800 pb-3">
              Order Review
            </h3>

            {/* Subtotal metrics */}
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Cart Subtotal</span>
                <span className="font-semibold text-white">${subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-400 font-bold">
                  <span>Coupon Discount</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Flat-Rate Shipping</span>
                <span className="font-semibold text-white">${shippingCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">GST Tax (18%)</span>
                <span className="font-semibold text-white">${tax.toFixed(2)}</span>
              </div>
            </div>

            {/* Coupon Entry Block */}
            <div className="border-t border-gray-800 pt-3 space-y-2">
              <label className="block text-3xs text-gray-500 uppercase font-semibold">Redeem Coupon</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="COUPON CODE"
                  disabled={!!appliedCoupon}
                  className="flex-1 bg-gray-950 border border-gray-850 rounded-lg px-2.5 py-1.5 text-2xs text-white uppercase font-mono outline-none focus:border-brand-500 transition disabled:opacity-50"
                />
                {appliedCoupon ? (
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="px-3 py-1.5 bg-red-950/30 hover:bg-red-900/30 border border-red-900/30 text-red-400 text-2xs font-bold rounded-lg transition"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !couponCode}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-2xs font-bold rounded-lg transition disabled:bg-gray-800 disabled:text-gray-500"
                  >
                    {couponLoading ? '...' : 'Apply'}
                  </button>
                )}
              </div>
              {couponError && (
                <p className="text-4xs text-red-400 font-semibold mt-1">⚠️ {couponError}</p>
              )}
              {couponSuccess && (
                <p className="text-4xs text-green-400 font-semibold mt-1">✓ {couponSuccess}</p>
              )}
            </div>

            <div className="border-t border-gray-800 pt-3 space-y-2">
              <label className="block text-3xs text-gray-500 uppercase font-semibold">Business GSTIN (Optional)</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="e.g. 27AAAAA1111A1Z1"
                className="w-full bg-gray-950 border border-gray-850 rounded-lg px-2.5 py-1.5 text-2xs text-white uppercase font-mono"
              />
            </div>

            <div className="border-t border-gray-800 pt-4 flex justify-between items-center text-sm font-bold">
              <span className="text-white">Total Payable</span>
              <span className="text-gradient font-outfit text-lg">${total.toFixed(2)}</span>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={checkoutLoading || isAddingAddress}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-850 text-white font-bold rounded-xl transition text-xs shadow-lg shadow-brand-600/20 mt-4 flex items-center justify-center gap-2"
            >
              {checkoutLoading ? (
                <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
              ) : (
                'Place Order'
              )}
            </button>
            <p className="text-4xs text-gray-500 leading-relaxed text-center">
              By placing this order, you agree to AlphaStryk terms of service. Product inventory will be locked in real-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
