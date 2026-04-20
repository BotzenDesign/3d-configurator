/**
 * ============================================================================
 * Shopify Checkout Client — Draft Orders API Integration
 * ============================================================================
 * Uses a backend proxy (/api/proxy/cart/checkout) to create secure Draft Orders
 * via the Shopify Admin API. This allows us to set dynamic custom prices
 * for 3D prints, bypassing the static pricing of standard Shopify variants.
 * ============================================================================
 */

export interface CheckoutLineItemProperties {
  _file_name?: string;
  _file_url?: string;
  Material: string;
  Color: string;
  Infill: string;
  Dimensions: string;
  Weight: string;
  'Print Time': string;
  Volume: string;
  Printability: string;
  [key: string]: string | undefined;
}

export interface CreateCheckoutInput {
  title: string;
  quantity: number;
  price: number; // in cents
  properties: CheckoutLineItemProperties;
}

export interface CheckoutResponse {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}

// Client no longer handles domain resolution; server reads it securely.

/**
 * Creates a dynamically priced checkout session via Draft Orders proxy.
 */
export async function createCheckout(input: CreateCheckoutInput): Promise<CheckoutResponse> {

  // Clean properties — Shopify ignores properties with underscore prefix in
  // standard cart UI, but we're using Draft Orders here so we can include it.
  const cleanProperties: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.properties)) {
    if (value !== undefined) cleanProperties[key] = value;
  }

  const payload = {
    title: input.title,
    quantity: input.quantity,
    price: input.price,
    properties: cleanProperties
  };

  const res = await fetch('/api/proxy/cart/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `Checkout proxy error ${res.status}`);
  }

  const data = await res.json() as { checkoutUrl?: string };
  
  if (!data.checkoutUrl) {
    throw new Error('Failed to retrieve checkout URL from Shopify.');
  }

  return {
    success: true,
    checkoutUrl: data.checkoutUrl,
  };
}
