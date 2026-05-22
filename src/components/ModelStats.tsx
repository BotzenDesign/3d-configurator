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
  <div className="flex items-center gap-1.5 sm:gap-2.5 group">
    <div
      className="w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center transition-colors shrink-0"
      style={{ background: `${color}15` }}
    >
      <Icon size={12} className="sm:w-[13px] sm:h-[13px]" style={{ color }} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[9px] sm:text-[10px] text-muted-foreground leading-none mb-0.5">{label}</div>
      <div className="text-[10px] sm:text-xs font-semibold text-foreground truncate">{value}</div>
    </div>
  </div>
);

export default function ModelStats({ dimensions, volume, surface, weight, modelName }: ModelStatsProps) {
  return (
    <div className="absolute top-2 left-2 right-2 sm:top-4 sm:right-4 sm:left-auto z-10 sm:min-w-[190px] max-w-full sm:max-w-[240px] pointer-events-none">
      <div className="bg-background/80 backdrop-blur-xl border border-border/50 rounded-xl p-2 sm:p-3 shadow-lg pointer-events-auto">
        {modelName && (
          <div className="text-[9px] sm:text-[10px] font-semibold text-primary tracking-wide uppercase truncate pb-1 border-b border-border/30 mb-2 sm:mb-2.5">
            {modelName}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 sm:gap-2.5">
          <StatRow icon={Ruler} label="Dimensions" value={dimensions} color="#ef4444" />
          <StatRow icon={Box} label="Volume" value={volume} color="#3b82f6" />
          <StatRow icon={Layers} label="Surface" value={surface} color="#22c55e" />
          <StatRow icon={Weight} label="Est. Weight" value={weight} color="#f59e0b" />
        </div>
      </div>
    </div>
  );
}
