import { useRef } from "react";
import * as THREE from "three";

const GRID_SIZE = 220;
const GRID_DIVISIONS = 22;

export default function PrintBed() {
  const ref = useRef<THREE.Group>(null);

  return (
    <group ref={ref} position={[0, -0.5, 0]}>
      {/* Base platform */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.8} />
      </mesh>
      {/* Grid lines */}
      <gridHelper
        args={[GRID_SIZE, GRID_DIVISIONS, "#555555", "#444444"]}
        position={[0, 0.01, 0]}
      />
      {/* Raised edges */}
      {[
        [0, 0.5, GRID_SIZE / 2],
        [0, 0.5, -GRID_SIZE / 2],
        [GRID_SIZE / 2, 0.5, 0],
        [-GRID_SIZE / 2, 0.5, 0],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} rotation={i < 2 ? [0, 0, 0] : [0, Math.PI / 2, 0]}>
          <boxGeometry args={[GRID_SIZE, 1, 2]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      ))}
    </group>
  );
}
