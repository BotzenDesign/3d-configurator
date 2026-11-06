import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { createCheckout } from "@/lib/shopifyClient";

export interface CartItem {
  id: string;
  title: string;
  fileName: string;
  fileUrl?: string;
  printType: "FDM" | "SLA";
  materialName: string;
  color: string;
  infill: string;
  dimensions: string;
  weightDisplay: string;
  weightInGrams: number;
  printTime: string;
  volume: string;
  printability: string;
  customNote?: string;
  isOversized?: boolean;
  quantity: number;
  pricePerUnitCents: number;
  totalPriceCents: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "id">) => boolean;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, deltaOrExact: number, isDelta?: boolean) => void;
  clearCart: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  totalCount: number;
  totalPriceCents: number;
  totalWeightGrams: number;
  isCheckingOut: boolean;
  checkoutCart: () => Promise<void>;
  registerUploadTrigger: (trigger: () => void) => void;
  triggerUpload: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = "botzen_3d_cart_items_v1";
const MAX_CART_ITEMS = 10;

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isOpen, setIsOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const uploadTriggerRef = React.useRef<(() => void) | null>(null);

  // Sync with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error("Failed to save cart to localStorage", e);
    }
  }, [items]);

  const totalCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const totalPriceCents = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.pricePerUnitCents * item.quantity), 0);
  }, [items]);

  const totalWeightGrams = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.weightInGrams * item.quantity), 0);
  }, [items]);

  const addItem = useCallback((newItem: Omit<CartItem, "id">): boolean => {
    if (items.length >= MAX_CART_ITEMS) {
      toast.error(`Cart limit reached (maximum ${MAX_CART_ITEMS} items per order). Please checkout or remove an item.`);
      return false;
    }

    const id = `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const fullItem: CartItem = {
      ...newItem,
      id,
      totalPriceCents: newItem.pricePerUnitCents * newItem.quantity,
    };

    setItems((prev) => [fullItem, ...prev]);
    toast.success(`Added "${newItem.fileName}" to your print queue!`);
    setIsOpen(true);
    return true;
  }, [items.length]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    toast.info("Item removed from queue.");
  }, []);

  const updateQuantity = useCallback((id: string, amount: number, isDelta = true) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const newQty = isDelta ? Math.max(1, item.quantity + amount) : Math.max(1, amount);
        return {
          ...item,
          quantity: newQty,
          totalPriceCents: item.pricePerUnitCents * newQty,
        };
      })
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const registerUploadTrigger = useCallback((trigger: () => void) => {
    uploadTriggerRef.current = trigger;
  }, []);

  const triggerUpload = useCallback(() => {
    setIsOpen(false);
    if (uploadTriggerRef.current) {
      setTimeout(() => {
        uploadTriggerRef.current?.();
      }, 200);
    }
  }, []);

  const checkoutCart = useCallback(async () => {
    if (items.length === 0) {
      toast.error("Your cart is empty. Please add at least one model.");
      return;
    }

    setIsCheckingOut(true);
    try {
      const lineItemsPayload = items.map((item) => {
        const properties: Record<string, string> = {
          "Print Type":   item.printType,
          "Material":     item.materialName,
          "Color":        item.color,
          "Infill":       item.infill,
          "Dimensions":   item.dimensions,
          "Weight":       item.weightDisplay,
          "Print Time":   item.printTime,
          "Volume":       item.volume,
          "Printability": item.printability,
          "_file_name":   item.fileName,
        };

        if (item.customNote?.trim()) {
          properties["Order Note"] = item.customNote.trim();
        }
        if (item.isOversized) {
          properties["Oversized Part"] = "Yes - Requires Manual Review";
        }
        if (item.fileUrl) {
          properties["File Download Link"] = item.fileUrl;
        }

        return {
          title: `Custom 3D Print - ${item.fileName}`,
          quantity: item.quantity,
          price: item.pricePerUnitCents,
          weight_in_grams: item.weightInGrams,
          properties,
        };
      });

      const result = await createCheckout({
        items: lineItemsPayload,
      });

      if (result.success && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        throw new Error(result.error || "Failed to retrieve Shopify checkout URL.");
      }
    } catch (err: any) {
      console.error("Cart Checkout Error:", err);
      toast.error(err.message || "Checkout failed. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        isOpen,
        setIsOpen,
        totalCount,
        totalPriceCents,
        totalWeightGrams,
        isCheckingOut,
        checkoutCart,
        registerUploadTrigger,
        triggerUpload,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
