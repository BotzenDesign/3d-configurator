/**
 * PriceBreakdown — Slicer-style Summary Panel
 * Matches the layout of professional slicers (Formlabs, Bambu, Prusa).
 */
import { Loader2, AlertTriangle, Clock, Droplets, DollarSign, Layers, Info, ChevronDown, Wand2, RefreshCcw } from 'lucide-react';
import type { QuoteResult } from '@/hooks/useQuote';

interface ModelStats {
  dimensions: string;
  volume: string;
  surface: string;
  weight: string;
}

interface Props {
  quote: QuoteResult | null;
  isLoading: boolean;
  error: string | null;
  hasFile: boolean;
  modelStats?: ModelStats;
  printType?: 'FDM' | 'SLA';
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Parse "167.3cm³" → 167.3 mL  (1 cm³ = 1 mL) */
function parseVolumeMl(volStr: string): number | null {
  const m = volStr.replace(/,/g, '').match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

/** Estimate layers from height dimension and layer height (default 0.2mm FDM / 0.05mm SLA) */
function estimateLayers(dimensionsStr: string, printType: 'FDM' | 'SLA'): number | null {
  // format: "102mm x 152mm x 155mm"
  const parts = dimensionsStr.replace(/mm/gi, '').split(/\s*x\s*/i);
  if (parts.length < 3) return null;
  const h = parseFloat(parts[2]); // third value = height
  if (isNaN(h)) return null;
  const layerH = printType === 'SLA' ? 0.05 : 0.2;
  return Math.round(h / layerH);
}

/** Extract filament length from line item notes (FDM: "45.32m" in note) */
function extractFilamentLength(quote: QuoteResult): string | null {
  for (const item of quote.lineItems) {
    if (item.note) {
      const m = item.note.match(/([\d.]+)\s*m\b/);
      if (m) return `${parseFloat(m[1]).toFixed(2)}m`;
    }
  }
  return null;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label, value, color = '#94a3b8' }: {
  icon: any; label: string; value?: string; color?: string;
}) {
  return (
    <div style={s.sectionRow}>
      <div style={s.iconWrap}>
        <Icon size={13} color={color} />
      </div>
      <span style={s.sectionLabel}>{label}</span>
      {value && <span style={s.sectionValue}>{value}</span>}
    </div>
  );
}

function SubRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.subRow}>
      <span style={s.subLabel}>{label}</span>
      <span style={s.subValue}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div style={s.divider} />;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PriceBreakdown({ quote, isLoading, error, hasFile, modelStats, printType = 'FDM' }: Props) {

  if (!hasFile) {
    return (
      <div style={s.emptyCard}>
        <Info size={16} style={{ color: '#475569', marginBottom: 6 }} />
        <p style={s.emptyText}>Upload a 3D model to see the print summary</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={s.emptyCard}>
        <Loader2 size={18} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
        <p style={s.emptyText}>Analysing model…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={s.errorCard}>
        <AlertTriangle size={14} color="#ef4444" />
        <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>
      </div>
    );
  }

  if (!quote) return null;

  // ── Computed values ──────────────────────────────────────────────────────────
  const vol = quote.volumeBreakdown;
  const cost = quote.costBreakdown;
  const totalMl   = vol ? vol.totalMl : (modelStats ? parseVolumeMl(modelStats.volume) : null);
  const modelMl   = vol ? `${vol.modelMl} mL` : (totalMl !== null ? `${totalMl.toFixed(2)} mL` : '—');
  const suppMl    = vol ? `${vol.supportsMl} mL` : '0 mL';
  const raftMl    = vol ? `${vol.raftMl} mL` : '0 mL';
  const layers    = modelStats ? estimateLayers(modelStats.dimensions, printType) : null;
  const printTime = quote.display.printTime;
  const score     = quote.printabilityScore;
  const scoreColor = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';

  const totalCost = cost ? cost.totalMaterialCost.toFixed(2) : '0.00';
  const modelCost = cost ? cost.modelCost.toFixed(2) : '0.00';
  const supportRaftCost = cost ? cost.supportRaftCost.toFixed(2) : '0.00';
  const touchpoints = 470; // Hardcoded touchpoints visual for now

  return (
    <div style={s.card}>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg text-foreground">Summary</h3>
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-3">
          {/* Time Estimate */}
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Time Estimate</span>
              <Info className="w-4 h-4" />
            </div>
            <div className="font-medium text-foreground flex items-center gap-2">
              {printTime} <RefreshCcw className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Volume Block */}
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Droplets className="w-4 h-4" />
              <span>Volume</span>
            </div>
            <div className="font-medium text-foreground flex items-center gap-1">
              {totalMl !== null ? `${totalMl.toFixed(2)} mL` : '—'} <ChevronDown className="w-4 h-4" />
            </div>
          </div>
          
          <div className="pl-6 border-l-[1.5px] border-border ml-[7px] space-y-1.5 mt-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Model(s)</span>
              <span className="text-foreground">{modelMl}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Supports</span>
              <span className="text-foreground">{suppMl}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Raft</span>
              <span className="text-foreground">{raftMl}</span>
            </div>
          </div>

          {/* Cost Block */}
          <div className="flex justify-between items-center text-sm pt-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="w-4 h-4" />
              <span>Total Print Cost</span>
              <Info className="w-4 h-4" />
            </div>
            <div className="font-medium text-blue-500 flex items-center gap-1">
              {totalCost} <ChevronDown className="w-4 h-4" />
            </div>
          </div>
          
          <div className="pl-6 border-l-[1.5px] border-border ml-[7px] space-y-1.5 mt-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Model Cost</span>
              <span className="text-blue-500">{modelCost}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Support & Raft Cost</span>
              <span className="text-blue-500">{supportRaftCost}</span>
            </div>
          </div>

          {/* Touchpoints */}
          <div className="flex justify-between items-center text-sm pt-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wand2 className="w-4 h-4" />
              <span>Touchpoints</span>
            </div>
            <div className="font-medium text-foreground">
              {touchpoints}
            </div>
          </div>

          {/* Layers */}
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Layers className="w-4 h-4" />
              <span>Layers</span>
            </div>
            <div className="font-medium text-foreground">
              {layers !== null ? layers.toLocaleString() : '—'}
            </div>
          </div>
        </div>

        <div className="pt-4 mt-2 border-t border-border">
          {/* Printability */}
          <div style={s.printabilityWrap}>
            <div style={s.printabilityTop}>
              <span style={s.printabilityLabel}>Printability</span>
              <span style={{ ...s.printabilityScore, color: scoreColor }}>{score}/100</span>
            </div>
            <div style={s.barTrack}>
              <div style={{ ...s.barFill, width: `${score}%`, background: scoreColor }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  card: {
    margin: '0 0 8px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '12px 14px 10px',
  },
  headerTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: '0.02em',
  },
  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.06)',
    margin: '0',
  },
  sectionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 14px',
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    background: 'rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.75)',
  },
  sectionValue: {
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.9)',
    fontVariantNumeric: 'tabular-nums',
  },
  subRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 14px 5px 44px',
  },
  subLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  subValue: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontVariantNumeric: 'tabular-nums',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
  },
  metaCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '10px 14px',
  },
  metaLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.85)',
    fontVariantNumeric: 'tabular-nums',
  },
  printabilityWrap: {
    padding: '10px 14px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  printabilityTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  printabilityLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  printabilityScore: {
    fontSize: 13,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  barTrack: {
    height: 5,
    borderRadius: 3,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.5s ease',
  },
  emptyCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '20px 16px',
    margin: '0 0 8px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.02)',
    border: '1px dashed rgba(255,255,255,0.08)',
  },
  emptyText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    margin: 0,
  },
  errorCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 14px',
    margin: '0 0 8px',
    borderRadius: 14,
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
  },
};
