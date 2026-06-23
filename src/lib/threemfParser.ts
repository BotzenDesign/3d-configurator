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

  // Parse all objects into a map
  const objects = xmlDoc.getElementsByTagName('object');
  const objectMap = new Map<string, THREE.Vector3[]>();
  
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    const id = obj.getAttribute('id');
    if (!id) continue;

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

    // Parse triangles and flatten into unindexed vector list
    const objectPositions: THREE.Vector3[] = [];
    const triangleList = trianglesEl.getElementsByTagName('triangle');
    for (let j = 0; j < triangleList.length; j++) {
      const t = triangleList[j];
      const v1 = parseInt(t.getAttribute('v1') || '0', 10);
      const v2 = parseInt(t.getAttribute('v2') || '0', 10);
      const v3 = parseInt(t.getAttribute('v3') || '0', 10);

      if (tempVerts[v1]) objectPositions.push(tempVerts[v1].clone());
      if (tempVerts[v2]) objectPositions.push(tempVerts[v2].clone());
      if (tempVerts[v3]) objectPositions.push(tempVerts[v3].clone());
    }

    objectMap.set(id, objectPositions);
  }

  // Parse <build> <item> to apply scene transforms
  const buildItems = xmlDoc.getElementsByTagName('build')[0]?.getElementsByTagName('item');
  let hasValidBuildItems = false;

  if (buildItems && buildItems.length > 0) {
    for (let i = 0; i < buildItems.length; i++) {
      const item = buildItems[i];
      const objectid = item.getAttribute('objectid');
      if (!objectid || !objectMap.has(objectid)) continue;

      hasValidBuildItems = true;
      const transformStr = item.getAttribute('transform');
      const transformMatrix = new THREE.Matrix4();

      if (transformStr) {
        // "m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32"
        const floats = transformStr.trim().split(/\s+/).map(parseFloat);
        if (floats.length === 12) {
          transformMatrix.set(
            floats[0], floats[3], floats[6], floats[9],
            floats[1], floats[4], floats[7], floats[10],
            floats[2], floats[5], floats[8], floats[11],
            0,         0,         0,         1
          );
        }
      }

      const itemVerts = objectMap.get(objectid)!;
      for (const v of itemVerts) {
        const transformedV = v.clone().applyMatrix4(transformMatrix);
        positions.push(transformedV.x, transformedV.y, transformedV.z);
      }
    }
  }

  // Fallback: If no build items, just dump all object vertices
  if (!hasValidBuildItems) {
    for (const itemVerts of objectMap.values()) {
      for (const v of itemVerts) {
        positions.push(v.x, v.y, v.z);
      }
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  return geometry;
}
