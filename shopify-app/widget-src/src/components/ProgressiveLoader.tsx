/**
 * ============================================================================
 * Progressive Loading Component
 * ============================================================================
 * Shows a staged loading experience while the 3D scene initializes:
 *   Stage 1: Skeleton shimmer animation
 *   Stage 2: Low-quality preview with blur
 *   Stage 3: Full-quality scene reveal
 * ============================================================================
 */

import { useState, useEffect } from "react";

interface ProgressiveLoaderProps {
  isLoaded: boolean;
  children: React.ReactNode;
}

export default function ProgressiveLoader({ isLoaded, children }: ProgressiveLoaderProps) {
  const [stage, setStage] = useState<"skeleton" | "loading" | "reveal" | "done">("skeleton");

  useEffect(() => {
    if (!isLoaded) {
      setStage("skeleton");
      return;
    }

    // Transition through stages
    setStage("loading");
    const t1 = setTimeout(() => setStage("reveal"), 200);
    const t2 = setTimeout(() => setStage("done"), 800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isLoaded]);

  return (
    <div className="relative w-full h-full">
      {/* Skeleton / Loading overlay */}
      {stage !== "done" && (
        <div
          className={`absolute inset-0 z-30 flex items-center justify-center transition-opacity duration-500 ${
            stage === "reveal" ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          style={{ background: "hsl(var(--viewer-bg))" }}
        >
          {stage === "skeleton" && (
            <div className="flex flex-col items-center gap-4">
              {/* Skeleton shimmer */}
              <div className="relative w-40 h-40 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-secondary/50 via-secondary/80 to-secondary/50 animate-shimmer" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-muted-foreground/30">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="h-2 w-32 bg-secondary/80 rounded-full animate-pulse" />
                <div className="h-2 w-20 bg-secondary/50 rounded-full animate-pulse" />
              </div>
            </div>
          )}

          {stage === "loading" && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground animate-pulse">
                Initializing 3D Scene...
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actual 3D content */}
      <div
        className={`w-full h-full transition-all duration-700 ${
          stage === "done" ? "blur-0 scale-100" : "blur-sm scale-[0.98]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
