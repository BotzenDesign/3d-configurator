import { useState, useRef } from "react";
import { Upload, Minus, Plus, ExternalLink, Loader2, AlertCircle, ShoppingCart } from "lucide-react";
import { createCheckout } from "@/lib/shopifyClient";
import { useQuote } from "@/hooks/useQuote";
import PriceBreakdown from "./PriceBreakdown";
import FileUploadComponent from "./FileUploadComponent";
import ErrorBoundary from "./ErrorBoundary";

// ── Material IDs must match server/services/materialEstimationEngine.ts ────────
const MATERIALS = [
  { label: "PLA (Standard)",     id: "PLA"    },
  { label: "PLA+ (Enhanced)",    id: "PLA+"   },
  { label: "PETG",               id: "PETG"   },
  { label: "ABS",                id: "ABS"    },
  { label: "ASA (UV Resistant)", id: "ASA"    },
  { label: "TPU (Flexible)",     id: "TPU"    },
  { label: "Nylon (PA12)",       id: "NYLON"  },
  { label: "Polycarbonate (PC)", id: "PC"     },
  { label: "Wood-fill PLA",      id: "WOOD"   },
  { label: "Carbon Fiber PLA",   id: "CARBON" },
];

const COLORS = [
  { label: "Any Color",  hex: "#00bcd4" },
  { label: "White",      hex: "#ffffff" },
  { label: "Black",      hex: "#222222" },
  { label: "Red",        hex: "#e53935" },
  { label: "Blue",       hex: "#1e88e5" },
  { label: "Green",      hex: "#43a047" },
  { label: "Yellow",     hex: "#fdd835" },
  { label: "Orange",     hex: "#fb8c00" },
];

const INFILL_OPTIONS = [
  { label: "Light (10%)",    value: 10  },
  { label: "Standard (20%)", value: 20  },
  { label: "Dense (40%)",    value: 40  },
  { label: "Solid (100%)",   value: 100 },
];

interface ConfigPanelProps {
  onFileUpload: (file: File) => void;
  onColorChange: (hex: string) => void;
  selectedColor: string;
  modelStats: { dimensions: string; volume: string; surface: string; weight: string };
  modelName?: string;
  /** File object passed from parent (either uploaded or preset-fetched) */
  uploadedFile?: File | null;
}

