/**
 * Shipping Carrier Integration Services (Shiprocket, Delhivery, Blue Dart)
 */

interface ShippingDispatchPayload {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  weightKg: number;
}

const isShiprocketConfigured = () => {
  return (
    process.env.SHIPROCKET_EMAIL &&
    process.env.SHIPROCKET_PASSWORD &&
    process.env.SHIPROCKET_EMAIL !== 'mock@shiprocket.com'
  );
};

const isDelhiveryConfigured = () => {
  return (
    process.env.DELHIVERY_API_TOKEN &&
    process.env.DELHIVERY_API_TOKEN !== 'mock_delhivery_token'
  );
};

const isBlueDartConfigured = () => {
  return (
    process.env.BLUEDART_CUSTOMER_CODE &&
    process.env.BLUEDART_LICENSE_KEY &&
    process.env.BLUEDART_LICENSE_KEY !== 'mock_bluedart_key'
  );
};

/**
 * Dispatch Shipment via Shiprocket
 */
export const dispatchShiprocket = async (payload: ShippingDispatchPayload) => {
  if (!isShiprocketConfigured()) {
    // Return mock integration result
    const mockAwb = `SR-${Math.floor(100000000 + Math.random() * 900000000)}`;
    return {
      success: true,
      carrier: 'SHIPROCKET',
      trackingNumber: mockAwb,
      estimatedDays: 4,
      rawResponse: { note: 'Shiprocket mock transaction logged', awb: mockAwb },
    };
  }

  try {
    // 1. Authenticate with Shiprocket API
    const authRes = await fetch('https://apiv2.shiprocket.in/v2/jwt/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD,
      }),
    });

    const authData: any = await authRes.json();
    if (!authRes.ok || !authData.token) {
      throw new Error(authData.message || 'Shiprocket authentication failed.');
    }

    const token = authData.token;

    // 2. Create Order & Generate shipment AWB
    const orderPayload = {
      order_id: payload.orderNumber,
      order_date: new Date().toISOString().slice(0, 10),
      pickup_location: 'Mumbai Warehouse',
      billing_customer_name: payload.customerName,
      billing_last_name: '',
      billing_address: payload.address.street,
      billing_city: payload.address.city,
      billing_pincode: payload.address.postalCode,
      billing_state: payload.address.state,
      billing_country: payload.address.country,
      billing_email: 'customer@alphastryk.com',
      billing_phone: payload.customerPhone || '9999999999',
      shipping_is_billing: true,
      order_items: [
        {
          name: 'Athletic Team Uniforms',
          sku: 'AS-UNIFORMS',
          units: 1,
          selling_price: '100',
        },
      ],
      payment_method: 'Prepaid',
      sub_total: 100,
      length: 10,
      width: 10,
      height: 10,
      weight: payload.weightKg || 0.5,
    };

    const res = await fetch('https://apiv2.shiprocket.in/v2/jwt/orders/create/adhoc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const resData: any = await res.json();
    if (!res.ok) {
      throw new Error(resData.message || 'Failed to dispatch Shiprocket adhoc order.');
    }

    // Capture AWB
    const trackingNumber = resData.awb_code || `SR-AWB-${resData.shipment_id}`;
    return {
      success: true,
      carrier: 'SHIPROCKET',
      trackingNumber,
      estimatedDays: 4,
      rawResponse: JSON.parse(JSON.stringify(resData)),
    };
  } catch (error: any) {
    console.error('Shiprocket API error:', error);
    throw new Error(error.message || 'Shiprocket aggregator failure.');
  }
};

/**
 * Dispatch Shipment via Delhivery
 */
export const dispatchDelhivery = async (payload: ShippingDispatchPayload) => {
  if (!isDelhiveryConfigured()) {
    const mockAwb = `DEL-${Math.floor(100000000 + Math.random() * 900000000)}`;
    return {
      success: true,
      carrier: 'DELHIVERY',
      trackingNumber: mockAwb,
      estimatedDays: 5,
      rawResponse: { note: 'Delhivery mock transaction logged', awb: mockAwb },
    };
  }

  try {
    const hostUrl = 'https://track.delhivery.com'; // Preprod sandbox host
    const apiToken = process.env.DELHIVERY_API_TOKEN;

    const shipmentPayload = {
      format: 'json',
      data: {
        shipments: [
          {
            name: payload.customerName,
            add: payload.address.street,
            pin: payload.address.postalCode,
            phone: payload.customerPhone || '9999999999',
            payment_mode: 'Prepaid',
            order: payload.orderNumber,
            client: 'ALPHASTRYK',
            weight: payload.weightKg * 1000, // in grams
          },
        ],
      },
    };

    const res = await fetch(`${hostUrl}/api/cmu/create.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${apiToken}`,
      },
      body: JSON.stringify(shipmentPayload),
    });

    const resData: any = await res.json();
    if (!res.ok || !resData.success) {
      throw new Error(resData.rmk || 'Delhivery CMU order dispatch failed.');
    }

    const trackingNumber = resData.packages[0]?.waybill || `DEL-${Date.now()}`;
    return {
      success: true,
      carrier: 'DELHIVERY',
      trackingNumber,
      estimatedDays: 5,
      rawResponse: JSON.parse(JSON.stringify(resData)),
    };
  } catch (error: any) {
    console.error('Delhivery API error:', error);
    throw new Error(error.message || 'Delhivery carrier failure.');
  }
};

/**
 * Dispatch Shipment via Blue Dart
 */
export const dispatchBlueDart = async (payload: ShippingDispatchPayload) => {
  if (!isBlueDartConfigured()) {
    const mockAwb = `BD-${Math.floor(100000000 + Math.random() * 900000000)}`;
    return {
      success: true,
      carrier: 'BLUEDART',
      trackingNumber: mockAwb,
      estimatedDays: 3,
      rawResponse: { note: 'Blue Dart mock transaction logged', awb: mockAwb },
    };
  }

  try {
    // Blue Dart SOAP XML or REST UAT client request
    // For sandbox onboarding, we construct the REST headers structure
    const customerCode = process.env.BLUEDART_CUSTOMER_CODE;
    const licenseKey = process.env.BLUEDART_LICENSE_KEY;

    // Call Blue Dart UAT service
    const response = await fetch('https://api.bluedart.com/servlet/webservice/waybill', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'JWT-Token': licenseKey || '',
      },
      body: JSON.stringify({
        customerCode,
        orderId: payload.orderNumber,
        consigneeName: payload.customerName,
        address1: payload.address.street,
        pincode: payload.address.postalCode,
        phone: payload.customerPhone || '9999999999',
        prepaid: true,
      }),
    });

    const resData: any = await response.json();
    if (!response.ok) {
      throw new Error(resData.message || 'Blue Dart waybill generation failed.');
    }

    const trackingNumber = resData.wayBillNumber || `BD-${Date.now()}`;
    return {
      success: true,
      carrier: 'BLUEDART',
      trackingNumber,
      estimatedDays: 3,
      rawResponse: JSON.parse(JSON.stringify(resData)),
    };
  } catch (error: any) {
    console.error('Blue Dart API error:', error);
    throw new Error(error.message || 'Blue Dart carrier failure.');
  }
};
