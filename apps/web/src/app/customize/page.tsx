'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { apiFetch } from '../../lib/api';

const TShirtCustomizerCanvas = dynamic(
  () => import('../../components/TShirtCustomizerCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 h-[50vh] lg:h-screen flex items-center justify-center bg-gray-950">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    ),
  }
);

export default function CustomizePage() {
  const router = useRouter();

  // Customizer state
  const [color, setColor] = useState('#4f46e5'); // default brand color
  const [decalUrl, setDecalUrl] = useState<string | null>(null);
  const [placement, setPlacement] = useState<'front' | 'back'>('front');
  
  // Decal transform states
  const [posX, setPosX] = useState(0.0);
  const [posY, setPosY] = useState(0.2);
  const [scale, setScale] = useState(0.4);
  const [rotation, setRotation] = useState(0); // in degrees

  const [cameraView, setCameraView] = useState<'front' | 'back' | 'left' | 'right'>('front');

  // Variant resolution
  const [variantId, setVariantId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Preset Sportswear colors
  const presetColors = [
    { name: 'Indigo Blue', hex: '#4f46e5' },
    { name: 'Neon Yellow', hex: '#eab308' },
    { name: 'Royal Red', hex: '#ef4444' },
    { name: 'Teal Green', hex: '#14b8a6' },
    { name: 'Matte Black', hex: '#111827' },
    { name: 'Clean White', hex: '#ffffff' },
    { name: 'Charcoal Slate', hex: '#4b5563' },
  ];

  useEffect(() => {
    // Resolve customizable product and variant
    const resolveCustomizableProduct = async () => {
      try {
        const res = await apiFetch('/products');
        const data = await res.json();
        if (res.ok && data.success && data.data && data.data.length > 0) {
          // Select first available variant in product catalog
          const product = data.data[0];
          if (product.variants && product.variants.length > 0) {
            setVariantId(product.variants[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to query customizable variants catalog:', err);
      } finally {
        setLoading(false);
      }
    };

    resolveCustomizableProduct();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    // Instant local preview for immediate user gratification
    const localUrl = URL.createObjectURL(file);
    setDecalUrl(localUrl);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiFetch('/designs/upload', {
        method: 'POST',
        // Note: apiFetch sets headers. If we pass FormData, we let the browser set boundary content-type automatically
        headers: {}, // overrides default application/json headers
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDecalUrl(data.url);
      } else {
        setError(data.message || 'Asset upload failed.');
      }
    } catch (err) {
      setError('Connection failure uploading logo graphic.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddToCart = async () => {
    // Fallback ID if catalog was empty
    const activeVariantId = variantId || 'db_variant_mock_tshirt_id';
    setSaving(true);
    setError('');

    try {
      // Calculate coordinates based on placement
      const finalPos: [number, number, number] = [posX, posY, placement === 'front' ? 0.78 : -0.78];
      const radRot = (rotation * Math.PI) / 180;
      const finalRot: [number, number, number] = [0, placement === 'front' ? 0 : Math.PI, placement === 'front' ? radRot : -radRot];
      const finalScale: [number, number, number] = [scale, scale, scale];

      // 1. Save Design parameters to Database
      const designRes = await apiFetch('/designs', {
        method: 'POST',
        body: JSON.stringify({
          productVariantId: activeVariantId,
          name: 'Custom Team T-Shirt',
          designData: {
            color,
            decalUrl,
            placement,
            posX,
            posY,
            scale,
            rotation,
          },
          thumbnailUrl: decalUrl || 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        }),
      });

      const designData = await designRes.json();
      if (!designRes.ok || !designData.success) {
        setError(designData.message || 'Failed to save design configurations.');
        setSaving(false);
        return;
      }

      const designId = designData.design.id;

      // 2. Add design binded to cart item
      const cartRes = await apiFetch('/cart', {
        method: 'POST',
        body: JSON.stringify({
          productVariantId: activeVariantId,
          quantity: 1,
          customDesignId: designId,
        }),
      });

      const cartData = await cartRes.json();
      if (cartRes.ok && cartData.success) {
        router.push('/cart');
      } else {
        setError(cartData.message || 'Failed to bind custom design to shopping cart.');
      }
    } catch (err) {
      setError('Connection failure completing checkout customizer binding.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-950 items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Pre-calculate positions
  const calculatedPos: [number, number, number] = [posX, posY, placement === 'front' ? 0.78 : -0.78];
  const radRot = (rotation * Math.PI) / 180;
  const calculatedRot: [number, number, number] = [0, placement === 'front' ? 0 : Math.PI, placement === 'front' ? radRot : -radRot];
  const calculatedScale: [number, number, number] = [scale, scale, scale];

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-950 text-white">
      {/* 3D Canvas area */}
      <TShirtCustomizerCanvas
        color={color}
        decalUrl={decalUrl}
        calculatedPos={calculatedPos}
        calculatedRot={calculatedRot}
        calculatedScale={calculatedScale}
        cameraView={cameraView}
        setCameraView={setCameraView}
        placement={placement}
        setPlacement={setPlacement}
      />


      {/* Control side panel */}
      <div className="w-full lg:w-96 bg-gray-950 border-t lg:border-t-0 lg:border-l border-gray-800 flex flex-col justify-between p-6 overflow-y-auto h-auto lg:h-screen shadow-2xl">
        <div className="space-y-6">
          <div className="border-b border-gray-800 pb-3 flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-400 font-outfit">
              Customize Gear
            </h2>
            <Link href="/products" className="text-3xs text-gray-400 hover:underline">
              Cancel
            </Link>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-2.5 rounded-lg">
              ⚠️ {error}
            </div>
          )}

          {/* Color Selection */}
          <div className="space-y-3">
            <span className="block text-3xs text-gray-500 font-extrabold uppercase tracking-wider">
              1. Base Fabric Color
            </span>
            <div className="grid grid-cols-7 gap-2">
              {presetColors.map((col) => (
                <button
                  key={col.hex}
                  type="button"
                  onClick={() => setColor(col.hex)}
                  style={{ backgroundColor: col.hex }}
                  title={col.name}
                  className={`w-8 h-8 rounded-full border-2 transition ${
                    color === col.hex ? 'border-white scale-110 shadow-lg' : 'border-gray-850 hover:border-gray-600'
                  }`}
                />
              ))}
            </div>
            
            {/* Custom Hex input */}
            <div className="flex items-center gap-3 pt-2 text-xs">
              <span className="text-gray-400">Custom Color:</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="bg-transparent border-0 w-8 h-8 rounded cursor-pointer"
              />
              <span className="font-mono text-gray-300 font-bold uppercase">{color}</span>
            </div>
          </div>

          {/* Graphic Upload */}
          <div className="space-y-3">
            <span className="block text-3xs text-gray-500 font-extrabold uppercase tracking-wider">
              2. Upload Custom Graphic
            </span>
            <div className="border border-dashed border-gray-800 rounded-xl p-4 bg-gray-950/40 text-center relative hover:border-gray-700 transition">
              <input
                type="file"
                accept="image/png, image/jpeg"
                onChange={handleImageUpload}
                disabled={uploading}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <span className="block text-2xs font-semibold text-gray-300">
                {uploading ? 'Processing Image Upload...' : 'Click to Upload PNG / JPG'}
              </span>
              <span className="block text-4xs text-gray-600 mt-1">Logo designs or team badges. Transparent PNG recommended.</span>
            </div>
          </div>

          {/* Decal position adjustment */}
          {decalUrl && (
            <div className="space-y-5 border-t border-gray-850 pt-5 text-xs">
              <div className="flex justify-between items-center border-b border-gray-900 pb-2">
                <span className="block text-3xs text-gray-500 font-extrabold uppercase tracking-wider">
                  3. Decal Transformations
                </span>
                
                {/* Placement switcher */}
                <div className="flex gap-1 bg-gray-900 p-0.5 rounded border border-gray-800">
                  {(['front', 'back'] as const).map((place) => (
                    <button
                      key={place}
                      onClick={() => {
                        setPlacement(place);
                        setCameraView(place);
                      }}
                      className={`px-2 py-0.5 rounded text-4xs font-bold uppercase transition ${
                        placement === place ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {place}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider posX */}
              <div className="space-y-1">
                <div className="flex justify-between text-gray-400 font-mono text-4xs">
                  <span>Horizontal Alignment (X)</span>
                  <span>{posX.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="-0.6"
                  max="0.6"
                  step="0.01"
                  value={posX}
                  onChange={(e) => setPosX(parseFloat(e.target.value))}
                  className="w-full accent-brand-500 bg-gray-900 h-1 rounded"
                />
              </div>

              {/* Slider posY */}
              <div className="space-y-1">
                <div className="flex justify-between text-gray-400 font-mono text-4xs">
                  <span>Vertical Alignment (Y)</span>
                  <span>{posY.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="-0.6"
                  max="0.6"
                  step="0.01"
                  value={posY}
                  onChange={(e) => setPosY(parseFloat(e.target.value))}
                  className="w-full accent-brand-500 bg-gray-900 h-1 rounded"
                />
              </div>

              {/* Slider Scale */}
              <div className="space-y-1">
                <div className="flex justify-between text-gray-400 font-mono text-4xs">
                  <span>Graphic Scale Size</span>
                  <span>{scale.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.01"
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="w-full accent-brand-500 bg-gray-900 h-1 rounded"
                />
              </div>

              {/* Slider Rotation */}
              <div className="space-y-1">
                <div className="flex justify-between text-gray-400 font-mono text-4xs">
                  <span>Graphic Rotation Angle</span>
                  <span>{rotation}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={rotation}
                  onChange={(e) => setRotation(parseInt(e.target.value, 10))}
                  className="w-full accent-brand-500 bg-gray-900 h-1 rounded"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="pt-6 border-t border-gray-850 space-y-3">
          <button
            onClick={handleAddToCart}
            disabled={saving || uploading}
            className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-850 text-white font-bold rounded-xl transition text-xs shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
            ) : (
              'Save & Add to Cart'
            )}
          </button>
          <p className="text-4xs text-gray-500 text-center leading-relaxed">
            Adds this design configuration to your logged-in session cart. Admin fulfillment will read graphic matrices to print uniforms.
          </p>
        </div>
      </div>
    </div>
  );
}
