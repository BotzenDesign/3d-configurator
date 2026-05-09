/**
 * useQuote — Debounced real-time quote hook
 *
 * Calls /api/quote whenever the file, material, infill, or quantity changes.
 * Returns the full QuoteResult plus loading/error states.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export interface QuoteLineItem {
  label: string;
  amountUsd: number;
  note?: string;
}

export interface QuoteResult {
  lineItems: QuoteLineItem[];
  unitPriceUsd: number;
  quantity: number;
  discountPct: number;
  discountAmountUsd: number;
  totalUsd: number;
  perUnitUsd: number;
  display: {
    unitPrice: string;
    total: string;
    perUnit: string;
    discount: string;
    printTime: string;
    weight: string;
  };
  needsRepair: boolean;
  printabilityGrade: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'FAIL';
  printabilityScore: number;
  volumeBreakdown?: {
    modelMl: number;
    supportsMl: number;
    raftMl: number;
    totalMl: number;
  };
}

export interface UseQuoteOptions {
  file: File | null;
  material: string;
  infill: number;
  quantity: number;
  layerHeight?: number;
  debounceMs?: number;
}

export interface UseQuoteReturn {
  quote: QuoteResult | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useQuote({
  file,
  material,
  infill,
  quantity,
  layerHeight = 0.2,
  debounceMs = 600,
}: UseQuoteOptions): UseQuoteReturn {
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchQuote = useCallback(async () => {
    if (!file) {
      setQuote(null);
      return;
    }

    // Cancel previous request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('materialId', material);
      form.append('infillPercentage', String(infill));
      form.append('quantity', String(quantity));
      form.append('layerHeight', String(layerHeight));

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !anonKey) {
        throw new Error('Supabase environment variables missing in .env.local');
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/quote`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey
        },
        body: form,
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      setQuote(data.quote);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to get quote');
      }
    } finally {
      setIsLoading(false);
    }
  }, [file, material, infill, quantity, layerHeight]);

  // Debounced effect
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchQuote, debounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchQuote, debounceMs]);

  return { quote, isLoading, error, refetch: fetchQuote };
}
