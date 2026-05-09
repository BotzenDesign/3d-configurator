export default function Navbar() {
  return (
    <nav className="h-12 bg-panel-bg border-b border-border flex items-center px-4 gap-6 z-20">
      <a href="/" className="flex items-center gap-2">
        <div className="text-lg font-bold tracking-tight text-foreground">
          3D<span className="text-primary">PRINT</span>
        </div>
        <span className="text-xs font-semibold bg-primary/20 text-primary px-2 py-0.5 rounded">BETA</span>
      </a>
    </nav>
  );
}
