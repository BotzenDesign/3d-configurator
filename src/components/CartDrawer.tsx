import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Upload,
  ArrowRight,
  Loader2,
  Box,
  Layers,
  Scale,
  Sparkles,
  Pencil,
} from "lucide-react";

export default function CartDrawer() {
  const {
    items,
    isOpen,
    setIsOpen,
    removeItem,
    updateQuantity,
    totalCount,
    totalPriceCents,
    totalWeightGrams,
    isCheckingOut,
    checkoutCart,
    triggerUpload,
    startEditing,
  } = useCart();

  const formattedTotal = (totalPriceCents / 100).toFixed(2);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col bg-panel-bg border-l border-border z-50"
      >
        {/* Header */}
        <SheetHeader className="p-4 border-b border-border bg-card/50 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <SheetTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Print Queue
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-semibold">
                  {items.length} / 10 {items.length === 1 ? "part" : "parts"}
                </span>
              </SheetTitle>
              <p className="text-xs text-muted-foreground">
                Bundle up to 10 parts into one order with combined shipping
              </p>
            </div>
          </div>
        </SheetHeader>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-secondary/80 flex items-center justify-center text-muted-foreground border border-border">
                <Box className="w-8 h-8 opacity-60" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Your queue is empty</h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Upload and configure your 3D models. You can bundle up to 10 parts into a single order with combined shipping!
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={triggerUpload}
                className="flex items-center gap-2 mt-2"
              >
                <Upload className="w-4 h-4" />
                Upload a 3D Model
              </Button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="bg-card rounded-xl border border-border p-3.5 space-y-3 shadow-sm hover:border-primary/40 transition-colors"
              >
                {/* Title & Delete */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-secondary text-foreground flex items-center justify-center shrink-0">
                      <Box className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h4
                        className="text-sm font-bold text-foreground truncate"
                        title={item.fileName}
                      >
                        {item.fileName}
                      </h4>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        <span>{item.dimensions}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <Scale className="w-3 h-3" />
                          {item.weightDisplay}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEditing(item.id)}
                      className="w-7 h-7 text-muted-foreground hover:text-primary shrink-0"
                      title="Edit part specs"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      className="w-7 h-7 text-muted-foreground hover:text-destructive shrink-0"
                      title="Remove part"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-secondary font-medium text-foreground">
                    {item.printType}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-secondary font-medium text-foreground">
                    {item.materialName}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-secondary font-medium text-foreground flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full inline-block border border-black/20"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.color}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-secondary font-medium text-foreground flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {item.infill}
                  </span>
                  {item.isOversized && (
                    <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 font-semibold text-[10px]">
                      Oversized
                    </span>
                  )}
                </div>

                {/* Order Note if present */}
                {item.customNote && (
                  <p className="text-[11px] bg-secondary/50 p-2 rounded text-muted-foreground italic truncate">
                    Note: &ldquo;{item.customNote}&rdquo;
                  </p>
                )}

                {/* Quantity & Price */}
                <div className="flex items-center justify-between pt-1 border-t border-border/60">
                  <div className="flex items-center gap-1.5 bg-secondary rounded-lg p-0.5">
                    <button
                      onClick={() => updateQuantity(item.id, -1, true)}
                      className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center font-bold text-xs text-foreground">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1, true)}
                      className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-black text-foreground">
                      ${((item.pricePerUnitCents * item.quantity) / 100).toFixed(2)}
                    </div>
                    {item.quantity > 1 && (
                      <div className="text-[10px] text-muted-foreground">
                        ${(item.pricePerUnitCents / 100).toFixed(2)} each
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <SheetFooter className="p-4 border-t border-border bg-card/60 flex flex-col space-y-3 sm:flex-col sm:space-x-0">
            {/* Stats summary */}
            <div className="space-y-1.5 w-full">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Parts:</span>
                <span className="font-semibold text-foreground">
                  {totalCount} {totalCount === 1 ? "piece" : "pieces"} ({items.length} {items.length === 1 ? "model" : "models"})
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Combined Shipping Weight:</span>
                <span className="font-semibold text-foreground">
                  {totalWeightGrams.toFixed(1)} g
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm font-bold text-foreground">Estimated Total:</span>
                <span className="text-xl font-black text-foreground">${formattedTotal}</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-1 gap-2 w-full pt-1">
              <Button
                variant="outline"
                size="default"
                onClick={triggerUpload}
                disabled={items.length >= 10 || isCheckingOut}
                className="w-full flex items-center justify-center gap-2 font-semibold"
              >
                <Plus className="w-4 h-4" />
                {items.length >= 10 ? "Queue Full (Max 10 Parts)" : "Add Another Model (+)"}
              </Button>

              <Button
                size="default"
                onClick={checkoutCart}
                disabled={isCheckingOut || items.length === 0}
                className="w-full flex items-center justify-center gap-2 font-bold text-base bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
              >
                {isCheckingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating Shopify Order...
                  </>
                ) : (
                  <>
                    Checkout All {items.length} {items.length === 1 ? "Part" : "Parts"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
