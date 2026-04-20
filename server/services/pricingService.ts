/**
 * ============================================================================
 * Pricing Service — Dynamic Quote Engine
 * ============================================================================
 * Calculates the final customer price for a 3D print order.
 *
 * Price Formula:
 *   Base Price = Material Cost + Machine Time Cost
 *   Surcharges = Complexity Fee + Non-Manifold Repair Fee + Rush Fee
 *   Subtotal   = (Base Price + Surcharges) × Markup
 *   Total      = Subtotal × Quantity — Volume Discount
 *
 * All prices in USD.
 * ============================================================================
 */

import type { GeometryAnalysisResult } from './geometryAnalysisService.js';
import type { EstimationResult } from './materialEstimationEngine.js';

// ── Pricing Configuration ─────────────────────────────────────────────────────

export interface PricingConfig {
  /** Markup multiplier applied over raw material cost (e.g. 3.5 = 250% margin) */
  markupMultiplier: number;
  /** Machine cost per hour of print time in USD */
  machineHourlyRateUsd: number;
  /** Base setup fee per order regardless of size */
  setupFeeUsd: number;
  /** Minimum order price */
  minimumPriceUsd: number;
  /** Complexity surcharge tiers (triangle count thresholds) */
  complexitySurcharge: {
    medium: { threshold: number; feeUsd: number };
    high:   { threshold: number; feeUsd: number };
    ultra:  { threshold: number; feeUsd: number };
  };
  /** Non-manifold mesh repair fee */
  repairFeeUsd: number;
  /** Quantity discount tiers */
  quantityDiscounts: Array<{ minQty: number; discountPct: number }>;
}

