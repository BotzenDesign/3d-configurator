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
    const { items, title, price, quantity, properties, weight_in_grams } = body;

    const shopDomain = Deno.env.get("VITE_SHOPIFY_DOMAIN");
    if (!shopDomain) {
      throw new Error("Server misconfiguration: VITE_SHOPIFY_DOMAIN is missing.");
    }

    const adminToken = Deno.env.get("SHOPIFY_ADMIN_TOKEN");
    if (!adminToken) {
      throw new Error("Server misconfiguration: Shopify Admin API token is missing.");
    }

    let lineItems: any[] = [];

    if (Array.isArray(items) && items.length > 0) {
      lineItems = items.map((item: any) => {
        const itemProps = item.properties
          ? Object.entries(item.properties).map(([name, value]) => ({
              name,
              value: String(value),
            }))
          : [];

        return {
          title: item.title || "Custom 3D Print",
          price: (Number(item.price) / 100).toFixed(2),
          quantity: Number(item.quantity) || 1,
          grams: item.weight_in_grams ? Math.round(Number(item.weight_in_grams)) : 0,
          properties: itemProps,
          requires_shipping: true,
          taxable: true,
        };
      });
    } else {
      // Convert properties { key: value } to Shopify Draft Order Array [{name, value}]
      const customProperties = properties
        ? Object.entries(properties).map(([name, value]) => ({
            name,
            value: String(value),
          }))
        : [];

      lineItems = [
        {
          title: title || "Custom 3D Print",
          price: (Number(price) / 100).toFixed(2),
          quantity: Number(quantity) || 1,
          grams: weight_in_grams ? Math.round(Number(weight_in_grams)) : 0,
          properties: customProperties,
          requires_shipping: true,
          taxable: true,
        },
      ];
    }

    const draftOrderPayload = {
      draft_order: {
        line_items: lineItems,
        tags: "3D Print Quote",
        note: `Created via Polar 3D Configurator (${lineItems.length} custom parts)`,
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
