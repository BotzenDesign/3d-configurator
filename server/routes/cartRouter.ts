/**
 * Cart proxy route — replaces standard Add to Cart with Shopify Draft Orders
 * to support dynamically calculated prices.
 */
import { Router, type Request, type Response } from 'express';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const cartRouter = Router();

cartRouter.post('/checkout', async (req: Request, res: Response) => {
  try {
    const { title, price, quantity, properties } = req.body;

    // Use server-side environment variable directly for better security
    const shopDomain = process.env.VITE_SHOPIFY_DOMAIN;
    
    if (!shopDomain) {
      return res.status(500).json({ error: 'Server misconfiguration: VITE_SHOPIFY_DOMAIN is missing in .env.local' });
    }

    const adminToken = process.env.SHOPIFY_ADMIN_TOKEN;
    if (!adminToken) {
       console.error('[Draft Order Error] SHOPIFY_ADMIN_TOKEN is missing in .env.local');
       return res.status(500).json({ error: 'Server misconfiguration: Shopify Admin API token is missing.' });
    }

    // Convert properties object into Shopify Draft Order properties array [{name, value}]
    const customProperties = properties ? Object.entries(properties).map(([name, value]) => ({
      name,
      value: String(value)
    })) : [];

    const draftOrderPayload = {
      draft_order: {
        line_items: [
          {
            title: title || 'Custom 3D Print',
            price: (price / 100).toFixed(2), // Price comes in as cents, Shopify expects "xx.xx"
            quantity: quantity || 1,
            properties: customProperties,
            requires_shipping: true,
            taxable: true
          }
        ],
        tags: "3D Print Quote",
        note: "Created via Polar 3D Configurator"
      }
    };

    const shopifyUrl = `https://${shopDomain}/admin/api/2024-01/draft_orders.json`;
    const response = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': adminToken
      },
      body: JSON.stringify(draftOrderPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Shopify Draft Order Error]', data);
      const errorMessage = data.errors ? 
        (typeof data.errors === 'string' ? data.errors : JSON.stringify(data.errors)) : 
        'Shopify API error.';
      return res.status(response.status).json({
        error: errorMessage,
      });
    }

    // Return the invoice_url which bypasses the cart and goes straight to checkout
    return res.json({
      success: true,
      checkoutUrl: data.draft_order.invoice_url,
    });

  } catch (err: any) {
    console.error('[Checkout Proxy Error]', err);
    return res.status(500).json({ error: err.message || 'Checkout proxy failed.' });
  }
});

export default cartRouter;
