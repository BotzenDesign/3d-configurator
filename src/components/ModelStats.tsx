/**
 * ============================================================================
 * ModelStats — Enhanced Stats Overlay
 * ============================================================================
 * Displays model dimensions, volume, surface area, and weight
 * with a glassmorphism panel in the top-right corner of the viewer.
 * ============================================================================
 */

import { Ruler, Box, Layers, Weight } from "lucide-react";

interface ModelStatsProps {
  dimensions: string;
  volume: string;
  surface: string;
  weight: string;
  modelName?: string;
}

const StatRow = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
}) => (
  <div className="flex items-center gap-2.5 group">
    <div
      className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
      style={{ background: `${color}15` }}
    >
      <Icon size={13} style={{ color }} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[10px] text-muted-foreground/60 leading-none mb-0.5">{label}</div>
      <div className="text-xs font-medium text-foreground/90 truncate">{value}</div>
    </div>
  </div>
);

export default function ModelStats({ dimensions, volume, surface, weight, modelName }: ModelStatsProps) {
  return (
    <div className="absolute top-4 right-4 z-10 w-[180px]">
      <div className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-xl p-3 space-y-2.5 shadow-lg">
        {modelName && (
          <div className="text-[10px] font-semibold text-primary tracking-wide uppercase truncate pb-1 border-b border-border/30">
            {modelName}
          </div>
        )}
        <StatRow icon={Ruler} label="Dimensions" value={dimensions} color="#ef4444" />
        <StatRow icon={Box} label="Volume" value={volume} color="#3b82f6" />
        <StatRow icon={Layers} label="Surface" value={surface} color="#22c55e" />
        <StatRow icon={Weight} label="Weight (PLA)" value={weight} color="#f59e0b" />
      </div>
    </div>
  );
}