const DEFAULT_CONFIG: PricingConfig = {
  markupMultiplier: 3.5,
  machineHourlyRateUsd: 2.50,
  setupFeeUsd: 3.00,
  minimumPriceUsd: 5.00,
  complexitySurcharge: {
    medium: { threshold: 50_000,  feeUsd: 1.50 },
    high:   { threshold: 200_000, feeUsd: 4.00 },
    ultra:  { threshold: 500_000, feeUsd: 9.00 },
  },
  repairFeeUsd: 5.00,
  quantityDiscounts: [
    { minQty: 5,  discountPct: 5  },
    { minQty: 10, discountPct: 10 },
    { minQty: 25, discountPct: 15 },
    { minQty: 50, discountPct: 20 },
  ],
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PriceLineItem {
  label: string;
  amountUsd: number;
  note?: string;
}

export interface QuoteResult {
  /** All individual line items for transparency */
  lineItems: PriceLineItem[];
  /** Unit price before quantity discount */
  unitPriceUsd: number;
  /** Quantity ordered */
  quantity: number;
  /** Discount percentage applied */
  discountPct: number;
  /** Discount amount in USD */
  discountAmountUsd: number;
  /** Final total after discount */
  totalUsd: number;
  /** Per-unit final price after discount */
  perUnitUsd: number;
  /** Formatted strings for display */
  display: {
    unitPrice: string;
    total: string;
    perUnit: string;
    discount: string;
    printTime: string;
    weight: string;
  };
  /** Whether the mesh needs repair (affects price) */
  needsRepair: boolean;
  /** Printability grade from geometry analysis */
  printabilityGrade: string;
  /** Printability score 0-100 */
  printabilityScore: number;
}

// ── Pricing Engine ────────────────────────────────────────────────────────────

export class PricingService {
  private config: PricingConfig;

  constructor(config: Partial<PricingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a full price quote from geometry analysis + material estimation.
   */
  quote(
    geometry: GeometryAnalysisResult,
    estimation: EstimationResult,
    quantity: number = 1
  ): QuoteResult {
    const { config } = this;
    const lineItems: PriceLineItem[] = [];

    // ── 1. Material Cost ────────────────────────────────────────────────────
    const materialCost = estimation.totalWeightGrams * estimation.material.costPerGram;
    lineItems.push({
      label: `Material (${estimation.material.name})`,
      amountUsd: materialCost,
      note: `${estimation.totalWeightGrams.toFixed(1)}g × $${estimation.material.costPerGram}/g`,
    });

    // ── 2. Machine Time Cost ────────────────────────────────────────────────
    const printHours = estimation.estimatedPrintMinutes / 60;
    const machineCost = printHours * config.machineHourlyRateUsd;
    lineItems.push({
      label: 'Machine Time',
      amountUsd: machineCost,
      note: `${estimation.estimatedPrintTime} @ $${config.machineHourlyRateUsd}/hr`,
    });

    // ── 3. Setup Fee ────────────────────────────────────────────────────────
    lineItems.push({
      label: 'Setup & Slicing',
      amountUsd: config.setupFeeUsd,
      note: 'Per-order setup fee',
    });

    // ── 4. Apply Markup ─────────────────────────────────────────────────────
    const subtotalBeforeMarkup = materialCost + machineCost + config.setupFeeUsd;
    const markupAmount = subtotalBeforeMarkup * (config.markupMultiplier - 1);
    lineItems.push({
      label: 'Service Margin',
      amountUsd: markupAmount,
      note: `${((config.markupMultiplier - 1) * 100).toFixed(0)}% margin`,
    });

    // ── 5. Complexity Surcharge ─────────────────────────────────────────────
    const triCount = geometry.quality.triangleCount;
    let complexityFee = 0;
    let complexityNote = '';

    if (triCount >= config.complexitySurcharge.ultra.threshold) {
      complexityFee = config.complexitySurcharge.ultra.feeUsd;
      complexityNote = `Ultra-complex mesh (${(triCount / 1000).toFixed(0)}k tris)`;
    } else if (triCount >= config.complexitySurcharge.high.threshold) {
      complexityFee = config.complexitySurcharge.high.feeUsd;
      complexityNote = `High-complexity mesh (${(triCount / 1000).toFixed(0)}k tris)`;
    } else if (triCount >= config.complexitySurcharge.medium.threshold) {
      complexityFee = config.complexitySurcharge.medium.feeUsd;
      complexityNote = `Medium-complexity mesh (${(triCount / 1000).toFixed(0)}k tris)`;
    }

    if (complexityFee > 0) {
      lineItems.push({
        label: 'Complexity Surcharge',
        amountUsd: complexityFee,
        note: complexityNote,
      });
    }

    // ── 6. Non-Manifold Repair Fee ──────────────────────────────────────────
    const needsRepair = !geometry.quality.isManifold &&
      (geometry.quality.nonManifoldEdges > 0 || geometry.quality.boundaryEdges > 5);

    if (needsRepair) {
      lineItems.push({
        label: 'Mesh Repair',
        amountUsd: config.repairFeeUsd,
        note: `${geometry.quality.nonManifoldEdges} non-manifold edge(s) detected`,
      });
    }

    // ── 7. Unit Price ───────────────────────────────────────────────────────
    const rawUnit = lineItems.reduce((sum, item) => sum + item.amountUsd, 0);
    const unitPriceUsd = Math.max(config.minimumPriceUsd, rawUnit);

    // ── 8. Quantity Discount ────────────────────────────────────────────────
    const safeQty = Math.max(1, Math.floor(quantity));
    const discountTier = [...config.quantityDiscounts]
      .reverse()
      .find(d => safeQty >= d.minQty);

    const discountPct = discountTier?.discountPct ?? 0;
    const subtotalBeforeDiscount = unitPriceUsd * safeQty;
    const discountAmountUsd = subtotalBeforeDiscount * (discountPct / 100);
    const totalUsd = subtotalBeforeDiscount - discountAmountUsd;
    const perUnitUsd = totalUsd / safeQty;

    return {
      lineItems,
      unitPriceUsd: +unitPriceUsd.toFixed(2),
      quantity: safeQty,
      discountPct,
      discountAmountUsd: +discountAmountUsd.toFixed(2),
      totalUsd: +totalUsd.toFixed(2),
      perUnitUsd: +perUnitUsd.toFixed(2),
      display: {
        unitPrice: formatUsd(unitPriceUsd),
        total: formatUsd(totalUsd),
        perUnit: formatUsd(perUnitUsd),
        discount: discountPct > 0 ? `-${discountPct}% (${formatUsd(discountAmountUsd)})` : 'None',
        printTime: estimation.estimatedPrintTime,
        weight: `${estimation.totalWeightGrams.toFixed(1)}g`,
      },
      needsRepair,
      printabilityGrade: geometry.printability.grade,
      printabilityScore: geometry.printability.score,
    };
  }

  /**
   * Quick price estimate from raw volume + material (no geometry analysis needed).
   * Used for real-time "ballpark" pricing before a file is analyzed.
   */
  quickEstimate(volumeCm3: number, materialCostPerGram: number, densityGcm3: number): number {
    const weightGrams = volumeCm3 * densityGcm3;
    const materialCost = weightGrams * materialCostPerGram;
    const raw = (materialCost + this.config.setupFeeUsd) * this.config.markupMultiplier;
    return Math.max(this.config.minimumPriceUsd, +raw.toFixed(2));
  }
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const pricingService = new PricingService();
