import { useCart } from "@/context/CartContext";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const { items, setIsOpen } = useCart();

  return (
    <nav className="h-12 bg-panel-bg border-b border-border flex items-center justify-between px-4 z-20">
      <a href="/" className="flex items-center gap-2">
        <img src="favicon.ico" className="h-10" alt="Botzen Logo" />
        <div className="text-lg font-bold tracking-tight text-foreground uppercase">
          Botzen<span className="text-muted-foreground font-medium">Design</span>
        </div>
        <span className="text-[10px] font-semibold bg-secondary text-secondary-foreground border border-border px-2 py-0.5 rounded uppercase">Configurator</span>
      </a>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 border-border/80 hover:border-primary/50 text-foreground font-semibold h-8 px-3"
      >
        <ShoppingCart className="w-4 h-4 text-primary" />
        <span className="text-xs">Queue</span>
        {items.length > 0 && (
          <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-primary text-primary-foreground leading-none">
            {items.length}
          </span>
        )}
      </Button>
    </nav>
  );
}
