'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';

interface OrderItem {
  id: string;
  quantity: number;
  priceAtPurchase: string;
  variant: {
    name: string;
    sku: string;
    product: {
      name: string;
      images: string[];
    };
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  cgst: string;
  sgst: string;
  igst: string;
  taxRate: string;
  gstin: string | null;
}

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
  totalAmount: string;
  payableAmount: string;
  taxAmount: string;
  shippingCost: string;
  shippingAddress: any;
  billingAddress: any;
  createdAt: string;
  items: OrderItem[];
  gstin?: string | null;
  invoice?: Invoice | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  estimatedDelivery?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  trackingUpdates?: TrackingUpdate[];
}

export default function OrderSummaryPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const resolvedParams = React.use(params);
  const orderNumber = resolvedParams.orderNumber;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [showMockModal, setShowMockModal] = useState(false);
  const [mockPaymentData, setMockPaymentData] = useState<any>(null);
  const [selectedMockMethod, setSelectedMockMethod] = useState<'card' | 'upi' | 'wallet'>('card');
  const [mockUpiId, setMockUpiId] = useState('athlete@upi');
  const [mockCardNumber, setMockCardNumber] = useState('4111 1111 1111 1111');

  const [invoiceActionLoading, setInvoiceActionLoading] = useState(false);
  const [invoiceActionMessage, setInvoiceActionMessage] = useState('');
  const [invoiceActionError, setInvoiceActionError] = useState('');

  const fetchOrderDetail = async () => {
    try {
      const res = await apiFetch(`/orders/detail/${orderNumber}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setOrder(data.data);
      } else {
        setError(data.message || 'Failed to load order details.');
      }
    } catch (err) {
      setError('Connection failure.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!order?.invoice) return;
    setInvoiceActionLoading(true);
    setInvoiceActionError('');
    setInvoiceActionMessage('');
    try {
      const res = await apiFetch(`/invoices/download/${order.invoice.invoiceNumber}`);
      if (!res.ok) {
        setInvoiceActionError('Failed to fetch invoice download document.');
        setInvoiceActionLoading(false);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${order.invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setInvoiceActionMessage('Invoice PDF downloaded successfully!');
    } catch (err) {
      setInvoiceActionError('Download connection error.');
    } finally {
      setInvoiceActionLoading(false);
    }
  };

  const handleEmailInvoice = async () => {
    if (!order?.invoice) return;
    setInvoiceActionLoading(true);
    setInvoiceActionError('');
    setInvoiceActionMessage('');
    try {
      const res = await apiFetch(`/invoices/email/${order.invoice.invoiceNumber}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setInvoiceActionMessage('Invoice PDF has been successfully dispatched to your email address!');
      } else {
        setInvoiceActionError(data.message || 'Failed to dispatch email.');
      }
    } catch (err) {
      setInvoiceActionError('Email connection error.');
    } finally {
      setInvoiceActionLoading(false);
    }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async (gateway: 'RAZORPAY' | 'PHONEPE') => {
    if (!order) return;
    setPaymentLoading(true);
    setPaymentError('');
    try {
      const res = await apiFetch('/payments/initiate', {
        method: 'POST',
        body: JSON.stringify({ orderId: order.id, gateway }),
      });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        setPaymentError(data.message || 'Payment initiation failed.');
        setPaymentLoading(false);
        return;
      }

      const paymentInfo = data.data;

      if (gateway === 'RAZORPAY') {
        if (paymentInfo.mockMode) {
          setMockPaymentData(paymentInfo);
          setShowMockModal(true);
          setPaymentLoading(false);
        } else {
          const loaded = await loadRazorpayScript();
          if (!loaded) {
            setPaymentError('Failed to load Razorpay SDK. Please verify network connectivity.');
            setPaymentLoading(false);
            return;
          }
          
          const options = {
            key: paymentInfo.keyId,
            amount: Math.round(paymentInfo.payableAmount * 100),
            currency: 'INR',
            name: 'AlphaStryk Sports Wear',
            description: `Order #${paymentInfo.orderNumber}`,
            order_id: paymentInfo.gatewayOrderId,
            handler: async (response: any) => {
              setPaymentLoading(true);
              try {
                const verifyRes = await apiFetch('/payments/verify', {
                  method: 'POST',
                  body: JSON.stringify({
                    orderId: paymentInfo.orderId,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpayOrderId: response.razorpay_order_id,
                    razorpaySignature: response.razorpay_signature,
                  }),
                });
                const verifyData = await verifyRes.json();
                if (verifyRes.ok && verifyData.success) {
                  fetchOrderDetail();
                } else {
                  setPaymentError(verifyData.message || 'Payment verification failed.');
                }
              } catch (err) {
                setPaymentError('Verification connection error.');
              } finally {
                setPaymentLoading(false);
              }
            },
            prefill: {
              email: '',
              name: '',
            },
            theme: {
              color: '#4f46e5',
            },
            modal: {
              ondismiss: () => {
                setPaymentLoading(false);
              }
            }
          };
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        }
      } else if (gateway === 'PHONEPE') {
        window.location.href = paymentInfo.redirectUrl;
      }
    } catch (err) {
      setPaymentError('Connection failure initiating payment.');
      setPaymentLoading(false);
    }
  };

  const handleMockVerify = async (success: boolean) => {
    setShowMockModal(false);
    if (!success) {
      setPaymentError('Mock payment transaction was cancelled. Retry enabled.');
      return;
    }

    setPaymentLoading(true);
    try {
      const mockPayId = `pay_mock_${Math.floor(Math.random() * 1000000)}`;
      const res = await apiFetch('/payments/verify', {
        method: 'POST',
        body: JSON.stringify({
          orderId: mockPaymentData.orderId,
          razorpayPaymentId: mockPayId,
          razorpayOrderId: mockPaymentData.gatewayOrderId,
          razorpaySignature: 'mock_signature_approved',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchOrderDetail();
      } else {
        setPaymentError(data.message || 'Mock payment verification failed.');
      }
    } catch (err) {
      setPaymentError('Mock verification connection error.');
    } finally {
      setPaymentLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const paymentStatus = searchParams.get('status');
      if (paymentStatus === 'success') {
        setPaymentError('');
      } else if (paymentStatus === 'failed') {
        setPaymentError('Payment transaction failed or was rejected. You can retry below.');
      }
    }
  }, [orderNumber]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <span className="text-3xl mb-4">⚠️</span>
        <h2 className="text-xl font-bold">{error || 'Order not found'}</h2>
        <Link href="/products" className="mt-4 text-brand-400 hover:underline text-sm font-semibold">
          Return to Catalog
        </Link>
      </div>
    );
  }

  const subtotal = parseFloat(order.totalAmount);
  const shipping = parseFloat(order.shippingCost);
  const tax = parseFloat(order.taxAmount);
  const total = parseFloat(order.payableAmount);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="glass-card sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <Link href="/" className="font-extrabold text-2xl tracking-wider text-gradient font-outfit">
          ALPHASTRYK
        </Link>
        <Link href="/products" className="text-xs font-semibold px-3.5 py-1.5 bg-gray-800 hover:bg-gray-750 text-white rounded-lg transition border border-gray-700">
          Store Catalog
        </Link>
      </header>

      {/* Invoice Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 space-y-8">
        
        {/* Order Status Header */}
        <div className="glass-card p-6 rounded-2xl border border-green-500/10 bg-green-500/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-2xs text-green-400 font-extrabold uppercase tracking-wider">Order Status Update</span>
            <h1 className="text-xl md:text-2xl font-extrabold text-white mt-1">Order #{order.orderNumber}</h1>
            <p className="text-3xs text-gray-500 font-mono mt-1">PLACED ON {new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <span className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-bold rounded-lg text-2xs uppercase">
            {order.status}
          </span>
        </div>

        {/* Shipping Tracking Timeline */}
        {order.trackingNumber && (
          <div className="glass-card p-6 rounded-2xl border border-brand-500/20 bg-brand-500/5 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-800">
              <div>
                <span className="text-3xs text-brand-400 font-extrabold uppercase tracking-widest">Shipment Tracking</span>
                <h3 className="text-sm font-bold text-white mt-1">
                  Carrier: <span className="text-brand-300 font-mono">{order.carrier}</span>
                </h3>
                <p className="text-3xs text-gray-400 font-mono mt-1">AWB REF: {order.trackingNumber}</p>
              </div>
              {order.estimatedDelivery && (
                <div className="text-left sm:text-right">
                  <span className="text-3xs text-gray-500 block">ESTIMATED DELIVERY</span>
                  <span className="text-xs font-bold text-white font-outfit">
                    {new Date(order.estimatedDelivery).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              )}
            </div>

            {/* Timeline Graphic */}
            <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-800/80">
              {order.trackingUpdates && order.trackingUpdates.length > 0 ? (
                order.trackingUpdates.map((update, index) => {
                  const isCurrent = index === 0;
                  return (
                    <div key={update.id} className="flex gap-4 relative items-start">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 shrink-0 border ${
                        isCurrent
                          ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-600/35 animate-pulse'
                          : 'bg-gray-950 border-gray-800 text-gray-500'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-white' : 'bg-gray-600'}`} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className={`text-xs font-extrabold tracking-wide uppercase ${isCurrent ? 'text-brand-400' : 'text-gray-300'}`}>
                            {update.status.replace(/_/g, ' ')}
                          </span>
                          <span className="text-3xs text-gray-500 font-mono">
                            {new Date(update.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <span className="block text-2xs text-gray-400 font-semibold">{update.location}</span>
                        <p className="text-3xs text-gray-500">{update.details}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="pl-8 text-2xs text-gray-400 italic">
                  Dispatch request initialized. Tracking details will update shortly.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Invoice breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Shipping snapshot address */}
          <div className="glass-card p-5 rounded-xl text-xs space-y-2">
            <span className="block text-2xs text-gray-500 font-bold uppercase tracking-wider mb-2">Shipping Details</span>
            <span className="block font-semibold text-white">Delivered To</span>
            <span className="block text-gray-300">{order.shippingAddress.street}</span>
            <span className="block text-gray-300">{order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.postalCode}</span>
            <span className="block font-semibold uppercase text-3xs text-gray-500">{order.shippingAddress.country}</span>
          </div>

          {/* Billing snapshot address */}
          <div className="glass-card p-5 rounded-xl text-xs space-y-2">
            <span className="block text-2xs text-gray-500 font-bold uppercase tracking-wider mb-2">Billing Details</span>
            <span className="block font-semibold text-white">Invoiced To</span>
            <span className="block text-gray-300">{order.billingAddress.street}</span>
            <span className="block text-gray-300">{order.billingAddress.city}, {order.billingAddress.state} - {order.billingAddress.postalCode}</span>
            <span className="block font-semibold uppercase text-3xs text-gray-500">{order.billingAddress.country}</span>
          </div>

          {/* Pricing calculations */}
          <div className="glass-card p-5 rounded-xl text-xs space-y-3">
            <span className="block text-2xs text-gray-500 font-bold uppercase tracking-wider mb-2">Payment Calc</span>
            <div className="flex justify-between text-gray-400">
              <span>Items Subtotal</span>
              <span className="font-semibold text-white">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Shipping Fee</span>
              <span className="font-semibold text-white">${shipping.toFixed(2)}</span>
            </div>
            {order.invoice ? (
              <>
                {parseFloat(order.invoice.igst) > 0 ? (
                  <div className="flex justify-between text-gray-400">
                    <span>Integrated IGST ({parseFloat(order.invoice.taxRate)}%)</span>
                    <span className="font-semibold text-white">${parseFloat(order.invoice.igst).toFixed(2)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-gray-400">
                      <span>Central CGST ({(parseFloat(order.invoice.taxRate)/2).toFixed(1)}%)</span>
                      <span className="font-semibold text-white">${parseFloat(order.invoice.cgst).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>State SGST ({(parseFloat(order.invoice.taxRate)/2).toFixed(1)}%)</span>
                      <span className="font-semibold text-white">${parseFloat(order.invoice.sgst).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex justify-between text-gray-400">
                <span>GST Tax (18%)</span>
                <span className="font-semibold text-white">${tax.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-gray-800 pt-2 flex justify-between font-bold text-sm">
              <span className="text-white">Amount Total</span>
              <span className="text-gradient font-outfit">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Invoice Actions Panel */}
        {order.invoice && (
          <div className="glass-card p-6 rounded-2xl border border-green-500/20 bg-green-500/5 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-3xs text-green-400 font-extrabold uppercase tracking-widest">Tax Invoice Generated</span>
                <h3 className="text-sm font-bold text-white mt-1">Invoice #{order.invoice.invoiceNumber}</h3>
                {order.gstin && (
                  <p className="text-3xs text-gray-400 font-mono mt-1">BUSINESS GSTIN: {order.gstin}</p>
                )}
              </div>
              <span className="px-2 py-0.5 rounded text-3xs font-extrabold bg-green-500/10 border border-green-500/20 text-green-400 uppercase tracking-widest">
                Tax Compliant
              </span>
            </div>

            {invoiceActionMessage && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-3xs px-4 py-2.5 rounded-lg font-semibold">
                {invoiceActionMessage}
              </div>
            )}

            {invoiceActionError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-3xs px-4 py-2.5 rounded-lg font-semibold">
                {invoiceActionError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button
                onClick={handleDownloadInvoice}
                disabled={invoiceActionLoading}
                className="flex-1 py-3 px-6 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20"
              >
                {invoiceActionLoading ? (
                  <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
                ) : (
                  'Download PDF Invoice'
                )}
              </button>
              
              <button
                onClick={handleEmailInvoice}
                disabled={invoiceActionLoading}
                className="flex-1 py-3 px-6 bg-gray-900 hover:bg-gray-850 text-gray-400 border border-gray-800 rounded-xl transition text-xs flex items-center justify-center gap-2"
              >
                {invoiceActionLoading ? (
                  <span className="w-4 h-4 border-2 border-t-transparent border-gray-400 rounded-full animate-spin"></span>
                ) : (
                  'Email Invoice PDF'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Payment selector panel if pending */}
        {order.status === 'PENDING' && (
          <div className="glass-card p-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">Complete Your Payment</h3>
                <p className="text-2xs text-gray-400 mt-1">Select a gateway below to secure checkout for your team order.</p>
              </div>
              <span className="px-2 py-0.5 rounded text-3xs font-extrabold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 uppercase tracking-widest">
                Payment Required
              </span>
            </div>
            
            {paymentError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-3xs px-4 py-2.5 rounded-lg font-semibold">
                {paymentError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button
                onClick={() => handlePayment('RAZORPAY')}
                disabled={paymentLoading}
                className="flex-1 py-3.5 px-6 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20"
              >
                {paymentLoading ? (
                  <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
                ) : (
                  'Pay with Razorpay'
                )}
              </button>
              
              <button
                onClick={() => handlePayment('PHONEPE')}
                disabled={paymentLoading}
                className="flex-1 py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {paymentLoading ? (
                  <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
                ) : (
                  'Pay with PhonePe'
                )}
              </button>
            </div>
            
            <p className="text-4xs text-gray-500 text-center">
              Secured payments processed through UPI, Cards, Net Banking, and Wallet providers.
            </p>
          </div>
        )}

        {/* Mock Payment Selector Modal */}
        {showMockModal && (
          <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card max-w-md w-full rounded-2xl border border-brand-500/30 p-6 space-y-6 shadow-2xl relative">
              <div className="border-b border-gray-800 pb-3 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400 font-outfit">Simulated Checkout Gateway</h3>
                  <span className="text-4xs text-gray-400 font-mono">Gateway: Razorpay (Simulated Sandbox)</span>
                </div>
                <button
                  onClick={() => handleMockVerify(false)}
                  className="text-gray-500 hover:text-white font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="bg-gray-950 p-4 rounded-xl border border-gray-850 flex justify-between items-center text-xs">
                <div>
                  <span className="block text-3xs text-gray-500">PAYABLE AMOUNT</span>
                  <span className="text-sm font-extrabold text-white">${total.toFixed(2)}</span>
                </div>
                <div className="text-right">
                  <span className="block text-3xs text-gray-500">ORDER REF</span>
                  <span className="font-mono font-bold text-gray-300">#{order.orderNumber}</span>
                </div>
              </div>

              {/* Methods tabs */}
              <div className="grid grid-cols-3 gap-2 border-b border-gray-800 pb-4">
                {(['card', 'upi', 'wallet'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setSelectedMockMethod(method)}
                    className={`py-2 px-3 rounded-lg text-center font-bold text-3xs transition uppercase border ${
                      selectedMockMethod === method
                        ? 'border-brand-500 bg-brand-500/5 text-white'
                        : 'border-gray-800 bg-gray-950/40 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>

              <div className="space-y-4 text-xs">
                {selectedMockMethod === 'card' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Card Number</label>
                      <input
                        type="text"
                        value={mockCardNumber}
                        onChange={(e) => setMockCardNumber(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Expiry Date</label>
                        <input
                          type="text"
                          defaultValue="12/29"
                          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">CVV</label>
                        <input
                          type="password"
                          defaultValue="123"
                          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedMockMethod === 'upi' && (
                  <div>
                    <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Virtual Payment Address (VPA)</label>
                    <input
                      type="text"
                      value={mockUpiId}
                      onChange={(e) => setMockUpiId(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                )}

                {selectedMockMethod === 'wallet' && (
                  <div>
                    <label className="block text-3xs text-gray-500 uppercase font-semibold mb-1">Wallet Provider</label>
                    <select
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white font-mono"
                    >
                      <option>PhonePe Wallet</option>
                      <option>Paytm</option>
                      <option>Amazon Pay</option>
                      <option>MobiKwik</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => handleMockVerify(true)}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xs transition uppercase"
                >
                  Approve Mock Payment
                </button>
                <button
                  onClick={() => handleMockVerify(false)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs transition uppercase"
                >
                  Fail Payment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* List items */}
        <div className="glass-card rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
          <div className="p-4 bg-gray-900/30 border-b border-gray-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Items Ordered</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <tbody className="divide-y divide-gray-800/60">
                {order.items.map((item) => {
                  const price = parseFloat(item.priceAtPurchase);
                  return (
                    <tr key={item.id} className="hover:bg-gray-900/10">
                      <td className="p-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-gray-950 flex items-center justify-center overflow-hidden">
                          <img src={item.variant.product.images[0] || 'https://res.cloudinary.com/demo/image/upload/sample.jpg'} alt={item.variant.product.name} className="object-contain max-h-7" />
                        </div>
                        <div>
                          <span className="block font-bold text-white">{item.variant.product.name}</span>
                          <span className="block text-3xs text-gray-500 font-mono">
                            SKU: {item.variant.sku} | Style: {item.variant.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-gray-300">${price.toFixed(2)} each</td>
                      <td className="p-4 text-gray-400">Qty: {item.quantity}</td>
                      <td className="p-4 text-right font-bold text-white">${(price * item.quantity).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-4 justify-center pt-4">
          <Link href="/dashboard/customer" className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition text-xs shadow shadow-brand-600/20">
            Return to Dashboard
          </Link>
          <Link href="/products" className="px-6 py-3 bg-gray-900 hover:bg-gray-850 text-gray-400 border border-gray-800 rounded-xl transition text-xs font-semibold">
            Browse Store Catalog
          </Link>
        </div>
      </main>
    </div>
  );
}
