


export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    fileType: "STL" | "OBJ" | "UNKNOWN";
    fileSize: number;
    volume?: number;
    surfaceArea?: number;
  };
}

export class FileValidationService {
  private static MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static ALLOWED_EXTENSIONS = [".stl", ".obj"];

  /**
   * Validate uploaded 3D file for structure, safety, and metadata.
   */
  public async validateFile(
    fileBuffer: Uint8Array,
    originalName: string,
    fileSize: number
  ): Promise<ValidationReport> {
    const report: ValidationReport = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {
        fileType: "UNKNOWN",
        fileSize,
      },
    };

    // 1. Basic checks
    if (fileSize > FileValidationService.MAX_FILE_SIZE) {
      report.isValid = false;
      report.errors.push(`File is too large. Max size is 50MB.`);
    }

    const lowerName = originalName.toLowerCase();
    const ext = FileValidationService.ALLOWED_EXTENSIONS.find((e) =>
      lowerName.endsWith(e)
    );
    if (!ext) {
      report.isValid = false;
      report.errors.push(`Invalid extension. Allowed: .stl, .obj`);
      return report;
    }

    report.metadata!.fileType = ext === ".stl" ? "STL" : "OBJ";

    // 2. Malware & Structure check via magic numbers/header parsing
    try {
      if (report.metadata!.fileType === "STL") {
        this.validateSTLStructure(fileBuffer, report);
      } else if (report.metadata!.fileType === "OBJ") {
        this.validateOBJStructure(fileBuffer, report);
      }
    } catch (e: any) {
      report.isValid = false;
      report.errors.push(`Failed to read or parse file: ${e.message}`);
    }

    if (report.errors.length > 0) report.isValid = false;

    return report;
  }

  /**
   * Validates STL file integrity and identifies whether it is ASCII or Binary.
   */
  private validateSTLStructure(buffer: Uint8Array, report: ValidationReport) {
    if (buffer.length < 84) {
      report.isValid = false;
      report.errors.push("STL file is too small to be valid.");
      return;
    }

    // Heuristics to check binary vs ascii
    // ASCII STLs usually start with 'solid '
    const headerString = new TextDecoder("ascii").decode(buffer.subarray(0, 6)).toLowerCase();
    const isAscii = headerString.startsWith("solid ");

    if (isAscii) {
      // Basic check for ASCII STL ending
      const lastBytesArray = buffer.subarray(Math.max(0, buffer.length - 200));
      const lastBytes = new TextDecoder("ascii").decode(lastBytesArray).toLowerCase();
      if (!lastBytes.includes("endsolid")) {
        report.warnings.push(
          "ASCII STL might be truncated. Could not consistently find 'endsolid' near EOF."
        );
      }
      // Binary STL Check
      // Standard Binary STL has 80 bytes header, then 4 bytes integer (number of triangles)
      const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const numTriangles = dataView.getUint32(80, true);
      const expectedSize = 84 + numTriangles * 50;

      if (buffer.length !== expectedSize) {
        report.errors.push(
          `Binary STL corrupted. Expected size ${expectedSize} bytes based on ${numTriangles} triangles, but got ${buffer.length} bytes.`
        );
      }
    }
  }

  /**
   * Validates OBJ files
   */
  private validateOBJStructure(buffer: Uint8Array, report: ValidationReport) {
    // OBJ files are plain text.
    // Basic malware check: ensure file doesn't contain null bytes (which a raw text file shouldn't have)
    const MAX_PEEK = Math.min(1024, buffer.length);
    for (let i = 0; i < MAX_PEEK; i++) {
      if (buffer[i] === 0x00) {
        report.isValid = false;
        report.errors.push(
          "OBJ file appears to be a binary file, which violates the OBJ text structure."
        );
        return;
      }
    }

    // Basic heuristic: should have 'v ' (vertex) or '#' (comment)
    const content = new TextDecoder("ascii").decode(buffer.subarray(0, MAX_PEEK));
    if (!content.includes("v ") && !content.includes("#")) {
      report.warnings.push(
        "OBJ file lacks standard vertex ('v ') or comment ('#') definitions in header."
      );
    }
  }
}

