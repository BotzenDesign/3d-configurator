/**
 * ============================================================================
 * DimensionOverlay — 3D Measurement Annotations
 * ============================================================================
 * Renders X/Y/Z dimension lines and labels around the model's bounding box,
 * using Three.js primitives drawn inside the R3F canvas.
 * ============================================================================
 */

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface DimensionOverlayProps {
  boundingBox: THREE.Box3;
  visible?: boolean;
  realDimensions?: string; // "WxHxD" string from STL parser, e.g. "102mm x 152mm x 155mm"
}

function DimensionLabel({
  position,
  text,
  color,
}: {
  position: [number, number, number];
  text: string;
  color: string;
}) {
  return (
    <Html position={position} center style={{ pointerEvents: "none" }}>
      <div
        style={{
          background: "rgba(10, 10, 15, 0.85)",
          backdropFilter: "blur(8px)",
          border: `1px solid ${color}40`,
          borderRadius: 6,
          padding: "2px 8px",
          fontSize: 11,
          fontWeight: 600,
          color,
          fontFamily: "'Inter', -apple-system, sans-serif",
          whiteSpace: "nowrap",
          letterSpacing: "0.02em",
          boxShadow: `0 0 12px ${color}15`,
        }}
      >
        {text}
      </div>
    </Html>
  );
}

function DimensionLine({
  start,
  end,
  color,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
}) {
  const points = useMemo(() => [start, end], [start, end]);

  return (
    <group>
      {/* Main dimension line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              points[0].x, points[0].y, points[0].z,
              points[1].x, points[1].y, points[1].z,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} linewidth={1} transparent opacity={0.7} />
      </line>

      {/* End caps — small spheres */}
      {points.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[0.6, 8, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

export default function DimensionOverlay({ boundingBox, visible = true, realDimensions }: DimensionOverlayProps) {
  const dimensions = useMemo(() => {
    if (!boundingBox || boundingBox.isEmpty()) return null;

    const min = boundingBox.min;
    const max = boundingBox.max;
    const size = new THREE.Vector3();
    boundingBox.getSize(size);

    // Parse real dimensions from STL parser if provided
    // Format: "102mm x 152mm x 155mm"  →  [W, H, D]
    let realW: number | null = null;
    let realH: number | null = null;
    let realD: number | null = null;
    if (realDimensions) {
      const parts = realDimensions.replace(/mm/gi, '').split(/\s*x\s*/i);
      if (parts.length === 3) {
        realW = parseFloat(parts[0]);
        realH = parseFloat(parts[1]);
        realD = parseFloat(parts[2]);
      }
    }

    const fmt = (real: number | null, scaled: number) =>
      real !== null ? `${real.toFixed(0)}mm` : `${scaled.toFixed(1)}mm`;

    const offset = 8;

    return {
      x: {
        start: new THREE.Vector3(min.x, min.y - offset, max.z + offset),
        end:   new THREE.Vector3(max.x, min.y - offset, max.z + offset),
        label: fmt(realW, size.x),
        labelPos: [(min.x + max.x) / 2, min.y - offset - 3, max.z + offset] as [number, number, number],
        color: "#ef4444",
      },
      y: {
        start: new THREE.Vector3(min.x - offset, min.y, max.z + offset),
        end:   new THREE.Vector3(min.x - offset, max.y, max.z + offset),
        label: fmt(realH, size.y),
        labelPos: [min.x - offset - 3, (min.y + max.y) / 2, max.z + offset] as [number, number, number],
        color: "#22c55e",
      },
      z: {
        start: new THREE.Vector3(max.x + offset, min.y - offset, min.z),
        end:   new THREE.Vector3(max.x + offset, min.y - offset, max.z),
        label: fmt(realD, size.z),
        labelPos: [max.x + offset + 3, min.y - offset - 3, (min.z + max.z) / 2] as [number, number, number],
        color: "#3b82f6",
      },
    };
  }, [boundingBox, realDimensions]);

  if (!visible || !dimensions) return null;

  return (
    <group>
      {/* X Dimension (Width) */}
      <DimensionLine
        start={dimensions.x.start}
        end={dimensions.x.end}
        color={dimensions.x.color}
      />
      <DimensionLabel
        position={dimensions.x.labelPos}
        text={`W: ${dimensions.x.label}`}
        color={dimensions.x.color}
      />

      {/* Y Dimension (Height) */}
      <DimensionLine
        start={dimensions.y.start}
        end={dimensions.y.end}
        color={dimensions.y.color}
      />
      <DimensionLabel
        position={dimensions.y.labelPos}
        text={`H: ${dimensions.y.label}`}
        color={dimensions.y.color}
      />

      {/* Z Dimension (Depth) */}
      <DimensionLine
        start={dimensions.z.start}
        end={dimensions.z.end}
        color={dimensions.z.color}
      />
      <DimensionLabel
        position={dimensions.z.labelPos}
        text={`D: ${dimensions.z.label}`}
        color={dimensions.z.color}
      />
    </group>
  );
}
