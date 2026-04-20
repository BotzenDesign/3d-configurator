/**
 * ============================================================================
 * Polar 3D Configurator — Express API Server
 * ============================================================================
 * Serves:
 *   - /api/validate       → Direct file validation (dev + prod)
 *   - /api/health         → Health check
 *   - /api/proxy/*        → Shopify App Proxy routes (HMAC verified)
 *   - /api/session/csrf   → CSRF token endpoint
 *
 * Middleware chain:
 *   1. Dynamic CORS (Shopify domain whitelisting)
 *   2. Session context extraction
 *   3. Rate limiting (per shop)
 *   4. HMAC verification (proxy routes only)
 *   5. Session token verification (authenticated routes)
 *   6. CSRF protection (state-changing requests)
 * ============================================================================
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Services
import { fileValidationService } from './services/fileValidationService';
import { geometryAnalysisService } from './services/geometryAnalysisService';
import { materialEstimationEngine, MATERIALS, type MaterialId } from './services/materialEstimationEngine';
import { pricingService } from './services/pricingService';

// Middleware
import { verifyShopifyProxy, verifySessionToken } from './middleware/shopifyProxyAuth';
import {
  shopifyCorsConfig,
  sessionContext,
  csrfProtection,
  rateLimiter,
} from './middleware/sessionManager';

// Routes
import proxyRouter from './routes/proxyRouter';
import cartRouter from './routes/cartRouter';

// ── Config ───────────────────────────────────────────────────────────────
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ── Global Middleware ────────────────────────────────────────────────────

// 1. CORS — dynamically allow Shopify storefronts
app.use(cors(shopifyCorsConfig()));

// 2. Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 3. Session context extraction (reads shop/customer from headers)
app.use(sessionContext);

// 4. Rate limiting — 100 requests per minute per shop
app.use(rateLimiter(100, 60_000));

// 5. Session token verification for authenticated requests
app.use(verifySessionToken);

// ── Upload Configuration ─────────────────────────────────────────────────
const uploadDirectory = process.env.VERCEL 
  ? path.join(os.tmpdir(), 'uploads') 
  : path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const upload = multer({
  dest: uploadDirectory,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// ── Health Check ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Polar 3D Configurator API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: IS_PRODUCTION ? 'production' : 'development',
  });
});

// ── CSRF Token Endpoint ──────────────────────────────────────────────────
app.get('/api/session/csrf', csrfProtection, (_req, res) => {
  // The CSRF token is set in the response header by the middleware
  res.json({ success: true, message: 'CSRF token issued in X-CSRF-Token header.' });
});

// ── Direct File Validation (non-proxy) ───────────────────────────────────
app.post('/api/validate', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const report = await fileValidationService.validateFile(
      file.path,
      file.originalname,
      file.size
    );

    // Clean up temporary file
    fs.unlink(file.path, (err) => {
      if (err) console.error(`Failed to delete temporary file ${file.path}:`, err);
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
    console.error('Validation API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during validation.',
    });
  }
});

// ── Geometry Analysis + Material Estimation ─────────────────────────────
app.post('/api/analyze', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded.' });

    const ext = file.originalname.toLowerCase().split('.').pop();
    const fileType = ext === 'obj' ? 'OBJ' : 'STL';

    // Parse request body parameters
    const materialId: MaterialId = (req.body.material || 'PLA') as MaterialId;
    const infillPct = Math.max(5, Math.min(100, parseInt(req.body.infill || '20', 10)));
    const layerHeight = parseFloat(req.body.layerHeight || '0.2');

    if (!MATERIALS[materialId]) {
      return res.status(400).json({ error: `Unknown material: ${materialId}` });
    }

    const buffer = fs.readFileSync(file.path);

    // Run geometry analysis
    const geometry = await geometryAnalysisService.analyzeBuffer(buffer, fileType);

    // Run material estimation
    const estimation = materialEstimationEngine.estimate({
      volumeCm3: geometry.volumeCm3,
      surfaceAreaCm2: geometry.surfaceAreaCm2,
      boundingBox: geometry.boundingBox,
      materialId,
      infill: {
        percentage: infillPct,
        pattern: 'grid',
        shellCount: 3,
        topBottomLayers: 4,
      },
      needsSupport: !geometry.quality.isManifold || MATERIALS[materialId].requiresSupport,
      layerHeightMm: layerHeight,
    });

    // Clean up temp file
    fs.unlink(file.path, () => {});

    return res.json({
      success: true,
      geometry,
      estimation,
      meta: {
        fileName: file.originalname,
        fileSize: file.size,
        fileType,
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[Analyze Error]', err);
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ success: false, error: err.message || 'Analysis failed.' });
  }
});

// ── Full Quote Endpoint ──────────────────────────────────────────────────────
// Combines geometry analysis + material estimation + pricing in one call.
app.post('/api/quote', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded.' });

    const ext = file.originalname.toLowerCase().split('.').pop();
    const fileType = ext === 'obj' ? 'OBJ' : 'STL';

    const materialId: MaterialId = (req.body.material || 'PLA') as MaterialId;
    const infillPct  = Math.max(5, Math.min(100, parseInt(req.body.infill || '20', 10)));
    const layerHeight = parseFloat(req.body.layerHeight || '0.2');
    const quantity   = Math.max(1, parseInt(req.body.quantity || '1', 10));

    if (!MATERIALS[materialId]) {
      return res.status(400).json({ error: `Unknown material: ${materialId}` });
    }

    const buffer = fs.readFileSync(file.path);

    // 1. Geometry analysis
    const geometry = await geometryAnalysisService.analyzeBuffer(buffer, fileType);

    // 2. Material + weight estimation
    const estimation = materialEstimationEngine.estimate({
      volumeCm3: geometry.volumeCm3,
      surfaceAreaCm2: geometry.surfaceAreaCm2,
      boundingBox: geometry.boundingBox,
      materialId,
      infill: { percentage: infillPct, pattern: 'grid', shellCount: 3, topBottomLayers: 4 },
      needsSupport: !geometry.quality.isManifold || MATERIALS[materialId].requiresSupport,
      layerHeightMm: layerHeight,
    });

    // 3. Pricing
    const quote = pricingService.quote(geometry, estimation, quantity);

    fs.unlink(file.path, () => {});

    return res.json({
      success: true,
      quote,
      geometry,
      estimation,
      meta: {
        fileName: file.originalname,
        fileSize: file.size,
        fileType,
        quotedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[Quote Error]', err);
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ success: false, error: err.message || 'Quote failed.' });
  }
});

// ── Shopify App Proxy Routes ─────────────────────────────────────────────
// Requests arriving via Shopify's App Proxy pass through HMAC verification
app.use('/api/proxy', verifyShopifyProxy, sessionContext, proxyRouter);

// ── Cart Proxy (standalone mode) ─────────────────────────────────────────
// Forwards cart/add.js calls to Shopify storefront on behalf of the app
app.use('/api/proxy/cart', cartRouter);

// ── Static Assets (production only) ──────────────────────────────────────
if (IS_PRODUCTION) {
  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));

    // SPA fallback — serve index.html for all non-API routes
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }
}

// ── Error Handler ────────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err);

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'File too large. Maximum size is 50MB.',
    });
  }

  // CORS errors
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      error: err.message,
    });
  }

  res.status(500).json({
    success: false,
    error: IS_PRODUCTION ? 'Internal server error.' : err.message,
  });
});

// ── Start Server ─────────────────────────────────────────────────────────
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🚀 Polar 3D Configurator API`);
    console.log(`   → http://localhost:${PORT}`);
    console.log(`   → Environment: ${IS_PRODUCTION ? 'production' : 'development'}`);
    console.log(`   → Health: http://localhost:${PORT}/api/health`);
    console.log(`   → Proxy:  http://localhost:${PORT}/api/proxy/health\n`);
  });
}

// Export the Express app for Vercel serverless environment
export default app;
