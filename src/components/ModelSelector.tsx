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
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-10">
      {PRESETS.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all ${
            selected === m.id
              ? "bg-primary/20 ring-2 ring-primary"
              : "bg-secondary/80 hover:bg-secondary"
          }`}
          title={m.label}
        >
          {m.icon}
        </button>
      ))}
      <button
        onClick={onUploadClick}
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
          selected === "upload"
            ? "bg-primary/20 ring-2 ring-primary"
            : "bg-secondary/80 hover:bg-secondary"
        }`}
        title="Upload STL"
      >
        <Upload size={22} className="text-muted-foreground" />
      </button>
    </div>
  );
}
