/**
 * ============================================================================
 * OBJ File Parser
 * ============================================================================
 * Parses Wavefront OBJ files into Three.js BufferGeometry.
 * Supports: vertices (v), texture coordinates (vt), normals (vn), faces (f)
 * Face formats: triangles, quads (auto-triangulated), and n-gons (fan triangulated)
 * ============================================================================
 */

import * as THREE from "three";

interface OBJParseResult {
  geometry: THREE.BufferGeometry;
  hasNormals: boolean;
  hasUVs: boolean;
  vertexCount: number;
  faceCount: number;
}

export function parseOBJ(text: string): OBJParseResult {
  const positions: number[][] = [];
  const normals: number[][] = [];
  const uvs: number[][] = [];

  const outPositions: number[] = [];
  const outNormals: number[] = [];
  const outUVs: number[] = [];

  let faceCount = 0;

  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    const parts = line.split(/\s+/);
    const keyword = parts[0];

    switch (keyword) {
      case "v": {
        // Vertex position: v x y z [w]
        positions.push([
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3]),
        ]);
        break;
      }

      case "vn": {
        // Vertex normal: vn x y z
        normals.push([
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3]),
        ]);
        break;
      }

      case "vt": {
        // Texture coordinate: vt u v [w]
        uvs.push([parseFloat(parts[1]), parseFloat(parts[2])]);
        break;
      }

      case "f": {
        // Face: f v1[/vt1][/vn1] v2[/vt2][/vn2] ...
        const faceVerts: { v: number; vt: number; vn: number }[] = [];

        for (let j = 1; j < parts.length; j++) {
          const indices = parts[j].split("/");
          faceVerts.push({
            v: parseInt(indices[0]) - 1, // OBJ is 1-indexed
            vt: indices[1] ? parseInt(indices[1]) - 1 : -1,
            vn: indices[2] ? parseInt(indices[2]) - 1 : -1,
          });
        }

        // Fan triangulation for n-gons (works for convex polygons)
        for (let j = 1; j < faceVerts.length - 1; j++) {
          const triIndices = [faceVerts[0], faceVerts[j], faceVerts[j + 1]];

          for (const idx of triIndices) {
            // Position (required)
            if (idx.v >= 0 && idx.v < positions.length) {
              outPositions.push(...positions[idx.v]);
            }

            // Normal (optional)
            if (idx.vn >= 0 && idx.vn < normals.length) {
              outNormals.push(...normals[idx.vn]);
            }

            // UV (optional)
            if (idx.vt >= 0 && idx.vt < uvs.length) {
              outUVs.push(...uvs[idx.vt]);
            }
          }

          faceCount++;
        }
        break;
      }

      // Skip: mtllib, usemtl, s, g, o, etc.
      default:
        break;
    }
  }

  // Build BufferGeometry
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(outPositions), 3)
  );

  const hasNormals = outNormals.length === outPositions.length;
  if (hasNormals) {
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(outNormals), 3)
    );
  } else {
    geometry.computeVertexNormals();
  }

  const hasUVs = outUVs.length === (outPositions.length / 3) * 2;
  if (hasUVs) {
    geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array(outUVs), 2)
    );
  }

  return {
    geometry,
    hasNormals,
    hasUVs,
    vertexCount: outPositions.length / 3,
    faceCount,
  };
}

/**
 * Parse OBJ from an ArrayBuffer.
 */
export function parseOBJBuffer(buffer: ArrayBuffer): OBJParseResult {
  const text = new TextDecoder().decode(buffer);
  return parseOBJ(text);
}
