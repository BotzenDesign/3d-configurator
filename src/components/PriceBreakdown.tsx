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
  const isSLA = quote?.isSLA ?? printType === 'SLA';
  const totalCost = (quote?.totalUsd ?? 0).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center py-10 bg-black/20 rounded-2xl border border-white/5 shadow-inner">
        <div className="flex items-start gap-2">
          <span className="text-3xl font-black text-primary/40 mt-4">$</span>
          <span className="text-8xl font-black tracking-tighter text-primary drop-shadow-[0_0_40px_rgba(0,188,212,0.4)]">
            {totalCost}
          </span>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-white/5">
        <div className="flex justify-between items-end">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">Formula Breakdown</span>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] font-mono text-muted-foreground italic">Botzen Engine v2.1</span>
            <div className="flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
              <Wand2 size={8} className="text-primary" />
              <span className="text-[8px] font-bold text-primary uppercase tracking-tighter">Cura Engine Optimized</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/[0.03] rounded-xl p-3 space-y-2">
            <div className="text-[10px] text-muted-foreground flex justify-between">
              <span>Usage ({isSLA ? 'B' : 'A'})</span>
              <span className="text-foreground font-medium">{quote.display.weight}</span>
            </div>
            <div className="text-[10px] text-muted-foreground flex justify-between">
              <span>Time (T)</span>
              <span className="text-foreground font-medium">{quote.display.printTime}</span>
            </div>
          </div>
          <div className="bg-white/[0.03] rounded-xl p-3 space-y-2">
            <div className="text-[10px] text-muted-foreground flex justify-between">
              <span>Multiplier (Y)</span>
              <span className="text-foreground font-medium">x{quote.botzenVariables?.Y.toFixed(1) || '2.0'}</span>
            </div>
            <div className="text-[10px] text-muted-foreground flex justify-between">
              <span>Machine (W)</span>
              <span className="text-foreground font-medium">${quote.botzenVariables?.W.toFixed(2)}/h</span>
            </div>
          </div>
        </div>

        <div className="bg-white/[0.02] rounded-lg p-3 space-y-2">
          {quote.lineItems.map((item, idx) => (
            <div key={idx} className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[11px] font-medium">
                <span className="text-foreground/80">{item.label}</span>
                <span className="text-primary">${item.amountUsd.toFixed(2)}</span>
              </div>
              <div className="text-[9px] text-muted-foreground/40 font-mono truncate">{item.note}</div>
            </div>
          ))}
          {quote.discountPct > 0 && (
            <div className="pt-1 border-t border-white/5 flex justify-between text-[11px] font-bold text-emerald-400">
              <span>Bulk Discount ({quote.discountPct}%)</span>
              <span>-${quote.discountAmountUsd.toFixed(2)}</span>
            </div>
          )}
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
