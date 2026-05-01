import { useState, useEffect } from "react";
import { Minus, Plus, Loader2, AlertCircle, ShoppingCart } from "lucide-react";
import { createCheckout } from "@/lib/shopifyClient";
import { useQuote } from "@/hooks/useQuote";
import PriceBreakdown from "./PriceBreakdown";
import FileUploadComponent from "./FileUploadComponent";
import ErrorBoundary from "./ErrorBoundary";
import { supabase } from "@/integrations/supabase/client";

// ── Print Type ────────────────────────────────────────────────────────────────
type PrintType = "FDM" | "SLA";

// ── Color hex map ─────────────────────────────────────────────────────────────
const COLOR_HEX: Record<string, string> = {
  "Red":             "#e53935",
  "Green":           "#43a047",
  "Blue":            "#1e88e5",
  "Orange":          "#fb8c00",
  "Gray":            "#9e9e9e",
  "Silver":          "#e0e0e0",
  "Black":           "#222222",
  "White":           "#ffffff",
  "Purple":          "#8e24aa",
  "Grey":            "#9e9e9e",
  "Yellow":          "#fdd835",
  "Clear":           "#e0f7fa",
  "Light Blue Clear":"#81d4fa",
};

// ── FDM Infill options ────────────────────────────────────────────────────────
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
  uploadedFile?: File | null;
}

