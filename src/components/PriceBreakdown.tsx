/**
 * PriceBreakdown — Live quote display component
 * Shows itemized cost breakdown, print time, weight, printability badge.
 */
import { Loader2, AlertTriangle } from 'lucide-react';
import type { QuoteResult } from '@/hooks/useQuote';

interface Props {
  quote: QuoteResult | null;
  isLoading: boolean;
  error: string | null;
  hasFile: boolean;
}



export default function PriceBreakdown({ quote, isLoading, error, hasFile }: Props) {
  // ── Empty state ─────────────────────────────────────────────────────────
  if (!hasFile) {
    return (
      <div style={styles.card}>
        <div style={styles.placeholder}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <p style={styles.placeholderText}>Upload a 3D file to get an instant quote</p>
        </div>
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={styles.card}>
        <div style={styles.loadingRow}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
          <span style={styles.loadingText}>Calculating quote…</span>
        </div>
        {/* Skeleton lines */}
        {[80, 60, 70, 50].map((w, i) => (
          <div key={i} style={{ ...styles.skeleton, width: `${w}%`, marginTop: i === 0 ? 12 : 8 }} />
        ))}
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={styles.card}>
        <div style={styles.errorRow}>
          <AlertTriangle size={14} color="#ef4444" />
          <span style={styles.errorText}>{error}</span>
        </div>
      </div>
    );
  }

  if (!quote) return null;

  return (
    <div style={styles.card}>
      {/* Total Price */}
      <div style={styles.totalRow}>
        <span style={styles.totalLabel}>Total</span>
        <span style={styles.totalPrice}>{quote.display.total}</span>
      </div>

      {quote.quantity > 1 && (
        <div style={styles.perUnitRow}>
          <span style={styles.mutedText}>{quote.display.perUnit} / unit</span>
          {quote.discountPct > 0 && (
            <span style={styles.discountBadge}>-{quote.discountPct}% discount</span>
          )}
        </div>
      )}

      <hr style={styles.divider} />

      {/* Line Items */}
      <div style={styles.lineItems}>
        {quote.lineItems.map((item, i) => (
          <div key={i} style={styles.lineItem}>
            <div>
              <span style={styles.lineLabel}>{item.label}</span>
              {item.note && <span style={styles.lineNote}> — {item.note}</span>}
            </div>
            <span style={styles.lineAmount}>
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.amountUsd)}
            </span>
          </div>
        ))}
      </div>

      <hr style={styles.divider} />

      {/* Stats row */}
      <div style={styles.statsRow}>
        <StatPill label="Print Time" value={quote.display.printTime} />
        <StatPill label="Weight" value={quote.display.weight} />
      </div>

      {/* Printability score */}
      <div style={styles.printabilityRow}>
        <span style={styles.printabilityLabel}>Printability</span>
        <div style={styles.printabilityRight}>
          <div style={styles.printabilityBar}>
            <div
              style={{
                ...styles.printabilityFill,
                width: `${quote.printabilityScore}%`,
                background: quote.printabilityScore >= 80
                  ? '#22c55e'
                  : quote.printabilityScore >= 50
                    ? '#f59e0b'
                    : '#ef4444',
              }}
            />
          </div>
          <span style={{
            ...styles.printabilityScore,
            color: quote.printabilityScore >= 80
              ? '#22c55e'
              : quote.printabilityScore >= 50
                ? '#f59e0b'
                : '#ef4444',
          }}>
            {quote.printabilityScore}/100
          </span>
        </div>
        {quote.needsRepair && (
          <span style={styles.repairNote}>Mesh repair included</span>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statPill}>
      <span style={styles.statLabel}>{label}</span>
      <span style={styles.statValue}>{value}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '16px',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '20px 0',
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 1.4,
    margin: 0,
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  skeleton: {
    height: 10,
    borderRadius: 6,
    background: 'rgba(255,255,255,0.06)',
    animation: 'shimmer 1.5s infinite ease-in-out',
  },
  errorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  totalLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  },
  totalPrice: {
    fontSize: 26,
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '-0.5px',
  },
  perUnitRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  mutedText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
  discountBadge: {
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: '#22c55e',
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 100,
  },
  divider: {
    border: 'none',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    margin: '12px 0',
  },
  lineItems: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  lineItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  lineLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  lineNote: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
  },
  lineAmount: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  statsRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 10,
  },
  statPill: {
    flex: 1,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  },
  statValue: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: 600,
  },
  printabilityRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  printabilityLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  },
  printabilityRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  printabilityBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  printabilityFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.4s ease',
  },
  printabilityScore: {
    fontSize: 13,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    minWidth: 40,
    textAlign: 'right' as const,
  },
  repairNote: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.3)',
  },
};
