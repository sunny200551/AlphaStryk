'use client';

import React, { Suspense } from 'react';
import { Decal, useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface TShirtModelProps {
  color: string;
  decalUrl: string | null;
  decalPos: [number, number, number];
  decalRot: [number, number, number];
  decalScale: [number, number, number];
}

// Sub-component to safely load texture with React Suspense
function TShirtDecal({
  decalUrl,
  position,
  rotation,
  scale,
}: {
  decalUrl: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}) {
  try {
    const texture = useTexture(decalUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;

    return (
      <Decal
        position={position}
        rotation={rotation}
        scale={scale}
        map={texture}
      />
    );
  } catch (error) {
    console.error('Decal texture load failed:', error);
    return null;
  }
}

export default function TShirtModel({
  color,
  decalUrl,
  decalPos,
  decalRot,
  decalScale,
}: TShirtModelProps) {
  return (
    <group>
      {/* Torus Collar */}
      <mesh castShadow position={[0, 0.82, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.31, 0.05, 16, 64]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.05} />
      </mesh>

      {/* Main Chest/Body Cylinder */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[0.78, 0.72, 1.6, 64]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.05} />

        {/* Project Decal on front chest mesh */}
        {decalUrl && (
          <Suspense fallback={null}>
            <TShirtDecal
              decalUrl={decalUrl}
              position={decalPos}
              rotation={decalRot}
              scale={decalScale}
            />
          </Suspense>
        )}
      </mesh>

      {/* Left Sleeve Cylinder */}
      <mesh
        castShadow
        position={[-0.88, 0.48, 0]}
        rotation={[0, 0, Math.PI / 6]}
      >
        <cylinderGeometry args={[0.26, 0.22, 0.5, 32]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.05} />
      </mesh>

      {/* Right Sleeve Cylinder */}
      <mesh
        castShadow
        position={[0.88, 0.48, 0]}
        rotation={[0, 0, -Math.PI / 6]}
      >
        <cylinderGeometry args={[0.26, 0.22, 0.5, 32]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.05} />
      </mesh>
    </group>
  );
}
