import { Upload } from "lucide-react";

interface ModelSelectorProps {
  selected: string;
  onSelect: (id: string) => void;
  onUploadClick: () => void;
}

export default function ModelSelector({ selected, onUploadClick }: ModelSelectorProps) {
  return (
    <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex gap-2 sm:gap-3 z-10 w-[max-content] max-w-[95vw]">
      <button
        onClick={onUploadClick}
        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all shrink-0 shadow-lg border ${
          selected === "upload"
            ? "bg-white text-black border-white"
            : "bg-[hsl(var(--viewer-btn-bg))] text-white/80 border-[hsl(var(--viewer-card-border))] hover:bg-[hsl(var(--viewer-btn-hover))] hover:text-white"
        }`}
        title="Upload your 3D model"
      >
        <Upload className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
      </button>
    </div>
  );
}
