import { useCallback, useRef, useState } from "react";
import { Upload, Minus, Plus, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import {
  createConfiguredCheckout,
  isShopifyConfigured,
} from "@/lib/shopifyClient";
import FileUploadComponent from "./FileUploadComponent";
import ErrorBoundary from "./ErrorBoundary";

const MATERIALS = [
  { label: "Standard Material (PLA)", pricePerG: 0.12 },
  { label: "PETG", pricePerG: 0.15 },
  { label: "ABS", pricePerG: 0.14 },
  { label: "TPU (Flexible)", pricePerG: 0.25 },
  { label: "Nylon", pricePerG: 0.30 },
];

const COLORS = [
  { label: "Any Color", hex: "#00bcd4" },
  { label: "White", hex: "#ffffff" },
  { label: "Black", hex: "#222222" },
  { label: "Red", hex: "#e53935" },
  { label: "Blue", hex: "#1e88e5" },
  { label: "Green", hex: "#43a047" },
  { label: "Yellow", hex: "#fdd835" },
  { label: "Orange", hex: "#fb8c00" },
];

const DENSITIES = [
  { label: "Standard Density", value: "20%" },
  { label: "Light", value: "10%" },
  { label: "Dense", value: "40%" },
  { label: "Solid", value: "100%" },
];

interface ConfigPanelProps {
  onFileUpload: (file: File) => void;
  onColorChange: (hex: string) => void;
  selectedColor: string;
  modelStats: { dimensions: string; volume: string; surface: string; weight: string };
  modelName?: string;
}

export default function ConfigPanel({
  onFileUpload,
  onColorChange,
  selectedColor,
  modelStats,
  modelName = "bear.stl",
}: ConfigPanelProps) {
  const [material, setMaterial] = useState(0);
  const [color, setColor] = useState(0);
  const [density, setDensity] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const weight = parseFloat(modelStats.weight) || 55;
  const densityMultiplier = parseFloat(DENSITIES[density].value) / 20;
  const priceEach = +(MATERIALS[material].pricePerG * weight * densityMultiplier + 15).toFixed(2);
  const total = +(priceEach * quantity).toFixed(2);

  const handleColorSelect = (idx: number) => {
    setColor(idx);
    onColorChange(COLORS[idx].hex);
  };

  const handleContinueToStore = async () => {
    setCheckoutError(null);

    // ── Dev mode: Shopify not yet configured ──────────────────────
    if (!isShopifyConfigured()) {
      setCheckoutError(
        "Shopify is not configured yet. Fill in VITE_SHOPIFY_DOMAIN, " +
        "VITE_SHOPIFY_STOREFRONT_TOKEN, and VITE_SHOPIFY_PRODUCT_ID in your .env.local file."
      );
      return;
    }

    setIsLoading(true);
    try {
      const checkoutUrl = await createConfiguredCheckout({
        material: MATERIALS[material].label,
        color: COLORS[color].label,
        colorHex: COLORS[color].hex,
        density: DENSITIES[density].value,
        quantity,
        priceEach,
        totalPrice: total,
        modelName,
        dimensions: modelStats.dimensions,
        weight: modelStats.weight,
        volume: modelStats.volume,
      });

      // Redirect customer to Shopify checkout
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error("Shopify checkout error:", err);
      setCheckoutError(
        err instanceof Error
          ? err.message
          : "Failed to create checkout. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full md:w-[320px] md:min-w-[320px] h-full bg-panel-bg flex flex-col overflow-y-auto">
      {/* Price */}
      <div className="p-6 text-center">
        <div className="text-6xl font-bold tracking-tight" style={{ color: "white" }}>
          ${Math.floor(priceEach)}
          <span className="text-3xl align-top">.{(priceEach % 1).toFixed(2).slice(2)}</span>
          <span className="text-lg font-normal text-muted-foreground ml-1">/ea</span>
        </div>
        <div className="text-sm text-muted-foreground mt-1">${total.toFixed(2)} total</div>
      </div>

      {/* Upload */}
      <div className="mx-4 mb-4">
        <ErrorBoundary>
          <FileUploadComponent onFileAccepted={onFileUpload} />
        </ErrorBoundary>
      </div>

      {/* Config selectors */}
      <div className="px-4 space-y-3 flex-1">
        {/* Material */}
        <div className="bg-secondary rounded-lg overflow-hidden">
          <select
            value={material}
            onChange={(e) => setMaterial(+e.target.value)}
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
            value={color}
            onChange={(e) => handleColorSelect(+e.target.value)}
            className="bg-transparent text-config-label text-sm font-medium appearance-none cursor-pointer outline-none flex-1"
          >
            {COLORS.map((c, i) => (
              <option key={i} value={i} className="bg-secondary text-foreground">{c.label}</option>
            ))}
          </select>
          <div
            className="w-6 h-6 rounded-full border-2 border-border ml-2 flex-shrink-0"
            style={{ backgroundColor: COLORS[color].hex }}
          />
        </div>

        {/* Density */}
        <div className="bg-secondary rounded-lg flex items-center justify-between px-4 py-3">
          <select
            value={density}
            onChange={(e) => setDensity(+e.target.value)}
            className="bg-transparent text-config-label text-sm font-medium appearance-none cursor-pointer outline-none flex-1"
          >
            {DENSITIES.map((d, i) => (
              <option key={i} value={i} className="bg-secondary text-foreground">{d.label}</option>
            ))}
          </select>
          <span className="text-config-value text-sm">{DENSITIES[density].value}</span>
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

        <button className="text-config-label text-sm underline hover:no-underline">Add Note</button>
      </div>

      {/* Error message */}
      {checkoutError && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
          <AlertCircle size={16} className="text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-xs text-destructive leading-snug">{checkoutError}</p>
        </div>
      )}

      {/* Continue button */}
      <div className="p-4">
        <button
          id="shopify-checkout-btn"
          onClick={handleContinueToStore}
          disabled={isLoading}
          className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Creating Checkout…
            </>
          ) : (
            <>
              Continue to Store <ExternalLink size={16} />
            </>
          )}
        </button>

        {/* Dev-mode hint when not configured */}
        {!isShopifyConfigured() && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            ⚙️ Fill in <code className="text-xs">.env.local</code> to activate Shopify
          </p>
        )}
      </div>
    </div>
  );
}
