/**
 * ============================================================================
 * Material & Weight Estimation Engine
 * ============================================================================
 * Calculates print weight, cost, and time for all common FDM materials.
 *
 * Material database includes:
 *   PLA, PETG, ABS, TPU, Nylon, ASA, PC, HIPS, Wood-fill, Carbon-fill, Resin
 *
 * Calculations account for:
 *   - Infill percentage → actual material volume
 *   - Shell perimeters → always solid
 *   - Top/bottom layers → always solid
 *   - Support material estimate
 *   - Waste factor (purge, failed starts)
 *   - Filament spool cost per gram
 * ============================================================================
 */

// ── Material Database ────────────────────────────────────────────────────────

export type MaterialId =
  // FDM Filament Spool — Build volume 330L × 240W × 300H mm
  | 'PLA_BUDGET'    // $20 / 1000g = $0.020/g
  | 'PLA'           // $35 / 1000g = $0.035/g
  | 'ABS'           // $40 / 1000g = $0.040/g
  | 'TPU95A'        // $40 / 1000g = $0.040/g
  | 'TPU60D'        // $40 / 1000g = $0.040/g
  | 'PETG'          // $50 / 1000g = $0.050/g
  | 'UM_TOUGH_PLA'  // $55 /  750g = $0.073/g
  | 'UM_ABS'        // $55 /  750g = $0.073/g
  | 'UM_TPU'        // $55 /  750g = $0.073/g
  // SLA Resin — Build volume 200L × 125W × 210H mm
  | 'RESIN_CLEAR'   // $87  / 1000ml (~1.1g/ml) = $0.087/g
  | 'RESIN_TOUGH'   // $155 / 1000ml             = $0.155/g
  | 'RESIN_WHITE'   // $89  / 1000ml             = $0.089/g
  | 'RESIN_BLACK'   // $89  / 1000ml             = $0.089/g
  | 'RESIN_CLEAR_BLUE'; // $20 / 1000ml          = $0.020/g

export interface Material {
  id: MaterialId;
  name: string;
  /** Density in g/cm³ */
  densityGcm3: number;
  /** Cost per gram in USD — sourced directly from PDF spool price */
  costPerGram: number;
  /** Typical nozzle temperature °C (0 for resin = UV cure) */
  nozzleTemp: number;
  /** Typical bed temperature °C */
  bedTemp: number;
  /** Max recommended print speed mm/s (0 for resin) */
  maxSpeedMms: number;
  /** Layer adhesion quality (1-5) */
  layerAdhesion: number;
  /** Flexibility rating (1=rigid, 5=very flexible) */
  flexibility: number;
  /** Whether support material is often needed */
  requiresSupport: boolean;
  /** Is this an SLA resin (true) or FDM filament (false) */
  isResin: boolean;
  description: string;
  /** Available colors from the PDF */
  availableColors: string[];
  color: string; // UI accent color
}

