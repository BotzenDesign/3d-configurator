import * as THREE from "three";

export function parseSTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  const isBinary = (buf: ArrayBuffer) => {
    const dv = new DataView(buf);
    const numTriangles = dv.getUint32(80, true);
    const expectedSize = 80 + 4 + numTriangles * 50;
    return buf.byteLength === expectedSize;
  };

  if (isBinary(buffer)) {
    return parseBinarySTL(buffer);
  }
  return parseAsciiSTL(buffer);
}

function parseBinarySTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  const dv = new DataView(buffer);
  const numTriangles = dv.getUint32(80, true);
  const vertices = new Float32Array(numTriangles * 9);
  const normals = new Float32Array(numTriangles * 9);

  let offset = 84;
  for (let i = 0; i < numTriangles; i++) {
    const nx = dv.getFloat32(offset, true);
    const ny = dv.getFloat32(offset + 4, true);
    const nz = dv.getFloat32(offset + 8, true);
    offset += 12;

    for (let j = 0; j < 3; j++) {
      const idx = i * 9 + j * 3;
      vertices[idx] = dv.getFloat32(offset, true);
      vertices[idx + 1] = dv.getFloat32(offset + 4, true);
      vertices[idx + 2] = dv.getFloat32(offset + 8, true);
      normals[idx] = nx;
      normals[idx + 1] = ny;
      normals[idx + 2] = nz;
      offset += 12;
    }
    offset += 2; // attribute byte count
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  return geo;
}

function parseAsciiSTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  const text = new TextDecoder().decode(buffer);
  const vertexRegex = /vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/g;
  const verts: number[] = [];
  let match;
  while ((match = vertexRegex.exec(text)) !== null) {
    verts.push(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.computeVertexNormals();
  return geo;
}

export function computeStats(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const size = new THREE.Vector3();
  box.getSize(size);

  const pos = geometry.getAttribute("position");
  let volume = 0;
  let surfaceArea = 0;

  for (let i = 0; i < pos.count; i += 3) {
    const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
    const c = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));

    // Surface area
    const ab = new THREE.Vector3().subVectors(b, a);
    const ac = new THREE.Vector3().subVectors(c, a);
    surfaceArea += ab.cross(ac).length() / 2;

    // Signed volume
    volume += a.dot(b.clone().cross(c)) / 6;
  }

  volume = Math.abs(volume);
  const density = 1.24; // PLA g/cm³
  const weight = (volume / 1000) * density;

  return {
    dimensions: `${size.x.toFixed(0)}mm x ${size.y.toFixed(0)}mm x ${size.z.toFixed(0)}mm`,
    volume: `${(volume / 1000).toFixed(0)}cm³`,
    surface: `${(surfaceArea / 100).toFixed(0)}cm²`,
    weight: `${weight.toFixed(0)}g`,
  };
}