export default function ConfigPanel({
  onFileUpload,
  onColorChange,
  selectedColor,
  modelStats,
  modelName = "bear.stl",
  uploadedFile: externalFile = null,
}: ConfigPanelProps) {
  const [materialIdx, setMaterialIdx] = useState(0);
  const [colorIdx,    setColorIdx]    = useState(0);
  const [infillIdx,   setInfillIdx]   = useState(1); // default: Standard 20%
  const [quantity,    setQuantity]    = useState(1);
  // Own uploaded file (from drag-drop/browse). Merges with externalFile from parent.
  const [ownUploadedFile, setOwnUploadedFile] = useState<File | null>(null);
  const activeFile = ownUploadedFile ?? externalFile;

  // Cart state
  const [isAddingToCart,  setIsAddingToCart]  = useState(false);
  const [cartError,       setCartError]       = useState<string | null>(null);

  // ── Real-time quote from /api/quote ────────────────────────────────────────
  const { quote, isLoading: isQuoteLoading, error: quoteError } = useQuote({
    file: activeFile,
    material: MATERIALS[materialIdx].id,
    infill: INFILL_OPTIONS[infillIdx].value,
    quantity,
    debounceMs: 700,
  });

  const handleColorSelect = (idx: number) => {
    setColorIdx(idx);
    onColorChange(COLORS[idx].hex);
  };

  const handleFileAccepted = (file: File) => {
    setOwnUploadedFile(file);
    onFileUpload(file);
    setCartError(null);
  };

  // ── Add to Cart ─────────────────────────────────────────────────────────────
  const handleAddToCart = async () => {
    setCartError(null);



    if (!activeFile && !quote) {
      setCartError("Please upload a 3D file first to generate a quote.");
      return;
    }

    setIsAddingToCart(true);
    try {
      const result = await createCheckout({
        title: `Custom 3D Print - ${modelName}`,
        quantity,
        price: Math.round((quote?.totalUsd ?? 0) * 100),
        properties: {
          Material:      MATERIALS[materialIdx].label,
          Color:         COLORS[colorIdx].label,
          Infill:        `${INFILL_OPTIONS[infillIdx].value}%`,
          Dimensions:    modelStats.dimensions,
          Weight:        quote?.display.weight    ?? modelStats.weight,
          "Print Time":  quote?.display.printTime ?? "N/A",
          Volume:        modelStats.volume,
          Printability:  quote ? `${quote.printabilityGrade} (${quote.printabilityScore}/100)` : "N/A",
          _file_name:    modelName,
        },
      });

      if (result.success && result.checkoutUrl) {
        // Redirect the user immediately to the dynamic Draft Order checkout
        window.location.href = result.checkoutUrl;
      }
    } catch (err) {
      setCartError(err instanceof Error ? err.message : "Failed to generate checkout link.");
    } finally {
      setIsAddingToCart(false);
    }
  };

  return (
    <div className="w-full md:w-[320px] md:min-w-[320px] h-full bg-panel-bg flex flex-col overflow-y-auto">

      {/* ── Live Price Display ─────────────────────────────────────────────── */}
      <div className="p-5 text-center border-b border-border">
        {quote && !isQuoteLoading ? (
          <>
            <div className="text-5xl font-black tracking-tight text-white">
              {quote.display.perUnit}
              <span className="text-lg font-normal text-muted-foreground ml-1">/ea</span>
            </div>
            {quantity > 1 && (
              <div className="text-sm text-muted-foreground mt-1">{quote.display.total} total</div>
            )}
            {quote.discountPct > 0 && (
              <div className="mt-1 inline-block text-xs font-semibold text-green-400
                             bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
                -{quote.discountPct}% qty discount
              </div>
            )}
          </>
        ) : isQuoteLoading ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground h-14">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Calculating…</span>
          </div>
        ) : (
          <div className="text-4xl font-black text-white/20 h-14 flex items-center justify-center">
            —
          </div>
        )}
      </div>

      {/* ── Upload ─────────────────────────────────────────────────────────── */}
      <div className="mx-4 my-4">
        <ErrorBoundary>
          <FileUploadComponent onFileAccepted={handleFileAccepted} />
        </ErrorBoundary>
      </div>

      {/* ── Config selectors ────────────────────────────────────────────────── */}
      <div className="px-4 space-y-3 flex-1">

        {/* Material */}
        <div className="bg-secondary rounded-lg overflow-hidden">
          <select
            value={materialIdx}
            onChange={(e) => setMaterialIdx(+e.target.value)}
            className="w-full bg-transparent px-4 py-3 text-config-label text-sm font-medium appearance-none cursor-pointer outline-none"
          >
            {MATERIALS.map((m, i) => (
              <option key={i} value={i} className="bg-secondary text-foreground">{m.label}</option>
            ))}
          </select>
        </div>

        {/* Color */}
        <div className="bg-secondary rounded-lg flex items-center justify-between px-4 py-3">
          <select
            value={colorIdx}
            onChange={(e) => handleColorSelect(+e.target.value)}
            className="bg-transparent text-config-label text-sm font-medium appearance-none cursor-pointer outline-none flex-1"
          >
            {COLORS.map((c, i) => (
              <option key={i} value={i} className="bg-secondary text-foreground">{c.label}</option>
            ))}
          </select>
          <div
            className="w-5 h-5 rounded-full border-2 border-border ml-2 flex-shrink-0"
            style={{ backgroundColor: COLORS[colorIdx].hex }}
          />
        </div>

        {/* Infill */}
        <div className="bg-secondary rounded-lg flex items-center justify-between px-4 py-3">
          <select
            value={infillIdx}
            onChange={(e) => setInfillIdx(+e.target.value)}
            className="bg-transparent text-config-label text-sm font-medium appearance-none cursor-pointer outline-none flex-1"
          >
            {INFILL_OPTIONS.map((d, i) => (
              <option key={i} value={i} className="bg-secondary text-foreground">{d.label}</option>
            ))}
          </select>
          <span className="text-config-value text-sm">{INFILL_OPTIONS[infillIdx].value}%</span>
        </div>

        {/* Quantity */}
        <div className="bg-secondary rounded-lg flex items-center justify-between px-4 py-3">
          <span className="text-config-label text-sm font-medium">Quantity</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <Minus size={14} />
            </button>
            <span className="text-foreground font-medium w-6 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Price Breakdown panel */}
        <PriceBreakdown
          quote={quote}
          isLoading={isQuoteLoading}
          error={quoteError}
          hasFile={!!activeFile}
        />
      </div>

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {cartError && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
          <AlertCircle size={16} className="text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-xs text-destructive leading-snug">{cartError}</p>
        </div>
      )}

      {/* ── Add to Cart button ──────────────────────────────────────────────── */}
      <div className="p-4 pt-3">
        <button
          id="shopify-add-to-cart-btn"
          onClick={handleAddToCart}
          disabled={isAddingToCart}
          className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold text-sm
                     hover:opacity-90 transition-opacity flex items-center justify-center gap-2
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isAddingToCart ? (
            <><Loader2 size={16} className="animate-spin" /> Generating Checkout...</>
          ) : (
            <><ShoppingCart size={16} /> Proceed to Checkout</>
          )}
        </button>


      </div>

    </div>
  );
}
