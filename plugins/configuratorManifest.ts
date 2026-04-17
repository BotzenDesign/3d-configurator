/**
 * ============================================================================
 * Vite Plugin — Configurator Build Manifest
 * ============================================================================
 * Generates a `configurator-manifest.json` in the build output that maps
 * the built asset filenames. The Shopify theme extension loader reads this
 * manifest to know which JS/CSS files to inject into the page.
 *
 * Usage in vite.config.ts:
 *   import { configuratorManifest } from './plugins/configuratorManifest';
 *   plugins: [react(), configuratorManifest()]
 * ============================================================================
 */

import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

export function configuratorManifest(): Plugin {
  let outDir = 'dist';

  return {
    name: 'configurator-manifest',
    apply: 'build',

    configResolved(config) {
      outDir = config.build.outDir;
    },

    closeBundle() {
      const assetsDir = path.join(outDir, 'assets');

      if (!fs.existsSync(assetsDir)) {
        console.warn('[configurator-manifest] No assets directory found, skipping manifest.');
        return;
      }

      const files = fs.readdirSync(assetsDir);

      const jsFiles = files
        .filter((f) => f.endsWith('.js') && !f.endsWith('.map'))
        .map((f) => `/assets/${f}`);

      const cssFiles = files
        .filter((f) => f.endsWith('.css'))
        .map((f) => `/assets/${f}`);

      const manifest = {
        generated: new Date().toISOString(),
        js: jsFiles,
        css: cssFiles,
      };

      const manifestPath = path.join(outDir, 'configurator-manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`[configurator-manifest] Wrote ${manifestPath}`);
    },
  };
}
