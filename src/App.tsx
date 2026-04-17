import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<ComingSoon />} />
          
          {/* Private Development Link */}
          <Route path="/configurator" element={<Index />} />
          
          {/* Catch-all */}
          <Route path="*" element={<LinkToConfigurator />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

// Helper to handle 404s or redirects if needed
const LinkToConfigurator = () => {
  // If we are in dev, maybe show a hint, otherwise NotFound
  if (import.meta.env.DEV) {
    return (
      <div className="min-h-screen bg-black text-white p-20">
        <h1 className="text-2xl mb-4">404 - Page Not Found</h1>
        <p className="mb-4">Development shortcuts:</p>
        <a href="/configurator" className="text-primary underline">Go to Configurator</a>
      </div>
    );
  }
  return <NotFound />;
};

export default App;
