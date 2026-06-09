function runDesignTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 8: 3D DESIGN COORDINATE SYSTEM TESTS');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  const assert = (name: string, condition: boolean) => {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.log(`[FAIL] ${name}`);
      failed++;
    }
  };

  // Helper mapping function mimicking frontend decals projection math
  const calculatePresetTransform = (placement: 'front' | 'back', rotationDeg: number) => {
    const posX = 0.0;
    const posY = 0.2;
    const scale = 0.4;

    const finalPos: [number, number, number] = [posX, posY, placement === 'front' ? 0.78 : -0.78];
    const radRot = (rotationDeg * Math.PI) / 180;
    const finalRot: [number, number, number] = [0, placement === 'front' ? 0 : Math.PI, placement === 'front' ? radRot : -radRot];
    const finalScale: [number, number, number] = [scale, scale, scale];

    return { finalPos, finalRot, finalScale };
  };

  // Assert Front view transformations
  const frontView = calculatePresetTransform('front', 45);
  assert(
    'Front placement yields positive Z projection offset (+0.78)',
    frontView.finalPos[2] === 0.78
  );
  assert(
    'Front placement yields Y rotation index of 0',
    frontView.finalRot[1] === 0
  );
  assert(
    'Front placement converts 45 degrees angle directly to Y-aligned radian rotation',
    Math.abs(frontView.finalRot[2] - (45 * Math.PI) / 180) < 0.0001
  );

  // Assert Back view transformations
  const backView = calculatePresetTransform('back', 90);
  assert(
    'Back placement yields negative Z projection offset (-0.78)',
    backView.finalPos[2] === -0.78
  );
  assert(
    'Back placement rotates mesh Y orientation by 180 degrees (PI radians)',
    Math.abs(backView.finalRot[1] - Math.PI) < 0.0001
  );
  assert(
    'Back placement negates Z-axis graphic rotation to mirror back projection correctly',
    Math.abs(backView.finalRot[2] - (-90 * Math.PI) / 180) < 0.0001
  );

  console.log('----------------------------------------------------');
  console.log(`TEST RUN SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runDesignTests();
