import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Index from "./src/pages/Index";

// We need the global styles
import "./src/index.css";

// Store configuration globally so components can access it
export const WidgetConfig = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  shopDomain: "",
  accentColor: "#0ea5e9",
  buttonText: "Proceed to Checkout",
};

const queryClient = new QueryClient();

function initWidget() {
  const rootElement = document.getElementById("polar-3d-root");
  
  if (!rootElement) {
    console.warn("Polar 3D Widget: Root element #polar-3d-root not found.");
    return;
  }

  // Read config from data attributes
  WidgetConfig.supabaseUrl = rootElement.getAttribute("data-supabase-url") || "";
  WidgetConfig.supabaseAnonKey = rootElement.getAttribute("data-supabase-key") || "";
  WidgetConfig.shopDomain = rootElement.getAttribute("data-shop") || "";
  WidgetConfig.accentColor = rootElement.getAttribute("data-accent-color") || "#0ea5e9";
  WidgetConfig.buttonText = rootElement.getAttribute("data-primary-button-text") || "Proceed to Checkout";

  // Apply custom CSS variables if needed based on settings
  document.documentElement.style.setProperty("--primary", WidgetConfig.accentColor);

  const root = ReactDOM.createRoot(rootElement);
  
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          {/* We do NOT wrap in BrowserRouter because this is an embedded widget on a Shopify page */}
          <div className="polar-3d-widget-wrapper text-foreground bg-background h-[800px] w-full max-w-7xl mx-auto rounded-xl overflow-hidden shadow-2xl border border-border">
            <Index isWidget={true} shopDomain={WidgetConfig.shopDomain} />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

// Initialize when the DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWidget);
} else {
  initWidget();
}
