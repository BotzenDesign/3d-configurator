/**
 * ============================================================================
 * 3D Print Configurator — Shopify Theme Extension Loader
 * ============================================================================
 * This script runs inside the merchant's Shopify storefront. It:
 *   1. Reads configuration from the Liquid block's data attributes
 *   2. Fetches the React app's built asset manifest
 *   3. Dynamically injects the JS/CSS bundles into the page
 *   4. Initialises the configurator inside #polar-3d-configurator-root
 *   5. Forwards Shopify session tokens for authenticated API calls
 * ============================================================================
 */

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────
  var CONTAINER_ID = 'polar-3d-configurator';
  var ROOT_ID = 'polar-3d-configurator-root';
  var LOADER_ID = 'polar-configurator-loader';
  var ASSET_MANIFEST = '/configurator-manifest.json';
  var MAX_RETRIES = 3;
  var RETRY_DELAY_MS = 1500;

  // ── Helpers ────────────────────────────────────────────────────────────

  /**
   * Read configuration from the wrapper element's data attributes.
   */
  function getConfig() {
    var el = document.getElementById(CONTAINER_ID);
    if (!el) return null;

    return {
      apiBase: el.getAttribute('data-api-base') || '',
      colorScheme: el.getAttribute('data-color-scheme') || 'dark',
      shopDomain: el.getAttribute('data-shop-domain') || '',
      customerId: el.getAttribute('data-customer-id') || '',
      customerEmail: el.getAttribute('data-customer-email') || '',
      enableAnalytics: el.getAttribute('data-enable-analytics') === 'true',
    };
  }

  /**
   * Inject a <script> tag and return a Promise that resolves on load.
   */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      // Don't double-load
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.type = 'module';
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = function () {
        reject(new Error('Failed to load script: ' + src));
      };
      document.head.appendChild(s);
    });
  }

  /**
   * Inject a <link rel="stylesheet"> and return a Promise.
   */
  function loadStylesheet(href) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('link[href="' + href + '"]')) {
        resolve();
        return;
      }
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.crossOrigin = 'anonymous';
      l.onload = resolve;
      l.onerror = function () {
        reject(new Error('Failed to load stylesheet: ' + href));
      };
      document.head.appendChild(l);
    });
  }

  /**
   * Hide the loading spinner.
   */
  function hideLoader() {
    var loader = document.getElementById(LOADER_ID);
    if (loader) {
      loader.style.opacity = '0';
      loader.style.transition = 'opacity 0.3s ease';
      setTimeout(function () {
        loader.style.display = 'none';
      }, 300);
    }
  }

  /**
   * Show an error state inside the configurator container.
   */
  function showError(message) {
    hideLoader();
    var root = document.getElementById(ROOT_ID);
    if (!root) return;

    root.innerHTML =
      '<div class="polar-configurator__error">' +
      '<svg class="polar-configurator__error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' +
      '</svg>' +
      '<p class="polar-configurator__error-title">Configuration Error</p>' +
      '<p class="polar-configurator__error-message">' + escapeHtml(message) + '</p>' +
      '<button class="polar-configurator__retry-btn" onclick="window.PolarConfigurator && window.PolarConfigurator.retry()">Try Again</button>' +
      '</div>';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── Session Token Provider ─────────────────────────────────────────────
  /**
   * Provides Shopify App Bridge session tokens for authenticated API calls.
   * Falls back to unauthenticated mode when running outside Shopify admin.
   */
  var SessionProvider = {
    _appBridge: null,

    init: function (config) {
      // If Shopify App Bridge is available (admin context), initialise it
      if (window.shopify && window.shopify.config) {
        try {
          this._appBridge = window.shopify;
          console.log('[Polar3D] App Bridge session provider initialised');
        } catch (e) {
          console.warn('[Polar3D] App Bridge init failed, using unauthenticated mode:', e.message);
        }
      }
    },

    /**
     * Get a fresh session token for API authentication.
     * @returns {Promise<string|null>}
     */
    getSessionToken: function () {
      if (this._appBridge && this._appBridge.idToken) {
        return this._appBridge.idToken();
      }
      return Promise.resolve(null);
    },

    /**
     * Create headers for an authenticated fetch request.
     * @returns {Promise<object>}
     */
    getAuthHeaders: async function () {
      var headers = { 'Content-Type': 'application/json' };
      var token = await this.getSessionToken();
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }
      return headers;
    },
  };

  // ── Configurator Init ──────────────────────────────────────────────────

  /**
   * Attempt to load and initialise the configurator with retry logic.
   */
  function initConfigurator(retriesLeft) {
    var config = getConfig();
    if (!config) {
      console.warn('[Polar3D] Configurator container not found, aborting.');
      return;
    }

    if (!config.apiBase) {
      // If no API base URL is set, try loading local build assets
      config.apiBase = '';
    }

    var manifestUrl = config.apiBase + ASSET_MANIFEST;

    // Expose config globally for the React app to read
    window.__POLAR_3D_CONFIG__ = config;
    window.__POLAR_SESSION__ = SessionProvider;

    SessionProvider.init(config);

    // Try fetching asset manifest; if it fails, fallback to known paths
    fetch(manifestUrl)
      .then(function (res) {
        if (!res.ok) throw new Error('Manifest not found');
        return res.json();
      })
      .then(function (manifest) {
        var promises = [];

        // Load CSS
        if (manifest.css) {
          var cssFiles = Array.isArray(manifest.css) ? manifest.css : [manifest.css];
          cssFiles.forEach(function (href) {
            promises.push(loadStylesheet(config.apiBase + href));
          });
        }

        // Load JS
        if (manifest.js) {
          var jsFiles = Array.isArray(manifest.js) ? manifest.js : [manifest.js];
          jsFiles.forEach(function (src) {
            promises.push(loadScript(config.apiBase + src));
          });
        }

        return Promise.all(promises);
      })
      .then(function () {
        hideLoader();
        console.log('[Polar3D] Configurator loaded successfully.');

        // Fire analytics event
        if (config.enableAnalytics && window.Shopify && window.Shopify.analytics) {
          try {
            window.Shopify.analytics.publish('polar_configurator_loaded', {
              shop_domain: config.shopDomain,
            });
          } catch (_) {}
        }
      })
      .catch(function (err) {
        console.warn('[Polar3D] Failed to load from manifest:', err.message);

        // Fallback: try loading known Vite build output paths
        var fallbackJS = config.apiBase + '/assets/index.js';
        var fallbackCSS = config.apiBase + '/assets/index.css';

        Promise.all([loadStylesheet(fallbackCSS), loadScript(fallbackJS)])
          .then(function () {
            hideLoader();
            console.log('[Polar3D] Configurator loaded via fallback paths.');
          })
          .catch(function (fallbackErr) {
            if (retriesLeft > 0) {
              console.log('[Polar3D] Retrying in ' + RETRY_DELAY_MS + 'ms... (' + retriesLeft + ' retries left)');
              setTimeout(function () {
                initConfigurator(retriesLeft - 1);
              }, RETRY_DELAY_MS);
            } else {
              showError(
                'Unable to load the 3D Configurator. Please check that the API Base URL ' +
                'is correctly configured in the theme editor, or try refreshing the page.'
              );
            }
          });
      });
  }

  // ── Public API ─────────────────────────────────────────────────────────
  window.PolarConfigurator = {
    retry: function () {
      var root = document.getElementById(ROOT_ID);
      if (root) {
        root.innerHTML =
          '<div class="polar-configurator__loading" id="' + LOADER_ID + '">' +
          '<div class="polar-configurator__spinner"></div>' +
          '<p class="polar-configurator__loading-text">Loading 3D Configurator...</p>' +
          '</div>';
      }
      initConfigurator(MAX_RETRIES);
    },
    getConfig: getConfig,
    getSession: function () {
      return SessionProvider;
    },
  };

  // ── Boot ───────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initConfigurator(MAX_RETRIES);
    });
  } else {
    initConfigurator(MAX_RETRIES);
  }
})();
