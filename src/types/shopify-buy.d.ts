/**
 * Shopify Buy SDK type declarations.
 * The shopify-buy package does not ship full TypeScript types,
 * so we declare the minimum interface we need here.
 */
declare module "shopify-buy" {
  interface ImageEdge {
    node: { src: string };
  }

  interface ProductVariant {
    id: string;
    price: { amount: string; currencyCode: string };
  }

  interface Product {
    variants: { edges: Array<{ node: ProductVariant }> };
    images: { edges: ImageEdge[] };
  }

  interface LineItemInput {
    variantId: string;
    quantity: number;
    customAttributes?: Array<{ key: string; value: string }>;
  }

  interface Checkout {
    id: string;
    webUrl: string;
    lineItems: unknown[];
  }

  interface Client {
    product: {
      fetch(productId: string): Promise<Product>;
    };
    checkout: {
      create(): Promise<Checkout>;
      addLineItems(
        checkoutId: string,
        lineItems: LineItemInput[]
      ): Promise<Checkout>;
    };
  }

  interface ClientConfig {
    domain: string;
    storefrontAccessToken: string;
  }

  function buildClient(config: ClientConfig): Client;

  export default { buildClient };
}
