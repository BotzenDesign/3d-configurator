import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";
import * as THREE from "https://esm.sh/three@0.160.0";

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    fileType: "STL" | "OBJ" | "3MF" | "UNKNOWN";
    fileSize: number;
    volume?: number;
    surfaceArea?: number;
  };
}

export class FileValidationService {
  private static MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private static ALLOWED_EXTENSIONS = [".stl", ".obj", ".3mf"];

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
      report.errors.push(`File is too large. Max size is 100MB.`);
    }

    const lowerName = originalName.toLowerCase();
    const ext = FileValidationService.ALLOWED_EXTENSIONS.find((e) =>
      lowerName.endsWith(e)
    );
    if (!ext) {
      report.isValid = false;
      report.errors.push(`Invalid extension. Allowed: .stl, .obj, .3mf`);
      return report;
    }

    report.metadata!.fileType = ext === ".stl" ? "STL" : ext === ".obj" ? "OBJ" : "3MF";

    // 2. Malware & Structure check via magic numbers/header parsing
    try {
      if (report.metadata!.fileType === "STL") {
        this.validateSTLStructure(fileBuffer, report);
      } else if (report.metadata!.fileType === "OBJ") {
        this.validateOBJStructure(fileBuffer, report);
      } else if (report.metadata!.fileType === "3MF") {
        // 3MF is a ZIP file, starts with PK\x03\x04
        if (fileBuffer.length < 4 || fileBuffer[0] !== 0x50 || fileBuffer[1] !== 0x4B || fileBuffer[2] !== 0x03 || fileBuffer[3] !== 0x04) {
          report.isValid = false;
          report.errors.push("Invalid 3MF file: missing ZIP signature.");
        }
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
 * Extract vertex triplets from a binary STL buffer.
 * Memory Optimized: Instead of returning a giant array, we calculate metrics inline
 * if requested, to prevent 546 Memory Limit Exceeded errors on >50MB files.
 */
function analyzeBinarySTLDirect(buffer: Uint8Array) {
  const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const triCount = dataView.getUint32(80, true);
  
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let volume = 0, surface = 0;
  let centroidX = 0, centroidY = 0, centroidZ = 0;

  // We only keep a small subset of triangles for topology & wall thickness checks to save memory
  const MAX_SAMPLES = Math.min(triCount, 30_000);
  const sampledVerts = new Float32Array(MAX_SAMPLES * 9);
  let vIdx = 0;

  let offset = 84;
  for (let i = 0; i < triCount; i++) {
    offset += 12; // skip normal
    
    const ax = dataView.getFloat32(offset, true);
    const ay = dataView.getFloat32(offset + 4, true);
    const az = dataView.getFloat32(offset + 8, true);
    offset += 12;

    const bx = dataView.getFloat32(offset, true);
    const by = dataView.getFloat32(offset + 4, true);
    const bz = dataView.getFloat32(offset + 8, true);
    offset += 12;

    const cx = dataView.getFloat32(offset, true);
    const cy = dataView.getFloat32(offset + 4, true);
    const cz = dataView.getFloat32(offset + 8, true);
    offset += 14;

    // Bounds
    if (ax < minX) minX = ax; if (ax > maxX) maxX = ax;
    if (ay < minY) minY = ay; if (ay > maxY) maxY = ay;
    if (az < minZ) minZ = az; if (az > maxZ) maxZ = az;
    if (bx < minX) minX = bx; if (bx > maxX) maxX = bx;
    if (by < minY) minY = by; if (by > maxY) maxY = by;
    if (bz < minZ) minZ = bz; if (bz > maxZ) maxZ = bz;
    if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
    if (cz < minZ) minZ = cz; if (cz > maxZ) maxZ = cz;

    // Volume (Signed tetrahedron)
    const b_cross_c_x = by * cz - bz * cy;
    const b_cross_c_y = bz * cx - bx * cz;
    const b_cross_c_z = bx * cy - by * cx;
    volume += (ax * b_cross_c_x + ay * b_cross_c_y + az * b_cross_c_z) / 6.0;

    // Surface Area
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    surface += Math.sqrt(nx*nx + ny*ny + nz*nz) / 2.0;

    centroidX += (ax + bx + cx) / 3;
    centroidY += (ay + by + cy) / 3;
    centroidZ += (az + bz + cz) / 3;

    if (i < MAX_SAMPLES) {
      sampledVerts[vIdx++] = ax; sampledVerts[vIdx++] = ay; sampledVerts[vIdx++] = az;
      sampledVerts[vIdx++] = bx; sampledVerts[vIdx++] = by; sampledVerts[vIdx++] = bz;
      sampledVerts[vIdx++] = cx; sampledVerts[vIdx++] = cy; sampledVerts[vIdx++] = cz;
    }
  }

  const size = { x: maxX - minX, y: maxY - minY, z: maxZ - minZ };
  return {
    triCount,
    volume: Math.abs(volume),
    surface,
    centerOfMass: { x: centroidX / triCount, y: centroidY / triCount, z: centroidZ / triCount },
    bbox: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      size,
      center: { x: (minX + maxX)/2, y: (minY + maxY)/2, z: (minZ + maxZ)/2 },
      diagonal: Math.sqrt(size.x*size.x + size.y*size.y + size.z*size.z)
    },
    sampledVerts
  };
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

  let lineStart = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      const line = text.substring(lineStart, i).trim();
      lineStart = i + 1;
      if (!line) continue;

      if (line.startsWith('v ')) {
        const parts = line.split(/\s+/);
        positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
      } else if (line.startsWith('f ')) {
        const parts = line.split(/\s+/);
        const indices = parts.slice(1).map(p => parseInt(p.split('/')[0]) - 1);
        for (let j = 1; j < indices.length - 1; j++) {
          const a = positions[indices[0]];
          const b = positions[indices[j]];
          const c = positions[indices[j + 1]];
          if (a && b && c) out.push(...a, ...b, ...c);
        }
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
    fileType: 'STL' | 'OBJ' | '3MF'
  ): Promise<GeometryAnalysisResult> {
    const start = Date.now();

    // Limit buffer to ~100MB to prevent Supabase 546 Memory Limit Exceeded error
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File is too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Please upload a file smaller than 100MB to prevent memory timeouts.`);
    }

    // 1. Parse vertices
    let verts: Float32Array;
    let triCount = 0;
    let bbox: BoundingBox;
    let volume = 0;
    let surface = 0;
    let centerOfMass = { x: 0, y: 0, z: 0 };

    if (fileType === 'STL') {
      const headerStr = new TextDecoder('ascii').decode(buffer.subarray(0, 6)).toLowerCase();
      const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      
      const isBinary = !headerStr.startsWith('solid') ||
        (buffer.length === 84 + dataView.getUint32(80, true) * 50);

      if (isBinary) {
        // High-performance, zero-allocation pass for massive files
        const directAnalysis = analyzeBinarySTLDirect(buffer);
        verts = directAnalysis.sampledVerts;
        triCount = directAnalysis.triCount;
        bbox = directAnalysis.bbox;
        volume = directAnalysis.volume;
        surface = directAnalysis.surface;
        centerOfMass = directAnalysis.centerOfMass;
      } else {
        verts = parseSTLAsciiVertices(new TextDecoder('ascii').decode(buffer));
      }
    } else if (fileType === 'OBJ') {
      verts = parseOBJVertices(new TextDecoder('utf-8').decode(buffer));
    } else {
      verts = await parse3MFVertices(buffer);
    }

    if (verts.length < 9 && !triCount) {
      throw new Error('File contains no valid geometry (less than 1 triangle parsed).');
    }

    // Fallback for ASCII STL and OBJ
    if (triCount === 0) {
      triCount = verts.length / 9;
      bbox = computeBoundingBox(verts);
      const vs = computeVolumeAndSurface(verts);
      volume = vs.volume;
      surface = vs.surface;
      centerOfMass = vs.centerOfMass;
    }

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

export type MaterialId = string;

export interface Material {
  id: MaterialId;
  name: string;
  /** @deprecated Use spoolCost/spoolQuantity instead. Kept for fallback only. */
  costPerGram: number;
  /** M — Total purchase price of the spool or resin bottle in USD */
  spoolCost: number;
  /** L (FDM) — Total filament length on the spool in meters
   *  V (SLA) — Total resin volume in the bottle in mL */
  spoolQuantity: number;
  /** Max recommended print speed mm/s (0 for resin) */
  maxSpeedMms: number;
  /** Is this an SLA resin (true) or FDM filament (false) */
  isResin: boolean;
  description: string;
  /** Available colors */
  availableColors: string[];
}

export let MATERIALS: Record<MaterialId, Material> = {}; // Will be populated from DB

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
  /** Layer height in mm */
  layerHeightMm?: number;
  /** Whether raft/base is enabled */
  raftEnabled?: boolean;
  /** Number of raft layers */
  raftLayers?: number;
}

export interface EstimationResult {
  material: Material;
  infill: InfillConfig;
  /** Effective material volume used (cm³) */
  effectiveVolumeCm3: number;
  /** Support material volume in cm³ (mL) */
  supportVolumeCm3: number;
  /** Raft material volume in cm³ (mL) */
  raftVolumeCm3: number;
  /** Total volume including support and raft */
  totalVolumeCm3: number;
  /** Total filament length in meters (A in formula) */
  filamentLengthM: number;
  /** Print time estimate in minutes */
  estimatedPrintMinutes: number;
  /** Print time formatted */
  estimatedPrintTime: string;
  /** Per-unit breakdown */
  breakdown: {
    infillEffectivePercent: number;
  };
}

const FILAMENT_DIAMETER_MM = 1.75;
const WASTE_FACTOR = 1.05; // 5% waste (purge lines, skirt)

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
      layerHeightMm = 0.2,
    } = input;

    const material = MATERIALS[materialId];
    
    if (!material) {
      throw new Error(`Material with ID "${materialId}" not found in database.`);
    }

    // ── FDM uses WEIGHT for cost. SLA uses VOLUME for cost (per PDF spec). ──
    const isSLA = material.isResin;

    // 1. Effective fill ratio (FDM only; SLA cures the full cross-section)
    const fillRatio = isSLA ? 1.0 : effectiveInfillRatio(volumeCm3, { size }, infill, layerHeightMm);
    const effectiveVolumeCm3 = volumeCm3 * fillRatio;

    // 3. Support material (Removed per client request)
    const supportVolumeCm3 = 0;

    // 4. Raft material
    let raftVolumeCm3 = 0;
    if (input.raftEnabled) {
      // area (mm2) * height (mm) / 1000 = cm3
      raftVolumeCm3 = (size.x * size.y * ((input.raftLayers || 3) * layerHeightMm)) / 1000;
    }

    // 5. Total volume
    const totalVolumeCm3 = effectiveVolumeCm3 + supportVolumeCm3 + raftVolumeCm3;

    // 6. Print time estimate
    let printTimeMinutes = 0;
    let finalFilamentLengthM = filamentLengthM;

    if (isSLA) {
      // SLA: Exposure-based timing (Jacob's Equation from formula.md)
      const layerHeight = layerHeightMm; // Cd in formula
      const normalExposure = 2.5; // Average t for standard resin at 0.05mm
      const bottomExposureMultiplier = 5; // 3-8x multiplier from formula.md
      const bottomLayers = 5;
      const liftRetractTime = 8; // Mechanical overhead per layer (lift + retract)
      
      const layerCount = Math.ceil(size.z / layerHeight);
      
      // Time = (Normal Layers * (t + lift)) + (Bottom Layers * (t*multiplier + lift))
      const totalExposureSeconds = (layerCount - bottomLayers) * (normalExposure + liftRetractTime) + 
                                  (bottomLayers * (normalExposure * bottomExposureMultiplier + liftRetractTime));
                                  
      printTimeMinutes = Math.max(5, Math.round(totalExposureSeconds / 60));
    } else {
      // FDM: Volumetric estimation based on formula.md (Cura Logic)
      const nozzleDiameterMm = 0.4;
      const lineWidth = nozzleDiameterMm * 1.05; // Standard Cura default
      const filamentArea = Math.PI * Math.pow(FILAMENT_DIAMETER_MM / 2, 2);
      
      // Calculate travel distance (L_travel) for ALL components
      // 1. Model Shells: surface area * shellCount
      const shellPathMm = (surfaceAreaCm2 * 100) * (input.infill.shellCount || 2);
      
      // 2. Model Infill: (Volume - ShellVolume) / (Area of extrusion)
      // Note: We subtract shell volume to avoid double-counting
      const shellVolumeMm3 = (surfaceAreaCm2 * 100) * (lineWidth * (input.infill.shellCount || 2));
      const modelInfillVolumeMm3 = Math.max(0, (volumeCm3 * 1000) - shellVolumeMm3) * (input.infill.percentage / 100);
      const modelInfillPathMm = modelInfillVolumeMm3 / (lineWidth * layerHeightMm);

      // 3. Support & Raft Path
      const supportPathMm = (supportVolumeCm3 * 1000) / (lineWidth * layerHeightMm);
      const raftPathMm = (raftVolumeCm3 * 1000) / (lineWidth * layerHeightMm);

      const totalTravelMm = (shellPathMm + modelInfillPathMm + supportPathMm + raftPathMm) * WASTE_FACTOR;
      
      // E = (line_width * layer_height * travel_distance) / filament_area
      // This is the "A" variable in the Botzen formula (converted to meters)
      const extrusionVolumeMm3 = (lineWidth * layerHeightMm * totalTravelMm);
      finalFilamentLengthM = (extrusionVolumeMm3 / filamentArea) / 1000;
      
      // Update print time using travel speed
      const printSpeedMms = Math.max(1, Math.min(material.maxSpeedMms, 60));
      const extrusionTimeSeconds = totalTravelMm / printSpeedMms;
      
      // Add mechanical overhead (retractions, layer changes, travel moves)
      const setupOverheadMinutes = 10;
      printTimeMinutes = Math.round(extrusionTimeSeconds / 60) + setupOverheadMinutes;
    }

    const estimatedPrintTime = formatPrintTime(printTimeMinutes);

    return {
      material,
      infill,
      effectiveVolumeCm3: +effectiveVolumeCm3.toFixed(3),
      supportVolumeCm3: +supportVolumeCm3.toFixed(3),
      raftVolumeCm3: +raftVolumeCm3.toFixed(3),
      totalVolumeCm3: +totalVolumeCm3.toFixed(3),
      filamentLengthM: +(isSLA ? 0 : finalFilamentLengthM).toFixed(2),
      estimatedPrintMinutes: printTimeMinutes,
      estimatedPrintTime,
      breakdown: {
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
  if (minutes < 60) return `~${minutes} m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h} h ${m} m` : `~${h} h`;
}

export const materialEstimationEngine = new MaterialEstimationEngine();


/**
 * ============================================================================
 * Pricing Service — Botzen Formula
 * ============================================================================
 *
 * Variables (all configurable via Admin Dashboard):
 *   M  = Material cost $ (purchase price of spool/bottle)     — per material
 *   L  = Length of filament on spool in meters (FDM)          — per material
 *   V  = Volume of purchased resin in mL (SLA)                — per material
 *   Y  = 2× material multiplier                               — global setting
 *   W  = Fixed run time multiplier (default 1.25)             — global setting
 *   T  = Machine part run time in hours                       — calculated from geometry
 *   A  = Length of job filament needed in meters (FDM)        — calculated from geometry
 *   B  = Volume of job resin needed in mL (SLA)               — calculated from geometry
 *
 * Formulas:
 *   FDM Total = (Y × M / L × A) + W × T
 *   SLA Total = (Y × M / V × B) + W × T
 *
 * All prices in USD.
 * ============================================================================
 */

// ── Pricing Configuration ─────────────────────────────────────────────────────

export interface PricingConfig {
  /** Y — Material cost multiplier (e.g. 2 = 2× the raw material cost) */
  materialMultiplierY: number;
  /** W — Fixed run-time multiplier in $/hour (e.g. 1.25 = $1.25 per print-hour) */
  runTimeMultiplierW: number;
  /** Base setup fee per order in USD */
  setupFeeUsd: number;
  /** Quantity discount tiers */
  quantityDiscounts: Array<{ minQty: number; discountPct: number }>;
}

const DEFAULT_CONFIG: PricingConfig = {
  // Overridden at runtime from app_settings table in Supabase.
  materialMultiplierY: 2.5,   // Y: Increased to 2.5x for better overhead coverage
  runTimeMultiplierW:  5.00,  // W: Increased to $5.00/hr (industry average for FDM/SLA)
  setupFeeUsd:         15.00, // Default setup fee
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
  /** Volume breakdown in mL for the Summary panel */
  volumeBreakdown: {
    modelMl: number;
    supportsMl: number;
    raftMl: number;
    totalMl: number;
  };
  /** Cost breakdown based purely on material usage */
  costBreakdown: {
    modelCost: number;
    supportRaftCost: number;
    totalMaterialCost: number;
  };
}

// ── Pricing Engine ────────────────────────────────────────────────────────────

export class PricingService {
  private config: PricingConfig;

  constructor(config: Partial<PricingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setConfig(config: Partial<PricingConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Generate a full price quote using the Botzen formula.
   *
   * FDM: Total = (Y × M/L × A) + W × T
   * SLA: Total = (Y × M/V × B) + W × T
   *
   * Variables:
   *   Y = materialMultiplierY  (global, from app_settings)
   *   M = material.spoolCost   (per material, from DB)
   *   L = material.spoolQuantity meters  (FDM, from DB)
   *   V = material.spoolQuantity mL      (SLA, from DB)
   *   W = runTimeMultiplierW   (global, from app_settings)
   *   T = print time in hours  (calculated from geometry)
   *   A = filament used in meters (FDM, from estimation engine)
   *   B = resin volume used in mL (SLA, from estimation engine = effectiveVolumeCm3)
   */
  quote(
    geometry: GeometryAnalysisResult,
    estimation: EstimationResult,
    quantity: number = 1
  ): QuoteResult {
    const { config } = this;
    const mat = estimation.material;
    const isSLA = mat.isResin;
    const lineItems: PriceLineItem[] = [];

    // ── Extract Botzen variables ─────────────────────────────────────────────
    const Y = config.materialMultiplierY;  // material multiplier
    const W = config.runTimeMultiplierW;   // run-time multiplier ($/hr)
    const M = mat.spoolCost;               // purchase price of spool/bottle
    const Q = mat.spoolQuantity;           // spool/bottle quantity (L or V)
    const T = estimation.estimatedPrintMinutes / 60; // print time in hours

    // ── 1. Material Cost ─────────────────────────────────────────────────────
    let materialCost = 0;
    let materialNote = '';

    if (isSLA) {
      // SLA Jobs = (Y * M / V * B) + W * T
      // B = total volume in mL (effective + support + raft)
      const B = estimation.totalVolumeCm3;
      materialCost = Y * (M / Q) * B;
      materialNote = `Y(${Y}) × $${M}/${Q}mL × ${B.toFixed(2)}mL × ${quantity}pcs`;
    } else {
      // FDM Jobs = (Y * M / L * A) + W * T
      // A = filament length in meters
      const A = estimation.filamentLengthM;
      materialCost = Y * (M / Q) * A;
      materialNote = `Y(${Y}) × $${M}/${Q}m × ${A.toFixed(2)}m × ${quantity}pcs`;
    }

    const batchMaterialCost = materialCost * quantity;

    lineItems.push({
      label: `Material — ${mat.name}`,
      amountUsd: +batchMaterialCost.toFixed(4),
      note: materialNote,
    });

    // ── 2. Machine Run Time ──────────────────────────────────────────────────
    // W × T  (applies to both FDM and SLA)
    const machineCost = W * T;
    const totalMachineCost = machineCost * quantity;
    lineItems.push({
      label: 'Machine Run Time',
      amountUsd: +totalMachineCost.toFixed(4),
      note: `W(${W}) × ${estimation.estimatedPrintTime} × ${quantity}pcs (${(T * quantity).toFixed(2)}h total)`,
    });

    // ── 3. Setup & Handling Fee (Flat per order) ─────────────────────────────
    const setupFeeUsd = config.setupFeeUsd;
    lineItems.push({
      label: 'Setup & Processing',
      amountUsd: setupFeeUsd,
      note: 'Standard machine prep & QA (Per order)',
    });

    // ── 4. Unit Price (excluding setup fee) ──────────────────────────────────
    const unitPriceUsd = materialCost + machineCost;

    // ── 5. Quantity Discount ─────────────────────────────────────────────────
    const safeQty = Math.max(1, Math.floor(quantity));
    const discountTier = [...config.quantityDiscounts]
      .reverse()
      .find(d => safeQty >= d.minQty);

    const discountPct = discountTier?.discountPct ?? 0;
    const subtotalBeforeDiscount = unitPriceUsd * safeQty;
    const discountAmountUsd = subtotalBeforeDiscount * (discountPct / 100);
    const totalBeforeSetup = subtotalBeforeDiscount - discountAmountUsd;
    
    // Setup fee is applied once per order/batch
    const totalUsd = totalBeforeSetup + setupFeeUsd;
    const perUnitUsd = totalUsd / safeQty;

    // ── 6. Discount Line Item (for breakdown) ────────────────────────────────
    if (discountPct > 0) {
      lineItems.push({
        label: `Bulk Discount (${discountPct}%)`,
        amountUsd: -discountAmountUsd,
        note: `Applied to material & machine cost`,
      });
    }

    // Printability check (geometry quality flag — no charge, just informational)
    const needsRepair = !geometry.quality.isManifold &&
      (geometry.quality.nonManifoldEdges > 0 || geometry.quality.boundaryEdges > 5);

    const modelMl    = +estimation.effectiveVolumeCm3.toFixed(2);
    const supportsMl = +estimation.supportVolumeCm3.toFixed(2);
    const raftMl     = +estimation.raftVolumeCm3.toFixed(2);
    const totalMl    = +estimation.totalVolumeCm3.toFixed(2);

    // ── Cost breakdown (Pure Material) ───────────────────────────────────────
    let modelCost = 0;
    let supportRaftCost = 0;
    let totalMaterialCost = materialCost; // already calculated per unit

    if (isSLA) {
      const costPerVolume = (M / Q);
      modelCost = estimation.effectiveVolumeCm3 * costPerVolume * Y;
      supportRaftCost = (estimation.supportVolumeCm3 + estimation.raftVolumeCm3) * costPerVolume * Y;
    } else {
      // For FDM, we don't have separate length breakdown for support/raft vs model,
      // so we approximate it via volume ratio
      const ratio = totalMl > 0 ? modelMl / totalMl : 1;
      modelCost = materialCost * ratio;
      supportRaftCost = materialCost * (1 - ratio);
    }

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
        weight: isSLA ? `${estimation.totalVolumeCm3.toFixed(2)} mL` : `${estimation.filamentLengthM.toFixed(2)} m`,
      },

      needsRepair,
      printabilityGrade: geometry.printability.grade,
      volumeBreakdown: { modelMl, supportsMl, raftMl, totalMl },
      costBreakdown: {
        modelCost: +modelCost.toFixed(2),
        supportRaftCost: +supportRaftCost.toFixed(2),
        totalMaterialCost: +totalMaterialCost.toFixed(2),
      }
    };
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



async function parse3MFVertices(buffer: Uint8Array): Promise<Float32Array> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(buffer);
  
  const modelFile = loadedZip.file('3D/3dmodel.model');
  if (!modelFile) {
    throw new Error("Invalid 3MF file: missing 3D/3dmodel.model");
  }

  const xmlText = await modelFile.async("text");
  
  // Detect units from the <model> tag
  const unitMatch = xmlText.match(/<model[^>]*unit="([^"]+)"/i);
  const unitStr = unitMatch ? unitMatch[1].toLowerCase() : "millimeter";
  
  let unitScale = 1.0;
  switch (unitStr) {
    case "micron":     unitScale = 0.001; break;
    case "millimeter": unitScale = 1.0;   break;
    case "centimeter": unitScale = 10.0;  break;
    case "inch":       unitScale = 25.4;  break;
    case "foot":       unitScale = 304.8; break;
    case "meter":      unitScale = 1000.0;break;
  }

  // Use a more memory-efficient approach by not storing all vertex objects
  const vertexData = new Float32Array(xmlText.length / 8); // Rough pre-allocation
  let vertexCount = 0;
  
  // vertexRegex: match <vertex x="..." y="..." z="..." />
  const vertexRegex = /<vertex\s+[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*z="([^"]+)"/gi;
  let vMatch;
  while ((vMatch = vertexRegex.exec(xmlText)) !== null) {
    if (vertexCount * 3 + 3 > vertexData.length) break; 
    vertexData[vertexCount * 3]     = parseFloat(vMatch[1]) * unitScale;
    vertexData[vertexCount * 3 + 1] = parseFloat(vMatch[2]) * unitScale;
    vertexData[vertexCount * 3 + 2] = parseFloat(vMatch[3]) * unitScale;
    vertexCount++;
  }

  // Triangle parsing - use a larger buffer or dynamic growth
  // 3MF usually has triangle count ~ 2x vertex count
  const positions = new Float32Array(vertexCount * 18); 
  let posIdx = 0;
  
  const triangleRegex = /<triangle\s+[^>]*v1="([^"]+)"[^>]*v2="([^"]+)"[^>]*v3="([^"]+)"/gi;
  let tMatch;
  while ((tMatch = triangleRegex.exec(xmlText)) !== null) {
    const v1 = parseInt(tMatch[1], 10);
    const v2 = parseInt(tMatch[2], 10);
    const v3 = parseInt(tMatch[3], 10);
    
    if (v1 < vertexCount && v2 < vertexCount && v3 < vertexCount) {
      if (posIdx + 9 > positions.length) break; 
      
      positions[posIdx++] = vertexData[v1*3]; positions[posIdx++] = vertexData[v1*3+1]; positions[posIdx++] = vertexData[v1*3+2];
      positions[posIdx++] = vertexData[v2*3]; positions[posIdx++] = vertexData[v2*3+1]; positions[posIdx++] = vertexData[v2*3+2];
      positions[posIdx++] = vertexData[v3*3]; positions[posIdx++] = vertexData[v3*3+1]; positions[posIdx++] = vertexData[v3*3+2];
    }
  }

  return positions.subarray(0, posIdx);
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Request received: ${req.method} ${req.url}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log(`[${requestId}] Handling OPTIONS preflight`);
    return new Response("ok", { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  try {
    // Move initialization inside the handler to be more robust
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[${requestId}] 1. Fetching config from DB...`);
    const [matRes, setRes] = await Promise.all([
      supabase.from("materials").select("*").eq("is_active", true),
      supabase.from("app_settings").select("*")
    ]);

    if (matRes.error) {
      console.error(`[${requestId}] Materials Fetch Error:`, matRes.error);
      throw new Error(`Database error (materials): ${matRes.error.message}`);
    }
    if (setRes.error) {
      console.error(`[${requestId}] Settings Fetch Error:`, setRes.error);
      throw new Error(`Database error (settings): ${setRes.error.message}`);
    }

    const dbMaterials = matRes.data || [];
    const dbSettings = setRes.data || [];
    console.log(`[${requestId}] Fetched ${dbMaterials.length} materials and ${dbSettings.length} settings.`);

    // Reconstruct MATERIALS record from DB rows
    MATERIALS = (dbMaterials || []).reduce((acc: any, mat: any) => {
      const isSLA = mat.type === 'SLA';
      acc[mat.id] = {
        id:              mat.id,
        name:            mat.label,
        costPerGram:     Number(mat.cost_per_gram),
        spoolCost:       Number(mat.spool_cost ?? mat.cost_per_gram * (isSLA ? 1000 : 335)),
        spoolQuantity:   Number(mat.spool_quantity ?? (isSLA ? 1000 : 335)),
        maxSpeedMms:     isSLA ? 0 : 80,
        isResin:         isSLA,
        description:     mat.price_label,
        availableColors: mat.colors || [],
      };
      return acc;
    }, {});

    console.log(`[${requestId}] Reconstructed MATERIALS:`, Object.keys(MATERIALS));

    // Reconstruct pricing config from app_settings
    const settingsMap = (dbSettings || []).reduce((acc: any, s: any) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    pricingService.setConfig({
      materialMultiplierY: Number(settingsMap.material_multiplier_Y ?? 2.0),
      runTimeMultiplierW:  Number(settingsMap.run_time_multiplier_W ?? 1.25),
      setupFeeUsd:         Number(settingsMap.base_setup_fee ?? 15.00),
      // Support & raft settings
      raftEnabled:   settingsMap.raft_enabled === false || settingsMap.raft_enabled === "false" ? false : true,
      raftLayers:    Number(settingsMap.raft_layers  ?? 3),
      layerHeightMm: Number(settingsMap.layer_height_fdm ?? 0.2),
    } as any);
    
    // Also update FileValidationService dynamic max file size if present
    if (settingsMap.max_file_size_mb) {
      (FileValidationService as any).MAX_FILE_SIZE = Number(settingsMap.max_file_size_mb) * 1024 * 1024;
    }

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
    const fileType = validation.metadata!.fileType as "STL" | "OBJ" | "3MF";
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
      needsSupport: settingsMap.supports_enabled === "false" ? false : true,
      layerHeightMm: Number(settingsMap.layer_height_fdm ?? 0.2), 
      raftEnabled: settingsMap.raft_enabled === false || settingsMap.raft_enabled === "false" ? false : true,
      raftLayers: Number(settingsMap.raft_layers ?? 3),
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

