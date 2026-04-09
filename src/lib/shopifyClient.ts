/**
 * shopifyClient.ts
 * ─────────────────────────────────────────────────────────────────
 * Shopify Buy SDK integration for the 3D Configurator.
 *
 * HOW IT WORKS:
 *  1. Fetches the "3D Print Order" product variant from Shopify
 *  2. Creates a new Shopify checkout
 *  3. Adds the product with all configurator options as line item
 *     custom attributes (visible to you in Shopify Admin → Orders)
 *  4. Returns the checkout web URL to redirect the customer
 *
 * SETUP:
 *  Fill in the 3 values in .env.local before using this module.
 *  See implementation_plan.md for step-by-step instructions.
 * ─────────────────────────────────────────────────────────────────
 */

import Client from "shopify-buy";

// ─── Env Variables (set in .env.local) ───────────────────────────
const SHOPIFY_DOMAIN = import.meta.env.VITE_SHOPIFY_DOMAIN as string;
const SHOPIFY_STOREFRONT_TOKEN = import.meta.env
  .VITE_SHOPIFY_STOREFRONT_TOKEN as string;
const SHOPIFY_PRODUCT_ID = import.meta.env.VITE_SHOPIFY_PRODUCT_ID as string;

// ─── Validate Config ─────────────────────────────────────────────
function assertEnvConfigured() {
  const missing: string[] = [];
  if (!SHOPIFY_DOMAIN || SHOPIFY_DOMAIN === "yourstore.myshopify.com")
    missing.push("VITE_SHOPIFY_DOMAIN");
  if (
    !SHOPIFY_STOREFRONT_TOKEN ||
    SHOPIFY_STOREFRONT_TOKEN === "your_storefront_api_token_here"
  )
    missing.push("VITE_SHOPIFY_STOREFRONT_TOKEN");
  if (!SHOPIFY_PRODUCT_ID || SHOPIFY_PRODUCT_ID === "your_product_id_here")
    missing.push("VITE_SHOPIFY_PRODUCT_ID");

  if (missing.length > 0) {
    throw new Error(
      `Shopify is not configured yet.\n` +
        `Please fill in these values in your .env.local file:\n` +
        missing.map((k) => `  → ${k}`).join("\n")
    );
  }
}

// ─── Build Shopify Client ─────────────────────────────────────────
function buildShopifyClient() {
  assertEnvConfigured();
  return Client.buildClient({
    domain: SHOPIFY_DOMAIN,
    storefrontAccessToken: SHOPIFY_STOREFRONT_TOKEN,
  });
}

// ─── Types ────────────────────────────────────────────────────────
export interface ConfiguratorOptions {
  material: string;
  color: string;
  colorHex: string;
  density: string;
  quantity: number;
  priceEach: number;
  totalPrice: number;
  modelName: string;
  dimensions?: string;
  weight?: string;
  volume?: string;
}

// ─── Main Export ─────────────────────────────────────────────────
/**
 * Creates a Shopify checkout from configurator options.
 * @returns The Shopify checkout URL to redirect the customer to.
 */
export async function createConfiguredCheckout(
  options: ConfiguratorOptions
): Promise<string> {
  assertEnvConfigured();

  const client = buildShopifyClient();

  // 1. Fetch the 3D Print product to get the variant ID
  const product = await client.product.fetch(SHOPIFY_PRODUCT_ID);

  if (!product || !product.variants?.edges?.length) {
    throw new Error(
      `Could not find the "3D Print Order" product in Shopify.\n` +
        `Check that VITE_SHOPIFY_PRODUCT_ID is correct.`
    );
  }

  const variantId = product.variants.edges[0].node.id;

  // 2. Create a blank checkout
  const checkout = await client.checkout.create();

  // 3. Build custom attributes (visible in Shopify Admin → Orders)
  const customAttributes = [
    { key: "Material", value: options.material },
    { key: "Color", value: options.color },
    { key: "Color Hex", value: options.colorHex },
    { key: "Infill Density", value: options.density },
    { key: "Price Per Unit", value: `$${options.priceEach.toFixed(2)}` },
    { key: "Total Price", value: `$${options.totalPrice.toFixed(2)}` },
    { key: "Model File", value: options.modelName },
    ...(options.dimensions
      ? [{ key: "Dimensions", value: options.dimensions }]
      : []),
    ...(options.weight ? [{ key: "Weight", value: options.weight }] : []),
    ...(options.volume ? [{ key: "Volume", value: options.volume }] : []),
    {
      key: "Configured At",
      value: new Date().toLocaleString("en-US", { timeZone: "UTC" }) + " UTC",
    },
  ];

  // 4. Add the product to checkout with all config attributes
  const updatedCheckout = await client.checkout.addLineItems(checkout.id, [
    {
      variantId,
      quantity: options.quantity,
      customAttributes,
    },
  ]);

  return updatedCheckout.webUrl;
}

/**
 * Returns true if Shopify credentials are configured in .env.local.
 * Useful for showing a warning in dev mode.
 */
export function isShopifyConfigured(): boolean {
  return (
    !!SHOPIFY_DOMAIN &&
    SHOPIFY_DOMAIN !== "yourstore.myshopify.com" &&
    !!SHOPIFY_STOREFRONT_TOKEN &&
    SHOPIFY_STOREFRONT_TOKEN !== "your_storefront_api_token_here" &&
    !!SHOPIFY_PRODUCT_ID &&
    SHOPIFY_PRODUCT_ID !== "your_product_id_here"
  );
}
