/**
 * ============================================================================
 * App Proxy Router
 * ============================================================================
 * Handles all routes served through Shopify's App Proxy.
 *
 * Shopify proxies requests like:
 *   https://your-store.myshopify.com/apps/configurator/validate
 *   → https://your-app.vercel.app/api/proxy/validate
 *
 * All requests pass through HMAC verification before reaching these handlers.
 *
 * Setup in Shopify Partner Dashboard:
 *   App → App proxy → Subpath prefix: /apps/configurator
 *   App → App proxy → Proxy URL: https://your-app.vercel.app/api/proxy
 * ============================================================================
 */

import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fileValidationService } from '../services/fileValidationService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const proxyRouter = Router();

// ── Upload Configuration ─────────────────────────────────────────────────
const uploadDirectory = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const upload = multer({
  dest: uploadDirectory,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ── Health Check ─────────────────────────────────────────────────────────
proxyRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Polar 3D Configurator — App Proxy',
    timestamp: new Date().toISOString(),
  });
});

// ── File Validation (proxied) ────────────────────────────────────────────
proxyRouter.post('/validate', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded.',
      });
    }

    const report = await fileValidationService.validateFile(
      file.path,
      file.originalname,
      file.size
    );

    // Cleanup temp file
    fs.unlink(file.path, (err) => {
      if (err) console.error(`[Proxy] Failed to delete temp file ${file.path}:`, err);
    });

    if (!report.isValid) {
      return res.status(422).json({
        success: false,
        message: 'File validation failed.',
        ...report,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'File successfully validated.',
      ...report,
    });
  } catch (error: any) {
    console.error('[Proxy] Validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during file validation.',
    });
  }
});

// ── Quote Endpoint (proxied) ─────────────────────────────────────────────
proxyRouter.post('/quote', async (req, res) => {
  try {
    const { volume, surfaceArea, material, density, quantity } = req.body;

    if (!volume || !material) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: volume, material.',
      });
    }

    // Basic pricing calculation (will be expanded in Phase 4)
    const materialRates: Record<string, number> = {
      PLA: 0.12,
      PETG: 0.15,
      ABS: 0.14,
      TPU: 0.25,
      Nylon: 0.30,
    };

    const rate = materialRates[material] || 0.12;
    const densityMultiplier = (parseFloat(density) || 20) / 20;
    const weightGrams = (volume / 1000) * 1.24 * densityMultiplier; // PLA default density
    const basePrice = weightGrams * rate + 15; // $15 base fee
    const totalPrice = basePrice * (quantity || 1);

    return res.status(200).json({
      success: true,
      quote: {
        pricePerUnit: +basePrice.toFixed(2),
        totalPrice: +totalPrice.toFixed(2),
        weightGrams: +weightGrams.toFixed(1),
        material,
        density: density || '20%',
        quantity: quantity || 1,
        currency: 'USD',
      },
    });
  } catch (error: any) {
    console.error('[Proxy] Quote error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during quote generation.',
    });
  }
});

// ── Session Info (proxied) ───────────────────────────────────────────────
proxyRouter.get('/session', (req, res) => {
  const sessionCtx = (req as any).sessionCtx || {};
  const proxyInfo = (req as any).shopifyProxy || {};

  res.json({
    success: true,
    session: {
      shop: sessionCtx.shop || proxyInfo.shop || null,
      customerId: sessionCtx.customerId || null,
      isAuthenticated: sessionCtx.isAuthenticated || false,
    },
  });
});

export default proxyRouter;
