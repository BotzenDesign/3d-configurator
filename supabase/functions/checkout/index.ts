const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { title, price, quantity, properties } = body;

    const shopDomain = Deno.env.get("VITE_SHOPIFY_DOMAIN");
    if (!shopDomain) {
      throw new Error("Server misconfiguration: VITE_SHOPIFY_DOMAIN is missing.");
    }

    const adminToken = Deno.env.get("SHOPIFY_ADMIN_TOKEN");
    if (!adminToken) {
      throw new Error("Server misconfiguration: Shopify Admin API token is missing.");
    }

    // Convert properties { key: value } to Shopify Draft Order Array [{name, value}]
    const customProperties = properties
      ? Object.entries(properties).map(([name, value]) => ({
          name,
          value: String(value),
        }))
      : [];

    const draftOrderPayload = {
      draft_order: {
        line_items: [
          {
            title: title || "Custom 3D Print",
            price: (price / 100).toFixed(2), // Price comes in as cents
            quantity: quantity || 1,
            properties: customProperties,
            requires_shipping: true,
            taxable: true,
          },
        ],
        tags: "3D Print Quote",
        note: "Created via Polar 3D Configurator",
      },
    };

    const shopifyUrl = `https://${shopDomain}/admin/api/2024-01/draft_orders.json`;
    const response = await fetch(shopifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
      body: JSON.stringify(draftOrderPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.errors
        ? typeof data.errors === "string"
          ? data.errors
          : JSON.stringify(data.errors)
        : "Shopify API error.";
      throw new Error(errorMessage);
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkoutUrl: data.draft_order.invoice_url,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Checkout proxy failed." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