export const MATERIALS: Record<MaterialId, Material> = {
  // ── FDM Filament Spool ────────────────────────────────────────────────────
  PLA_BUDGET: {
    id: 'PLA_BUDGET',
    name: 'PLA Budget',
    densityGcm3: 1.24,
    costPerGram: 0.020,           // $20 / 1000g
    nozzleTemp: 210,
    bedTemp: 60,
    maxSpeedMms: 80,
    layerAdhesion: 3,
    flexibility: 1,
    requiresSupport: false,
    isResin: false,
    description: 'Budget-friendly PLA. Best for basic prototypes and low-detail prints.',
    availableColors: ['Red'],
    color: '#ef4444',
  },
  PLA: {
    id: 'PLA',
    name: 'PLA Standard',
    densityGcm3: 1.24,
    costPerGram: 0.035,           // $35 / 1000g
    nozzleTemp: 210,
    bedTemp: 60,
    maxSpeedMms: 80,
    layerAdhesion: 4,
    flexibility: 1,
    requiresSupport: false,
    isResin: false,
    description: 'Easiest to print, biodegradable, wide color range.',
    availableColors: ['Green', 'Red', 'Blue', 'Orange', 'Gray', 'Silver'],
    color: '#22c55e',
  },
  ABS: {
    id: 'ABS',
    name: 'ABS',
    densityGcm3: 1.04,
    costPerGram: 0.040,           // $40 / 1000g
    nozzleTemp: 240,
    bedTemp: 110,
    maxSpeedMms: 60,
    layerAdhesion: 3,
    flexibility: 2,
    requiresSupport: true,
    isResin: false,
    description: 'Heat resistant up to 100°C. Requires enclosure. Machinable.',
    availableColors: ['Black', 'White'],
    color: '#f59e0b',
  },
  TPU95A: {
    id: 'TPU95A',
    name: 'TPU 95A (Flexible)',
    densityGcm3: 1.21,
    costPerGram: 0.040,           // $40 / 1000g
    nozzleTemp: 230,
    bedTemp: 45,
    maxSpeedMms: 25,
    layerAdhesion: 4,
    flexibility: 4,
    requiresSupport: false,
    isResin: false,
    description: 'Semi-flexible, rubber-like. Shore hardness 95A.',
    availableColors: ['Red'],
    color: '#a855f7',
  },
  TPU60D: {
    id: 'TPU60D',
    name: 'TPU 60D (Soft)',
    densityGcm3: 1.21,
    costPerGram: 0.040,           // $40 / 1000g
    nozzleTemp: 225,
    bedTemp: 45,
    maxSpeedMms: 20,
    layerAdhesion: 4,
    flexibility: 5,
    requiresSupport: false,
    isResin: false,
    description: 'Very soft and elastic. Shore hardness 60D. Excellent shock absorption.',
    availableColors: ['White'],
    color: '#c084fc',
  },
  PETG: {
    id: 'PETG',
    name: 'PETG',
    densityGcm3: 1.27,
    costPerGram: 0.050,           // $50 / 1000g
    nozzleTemp: 240,
    bedTemp: 80,
    maxSpeedMms: 60,
    layerAdhesion: 4,
    flexibility: 2,
    requiresSupport: false,
    isResin: false,
    description: 'Food-safe, chemical resistant, strong inter-layer bonding.',
    availableColors: ['Green', 'Purple', 'Blue'],
    color: '#3b82f6',
  },
  UM_TOUGH_PLA: {
    id: 'UM_TOUGH_PLA',
    name: 'Ultimaker Tough PLA',
    densityGcm3: 1.24,
    costPerGram: 0.073,           // $55 / 750g
    nozzleTemp: 220,
    bedTemp: 60,
    maxSpeedMms: 70,
    layerAdhesion: 5,
    flexibility: 2,
    requiresSupport: false,
    isResin: false,
    description: 'Professional-grade PLA. Impact-resistant, high detail. Ultimaker certified.',
    availableColors: ['Black', 'White', 'Grey', 'Yellow', 'Blue'],
    color: '#0ea5e9',
  },
  UM_ABS: {
    id: 'UM_ABS',
    name: 'Ultimaker ABS',
    densityGcm3: 1.04,
    costPerGram: 0.073,           // $55 / 750g
    nozzleTemp: 255,
    bedTemp: 110,
    maxSpeedMms: 50,
    layerAdhesion: 5,
    flexibility: 2,
    requiresSupport: true,
    isResin: false,
    description: 'Professional ABS. Superior warp resistance. Ultimaker certified.',
    availableColors: ['Black', 'White'],
    color: '#f97316',
  },
  UM_TPU: {
    id: 'UM_TPU',
    name: 'Ultimaker TPU',
    densityGcm3: 1.22,
    costPerGram: 0.073,           // $55 / 750g
    nozzleTemp: 230,
    bedTemp: 70,
    maxSpeedMms: 25,
    layerAdhesion: 5,
    flexibility: 4,
    requiresSupport: false,
    isResin: false,
    description: 'Professional-grade flexible TPU. Ultimaker certified. Excellent surface quality.',
    availableColors: ['Red', 'Blue', 'White'],
    color: '#8b5cf6',
  },

  // ── SLA Liquid Photo Polymer Resin ──────────────────────────────────────
  RESIN_CLEAR: {
    id: 'RESIN_CLEAR',
    name: 'Resin — Clear v5',
    densityGcm3: 1.10,
    costPerGram: 0.087,           // $87 / 1000ml
    nozzleTemp: 0,
    bedTemp: 0,
    maxSpeedMms: 0,
    layerAdhesion: 5,
    flexibility: 1,
    requiresSupport: true,
    isResin: true,
    description: 'Transparent SLA resin. Extreme surface detail. UV-cure only.',
    availableColors: ['Clear'],
    color: '#bae6fd',
  },
  RESIN_TOUGH: {
    id: 'RESIN_TOUGH',
    name: 'Resin — Tough 2000 ABS',
    densityGcm3: 1.18,
    costPerGram: 0.155,           // $155 / 1000ml
    nozzleTemp: 0,
    bedTemp: 0,
    maxSpeedMms: 0,
    layerAdhesion: 5,
    flexibility: 2,
    requiresSupport: true,
    isResin: true,
    description: 'ABS-like engineering resin. Impact resistant, semi-rigid. UV-cure only.',
    availableColors: ['Grey'],
    color: '#94a3b8',
  },
  RESIN_WHITE: {
    id: 'RESIN_WHITE',
    name: 'Resin — White',
    densityGcm3: 1.10,
    costPerGram: 0.089,           // $89 / 1000ml
    nozzleTemp: 0,
    bedTemp: 0,
    maxSpeedMms: 0,
    layerAdhesion: 5,
    flexibility: 1,
    requiresSupport: true,
    isResin: true,
    description: 'Opaque white SLA resin. High detail, smooth surface. UV-cure only.',
    availableColors: ['White'],
    color: '#f1f5f9',
  },
  RESIN_BLACK: {
    id: 'RESIN_BLACK',
    name: 'Resin — Black',
    densityGcm3: 1.10,
    costPerGram: 0.089,           // $89 / 1000ml
    nozzleTemp: 0,
    bedTemp: 0,
    maxSpeedMms: 0,
    layerAdhesion: 5,
    flexibility: 1,
    requiresSupport: true,
    isResin: true,
    description: 'Opaque black SLA resin. Excellent surface quality, UV-cure only.',
    availableColors: ['Black'],
    color: '#1e293b',
  },
  RESIN_CLEAR_BLUE: {
    id: 'RESIN_CLEAR_BLUE',
    name: 'Resin — ClearLight Blue ABS',
    densityGcm3: 1.10,
    costPerGram: 0.020,           // $20 / 1000ml
    nozzleTemp: 0,
    bedTemp: 0,
    maxSpeedMms: 0,
    layerAdhesion: 5,
    flexibility: 1,
    requiresSupport: true,
    isResin: true,
    description: 'Light blue clear SLA resin. UV-cure only.',
    availableColors: ['Light Blue Clear'],
    color: '#38bdf8',
  },
};

