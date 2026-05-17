import * as THREE from 'three';
import JSZip from 'jszip';

/**
 * Basic 3MF Parser for the frontend.
 * Extracts the 3D/3dmodel.model XML file from the ZIP archive,
 * parses all vertices and triangles, and builds a single THREE.BufferGeometry.
 */
export async function parse3MF(buffer: ArrayBuffer): Promise<THREE.BufferGeometry> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(buffer);
  
  // 3MF uses 3D/3dmodel.model as the main mesh data file
  const modelFile = loadedZip.file('3D/3dmodel.model');
  if (!modelFile) {
    throw new Error("Invalid 3MF file: missing 3D/3dmodel.model");
  }

  const xmlText = await modelFile.async("text");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];

  // Parse all objects (in a robust parser we'd handle components/build items,
  // but for basic viewing, extracting all meshes from resources is often sufficient).
  const objects = xmlDoc.getElementsByTagName('object');
  
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    const mesh = obj.getElementsByTagName('mesh')[0];
    if (!mesh) continue;

    const verticesEl = mesh.getElementsByTagName('vertices')[0];
    const trianglesEl = mesh.getElementsByTagName('triangles')[0];
    if (!verticesEl || !trianglesEl) continue;

    // Parse vertices
    const vertexList = verticesEl.getElementsByTagName('vertex');
    const tempVerts: THREE.Vector3[] = [];
    for (let j = 0; j < vertexList.length; j++) {
      const v = vertexList[j];
      const x = parseFloat(v.getAttribute('x') || '0');
      const y = parseFloat(v.getAttribute('y') || '0');
      const z = parseFloat(v.getAttribute('z') || '0');
      tempVerts.push(new THREE.Vector3(x, y, z));
    }

    // Parse triangles
    const triangleList = trianglesEl.getElementsByTagName('triangle');
    for (let j = 0; j < triangleList.length; j++) {
      const t = triangleList[j];
      const v1 = parseInt(t.getAttribute('v1') || '0', 10);
      const v2 = parseInt(t.getAttribute('v2') || '0', 10);
      const v3 = parseInt(t.getAttribute('v3') || '0', 10);

      // Add to positions array (unindexed geometry format for simplicity and consistency with STL)
      if (tempVerts[v1]) {
        positions.push(tempVerts[v1].x, tempVerts[v1].y, tempVerts[v1].z);
      }
      if (tempVerts[v2]) {
        positions.push(tempVerts[v2].x, tempVerts[v2].y, tempVerts[v2].z);
      }
      if (tempVerts[v3]) {
        positions.push(tempVerts[v3].x, tempVerts[v3].y, tempVerts[v3].z);
      }
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  return geometry;
}