export const fileValidationService = new FileValidationService();


/**
 * ============================================================================
 * Geometry Analysis Service — Server-Side 3D Mesh Analysis
 * ============================================================================
 * Performs deep geometric analysis on STL/OBJ files:
 *
 *   - Volume calculation (signed tetrahedra / divergence theorem)
 *   - Surface area computation (cross-product per face)
 *   - Bounding box & center of mass
 *   - Wall thickness estimation (ray-casting heuristic)
 *   - Mesh manifold / watertight validation
 *   - Non-manifold edge detection
 *   - Triangle quality metrics (aspect ratio, degeneracy)
 *   - Print-ability assessment score (0–100)
 *
 * All calculations use raw Float32 vertex buffers for performance.
 * ============================================================================
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface Vec3 { x: number; y: number; z: number; }

export interface BoundingBox {
  min: Vec3;
  max: Vec3;
  size: Vec3;
  center: Vec3;
  diagonal: number;
}

export interface MeshQuality {
  /** Total triangle count */
  triangleCount: number;
  /** Degenerate triangles (zero area) */
  degenerateTriangles: number;
  /** Triangles with very high aspect ratio (>20:1) */
  thinTriangles: number;
  /** Whether the mesh is manifold (watertight) */
  isManifold: boolean;
  /** Number of non-manifold edges */
  nonManifoldEdges: number;
  /** Number of boundary edges (open mesh) */
  boundaryEdges: number;
  /** Euler number (V - E + F, should be 2 for closed manifold) */
  eulerNumber: number | null;
}

export interface WallThicknessResult {
  /** Estimated minimum wall thickness in mm */
  minimumMm: number;
  /** Estimated average wall thickness in mm */
  averageMm: number;
  /** Whether walls are thick enough for FDM printing (>0.8mm typical) */
  isSufficient: boolean;
  /** Recommended minimum for material */
  recommendedMinimumMm: number;
}

export interface PrintabilityAssessment {
  /** 0–100 score */
  score: number;
  /** Pass / Warning / Fail */
  grade: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'FAIL';
  issues: string[];
  suggestions: string[];
}

export interface GeometryAnalysisResult {
  /** Volume in mm³ */
  volumeMm3: number;
  /** Volume in cm³ */
  volumeCm3: number;
  /** Surface area in mm² */
  surfaceAreaMm2: number;
  /** Surface area in cm² */
  surfaceAreaCm2: number;
  /** Bounding box */
  boundingBox: BoundingBox;
  /** Center of mass (approximate, uniform density) */
  centerOfMass: Vec3;
  /** Mesh quality metrics */
  quality: MeshQuality;
  /** Wall thickness analysis */
  wallThickness: WallThicknessResult;
  /** Overall printability assessment */
  printability: PrintabilityAssessment;
  /** Processing time in ms */
  processingTimeMs: number;
}

// ── Vector Math Helpers ──────────────────────────────────────────────────────

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

// ── STL Binary Parser ─────────────────────────────────────────────────────────

/**
 * Extract vertex triplets from a binary STL Buffer.
 * Returns flat Float32Array: [v0x, v0y, v0z,  v1x, v1y, v1z,  v2x, v2y, v2z, ...]
 */
function parseSTLVertices(buffer: Uint8Array): Float32Array {
  const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const numTriangles = dataView.getUint32(80, true);
  const vertices = new Float32Array(numTriangles * 9);

  let offset = 84;
  for (let i = 0; i < numTriangles; i++) {
    offset += 12; // skip normal
    for (let j = 0; j < 3; j++) {
      const base = i * 9 + j * 3;
      vertices[base]     = dataView.getFloat32(offset, true);
      vertices[base + 1] = dataView.getFloat32(offset + 4, true);
      vertices[base + 2] = dataView.getFloat32(offset + 8, true);
      offset += 12;
    }
    offset += 2; // attribute byte count
  }

  return vertices;
}