// ── Infill Profiles ───────────────────────────────────────────────────────────

export type InfillPattern = 'grid' | 'gyroid' | 'honeycomb' | 'lightning' | 'solid';

export interface InfillConfig {
  percentage: number;       // 0–100
  pattern: InfillPattern;
  shellCount: number;       // number of perimeter walls
  topBottomLayers: number;  // top + bottom solid layers count
}

// Effective infill material ratio (accounting for shells and top/bottom)
function effectiveInfillRatio(
  volumeCm3: number,
  bbox: { size: { x: number; y: number; z: number } },
  infill: InfillConfig,
  layerHeightMm: number = 0.2
): number {
  const { percentage, shellCount, topBottomLayers } = infill;

  // Estimate shell volume: perimeter area × shell thickness × layer count
  const shellThicknessMm = 0.4 * shellCount; // 0.4mm per wall (standard nozzle)
  const modelHeightMm = bbox.size.z;

  // Perimeter shell: outer surface area × shell thickness
  // Approximated as fraction of total volume
  const surfaceShellFraction = Math.min(
    0.9,
    (shellThicknessMm * 2 * (bbox.size.x + bbox.size.y) * modelHeightMm) /
    Math.max(1, volumeCm3 * 1000)
  );

  // Top/bottom shell fraction
  const topBottomThicknessMm = topBottomLayers * layerHeightMm;
  const topBottomFraction = Math.min(
    0.9,
    (topBottomThicknessMm * 2 * bbox.size.x * bbox.size.y) /
    Math.max(1, volumeCm3 * 1000)
  );

  // Shell regions are always solid
  const shellSolidFraction = Math.min(1, surfaceShellFraction + topBottomFraction);
  const infillRegionFraction = Math.max(0, 1 - shellSolidFraction);

  // Total effective fill ratio
  return shellSolidFraction + infillRegionFraction * (percentage / 100);
}

// ── Weight & Cost Calculation ────────────────────────────────────────────────

export interface EstimationInput {
  volumeCm3: number;
  surfaceAreaCm2: number;
  boundingBox: { size: { x: number; y: number; z: number } };
  materialId: MaterialId;
  infill: InfillConfig;
  /** Whether automatic supports are needed */
  needsSupport?: boolean;
  /** Support contact area fraction (0–1, estimated from overhang analysis) */
  supportFraction?: number;
  /** Layer height in mm */
  layerHeightMm?: number;
}

export interface EstimationResult {
  material: Material;
  infill: InfillConfig;
  /** Effective material volume used (cm³) */
  effectiveVolumeCm3: number;
  /** Model weight in grams */
  weightGrams: number;
  /** Support material weight (if any) in grams */
  supportWeightGrams: number;
  /** Total weight including support and waste */
  totalWeightGrams: number;
  /** Total filament length in meters */
  filamentLengthM: number;
  /** Material cost in USD */
  materialCostUsd: number;
  /** Print time estimate in minutes */
  estimatedPrintMinutes: number;
  /** Print time formatted */
  estimatedPrintTime: string;
  /** Per-unit breakdown */
  breakdown: {
    modelMaterialGrams: number;
    supportMaterialGrams: number;
    wasteMaterialGrams: number;
    infillEffectivePercent: number;
  };
}

