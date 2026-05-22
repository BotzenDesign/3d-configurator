import { Upload } from "lucide-react";

const PRESETS = [
  { id: "bear", label: "bear.stl", icon: "🐻" },
  { id: "mug", label: "mug.stl", icon: "☕" },
  { id: "helmet", label: "helmet.stl", icon: "⛑️" },
];

interface ModelSelectorProps {
  selected: string;
  onSelect: (id: string) => void;
  onUploadClick: () => void;
}

export default function ModelSelector({ selected, onSelect, onUploadClick }: ModelSelectorProps) {
  return (
    <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex gap-2 sm:gap-3 z-10 w-[max-content] max-w-[95vw]">
      {PRESETS.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-xl sm:text-2xl transition-all shrink-0 border shadow-sm ${
            selected === m.id
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-foreground border-border hover:border-foreground/30"
          }`}
          title={m.label}
        >
          {m.icon}
        </button>
      ))}
      <button
        onClick={onUploadClick}
        className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all shrink-0 border shadow-sm ${
          selected === "upload"
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card text-foreground border-border hover:border-foreground/30"
        }`}
        title="Upload STL"
      >
        <Upload className={`w-5 h-5 sm:w-[22px] sm:h-[22px] ${selected === "upload" ? "text-primary-foreground" : "text-muted-foreground"}`} />
      </button>
    </div>
  );
}
