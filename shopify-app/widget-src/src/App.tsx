import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useSearchParams } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import { Analytics } from "@vercel/analytics/react";

const queryClient = new QueryClient();

/**
 * IndexWrapper reads ?widget=1&shop=xxx from the URL so the iframe
 * integration works without modifying Index.tsx itself.
 */
function IndexWrapper() {
  const [params] = useSearchParams();
  const isWidget = params.get("widget") === "1";
  const shopDomain = params.get("shop") ?? "";

  // Optionally allow Supabase creds to be overridden via URL for the widget
  // (they are already baked into .env at build time; this is just a fallback)

  return <Index isWidget={isWidget} shopDomain={shopDomain} />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          {/* Configurator — widget mode auto-detected from ?widget=1 */}
          <Route path="/" element={<IndexWrapper />} />
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Analytics />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