export default function ConfigPanel({
  onFileUpload,
  onColorChange,
  modelStats,
  modelName = "bear.stl",
  uploadedFile: externalFile = null,
}: ConfigPanelProps) {
  // Print type toggle
  const [printType, setPrintType] = useState<PrintType>("FDM");

  // Dynamic Materials State
  const [dbMaterials, setDbMaterials] = useState<any[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(true);

  // Material index
  const [materialIdx, setMaterialIdx] = useState(0);

  // Infill (SLA is always 100)
  const [infillIdx, setInfillIdx] = useState(1); // default: Standard 20%

  // Quantity
  const [quantity, setQuantity] = useState(1);

  // File state
  const [ownUploadedFile, setOwnUploadedFile] = useState<File | null>(null);
  const activeFile = ownUploadedFile ?? externalFile;

  // Cart state
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  // Color index — reset when material changes
  const [colorIdx, setColorIdx] = useState(0);

  useEffect(() => {
    async function loadMats() {
      const { data, error } = await supabase.from("materials").select("*").eq("is_active", true).order('label');
      if (error) {
        console.error("Error loading materials:", error);
      }
      if (data) {
        setDbMaterials(data);
      }
      setLoadingMaterials(false);
    }
    loadMats();
  }, []);

  const materials = dbMaterials.filter(m => m.type === printType).map(m => ({
    label: m.label, id: m.id, price: m.price_label, colors: m.colors || []
  }));

  const currentMaterial = materials[materialIdx] ?? materials[0];
  const availableColors = currentMaterial?.colors || [];

  // Update color when materials load
  useEffect(() => {
    if (availableColors.length > 0 && availableColors[colorIdx]) {
      onColorChange(COLOR_HEX[availableColors[colorIdx]] ?? "#00bcd4");
    }
  }, [materials.length, materialIdx, colorIdx, availableColors]);

  // Infill value — SLA is always 100%
  const effectiveInfill = printType === "SLA" ? 100 : INFILL_OPTIONS[infillIdx].value;

  // ── Real-time quote ─────────────────────────────────────────────────────────
  const { quote, isLoading: isQuoteLoading, error: quoteError } = useQuote({
    file: activeFile,
    material: currentMaterial?.id || "PLA",
    infill: effectiveInfill,
    quantity,
    debounceMs: 700,
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handlePrintTypeChange = (type: PrintType) => {
    setPrintType(type);
    setMaterialIdx(0);
    setColorIdx(0);
  };

  const handleMaterialChange = (idx: number) => {
    setMaterialIdx(idx);
    setColorIdx(0);
  };

  const handleColorSelect = (idx: number) => {
    setColorIdx(idx);
    onColorChange(COLOR_HEX[availableColors[idx]] ?? "#00bcd4");
  };

  const handleFileAccepted = (file: File) => {
    setOwnUploadedFile(file);
    onFileUpload(file);
    setCartError(null);
  };

  // ── Checkout ────────────────────────────────────────────────────────────────
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
          "Print Type":  printType,
          Material:      currentMaterial?.label || "Unknown",
          Color:         availableColors[colorIdx] || "Unknown",
          Infill:        `${effectiveInfill}%`,
          Dimensions:    modelStats.dimensions,
          Weight:        quote?.display.weight    ?? modelStats.weight,
          "Print Time":  quote?.display.printTime ?? "N/A",
          Volume:        modelStats.volume,
          Printability:  quote ? `${quote.printabilityGrade} (${quote.printabilityScore}/100)` : "N/A",
          _file_name:    modelName,
        },
      });
      if (result.success && result.checkoutUrl) {
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

      {/* ── Live Price ───────────────────────────────────────────────────────── */}
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
              <div className="mt-1 inline-block text-xs font-semibold text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
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
          <div className="text-4xl font-black text-white/20 h-14 flex items-center justify-center">—</div>
        )}
      </div>

      {/* ── Upload ──────────────────────────────────────────────────────────── */}
      <div className="mx-4 my-4">
        <ErrorBoundary>
          <FileUploadComponent onFileAccepted={handleFileAccepted} />
        </ErrorBoundary>
      </div>

      {/* ── Config selectors ─────────────────────────────────────────────────── */}
      <div className="px-4 space-y-3 flex-1">

        {/* Print Type Toggle */}
        <div className="bg-secondary rounded-lg flex overflow-hidden">
          {(["FDM", "SLA"] as PrintType[]).map((type) => (
            <button
              key={type}
              onClick={() => handlePrintTypeChange(type)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                printType === type
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Build volume info */}
        <div className="text-[10px] text-muted-foreground/60 text-center tracking-wide">
          {printType === "FDM"
            ? "Max build: 330L × 240W × 300H mm"
            : "Max build: 200L × 125W × 210H mm"}
        </div>

        {loadingMaterials ? (
          <div className="py-4 text-center text-sm text-muted-foreground flex justify-center items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading materials...
          </div>
        ) : materials.length === 0 ? (
          <div className="py-4 text-center text-sm text-destructive">
            No materials found for {printType}.
          </div>
        ) : (
          <>
            {/* Material */}
            <div className="bg-secondary rounded-lg overflow-hidden">
              <select
                value={materialIdx}
                onChange={(e) => handleMaterialChange(+e.target.value)}
                className="w-full bg-transparent px-4 py-3 text-config-label text-sm font-medium appearance-none cursor-pointer outline-none"
              >
                {materials.map((m, i) => (
                  <option key={i} value={i} className="bg-secondary text-foreground">
                    {m.label} — {m.price}
                  </option>
                ))}
              </select>
            </div>

            {/* Color — only colors available for this material */}
            <div className="bg-secondary rounded-lg flex items-center justify-between px-4 py-3">
              <select
                value={colorIdx}
                onChange={(e) => handleColorSelect(+e.target.value)}
                className="bg-transparent text-config-label text-sm font-medium appearance-none cursor-pointer outline-none flex-1"
              >
                {availableColors.map((c: string, i: number) => (
                  <option key={i} value={i} className="bg-secondary text-foreground">{c}</option>
                ))}
              </select>
              <div
                className="w-5 h-5 rounded-full border-2 border-border ml-2 flex-shrink-0"
                style={{ backgroundColor: COLOR_HEX[availableColors[colorIdx]] ?? "#888" }}
              />
            </div>
          </>
        )}

        {/* Infill — FDM: dropdown | SLA: locked at 100% */}
        {printType === "FDM" ? (
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
        ) : (
          <div className="bg-secondary rounded-lg flex items-center justify-between px-4 py-3">
            <span className="text-config-label text-sm font-medium">Infill</span>
            <span className="text-config-value text-sm font-semibold">100% (SLA)</span>
          </div>
        )}

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

        {/* Price breakdown */}
        <PriceBreakdown
          quote={quote}
          isLoading={isQuoteLoading}
          error={quoteError}
          hasFile={!!activeFile}
        />
      </div>

      {/* ── Cart Error ───────────────────────────────────────────────────────── */}
      {cartError && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
          <AlertCircle size={16} className="text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-xs text-destructive leading-snug">{cartError}</p>
        </div>
      )}

      {/* ── Checkout button ──────────────────────────────────────────────────── */}
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
