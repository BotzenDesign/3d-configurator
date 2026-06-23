import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import Navbar from "@/components/Navbar";
import ModelViewer from "@/components/ModelViewer";
import ConfigPanel from "@/components/ConfigPanel";
import ModelSelector from "@/components/ModelSelector";
import ModelStats from "@/components/ModelStats";
import { parseSTL, computeStats } from "@/lib/stlParser";
import { parseOBJBuffer } from "@/lib/objParser";
import { parse3MF } from "@/lib/threemfParser";
import { validate3DFile } from "@/utils/fileValidation";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

// Preset model STL URLs (served from /public/models/)
const PRESET_MODELS: Record<string, string> = {
  bear:   '/models/bear.stl',
  mug:    '/models/mug.stl',
  helmet: '/models/helmet.stl',
};

const DEFAULT_STATS = {
  dimensions: "103.00mm x 54.00mm x 75.00mm",
  volume: "153.00cm³",
  surface: "207.00cm²",
  weight: "55.00g",
};

export default function Index() {
  const [modelType, setModelType] = useState("upload");
  const [modelName, setModelName] = useState("Fluid head mounting block.stl");
  const [color, setColor] = useState("#00bcd4");
  const [printType, setPrintType] = useState<"FDM" | "SLA">("FDM");
  const [uploadedGeometry, setUploadedGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [mobileTab, setMobileTab] = useState<"viewer" | "config">("viewer");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      try {
        let geometry: THREE.BufferGeometry;
        const ext = file.name.toLowerCase().split(".").pop();

        if (ext === "obj") {
          const result = parseOBJBuffer(buffer);
          geometry = result.geometry;
        } else if (ext === "3mf") {
          geometry = await parse3MF(buffer);
        } else {
          geometry = parseSTL(buffer);
        }

        const fileStats = computeStats(geometry);
        setUploadedGeometry(geometry);
        setUploadedFile(file);
        setStats(fileStats);
        setModelType("upload");
        setModelName(file.name);

        if (isMobile) setMobileTab("viewer");
      } catch (err) {
        console.error("Failed to parse 3D file:", err);
        toast.error("Failed to parse file. It may be corrupted or in an unsupported format.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, [isMobile]);

  // Load the default model on mount
  useEffect(() => {
    fetch('/models/default.stl')
      .then(res => {
        if (!res.ok) throw new Error("Default model not found");
        return res.blob();
      })
      .then(blob => {
        const file = new File([blob], 'Fluid head mounting block.stl', { type: 'application/octet-stream' });
        handleFileUpload(file);
      })
      .catch(err => console.log("No default model loaded:", err));
  }, [handleFileUpload]);

  const handleModelSelect = useCallback(async (id: string) => {
    // Only upload is used now
  }, []);

  const displayStats = {
    ...stats,
    weight: quoteData ? quoteData.display.weight : stats.weight,
  };

  const isOversized = useMemo(() => {
    if (!stats.dimensions || stats.dimensions === "0mm x 0mm x 0mm") return false;
    const dims = stats.dimensions.split('x').map(s => parseFloat(s)).filter(n => !isNaN(n));
    if (dims.length !== 3) return false;
    
    // Sort dimensions so that we check if the part CAN fit inside the bounding box in any orthogonal orientation
    const bv = printType === "FDM" ? { l: 330, w: 240, h: 300 } : { l: 200, w: 125, h: 210 };
    const bedDims = [bv.l, bv.w, bv.h].sort((a, b) => a - b);
    const partDims = dims.sort((a, b) => a - b);
    
    // Check if the part's smallest dimension fits in the bed's smallest dimension, etc.
    return partDims[0] > bedDims[0] || partDims[1] > bedDims[1] || partDims[2] > bedDims[2];
  }, [stats.dimensions, printType]);

  // ── Mobile Layout ──────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <Navbar />

        {/* Tab switcher */}
        <div className="flex bg-panel-bg border-b border-border">
          <button
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors touch-manipulation ${
              mobileTab === "viewer"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
            onClick={() => setMobileTab("viewer")}
          >
            3D Viewer
          </button>
          <button
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors touch-manipulation ${
              mobileTab === "config"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
            onClick={() => setMobileTab("config")}
          >
            Configure & Quote
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden relative">
          {mobileTab === "viewer" ? (
            <div className="w-full h-full relative">
              <ModelViewer
                modelType={modelType}
                color={color}
                geometry={uploadedGeometry}
                printType={printType}
                realDimensions={stats.dimensions}
              />
              <ModelStats {...displayStats} modelName={modelName} />
              <ModelSelector
                selected={modelType}
                onSelect={handleModelSelect}
                onUploadClick={() => fileInputRef.current?.click()}
              />
            </div>
          ) : (
            <div className="w-full h-full overflow-y-auto">
              <ConfigPanel
                onFileUpload={handleFileUpload}
                onColorChange={setColor}
                onPrintTypeChange={setPrintType}
                onQuoteUpdate={setQuoteData}
                selectedColor={color}
                modelStats={displayStats}
                modelName={modelName}
                uploadedFile={uploadedFile}
                isOversized={isOversized}
              />
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".stl,.obj,.3mf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const validation = validate3DFile(file);
              if (!validation.isValid) {
                toast.error(validation.error);
                return;
              }
              handleFileUpload(file);
            }
          }}
        />
      </div>
    );
  }

  // ── Desktop Layout ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <ConfigPanel
          onFileUpload={handleFileUpload}
          onColorChange={setColor}
          onPrintTypeChange={setPrintType}
          onQuoteUpdate={setQuoteData}
          selectedColor={color}
          modelStats={displayStats}
          modelName={modelName}
          uploadedFile={uploadedFile}
          isOversized={isOversized}
        />
        <div className="flex-1 relative">
          <ModelViewer
            modelType={modelType}
            color={color}
            geometry={uploadedGeometry}
            printType={printType}
            realDimensions={stats.dimensions}
            isOversized={isOversized}
          />
          <ModelStats {...displayStats} modelName={modelName} />
          <ModelSelector
            selected={modelType}
            onSelect={handleModelSelect}
            onUploadClick={() => fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".stl,.obj,.3mf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const validation = validate3DFile(file);
                if (!validation.isValid) {
                  toast.error(validation.error);
                  return;
                }
                handleFileUpload(file);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
