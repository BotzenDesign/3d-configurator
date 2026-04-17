/**
 * ============================================================================
 * LOD (Level of Detail) System — Geometry Simplification
 * ============================================================================
 * Reduces polygon count for low-end devices by decimating mesh geometry.
 * Uses vertex clustering to merge nearby vertices and reduce triangle count
 * while preserving the overall shape.
 * ============================================================================
 */

import * as THREE from "three";

interface SimplifyOptions {
  /** Target number of triangles (approximate) */
  targetTriangles?: number;
  /** Simplification ratio (0.0 - 1.0, lower = more simplified) */
  ratio?: number;
}

/**
 * Simplify a BufferGeometry by reducing triangle count.
 * Uses grid-based vertex merging for fast, predictable decimation.
 *
 * @param geometry - Source geometry to simplify
 * @param options - Simplification options
 * @returns Simplified geometry (new instance, original is unchanged)
 */
export function simplifyGeometry(
  geometry: THREE.BufferGeometry,
  options: SimplifyOptions = {}
): THREE.BufferGeometry {
  const posAttr = geometry.getAttribute("position");
  if (!posAttr) return geometry.clone();

  const currentTriangles = posAttr.count / 3;

  // Determine target
  let targetTriangles: number;
  if (options.targetTriangles) {
    targetTriangles = options.targetTriangles;
  } else if (options.ratio !== undefined) {
    targetTriangles = Math.floor(currentTriangles * options.ratio);
  } else {
    targetTriangles = Math.floor(currentTriangles * 0.5);
  }

  // Don't simplify if already below target
  if (currentTriangles <= targetTriangles) {
    return geometry.clone();
  }

  // Compute bounding box for grid sizing
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const size = new THREE.Vector3();
  box.getSize(size);

  // Grid resolution based on target triangles
  // More cells = less simplification
  const cellCount = Math.max(8, Math.ceil(Math.cbrt(targetTriangles * 2)));
  const cellSize = new THREE.Vector3(
    size.x / cellCount,
    size.y / cellCount,
    size.z / cellCount
  );

  // Ensure non-zero cell sizes
  if (cellSize.x === 0) cellSize.x = 1;
  if (cellSize.y === 0) cellSize.y = 1;
  if (cellSize.z === 0) cellSize.z = 1;

  // Map vertices to grid cells
  const vertexMap = new Map<string, number>();
  const mergedPositions: number[] = [];
  const mergedNormals: number[] = [];
  const indexMap = new Int32Array(posAttr.count);

  const normalAttr = geometry.getAttribute("normal");

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    // Quantize to grid cell
    const cx = Math.floor((x - box.min.x) / cellSize.x);
    const cy = Math.floor((y - box.min.y) / cellSize.y);
    const cz = Math.floor((z - box.min.z) / cellSize.z);
    const key = `${cx},${cy},${cz}`;

    if (vertexMap.has(key)) {
      indexMap[i] = vertexMap.get(key)!;
    } else {
      const newIdx = mergedPositions.length / 3;
      vertexMap.set(key, newIdx);
      indexMap[i] = newIdx;
      mergedPositions.push(x, y, z);

      if (normalAttr) {
        mergedNormals.push(
          normalAttr.getX(i),
          normalAttr.getY(i),
          normalAttr.getZ(i)
        );
      }
    }
  }

  // Rebuild triangles, skipping degenerate ones
  const indices: number[] = [];
  for (let i = 0; i < posAttr.count; i += 3) {
    const a = indexMap[i];
    const b = indexMap[i + 1];
    const c = indexMap[i + 2];

    // Skip degenerate triangles (where vertices merged to same cell)
    if (a !== b && b !== c && a !== c) {
      indices.push(a, b, c);
    }
  }

  // Build output geometry
  const result = new THREE.BufferGeometry();

  result.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(mergedPositions), 3)
  );

  if (mergedNormals.length > 0) {
    result.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(mergedNormals), 3)
    );
  }

  result.setIndex(indices);

  // Recompute normals for smooth appearance
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();

  return result;
}

/**
 * Create multiple LOD levels for a geometry.
 * Returns an array of geometries from highest to lowest detail.
 */
export function createLODLevels(
  geometry: THREE.BufferGeometry,
  levels: number = 3
): THREE.BufferGeometry[] {
  const result: THREE.BufferGeometry[] = [geometry.clone()];

  const ratios = [0.5, 0.25, 0.1];

  for (let i = 0; i < Math.min(levels - 1, ratios.length); i++) {
    result.push(simplifyGeometry(geometry, { ratio: ratios[i] }));
  }

  return result;
}

/**
 * Choose appropriate LOD level based on camera distance.
 */
export function selectLODLevel(
  distance: number,
  thresholds: number[] = [100, 250, 500]
): number {
  for (let i = 0; i < thresholds.length; i++) {
    if (distance < thresholds[i]) return i;
  }
  return thresholds.length;
}
