import { calculateGstBreakdown } from '../controllers/invoice';

function runInvoiceTests() {
  console.log('====================================================');
  console.log('STARTING GST AND INVOICE MATHEMATICAL SPLITS TESTS');
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

  // Test 1: Intrastate Tax Split (Maharashtra)
  const subtotal1 = 1000.0;
  const state1 = 'Maharashtra';
  const split1 = calculateGstBreakdown(subtotal1, state1);

  assert(
    'Maharashtra billing state splits Central CGST at 9% ($90)',
    Math.abs(split1.cgst - 90.0) < 0.001
  );

  assert(
    'Maharashtra billing state splits State SGST at 9% ($90)',
    Math.abs(split1.sgst - 90.0) < 0.001
  );

  assert(
    'Maharashtra billing state sets Integrated IGST to 0',
    split1.igst === 0
  );

  assert(
    'Standard tax rate constant equals 18.00%',
    split1.taxRate === 18.00
  );

  // Test 2: Interstate Tax mapping (Karnataka)
  const subtotal2 = 2500.0;
  const state2 = 'Karnataka';
  const split2 = calculateGstBreakdown(subtotal2, state2);

  assert(
    'Out-of-state billing state maps full Integrated IGST at 18% ($450)',
    Math.abs(split2.igst - 450.0) < 0.001
  );

  assert(
    'Out-of-state billing state sets CGST to 0',
    split2.cgst === 0
  );

  assert(
    'Out-of-state billing state sets SGST to 0',
    split2.sgst === 0
  );

  // Test 3: Case insensitivity and trim checks (e.g. "  maharashtra  ")
  const split3 = calculateGstBreakdown(500.0, '  maharashtra  ');
  assert(
    'Trimming and case-insensitivity matches Maharashtra state correctly',
    Math.abs(split3.cgst - 45.0) < 0.001 && split3.igst === 0
  );

  console.log('----------------------------------------------------');
  console.log(`TEST RUN SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runInvoiceTests();