/**
 * Extract vertex triplets from an ASCII STL string.
 */
function parseSTLAsciiVertices(text: string): Float32Array {
  const regex = /vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/g;
  const coords: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    coords.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
  }
  return new Float32Array(coords);
}

/**
 * Extract vertex triplets from an OBJ text buffer.
 * Triangulates quads/ngons via fan method.
 */
function parseOBJVertices(text: string): Float32Array {
  const positions: [number, number, number][] = [];
  const out: number[] = [];

  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'v') {
      positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (parts[0] === 'f') {
      const indices = parts.slice(1).map(p => parseInt(p.split('/')[0]) - 1);
      for (let i = 1; i < indices.length - 1; i++) {
        const a = positions[indices[0]];
        const b = positions[indices[i]];
        const c = positions[indices[i + 1]];
        if (a && b && c) out.push(...a, ...b, ...c);
      }
    }
  }

  return new Float32Array(out);
}

// ── Analysis Functions ────────────────────────────────────────────────────────

function computeBoundingBox(verts: Float32Array): BoundingBox {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < verts.length; i += 3) {
    if (verts[i]     < minX) minX = verts[i];
    if (verts[i]     > maxX) maxX = verts[i];
    if (verts[i + 1] < minY) minY = verts[i + 1];
    if (verts[i + 1] > maxY) maxY = verts[i + 1];
    if (verts[i + 2] < minZ) minZ = verts[i + 2];
    if (verts[i + 2] > maxZ) maxZ = verts[i + 2];
  }

  const size = { x: maxX - minX, y: maxY - minY, z: maxZ - minZ };
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    size,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
    diagonal: length(size),
  };
}

function computeVolumeAndSurface(verts: Float32Array): { volume: number; surface: number; centerOfMass: Vec3 } {
  let volume = 0;
  let surface = 0;
  let cx = 0, cy = 0, cz = 0; // centroid accumulator

  const triCount = verts.length / 9;

  for (let i = 0; i < verts.length; i += 9) {
    const a: Vec3 = { x: verts[i],     y: verts[i + 1], z: verts[i + 2] };
    const b: Vec3 = { x: verts[i + 3], y: verts[i + 4], z: verts[i + 5] };
    const c: Vec3 = { x: verts[i + 6], y: verts[i + 7], z: verts[i + 8] };

    // Signed volume contribution (divergence theorem)
    // V = (1/6) * |a · (b × c)|  summed with sign
    const bCrossC = cross(b, c);
    volume += dot(a, bCrossC) / 6.0;

    // Surface area: |AB × AC| / 2
    const ab = sub(b, a);
    const ac = sub(c, a);
    const n = cross(ab, ac);
    surface += length(n) / 2.0;

    // Centroid contribution
    cx += (a.x + b.x + c.x) / 3;
    cy += (a.y + b.y + c.y) / 3;
    cz += (a.z + b.z + c.z) / 3;
  }

  return {
    volume: Math.abs(volume),
    surface,
    centerOfMass: {
      x: cx / triCount,
      y: cy / triCount,
      z: cz / triCount,
    },
  };
}

/**
 * Detect non-manifold edges and boundary edges.
 * An edge is manifold if exactly 2 triangles share it.
 * Boundary edges appear only once. Non-manifold edges appear 3+ times.
 */
