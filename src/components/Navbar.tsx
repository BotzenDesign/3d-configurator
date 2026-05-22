export default function Navbar() {
  return (
    <nav className="h-12 bg-panel-bg border-b border-border flex items-center px-4 gap-6 z-20">
      <a href="/" className="flex items-center gap-2">
        <div className="text-lg font-bold tracking-tight text-foreground uppercase">
          Botzen<span className="text-muted-foreground font-medium">Design</span>
        </div>
        <span className="text-[10px] font-semibold bg-secondary text-secondary-foreground border border-border px-2 py-0.5 rounded uppercase">Configurator</span>
      </a>
    </nav>
  );
}
