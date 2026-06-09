'use client';

import React, { useEffect, Suspense } from 'react';
import Link from 'next/link';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import TShirtModel from './TShirtModel';

// Camera controller inside Canvas context
function CameraRig({ view }: { view: 'front' | 'back' | 'left' | 'right' }) {
  const { camera } = useThree();
  useEffect(() => {
    if (view === 'front') {
      camera.position.set(0, 0, 2.5);
    } else if (view === 'back') {
      camera.position.set(0, 0, -2.5);
    } else if (view === 'left') {
      camera.position.set(-2.2, 0.3, 0);
    } else if (view === 'right') {
      camera.position.set(2.2, 0.3, 0);
    }
    camera.lookAt(0, 0, 0);
  }, [view, camera]);

  return null;
}

interface TShirtCustomizerCanvasProps {
  color: string;
  decalUrl: string | null;
  calculatedPos: [number, number, number];
  calculatedRot: [number, number, number];
  calculatedScale: [number, number, number];
  cameraView: 'front' | 'back' | 'left' | 'right';
  setCameraView: (view: 'front' | 'back' | 'left' | 'right') => void;
  placement: 'front' | 'back';
  setPlacement: (placement: 'front' | 'back') => void;
}

export default function TShirtCustomizerCanvas({
  color,
  decalUrl,
  calculatedPos,
  calculatedRot,
  calculatedScale,
  cameraView,
  setCameraView,
  placement,
  setPlacement,
}: TShirtCustomizerCanvasProps) {
  return (
    <div className="flex-1 h-[50vh] lg:h-screen relative bg-gradient-to-b from-gray-900 to-gray-950">
      <div className="absolute top-6 left-6 z-10 space-y-1">
        <Link href="/" className="font-extrabold text-xl tracking-wider text-gradient font-outfit">
          ALPHASTRYK
        </Link>
        <span className="block text-4xs text-gray-500 font-mono">3D APPAREL CONFIGURATOR v1.0</span>
      </div>

      {/* Preset views floating shortcuts */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2.5 bg-gray-950/70 p-2 rounded-xl border border-gray-800 backdrop-blur-md">
        {(['front', 'back', 'left', 'right'] as const).map((view) => (
          <button
            key={view}
            onClick={() => {
              setCameraView(view);
              if (view === 'front' || view === 'back') {
                setPlacement(view);
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-4xs font-bold uppercase tracking-wider transition ${
              cameraView === view ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {view}
          </button>
        ))}
      </div>

      <Canvas shadows camera={{ position: [0, 0, 2.5], fov: 50 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 10, 10]} intensity={1.5} castShadow />
        <directionalLight position={[-10, 10, -10]} intensity={0.5} />
        
        <Suspense fallback={null}>
          <TShirtModel
            color={color}
            decalUrl={decalUrl}
            decalPos={calculatedPos}
            decalRot={calculatedRot}
            decalScale={calculatedScale}
          />
        </Suspense>

        <CameraRig view={cameraView} />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
      </Canvas>
    </div>
  );
}
