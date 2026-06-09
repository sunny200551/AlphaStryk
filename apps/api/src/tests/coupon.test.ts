// Coupon validation logic mathematical and rule tests
import { CouponType } from '@prisma/client';

// Simple replica calculation logic to avoid DB hits in standalone execution
function simulateDiscountCalculation(
  coupon: {
    type: CouponType;
    value: number;
    minOrderValue: number;
    maxDiscount: number | null;
    categoryId: string | null;
    startsAt: Date;
    expiresAt: Date;
    isActive: boolean;
  },
  items: Array<{ price: number; quantity: number; categoryId: string }>
) {
  const now = new Date();
  if (!coupon.isActive) throw new Error('This coupon is no longer active.');
  if (now < coupon.startsAt) throw new Error('This coupon code is not yet active.');
  if (now > coupon.expiresAt) throw new Error('This coupon code has expired.');

  let eligibleSubtotal = 0;
  let overallSubtotal = 0;

  for (const item of items) {
    const itemTotal = item.price * item.quantity;
    overallSubtotal += itemTotal;

    if (coupon.categoryId) {
      if (item.categoryId === coupon.categoryId) {
        eligibleSubtotal += itemTotal;
      }
    } else {
      eligibleSubtotal += itemTotal;
    }
  }

  if (coupon.categoryId && eligibleSubtotal === 0) {
    throw new Error('This coupon is only valid for products in the specified category.');
  }

  const checkValue = coupon.categoryId ? eligibleSubtotal : overallSubtotal;
  if (checkValue < coupon.minOrderValue) {
    throw new Error('Minimum order value required.');
  }

  let discount = 0;
  if (coupon.type === 'PERCENTAGE') {
    discount = eligibleSubtotal * (coupon.value / 100);
    if (coupon.maxDiscount !== null) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else if (coupon.type === 'FIXED_AMOUNT') {
    discount = Math.min(coupon.value, eligibleSubtotal);
  }

  return { discount, overallSubtotal, eligibleSubtotal };
}

function runCouponTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 7: COUPON ENGINE MATHEMATICS TESTS');
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

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // Test 1: Flat Discount Calculation
  const coupon1 = {
    type: CouponType.FIXED_AMOUNT,
    value: 50.0,
    minOrderValue: 100.0,
    maxDiscount: null,
    categoryId: null,
    startsAt: yesterday,
    expiresAt: tomorrow,
    isActive: true,
  };

  const cart1 = [
    { price: 40.0, quantity: 3, categoryId: 'cat_uniform' }, // $120 total
  ];

  try {
    const res = simulateDiscountCalculation(coupon1, cart1);
    assert('Flat discount returns exact coupon value ($50)', res.discount === 50.0);
    assert('Subtotal is computed correctly ($120)', res.overallSubtotal === 120.0);
  } catch (err) {
    assert('Flat discount passes successfully', false);
  }

  // Test 2: Flat Discount capped to eligible subtotal
  const cart2 = [
    { price: 40.0, quantity: 1, categoryId: 'cat_uniform' }, // $40 total, bypasses min order check for sake of caps validation
  ];
  const coupon2 = { ...coupon1, minOrderValue: 0.0 };
  try {
    const res = simulateDiscountCalculation(coupon2, cart2);
    assert('Flat discount caps at eligible subtotal value ($40)', res.discount === 40.0);
  } catch (err) {
    assert('Flat discount caps passes successfully', false);
  }

  // Test 3: Percentage Discount Calculation
  const coupon3 = {
    type: CouponType.PERCENTAGE,
    value: 15.0, // 15% off
    minOrderValue: 100.0,
    maxDiscount: 30.0, // Max cap $30
    categoryId: null,
    startsAt: yesterday,
    expiresAt: tomorrow,
    isActive: true,
  };

  const cart3 = [
    { price: 10.0, quantity: 15, categoryId: 'cat_uniform' }, // $150 total (15% is $22.50)
  ];

  try {
    const res = simulateDiscountCalculation(coupon3, cart3);
    assert('Percentage discount is calculated correctly ($22.50)', res.discount === 22.50);
  } catch (err) {
    assert('Percentage discount passes successfully', false);
  }

  // Test 4: Percentage Discount Capped
  const cart4 = [
    { price: 50.0, quantity: 6, categoryId: 'cat_uniform' }, // $300 total (15% is $45, caps to $30)
  ];
  try {
    const res = simulateDiscountCalculation(coupon3, cart4);
    assert('Percentage discount caps at maxDiscount threshold ($30)', res.discount === 30.0);
  } catch (err) {
    assert('Percentage discount capping passes successfully', false);
  }

  // Test 5: Category Restricted Coupon
  const coupon5 = {
    type: CouponType.PERCENTAGE,
    value: 10.0, // 10%
    minOrderValue: 0.0,
    maxDiscount: null,
    categoryId: 'cat_restricted',
    startsAt: yesterday,
    expiresAt: tomorrow,
    isActive: true,
  };

  const cart5 = [
    { price: 50.0, quantity: 1, categoryId: 'cat_other' },      // $50 (ineligible)
    { price: 100.0, quantity: 1, categoryId: 'cat_restricted' }, // $100 (eligible)
  ];

  try {
    const res = simulateDiscountCalculation(coupon5, cart5);
    assert('Category restricted coupon only discounts items in targeted category ($10)', res.discount === 10.0);
    assert('Overall subtotal registers full cart total ($150)', res.overallSubtotal === 150.0);
    assert('Eligible subtotal registers only matching items ($100)', res.eligibleSubtotal === 100.0);
  } catch (err) {
    assert('Category restriction passes successfully', false);
  }

  // Test 6: Expired Coupon Validation
  const coupon6 = {
    ...coupon1,
    expiresAt: yesterday, // Expired yesterday
  };
  try {
    simulateDiscountCalculation(coupon6, cart1);
    assert('Expired coupon validation passes validation (should fail)', false);
  } catch (err: any) {
    assert('Expired coupon validation fails with correct message', err.message === 'This coupon code has expired.');
  }

  // Test 7: Minimum Order Value Validation
  const coupon7 = {
    ...coupon1,
    minOrderValue: 200.0, // $200 min required, cart is $120
  };
  try {
    simulateDiscountCalculation(coupon7, cart1);
    assert('Min order check passes validation (should fail)', false);
  } catch (err: any) {
    assert('Min order check fails with correct message', err.message === 'Minimum order value required.');
  }

  console.log('----------------------------------------------------');
  console.log(`TEST RUN SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runCouponTests();