const FILAMENT_DIAMETER_MM = 1.75;
const WASTE_FACTOR = 1.05; // 5% waste (purge lines, skirt)
const SUPPORT_DENSITY = 0.15; // 15% infill for supports

export class MaterialEstimationEngine {
  /**
   * Calculate complete weight, cost, and print time for a model.
   */
  estimate(input: EstimationInput): EstimationResult {
    const {
      volumeCm3,
      surfaceAreaCm2,
      boundingBox: { size },
      materialId,
      infill,
      needsSupport = false,
      supportFraction = 0.15,
      layerHeightMm = 0.2,
    } = input;

    const material = MATERIALS[materialId];

    // 1. Effective fill ratio considering shells and infill
    const fillRatio = effectiveInfillRatio(volumeCm3, { size }, infill, layerHeightMm);
    const effectiveVolumeCm3 = volumeCm3 * fillRatio;

    // 2. Model weight
    const modelWeightGrams = effectiveVolumeCm3 * material.densityGcm3;

    // 3. Support material (estimated as % of bounding box volume beneath overhangs)
    let supportWeightGrams = 0;
    if (needsSupport || material.requiresSupport) {
      const supportVolumeCm3 = volumeCm3 * supportFraction * SUPPORT_DENSITY;
      supportWeightGrams = supportVolumeCm3 * material.densityGcm3;
    }

    // 4. Waste factor
    const wasteMaterialGrams = (modelWeightGrams + supportWeightGrams) * (WASTE_FACTOR - 1);
    const totalWeightGrams = modelWeightGrams + supportWeightGrams + wasteMaterialGrams;

    // 5. Filament length
    // Volume → length: V = π(d/2)² × L → L = V / (π × r²)
    const filamentRadiusCm = (FILAMENT_DIAMETER_MM / 2) / 10;
    const filamentLengthCm = (totalWeightGrams / material.densityGcm3) /
      (Math.PI * filamentRadiusCm * filamentRadiusCm);
    const filamentLengthM = filamentLengthCm / 100;

    // 6. Material cost
    const materialCostUsd = totalWeightGrams * material.costPerGram;

    // 7. Print time estimate
    let printTimeMinutes = 0;
    if (material.isResin) {
      // SLA time is strictly Z-height based. Assume 10 seconds per layer (cure + peel + lift)
      // Standard SLA layer height: 0.05mm
      const layerCount = size.z / 0.05; 
      const printTimeSeconds = layerCount * 10;
      printTimeMinutes = Math.max(5, Math.round(printTimeSeconds / 60));
    } else {
      // FDM time based on nozzle travel
      const layerCount = size.z / layerHeightMm;
      const printSpeedMms = Math.max(1, Math.min(material.maxSpeedMms, 60)); // avoid div by zero
      const avgLayerTravelMm = Math.sqrt(size.x * size.y) * (1 + fillRatio * 2);
      const printTimeSeconds = (layerCount * avgLayerTravelMm) / printSpeedMms;
      printTimeMinutes = Math.max(5, Math.round(printTimeSeconds / 60));
    }

    const estimatedPrintTime = formatPrintTime(printTimeMinutes);

    return {
      material,
      infill,
      effectiveVolumeCm3: +effectiveVolumeCm3.toFixed(3),
      weightGrams: +modelWeightGrams.toFixed(2),
      supportWeightGrams: +supportWeightGrams.toFixed(2),
      totalWeightGrams: +totalWeightGrams.toFixed(2),
      filamentLengthM: +filamentLengthM.toFixed(2),
      materialCostUsd: +materialCostUsd.toFixed(4),
      estimatedPrintMinutes: printTimeMinutes,
      estimatedPrintTime,
      breakdown: {
        modelMaterialGrams: +modelWeightGrams.toFixed(2),
        supportMaterialGrams: +supportWeightGrams.toFixed(2),
        wasteMaterialGrams: +wasteMaterialGrams.toFixed(2),
        infillEffectivePercent: +(fillRatio * 100).toFixed(1),
      },
    };
  }

  /**
   * Returns estimates for all materials in the database.
   */
  estimateAll(input: Omit<EstimationInput, 'materialId'>): Record<MaterialId, EstimationResult> {
    const results: Partial<Record<MaterialId, EstimationResult>> = {};
    for (const id of Object.keys(MATERIALS) as MaterialId[]) {
      results[id] = this.estimate({ ...input, materialId: id });
    }
    return results as Record<MaterialId, EstimationResult>;
  }
}

function formatPrintTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export const materialEstimationEngine = new MaterialEstimationEngine();
