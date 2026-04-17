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

export default function DimensionOverlay({ boundingBox, visible = true }: DimensionOverlayProps) {
  const dimensions = useMemo(() => {
    if (!boundingBox || boundingBox.isEmpty()) return null;

    const min = boundingBox.min;
    const max = boundingBox.max;
    const size = new THREE.Vector3();
    boundingBox.getSize(size);

    const offset = 8; // Distance of dimension lines from model

    return {
      // X axis (width) — along the bottom front edge
      x: {
        start: new THREE.Vector3(min.x, min.y - offset, max.z + offset),
        end: new THREE.Vector3(max.x, min.y - offset, max.z + offset),
        label: `${size.x.toFixed(1)}mm`,
        labelPos: [
          (min.x + max.x) / 2,
          min.y - offset - 3,
          max.z + offset,
        ] as [number, number, number],
        color: "#ef4444", // Red
      },
      // Y axis (height) — along the left side
      y: {
        start: new THREE.Vector3(min.x - offset, min.y, max.z + offset),
        end: new THREE.Vector3(min.x - offset, max.y, max.z + offset),
        label: `${size.y.toFixed(1)}mm`,
        labelPos: [
          min.x - offset - 3,
          (min.y + max.y) / 2,
          max.z + offset,
        ] as [number, number, number],
        color: "#22c55e", // Green
      },
      // Z axis (depth) — along the bottom right edge
      z: {
        start: new THREE.Vector3(max.x + offset, min.y - offset, min.z),
        end: new THREE.Vector3(max.x + offset, min.y - offset, max.z),
        label: `${size.z.toFixed(1)}mm`,
        labelPos: [
          max.x + offset + 3,
          min.y - offset - 3,
          (min.z + max.z) / 2,
        ] as [number, number, number],
        color: "#3b82f6", // Blue
      },
    };
  }, [boundingBox]);

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
