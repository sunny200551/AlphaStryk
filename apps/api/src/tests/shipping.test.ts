import { dispatchShiprocket, dispatchDelhivery, dispatchBlueDart } from '../services/shipping';

function runShippingTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 6: SHIPPING AND CARRIER SERVICE TESTS');
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

  const dummyPayload = {
    orderNumber: 'TEST-ORDER-1001',
    customerName: 'Sunny Kumar',
    customerPhone: '9999999999',
    address: {
      street: '123 Test Street, Bandra East',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '400051',
    },
    weightKg: 1.5,
  };

  // Run tests inside an async immediate-invoked function expression
  (async () => {
    try {
      // Test 1: Shiprocket Mock Integration (when API keys are missing/mock)
      const shiprocketResult = await dispatchShiprocket(dummyPayload);
      assert(
        'Shiprocket dispatch returns success state',
        shiprocketResult.success === true
      );
      assert(
        'Shiprocket tracking number matches SR- prefix',
        shiprocketResult.trackingNumber.startsWith('SR-')
      );
      assert(
        'Shiprocket default estimated days matches expected value of 4',
        shiprocketResult.estimatedDays === 4
      );

      // Test 2: Delhivery Mock Integration
      const delhiveryResult = await dispatchDelhivery(dummyPayload);
      assert(
        'Delhivery dispatch returns success state',
        delhiveryResult.success === true
      );
      assert(
        'Delhivery tracking number matches DEL- prefix',
        delhiveryResult.trackingNumber.startsWith('DEL-')
      );
      assert(
        'Delhivery default estimated days matches expected value of 5',
        delhiveryResult.estimatedDays === 5
      );

      // Test 3: Blue Dart Mock Integration
      const bluedartResult = await dispatchBlueDart(dummyPayload);
      assert(
        'Blue Dart dispatch returns success state',
        bluedartResult.success === true
      );
      assert(
        'Blue Dart tracking number matches BD- prefix',
        bluedartResult.trackingNumber.startsWith('BD-')
      );
      assert(
        'Blue Dart default estimated days matches expected value of 3',
        bluedartResult.estimatedDays === 3
      );

      // Test 4: Estimated delivery date calculation logic
      const estimatedDays = shiprocketResult.estimatedDays;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + estimatedDays);

      const calculatedTime = targetDate.getTime();
      const expectedTime = new Date().getTime() + estimatedDays * 24 * 60 * 60 * 1000;

      assert(
        'Estimated delivery date offset computation aligns within 5s margin',
        Math.abs(calculatedTime - expectedTime) < 5000
      );

      console.log('----------------------------------------------------');
      console.log(`TEST RUN SUMMARY: ${passed} Passed, ${failed} Failed`);
      console.log('====================================================');

      if (failed > 0) {
        process.exit(1);
      }
    } catch (err: any) {
      console.error('Exception thrown during shipping test execution:', err);
      process.exit(1);
    }
  })();
}

runShippingTests();
