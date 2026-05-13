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
        <meshStandardMaterial color="#555555" roughness={0.8} />
      </mesh>
      
      {/* Rectangular Grid Lines */}
      <group position={[0, 0.01, 0]}>
        {/* Horizontal lines */}
        {Array.from({ length: Math.floor(GRID_SIZE_Z / 10) + 1 }).map((_, i) => (
          <mesh key={`h-${i}`} position={[0, 0, (i * 10) - (GRID_SIZE_Z / 2)]}>
            <boxGeometry args={[GRID_SIZE_X, 0.05, 0.1]} />
            <meshBasicMaterial color="#0b0909ff" transparent opacity={0.15} />
          </mesh>
        ))}
        {/* Vertical lines */}
        {Array.from({ length: Math.floor(GRID_SIZE_X / 10) + 1 }).map((_, i) => (
          <mesh key={`v-${i}`} position={[(i * 10) - (GRID_SIZE_X / 2), 0, 0]}>
            <boxGeometry args={[0.1, 0.05, GRID_SIZE_Z]} />
            <meshBasicMaterial color="#0b0909ff" transparent opacity={0.15} />
          </mesh>
        ))}
      </group>
      
      {/* Raised edges */}
      {[
        [0, 0.5, GRID_SIZE_Z / 2],
        [0, 0.5, -GRID_SIZE_Z / 2],
        [GRID_SIZE_X / 2, 0.5, 0],
        [-GRID_SIZE_X / 2, 0.5, 0],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} rotation={i < 2 ? [0, 0, 0] : [0, Math.PI / 2, 0]}>
          <boxGeometry args={[i < 2 ? GRID_SIZE_X : GRID_SIZE_Z, 1, 2]} />
          <meshStandardMaterial color="#555555" />
        </mesh>
      ))}

      {/* Corner Dimension Labels */}
      <Html position={[GRID_SIZE_X / 2, 2, GRID_SIZE_Z / 2]} center style={{ pointerEvents: "none" }}>
        <div style={{ background: "rgba(10, 10, 15, 0.85)", backdropFilter: "blur(8px)", border: `1px solid #ffffff40`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#ffffff", fontFamily: "'Inter', -apple-system, sans-serif", whiteSpace: "nowrap", letterSpacing: "0.02em", boxShadow: `0 0 12px #ffffff15` }}>
          {GRID_SIZE_X} x {GRID_SIZE_Z} mm
        </div>
      </Html>

      <Html position={[-GRID_SIZE_X / 2, 1, GRID_SIZE_Z / 2]} center style={{ pointerEvents: "none" }}>
        <div style={{ background: "rgba(10, 10, 15, 0.85)", backdropFilter: "blur(8px)", border: `1px solid #ef444440`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#ef4444", fontFamily: "'Inter', -apple-system, sans-serif", whiteSpace: "nowrap", letterSpacing: "0.02em", boxShadow: `0 0 12px #ef444415` }}>
          Max L: {GRID_SIZE_X}mm
        </div>
      </Html>

      <Html position={[GRID_SIZE_X / 2, 1, -GRID_SIZE_Z / 2]} center style={{ pointerEvents: "none" }}>
        <div style={{ background: "rgba(10, 10, 15, 0.85)", backdropFilter: "blur(8px)", border: `1px solid #3b82f640`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#3b82f6", fontFamily: "'Inter', -apple-system, sans-serif", whiteSpace: "nowrap", letterSpacing: "0.02em", boxShadow: `0 0 12px #3b82f615` }}>
          Max W: {GRID_SIZE_Z}mm
        </div>
      </Html>

      {/* Height Indicator on the back corner */}
      <Html position={[-GRID_SIZE_X / 2, vol.h / 2, -GRID_SIZE_Z / 2]} center style={{ pointerEvents: "none" }}>
        <div className="flex flex-col items-center gap-1">
          <div className="h-10 w-0.5 bg-[#22c55e]/50" />
          <div style={{ background: "rgba(10, 10, 15, 0.85)", backdropFilter: "blur(8px)", border: `1px solid #22c55e40`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#22c55e", fontFamily: "'Inter', -apple-system, sans-serif", whiteSpace: "nowrap", letterSpacing: "0.02em", boxShadow: `0 0 12px #22c55e15` }}>
            Max H: {vol.h}mm
          </div>
          <div className="h-10 w-0.5 bg-[#22c55e]/50" />
        </div>
      </Html>
    </group>
  );
}
