/**
 * OrderConfirmation — Post-cart success modal
 * Shows after a successful "Add to Cart" with full order summary.
 */
import { ShoppingCart, ExternalLink, CheckCircle2, X, Clock, Package, Layers } from 'lucide-react';
import type { QuoteResult } from '@/hooks/useQuote';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  quote: QuoteResult;
  material: string;
  color: string;
  infill: number;
  modelName: string;
  cartUrl: string;
  checkoutUrl: string;
}

export default function OrderConfirmation({
  isOpen, onClose, quote, material, color, infill, modelName, cartUrl, checkoutUrl,
}: Props) {
  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.successIcon}>
            <CheckCircle2 size={22} color="#22c55e" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={styles.title}>Added to Cart!</h2>
            <p style={styles.subtitle}>{modelName}</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={16} />
          </button>
        </div>

        {/* Order Summary */}
        <div style={styles.summary}>
          <SummaryRow icon={<Package size={13} />} label="Material" value={material} />
          <SummaryRow icon={<Layers size={13} />}  label="Infill"    value={`${infill}%`} />
          <SummaryRow icon={<div style={{ ...styles.colorDot, background: color }} />} label="Color" value={color} />
          <SummaryRow icon={<Clock size={13} />}   label="Print Time" value={quote.display.printTime} />
        </div>

        {/* Price */}
        <div style={styles.priceBox}>
          <div style={styles.priceRow}>
            <span style={styles.priceLabel}>
              {quote.quantity > 1 ? `${quote.quantity} × ${quote.display.perUnit}` : 'Unit Price'}
            </span>
            <span style={styles.totalPrice}>{quote.display.total}</span>
          </div>
          {quote.discountPct > 0 && (
            <div style={styles.discountRow}>
              <span style={styles.discountText}>Quantity discount applied: -{quote.discountPct}%</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <a href={checkoutUrl} style={styles.checkoutBtn}>
            Checkout Now <ExternalLink size={14} />
          </a>
          <a href={cartUrl} style={styles.cartBtn}>
            <ShoppingCart size={14} /> View Cart
          </a>
        </div>

        <p style={styles.note}>
          Your 3D file configuration has been saved to this order.
        </p>
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={styles.summaryRow}>
      <span style={styles.summaryIcon}>{icon}</span>
      <span style={styles.summaryLabel}>{label}</span>
      <span style={styles.summaryValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: 16,
  },
  modal: {
    background: '#111',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 24,
    width: '100%', maxWidth: 380,
    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
  },
  successIcon: {
    width: 40, height: 40,
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    margin: 0, fontSize: 16, fontWeight: 700, color: '#fff',
  },
  subtitle: {
    margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.4)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: 6,
    cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  summary: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12, padding: '10px 14px',
    display: 'flex', flexDirection: 'column' as const, gap: 8,
    marginBottom: 14,
  },
  summaryRow: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  summaryIcon: {
    color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center',
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.4)', fontSize: 12, flex: 1,
  },
  summaryValue: {
    color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 500,
  },
  colorDot: {
    width: 10, height: 10, borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.2)',
  },
  priceBox: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12, padding: '10px 14px', marginBottom: 16,
  },
  priceRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  },
  priceLabel: {
    color: 'rgba(255,255,255,0.45)', fontSize: 11,
  },
  totalPrice: {
    fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px',
  },
  discountRow: {
    marginTop: 4,
  },
  discountText: {
    color: '#22c55e', fontSize: 10, fontWeight: 500,
  },
  actions: {
    display: 'flex', gap: 8, marginBottom: 12,
  },
  checkoutBtn: {
    flex: 2,
    background: 'var(--primary, #00bcd4)',
    color: '#000',
    borderRadius: 10, padding: '11px 16px',
    fontWeight: 700, fontSize: 13,
    textDecoration: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    transition: 'opacity 0.2s',
  },
  cartBtn: {
    flex: 1,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.7)',
    borderRadius: 10, padding: '11px 12px',
    fontWeight: 600, fontSize: 12,
    textDecoration: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  note: {
    color: 'rgba(255,255,255,0.25)', fontSize: 10,
    textAlign: 'center' as const, margin: 0,
  },
};