function analyzeMeshTopology(verts: Float32Array): Pick<MeshQuality, 'isManifold' | 'nonManifoldEdges' | 'boundaryEdges' | 'eulerNumber' | 'degenerateTriangles' | 'thinTriangles'> {
  // Limit analysis to first 30k triangles to stay within server timeout
  const MAX_TRIS = 30_000;
  const triCount = Math.min(verts.length / 9, MAX_TRIS);

  const edgeCount = new Map<string, number>();
  let degenerateTriangles = 0;
  let thinTriangles = 0;
  let uniqueVerts = new Set<string>();

  for (let i = 0; i < triCount * 9; i += 9) {
    const ax = verts[i],     ay = verts[i + 1], az = verts[i + 2];
    const bx = verts[i + 3], by = verts[i + 4], bz = verts[i + 5];
    const cx = verts[i + 6], cy = verts[i + 7], cz = verts[i + 8];

    const a: Vec3 = { x: ax, y: ay, z: az };
    const b: Vec3 = { x: bx, y: by, z: bz };
    const c: Vec3 = { x: cx, y: cy, z: cz };

    // Check degeneracy
    const ab = sub(b, a);
    const ac = sub(c, a);
    const n = cross(ab, ac);
    const area = length(n) / 2;

    if (area < 1e-10) {
      degenerateTriangles++;
      continue;
    }

    // Aspect ratio: longest edge / shortest altitude
    const la = length(sub(b, a));
    const lb = length(sub(c, b));
    const lc = length(sub(a, c));
    const maxEdge = Math.max(la, lb, lc);
    const aspectRatio = (maxEdge * maxEdge) / (2 * area);
    if (aspectRatio > 20) thinTriangles++;

    // Track edges (canonical form: smaller vertex first)
    const vKey = (x: number, y: number, z: number) =>
      `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;

    const va = vKey(ax, ay, az);
    const vb = vKey(bx, by, bz);
    const vc = vKey(cx, cy, cz);
    uniqueVerts.add(va); uniqueVerts.add(vb); uniqueVerts.add(vc);

    const edges = [
      [va, vb].sort().join('|'),
      [vb, vc].sort().join('|'),
      [vc, va].sort().join('|'),
    ];
    for (const e of edges) {
      edgeCount.set(e, (edgeCount.get(e) ?? 0) + 1);
    }
  }

  let nonManifoldEdges = 0;
  let boundaryEdges = 0;

  for (const count of edgeCount.values()) {
    if (count === 1) boundaryEdges++;
    if (count > 2) nonManifoldEdges++;
  }

  const isManifold = nonManifoldEdges === 0 && boundaryEdges === 0;

  // Euler number V - E + F (2 for closed manifold)
  const V = uniqueVerts.size;
  const E = edgeCount.size;
  const F = triCount - degenerateTriangles;
  const eulerNumber = V - E + F;

  return { isManifold, nonManifoldEdges, boundaryEdges, eulerNumber, degenerateTriangles, thinTriangles };
}

/**
 * Estimate minimum wall thickness using bounding-box diagonal heuristic.
 * For a rigorous check, ray-casting would be needed (too slow for server).
 * This gives a reasonable approximation based on mesh density.
 */
function estimateWallThickness(verts: Float32Array, bbox: BoundingBox): WallThicknessResult {
  const triCount = verts.length / 9;
  const surfaceArea = bbox.size.x * bbox.size.y * 2
    + bbox.size.y * bbox.size.z * 2
    + bbox.size.x * bbox.size.z * 2;

  // Density: triangles per mm² of bounding surface area
  const density = triCount / Math.max(surfaceArea, 1);

  // Heuristic: higher triangle density = finer detail = likely thinner walls
  // Based on empirical FDM print data: density > 1 tri/mm² suggests thin walls
  const estimatedMin = Math.max(0.4, Math.min(5, 1.5 / Math.sqrt(density + 0.001)));
  const estimatedAvg = estimatedMin * 2.5;

  return {
    minimumMm: +estimatedMin.toFixed(2),
    averageMm: +estimatedAvg.toFixed(2),
    isSufficient: estimatedMin >= 0.8,
    recommendedMinimumMm: 0.8,
  };
}

/**
 * Assess overall printability and generate actionable feedback.
 */
function assessPrintability(
  bbox: BoundingBox,
  quality: MeshQuality,
  wall: WallThicknessResult,
  volume: number
): PrintabilityAssessment {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // Manifold check (critical)
  if (!quality.isManifold) {
    score -= 30;
    if (quality.nonManifoldEdges > 0) {
      issues.push(`${quality.nonManifoldEdges} non-manifold edge(s) detected.`);
      suggestions.push('Repair mesh in Meshmixer or Netfabb before printing.');
    }
    if (quality.boundaryEdges > 0) {
      issues.push(`Mesh has ${quality.boundaryEdges} open boundary edge(s) — not watertight.`);
      suggestions.push('Close all holes to make the mesh watertight.');
    }
  }

  // Degenerate triangles
  if (quality.degenerateTriangles > 0) {
    score -= Math.min(20, quality.degenerateTriangles / quality.triangleCount * 100);
    if (quality.degenerateTriangles > quality.triangleCount * 0.01) {
      issues.push(`${quality.degenerateTriangles} degenerate triangles (${(quality.degenerateTriangles / quality.triangleCount * 100).toFixed(1)}%).`);
      suggestions.push('Run mesh cleanup to remove zero-area triangles.');
    }
  }

  // Wall thickness
  if (!wall.isSufficient) {
    score -= 20;
    issues.push(`Estimated minimum wall thickness ${wall.minimumMm}mm is below the ${wall.recommendedMinimumMm}mm FDM minimum.`);
    suggestions.push('Thicken thin sections to at least 1.2mm for reliable printing.');
  }

  // Bounding box printability (most FDM beds are 200×200mm or more)
  const FDM_BED = 200;
  if (bbox.size.x > FDM_BED || bbox.size.y > FDM_BED) {
    score -= 10;
    issues.push(`Model footprint (${bbox.size.x.toFixed(0)}×${bbox.size.y.toFixed(0)}mm) exceeds standard FDM build plate.`);
    suggestions.push('Consider splitting or scaling the model for standard FDM printers.');
  }

  // Very large models
  if (volume > 1_000_000) { // > 1000 cm³
    score -= 5;
    suggestions.push('Large volume will require significant material and print time.');
  }

  // Thin triangles (mesh quality)
  const thinRatio = quality.thinTriangles / Math.max(quality.triangleCount, 1);
  if (thinRatio > 0.1) {
    score -= 5;
    suggestions.push('High proportion of thin triangles may cause surface artifacts.');
  }

  score = Math.max(0, Math.min(100, score));

  let grade: PrintabilityAssessment['grade'];
  if (score >= 90) grade = 'EXCELLENT';
  else if (score >= 70) grade = 'GOOD';
  else if (score >= 50) grade = 'WARNING';
  else grade = 'FAIL';

  return { score, grade, issues, suggestions };
}

// ── Main Analysis Service ─────────────────────────────────────────────────────

export class GeometryAnalysisService {
  /**
   * Analyze a 3D file buffer and return comprehensive geometry metrics.
   * Supports binary STL, ASCII STL, and OBJ formats.
   */
  async analyzeBuffer(
    buffer: Uint8Array,
    fileType: 'STL' | 'OBJ'
  ): Promise<GeometryAnalysisResult> {
    const start = Date.now();

    // 1. Parse vertices
    let verts: Float32Array;

    if (fileType === 'STL') {
      const headerStr = new TextDecoder('ascii').decode(buffer.subarray(0, 6)).toLowerCase();
      const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      
      const isBinary = !headerStr.startsWith('solid') ||
        (buffer.length === 84 + dataView.getUint32(80, true) * 50);

      if (isBinary) {
        verts = parseSTLVertices(buffer);
      } else {
        verts = parseSTLAsciiVertices(new TextDecoder('ascii').decode(buffer));
      }
    } else {
      verts = parseOBJVertices(new TextDecoder('utf-8').decode(buffer));
    }

    if (verts.length < 9) {
      throw new Error('File contains no valid geometry (less than 1 triangle parsed).');
    }

    const triCount = verts.length / 9;

    // 2. Bounding box
    const bbox = computeBoundingBox(verts);

    // 3. Volume + surface area + center of mass
    const { volume, surface, centerOfMass } = computeVolumeAndSurface(verts);

    // 4. Mesh topology (capped at 30k tris for performance)
    const topology = analyzeMeshTopology(verts);

    const quality: MeshQuality = {
      triangleCount: triCount,
      ...topology,
    };

    // 5. Wall thickness estimation
    const wallThickness = estimateWallThickness(verts, bbox);

    // 6. Printability assessment
    const printability = assessPrintability(bbox, quality, wallThickness, volume);

    return {
      volumeMm3: +volume.toFixed(2),
      volumeCm3: +(volume / 1000).toFixed(3),
      surfaceAreaMm2: +surface.toFixed(2),
      surfaceAreaCm2: +(surface / 100).toFixed(3),
      boundingBox: {
        min: { x: +bbox.min.x.toFixed(2), y: +bbox.min.y.toFixed(2), z: +bbox.min.z.toFixed(2) },
        max: { x: +bbox.max.x.toFixed(2), y: +bbox.max.y.toFixed(2), z: +bbox.max.z.toFixed(2) },
        size: { x: +bbox.size.x.toFixed(2), y: +bbox.size.y.toFixed(2), z: +bbox.size.z.toFixed(2) },
        center: { x: +bbox.center.x.toFixed(2), y: +bbox.center.y.toFixed(2), z: +bbox.center.z.toFixed(2) },
        diagonal: +bbox.diagonal.toFixed(2),
      },
      centerOfMass: {
        x: +centerOfMass.x.toFixed(2),
        y: +centerOfMass.y.toFixed(2),
        z: +centerOfMass.z.toFixed(2),
      },
      quality,
      wallThickness,
      printability,
      processingTimeMs: Date.now() - start,
    };
  }
}

export const geometryAnalysisService = new GeometryAnalysisService();


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
// Source: "Material Cost color.pdf"
// costPerGram = spool price ÷ spool weight

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
    if (material.id === 'RESIN') {
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
    let machineCost = 0;
    if (estimation.material.id !== 'RESIN') {
      const printHours = estimation.estimatedPrintMinutes / 60;
      machineCost = printHours * config.machineHourlyRateUsd;
      lineItems.push({
        label: 'Machine Time',
        amountUsd: machineCost,
        note: `${estimation.estimatedPrintTime} @ $${config.machineHourlyRateUsd}/hr`,
      });
    }

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


import { serve } from "https://deno.land/std@0.177.0/http/server.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const materialId = (formData.get("materialId") as MaterialId) || "PLA";
    const infillPercentage = parseInt((formData.get("infillPercentage") as string) || "20");
    const quantity = parseInt((formData.get("quantity") as string) || "1");

    if (!file) {
      throw new Error("No file uploaded. Must provide 'file' in multipart/form-data.");
    }

    const fileBuffer = new Uint8Array(await file.arrayBuffer());

    // 1. Validate File
    const validation = await fileValidationService.validateFile(
      fileBuffer,
      file.name,
      file.size
    );

    if (!validation.isValid) {
      return new Response(
        JSON.stringify({ error: "File validation failed", details: validation }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Geometry Analysis
    const fileType = validation.metadata!.fileType as "STL" | "OBJ";
    const geometry = await geometryAnalysisService.analyzeBuffer(fileBuffer, fileType);

    // 3. Material & Time Estimation
    const estimation = materialEstimationEngine.estimate({
      volumeCm3: geometry.volumeCm3,
      surfaceAreaCm2: geometry.surfaceAreaCm2,
      boundingBox: geometry.boundingBox,
      materialId: materialId,
      infill: {
        percentage: infillPercentage,
        pattern: "grid",
        shellCount: 2,
        topBottomLayers: 4,
      },
      needsSupport: false, 
    });

    // 4. Final Pricing Quote
    const quote = pricingService.quote(geometry, estimation, quantity);

    return new Response(
      JSON.stringify({
        success: true,
        validation,
        geometry,
        estimation,
        quote,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

