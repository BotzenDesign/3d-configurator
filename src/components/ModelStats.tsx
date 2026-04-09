interface ModelStatsProps {
  dimensions: string;
  volume: string;
  surface: string;
  weight: string;
}

export default function ModelStats({ dimensions, volume, surface, weight }: ModelStatsProps) {
  return (
    <div className="absolute top-4 right-4 text-right text-xs text-muted-foreground space-y-0.5 z-10">
      <div>{dimensions}</div>
      <div>{volume}</div>
      <div>{surface}</div>
      <div>{weight}</div>
    </div>
  );
}
