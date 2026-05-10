import { useRef } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";

const BUILD_VOLUME = {
  FDM: { l: 330, w: 240, h: 300 },
  SLA: { l: 200, w: 125, h: 210 },
} as const;

interface PrintBedProps {
  printType?: "FDM" | "SLA";
}

export default function PrintBed({ printType = "FDM" }: PrintBedProps) {
  const ref = useRef<THREE.Group>(null);

  // Determine actual build volume dimensions
  const vol = BUILD_VOLUME[printType];
  const GRID_SIZE_X = vol.l;
  const GRID_SIZE_Z = vol.w;
  const GRID_DIVISIONS = Math.floor(Math.max(GRID_SIZE_X, GRID_SIZE_Z) / 10);

  return (
    <group ref={ref} position={[0, -0.5, 0]}>
      {/* Base platform */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[GRID_SIZE_X, GRID_SIZE_Z]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.8} />
      </mesh>
      
      {/* Grid lines */}
      <gridHelper
        args={[Math.max(GRID_SIZE_X, GRID_SIZE_Z), GRID_DIVISIONS, "#555555", "#444444"]}
        position={[0, 0.01, 0]}
      />
      
      {/* Raised edges */}
      {[
        [0, 0.5, GRID_SIZE_Z / 2],
        [0, 0.5, -GRID_SIZE_Z / 2],
        [GRID_SIZE_X / 2, 0.5, 0],
        [-GRID_SIZE_X / 2, 0.5, 0],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} rotation={i < 2 ? [0, 0, 0] : [0, Math.PI / 2, 0]}>
          <boxGeometry args={[i < 2 ? GRID_SIZE_X : GRID_SIZE_Z, 1, 2]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      ))}

      {/* Corner Dimension Labels */}
      <Html position={[GRID_SIZE_X / 2, 2, GRID_SIZE_Z / 2]} center style={{ pointerEvents: "none" }}>
        <div className="bg-black border-2 border-red-500 rounded-md px-3 py-1 shadow-2xl">
          <span className="text-[12px] font-black text-white whitespace-nowrap">
            {GRID_SIZE_X} x {GRID_SIZE_Z} mm
          </span>
        </div>
      </Html>

      <Html position={[-GRID_SIZE_X / 2, 1, GRID_SIZE_Z / 2]} center style={{ pointerEvents: "none" }}>
        <div className="bg-black/80 backdrop-blur-sm border border-white/20 rounded px-2 py-0.5 shadow-lg">
          <span className="text-[10px] font-bold text-white/60">Max X: {GRID_SIZE_X}mm</span>
        </div>
      </Html>

      <Html position={[GRID_SIZE_X / 2, 1, -GRID_SIZE_Z / 2]} center style={{ pointerEvents: "none" }}>
        <div className="bg-black/80 backdrop-blur-sm border border-white/20 rounded px-2 py-0.5 shadow-lg">
          <span className="text-[10px] font-bold text-white/60">Max Z: {GRID_SIZE_Z}mm</span>
        </div>
      </Html>

      {/* Height Indicator on the back corner */}
      <Html position={[-GRID_SIZE_X / 2, vol.h / 2, -GRID_SIZE_Z / 2]} center style={{ pointerEvents: "none" }}>
        <div className="flex flex-col items-center gap-1">
          <div className="h-10 w-0.5 bg-red-500/50" />
          <div className="bg-red-600 border border-red-400 rounded-md px-3 py-1 shadow-2xl">
            <span className="text-[11px] font-black text-white whitespace-nowrap uppercase tracking-wider">
              H: {vol.h}mm
            </span>
          </div>
          <div className="h-10 w-0.5 bg-red-500/50" />
        </div>
      </Html>
    </group>
  );
}
