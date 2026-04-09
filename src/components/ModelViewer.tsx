import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import PrintBed from "./PrintBed";
import { Suspense, useMemo } from "react";
import * as THREE from "three";

interface ModelViewerProps {
  modelType: string;
  color: string;
  geometry: THREE.BufferGeometry | null;
}

function DemoModel({ type, color }: { type: string; color: string }) {
  const geo = useMemo(() => {
    switch (type) {
      case "bear":
        return <sphereGeometry args={[30, 32, 32]} />;
      case "mug":
        return <cylinderGeometry args={[18, 18, 40, 32]} />;
      case "helmet":
        return <dodecahedronGeometry args={[28, 1]} />;
      default:
        return <boxGeometry args={[30, 30, 30]} />;
    }
  }, [type]);

  return (
    <mesh position={[0, 25, 0]}>
      {geo}
      <meshPhysicalMaterial
        color={color}
        transparent
        opacity={0.85}
        roughness={0.2}
        transmission={0.3}
        thickness={2}
      />
    </mesh>
  );
}

function UploadedModel({ geometry, color }: { geometry: THREE.BufferGeometry; color: string }) {
  const centered = useMemo(() => {
    const g = geometry.clone();
    g.computeBoundingBox();
    const box = g.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 60 / maxDim;
    g.translate(-center.x, -center.y + size.y / 2, -center.z);
    g.scale(scale, scale, scale);
    return g;
  }, [geometry]);

  return (
    <mesh geometry={centered} position={[0, -0.5, 0]}>
      <meshPhysicalMaterial
        color={color}
        transparent
        opacity={0.85}
        roughness={0.2}
        transmission={0.3}
        thickness={2}
      />
    </mesh>
  );
}

export default function ModelViewer({ modelType, color, geometry }: ModelViewerProps) {
  return (
    <div className="w-full h-full bg-viewer-bg">
      <Canvas
        camera={{ position: [120, 80, 120], fov: 50 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[100, 100, 50]} intensity={1} />
        <directionalLight position={[-50, 50, -50]} intensity={0.3} />
        <Suspense fallback={null}>
          <Environment preset="studio" />
          <PrintBed />
          {geometry ? (
            <UploadedModel geometry={geometry} color={color} />
          ) : (
            <DemoModel type={modelType} color={color} />
          )}
        </Suspense>
        <OrbitControls
          enableDamping
          dampingFactor={0.1}
          minDistance={50}
          maxDistance={400}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>
    </div>
  );
}
