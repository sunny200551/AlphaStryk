import crypto from 'crypto';

// Replicate signature calculation logic for testing
function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  keySecret: string
): boolean {
  const hmac = crypto.createHmac('sha256', keySecret);
  hmac.update(razorpayOrderId + '|' + razorpayPaymentId);
  const generatedSignature = hmac.digest('hex');
  return generatedSignature === razorpaySignature;
}

function generatePhonePeChecksum(
  payload: any,
  endpoint: string,
  saltKey: string,
  saltIndex: string
): { base64Payload: string; xVerifyHeader: string } {
  const buffer = Buffer.from(JSON.stringify(payload));
  const base64Payload = buffer.toString('base64');
  const verifyString = base64Payload + endpoint + saltKey;
  const sha255Checksum = crypto.createHash('sha256').update(verifyString).digest('hex');
  const xVerifyHeader = `${sha255Checksum}###${saltIndex}`;
  return { base64Payload, xVerifyHeader };
}

// Running unit tests assertions
function runTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 4: PAYMENT SECURITY ALGORITHMS TESTS');
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

  // Test 1: Razorpay Signature Verification
  const rzpOrderId = 'order_test_123';
  const rzpPayId = 'pay_test_456';
  const rzpSecret = 'mySecretKeyABC';
  // Compute expected signature
  const hmac = crypto.createHmac('sha256', rzpSecret);
  hmac.update(rzpOrderId + '|' + rzpPayId);
  const correctRzpSignature = hmac.digest('hex');

  assert(
    'Razorpay signature verification accepts valid signatures',
    verifyRazorpaySignature(rzpOrderId, rzpPayId, correctRzpSignature, rzpSecret) === true
  );

  assert(
    'Razorpay signature verification rejects invalid signatures',
    verifyRazorpaySignature(rzpOrderId, rzpPayId, 'wrong_signature_here', rzpSecret) === false
  );

  // Test 2: PhonePe Payload Base64 Encryption & Header Generation
  const phonepePayload = {
    merchantId: 'PGTESTPAYUAT',
    merchantTransactionId: 'TXN-AS-1234',
    amount: 15000,
  };
  const phonepeEndpoint = '/pg/v1/pay';
  const phonepeSalt = '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
  const phonepeSaltIdx = '1';

  const { base64Payload, xVerifyHeader } = generatePhonePeChecksum(
    phonepePayload,
    phonepeEndpoint,
    phonepeSalt,
    phonepeSaltIdx
  );

  // Assert base64 decoding matches original payload
  const decoded = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf-8'));
  assert(
    'PhonePe base64 payload correctly matches original payload values',
    decoded.merchantTransactionId === 'TXN-AS-1234' && decoded.amount === 15000
  );

  // Assert header contains index suffix
  assert(
    'PhonePe verify header contains correct salt index suffix',
    xVerifyHeader.endsWith('###1') === true
  );

  // Assert header signature is valid SHA256 string length
  const signaturePart = xVerifyHeader.split('###')[0];
  assert(
    'PhonePe verify header signature part has 64-character hex hash length',
    signaturePart.length === 64
  );

  console.log('----------------------------------------------------');
  console.log(`TEST RUN SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
