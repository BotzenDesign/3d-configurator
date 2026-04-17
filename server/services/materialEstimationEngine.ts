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
  | 'PLA' | 'PLA+' | 'PETG' | 'ABS' | 'ASA' | 'TPU'
  | 'NYLON' | 'PC' | 'HIPS' | 'WOOD' | 'CARBON' | 'RESIN';

export interface Material {
  id: MaterialId;
  name: string;
  /** Density in g/cm³ */
  densityGcm3: number;
  /** Approximate cost per gram in USD */
  costPerGram: number;
  /** Typical nozzle temperature °C */
  nozzleTemp: number;
  /** Typical bed temperature °C */
  bedTemp: number;
  /** Max recommended print speed mm/s */
  maxSpeedMms: number;
  /** Layer adhesion quality (1-5) */
  layerAdhesion: number;
  /** Flexibility rating (1=rigid, 5=very flexible) */
  flexibility: number;
  /** Whether support material is often needed */
  requiresSupport: boolean;
  description: string;
  color: string; // UI accent color
}

export const MATERIALS: Record<MaterialId, Material> = {
  PLA: {
    id: 'PLA',
    name: 'PLA (Standard)',
    densityGcm3: 1.24,
    costPerGram: 0.018,
    nozzleTemp: 210,
    bedTemp: 60,
    maxSpeedMms: 80,
    layerAdhesion: 4,
    flexibility: 1,
    requiresSupport: false,
    description: 'Best for beginners. Easy to print, biodegradable.',
    color: '#22c55e',
  },
  'PLA+': {
    id: 'PLA+',
    name: 'PLA+ (Enhanced)',
    densityGcm3: 1.24,
    costPerGram: 0.022,
    nozzleTemp: 220,
    bedTemp: 60,
    maxSpeedMms: 80,
    layerAdhesion: 5,
    flexibility: 2,
    requiresSupport: false,
    description: 'Stronger and tougher than standard PLA.',
    color: '#86efac',
  },
  PETG: {
    id: 'PETG',
    name: 'PETG',
    densityGcm3: 1.27,
    costPerGram: 0.025,
    nozzleTemp: 240,
    bedTemp: 80,
    maxSpeedMms: 60,
    layerAdhesion: 4,
    flexibility: 2,
    requiresSupport: false,
    description: 'Food-safe, chemical resistant, flexible strength.',
    color: '#3b82f6',
  },
  ABS: {
    id: 'ABS',
    name: 'ABS',
    densityGcm3: 1.04,
    costPerGram: 0.020,
    nozzleTemp: 240,
    bedTemp: 110,
    maxSpeedMms: 60,
    layerAdhesion: 3,
    flexibility: 2,
    requiresSupport: true,
    description: 'Heat resistant up to 100°C. Requires enclosure.',
    color: '#f59e0b',
  },
  ASA: {
    id: 'ASA',
    name: 'ASA (UV Resistant)',
    densityGcm3: 1.07,
    costPerGram: 0.030,
    nozzleTemp: 250,
    bedTemp: 100,
    maxSpeedMms: 50,
    layerAdhesion: 3,
    flexibility: 2,
    requiresSupport: true,
    description: 'Outdoor use, UV and weather resistant.',
    color: '#fb923c',
  },
  TPU: {
    id: 'TPU',
    name: 'TPU (Flexible)',
    densityGcm3: 1.21,
    costPerGram: 0.040,
    nozzleTemp: 230,
    bedTemp: 45,
    maxSpeedMms: 25,
    layerAdhesion: 4,
    flexibility: 5,
    requiresSupport: false,
    description: 'Rubber-like, flexible, shock-absorbing.',
    color: '#a855f7',
  },
  NYLON: {
    id: 'NYLON',
    name: 'Nylon (PA12)',
    densityGcm3: 1.01,
    costPerGram: 0.045,
    nozzleTemp: 260,
    bedTemp: 70,
    maxSpeedMms: 40,
    layerAdhesion: 5,
    flexibility: 3,
    requiresSupport: true,
    description: 'Extremely durable, low friction, chemical resistant.',
    color: '#06b6d4',
  },
  PC: {
    id: 'PC',
    name: 'Polycarbonate (PC)',
    densityGcm3: 1.20,
    costPerGram: 0.055,
    nozzleTemp: 280,
    bedTemp: 120,
    maxSpeedMms: 40,
    layerAdhesion: 5,
    flexibility: 1,
    requiresSupport: true,
    description: 'Highest strength thermoplastic. Heat resistant to 130°C.',
    color: '#64748b',
  },
  HIPS: {
    id: 'HIPS',
    name: 'HIPS (Support)',
    densityGcm3: 1.03,
    costPerGram: 0.022,
    nozzleTemp: 230,
    bedTemp: 100,
    maxSpeedMms: 60,
    layerAdhesion: 3,
    flexibility: 2,
    requiresSupport: false,
    description: 'Dissolvable in D-Limonene. Used as support material for ABS.',
    color: '#94a3b8',
  },
  WOOD: {
    id: 'WOOD',
    name: 'Wood-fill PLA',
    densityGcm3: 1.28,
    costPerGram: 0.035,
    nozzleTemp: 205,
    bedTemp: 60,
    maxSpeedMms: 40,
    layerAdhesion: 3,
    flexibility: 1,
    requiresSupport: false,
    description: 'Wood fiber composite. Sandable and stainable.',
    color: '#92400e',
  },
  CARBON: {
    id: 'CARBON',
    name: 'Carbon Fiber PLA',
    densityGcm3: 1.30,
    costPerGram: 0.065,
    nozzleTemp: 220,
    bedTemp: 60,
    maxSpeedMms: 40,
    layerAdhesion: 4,
    flexibility: 1,
    requiresSupport: false,
    description: 'Extremely stiff and lightweight. Hardened nozzle required.',
    color: '#1c1917',
  },
  RESIN: {
    id: 'RESIN',
    name: 'Standard Resin (SLA)',
    densityGcm3: 1.18,
    costPerGram: 0.055,
    nozzleTemp: 0, // UV cure, not FDM
    bedTemp: 0,
    maxSpeedMms: 0,
    layerAdhesion: 5,
    flexibility: 1,
    requiresSupport: true,
    description: 'SLA/MSLA resin printing. Extreme detail resolution.',
    color: '#c084fc',
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
    // Based on: layers × (perimeter travel + infill travel) / print speed
    const layerCount = size.z / layerHeightMm;
    const printSpeedMms = Math.min(material.maxSpeedMms, 60);
    const avgLayerTravelMm = Math.sqrt(size.x * size.y) * (1 + fillRatio * 2);
    const printTimeSeconds = (layerCount * avgLayerTravelMm) / printSpeedMms;
    const printTimeMinutes = Math.max(5, Math.round(printTimeSeconds / 60));

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
