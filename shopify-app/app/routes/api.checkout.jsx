import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * Draft Orders Proxy — api.checkout.jsx
 *
 * The storefront widget calls POST /api/checkout with:
 *   { title, quantity, price (cents), properties }
 *
 * This server action uses the merchant's stored Shopify Admin API
 * token to create a Draft Order with a custom price, then returns
 * the invoice_url as the checkout link.
 *
 * Security: Shopify Admin token is NEVER exposed to the browser —
 * it lives only in the server session.
 */

// CORS helper — the widget runs on the merchant's storefront domain
function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// Handle OPTIONS preflight
export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  return json({ ok: true });
};

export const action = async ({ request }) => {
  const headers = corsHeaders(request);

  try {
    // Parse the request body
    const body = await request.json();
    const { title, quantity = 1, price, properties = {}, shop } = body;

    if (!price || !title) {
      return json(
        { error: "Missing required fields: title, price" },
        { status: 400, headers }
      );
    }

    // Get the shop's authenticated admin session
    // The widget must pass the shop domain so we can look up its session
    if (!shop) {
      return json({ error: "Missing shop domain" }, { status: 400, headers });
    }

    const { admin } = await authenticate.public.appProxy(request);

    // Build line item properties for the draft order
    const lineItemProperties = Object.entries(properties).map(([name, value]) => ({
      name,
      value: String(value),
    }));

    // Create Draft Order via Shopify GraphQL Admin API
    const response = await admin.graphql(
      `#graphql
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            invoiceUrl
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          input: {
            lineItems: [
              {
                title,
                quantity: Number(quantity),
                originalUnitPrice: (Number(price) / 100).toFixed(2),
                customAttributes: lineItemProperties,
              },
            ],
            note: "Created by Polar 3D Configurator",
            tags: ["3d-print", "custom-quote"],
          },
        },
      }
    );

    const data = await response.json();
    const draftOrder = data?.data?.draftOrderCreate?.draftOrder;
    const userErrors = data?.data?.draftOrderCreate?.userErrors;

    if (userErrors?.length > 0) {
      return json(
        { error: userErrors[0].message },
        { status: 422, headers }
      );
    }

    if (!draftOrder?.invoiceUrl) {
      return json(
        { error: "Failed to create checkout — no invoice URL returned" },
        { status: 500, headers }
      );
    }

    return json({ checkoutUrl: draftOrder.invoiceUrl }, { headers });
  } catch (err) {
    console.error("[Checkout Proxy Error]", err);
    return json(
      { error: err.message || "Internal server error" },
      { status: 500, headers }
    );
  }
};
