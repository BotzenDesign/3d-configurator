import { authenticate } from "../shopify.server";

/**
 * Webhook handler for all Shopify webhook subscriptions.
 * Shopify verifies the HMAC signature before this runs.
 *
 * GDPR webhooks (required for App Store submission):
 *   - CUSTOMERS_DATA_REQUEST
 *   - CUSTOMERS_REDACT
 *   - SHOP_REDACT
 *
 * Business webhooks:
 *   - ORDERS_CREATE (log 3D print orders)
 */
export const action = async ({ request }) => {
  const { topic, shop, session, admin, payload } =
    await authenticate.webhook(request);

  if (!admin && topic !== "SHOP_REDACT") {
    // The admin context is not available for shop redact webhooks
    throw new Response("Unauthorized", { status: 401 });
  }

  switch (topic) {
    // ── GDPR Mandatory Webhooks ──────────────────────────────────────
    case "CUSTOMERS_DATA_REQUEST":
      /**
       * Shopify asks: "What data do you hold for this customer?"
       * Since we store no PII (all data is in the merchant's Supabase),
       * we simply acknowledge. If you store customer emails/files,
       * log them here and email data to customer if required.
       */
      console.log(`[GDPR] Data request for shop ${shop}:`, payload);
      break;

    case "CUSTOMERS_REDACT":
      /**
       * Customer requested deletion. We store no PII in Prisma —
       * only Shopify session tokens (no customer data).
       * Acknowledge immediately.
       */
      console.log(`[GDPR] Customer redact for shop ${shop}:`, payload);
      break;

    case "SHOP_REDACT":
      /**
       * Merchant uninstalled the app. Clean up their session from Prisma.
       */
      console.log(`[GDPR] Shop redact for ${shop}`);
      // Session cleanup is automatic via SessionStorage
      break;

    // ── Business Webhooks ────────────────────────────────────────────
    case "ORDERS_CREATE":
      /**
       * A new order was created. Log 3D print orders for analytics.
       * You can extend this to: send confirmation emails, update
       * a print queue, or notify your print operators.
       */
      console.log(`[Orders] New order on ${shop}:`, {
        id: payload.id,
        name: payload.name,
        total: payload.total_price,
        lineItems: payload.line_items?.length,
      });
      break;

    default:
      console.warn(`[Webhooks] Unhandled topic: ${topic}`);
  }

  return new Response(null, { status: 200 });
};
