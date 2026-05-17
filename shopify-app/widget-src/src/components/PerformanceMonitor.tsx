/**
 * ============================================================================
 * Performance Monitor — FPS & Draw Call Overlay
 * ============================================================================
 * Provides real-time rendering performance metrics inside the 3D viewer.
 * Shows FPS, draw calls, triangle count, and memory usage.
 * Toggle visibility with the `visible` prop.
 * ============================================================================
 */

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";

interface PerformanceStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  frameTime: number;
}

interface PerformanceMonitorProps {
  visible?: boolean;
}

export default function PerformanceMonitor({ visible = false }: PerformanceMonitorProps) {
  const { gl } = useThree();
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    frameTime: 0,
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const lastUpdateRef = useRef(performance.now());

  useFrame(() => {
    if (!visible) return;

    frameCountRef.current++;
    const now = performance.now();
    const elapsed = now - lastUpdateRef.current;

    // Update stats every 500ms
    if (elapsed >= 500) {
      const fps = Math.round((frameCountRef.current / elapsed) * 1000);
      const frameTime = +(elapsed / frameCountRef.current).toFixed(1);

      const info = gl.info;

      setStats({
        fps,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        frameTime,
      });

      frameCountRef.current = 0;
      lastUpdateRef.current = now;
    }
  });

  if (!visible) return null;

  const fpsColor = stats.fps >= 55 ? "#22c55e" : stats.fps >= 30 ? "#eab308" : "#ef4444";

  return (
    <Html
      position={[0, 0, 0]}
      style={{
        position: "fixed",
        bottom: "80px",
        right: "16px",
        pointerEvents: "none",
      }}
      calculatePosition={() => [0, 0]}
    >
      <div
        style={{
          position: "fixed",
          bottom: 80,
          right: 16,
          background: "rgba(10, 10, 15, 0.9)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding: "10px 14px",
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontSize: 11,
          color: "#a1a1aa",
          lineHeight: 1.6,
          minWidth: 160,
          pointerEvents: "auto",
          zIndex: 50,
        }}
      >
        <div style={{ fontWeight: 700, color: "#fafafa", marginBottom: 4, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Performance
        </div>
        <div>
          <span style={{ color: fpsColor, fontWeight: 700 }}>{stats.fps}</span> FPS
          <span style={{ color: "#52525b", margin: "0 6px" }}>·</span>
          {stats.frameTime}ms
        </div>
        <div>Draw calls: {stats.drawCalls}</div>
        <div>Triangles: {stats.triangles.toLocaleString()}</div>
        <div>Geometries: {stats.geometries}</div>
        <div>Textures: {stats.textures}</div>
      </div>
    </Html>
  );
}
