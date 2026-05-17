/**
 * ============================================================================
 * useDeviceCapabilities — Device Performance Detection Hook
 * ============================================================================
 * Detects device capabilities for adaptive rendering:
 *   - GPU tier estimation (low/medium/high)
 *   - Touch device detection
 *   - Battery status monitoring
 *   - Network speed detection
 *   - Screen DPR and viewport size
 * ============================================================================
 */

import { useState, useEffect, useMemo } from "react";

export type GPUTier = "low" | "medium" | "high";

export interface DeviceCapabilities {
  /** Estimated GPU performance tier */
  gpuTier: GPUTier;
  /** Whether the device has a touchscreen */
  isTouchDevice: boolean;
  /** Whether the device is mobile-sized (<768px) */
  isMobile: boolean;
  /** Device pixel ratio */
  dpr: number;
  /** Clamped DPR for rendering (max 2 on mobile) */
  renderDpr: [number, number];
  /** Whether battery saver should be activated */
  lowPowerMode: boolean;
  /** Available device memory in GB (if available) */
  deviceMemory: number | null;
  /** Number of logical CPU cores */
  hardwareConcurrency: number;
  /** Whether reduced motion is preferred */
  prefersReducedMotion: boolean;
  /** Recommended max polygon count for this device */
  maxPolygons: number;
  /** Whether shadows should be enabled */
  enableShadows: boolean;
  /** Whether environment maps should be used */
  enableEnvironment: boolean;
  /** Recommended shadow map resolution */
  shadowMapSize: number;
}

/**
 * Estimate GPU tier based on available signals.
 */
function estimateGPUTier(): GPUTier {
  // Check device memory (Chrome only)
  const memory = (navigator as any).deviceMemory as number | undefined;
  if (memory && memory <= 2) return "low";

  // Check hardware concurrency
  const cores = navigator.hardwareConcurrency || 4;
  if (cores <= 2) return "low";

  // Check if WebGL2 is available with good extensions
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return "low";

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();

      // Known low-end GPUs
      if (
        renderer.includes("intel hd") ||
        renderer.includes("intel(r) hd") ||
        renderer.includes("mali-4") ||
        renderer.includes("adreno 3") ||
        renderer.includes("adreno 4") ||
        renderer.includes("powervr sgx") ||
        renderer.includes("swiftshader")
      ) {
        return "low";
      }

      // Known high-end GPUs
      if (
        renderer.includes("nvidia") ||
        renderer.includes("radeon rx") ||
        renderer.includes("radeon pro") ||
        renderer.includes("apple m") ||
        renderer.includes("apple gpu") ||
        renderer.includes("adreno 7") ||
        renderer.includes("adreno 6")
      ) {
        return "high";
      }
    }

    // Check max texture size as quality indicator
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (maxTextureSize < 4096) return "low";
    if (maxTextureSize >= 16384) return "high";
  } catch {
    // WebGL not available
    return "low";
  }

  return "medium";
}

export function useDeviceCapabilities(): DeviceCapabilities {
  const [isMobile, setIsMobile] = useState(false);
  const [lowPowerMode, setLowPowerMode] = useState(false);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Monitor battery
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    if ("getBattery" in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const update = () => {
          // Activate low power mode when battery < 20% and not charging
          setLowPowerMode(!battery.charging && battery.level < 0.2);
        };
        update();
        battery.addEventListener("levelchange", update);
        battery.addEventListener("chargingchange", update);
        cleanup = () => {
          battery.removeEventListener("levelchange", update);
          battery.removeEventListener("chargingchange", update);
        };
      });
    }

    return () => cleanup?.();
  }, []);

  const capabilities = useMemo((): DeviceCapabilities => {
    const gpuTier = estimateGPUTier();
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const dpr = window.devicePixelRatio || 1;
    const deviceMemory = (navigator as any).deviceMemory || null;
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Adaptive settings based on GPU tier
    const config = {
      low: {
        renderDpr: [1, 1] as [number, number],
        maxPolygons: 50_000,
        enableShadows: false,
        enableEnvironment: false,
        shadowMapSize: 256,
      },
      medium: {
        renderDpr: [1, 1.5] as [number, number],
        maxPolygons: 200_000,
        enableShadows: true,
        enableEnvironment: true,
        shadowMapSize: 512,
      },
      high: {
        renderDpr: [1, 2] as [number, number],
        maxPolygons: 1_000_000,
        enableShadows: true,
        enableEnvironment: true,
        shadowMapSize: 1024,
      },
    };

    const tier = lowPowerMode ? "low" : gpuTier;
    const settings = config[tier];

    return {
      gpuTier: tier,
      isTouchDevice,
      isMobile,
      dpr,
      renderDpr: settings.renderDpr,
      lowPowerMode,
      deviceMemory,
      hardwareConcurrency,
      prefersReducedMotion,
      maxPolygons: settings.maxPolygons,
      enableShadows: settings.enableShadows,
      enableEnvironment: settings.enableEnvironment,
      shadowMapSize: settings.shadowMapSize,
    };
  }, [isMobile, lowPowerMode]);

  return capabilities;
}
