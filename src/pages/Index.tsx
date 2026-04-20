import { useState, useCallback, useRef } from "react";
import * as THREE from "three";
import Navbar from "@/components/Navbar";
import ModelViewer from "@/components/ModelViewer";
import ConfigPanel from "@/components/ConfigPanel";
import ModelSelector from "@/components/ModelSelector";
import ModelStats from "@/components/ModelStats";
import { parseSTL, computeStats } from "@/lib/stlParser";
import { parseOBJBuffer } from "@/lib/objParser";
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
  dimensions: "103mm x 54mm x 75mm",
  volume: "153cm³",
  surface: "207cm²",
  weight: "55g",
};

export default function Index() {
  const [modelType, setModelType] = useState("bear");
  const [modelName, setModelName] = useState("bear.stl");
  const [color, setColor] = useState("#00bcd4");
  const [uploadedGeometry, setUploadedGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [mobileTab, setMobileTab] = useState<"viewer" | "config">("viewer");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      try {
        let geometry: THREE.BufferGeometry;
        const ext = file.name.toLowerCase().split(".").pop();

        if (ext === "obj") {
          const result = parseOBJBuffer(buffer);
          geometry = result.geometry;
          toast.success(`OBJ loaded: ${result.vertexCount.toLocaleString()} vertices, ${result.faceCount.toLocaleString()} faces`);
        } else {
          geometry = parseSTL(buffer);
          const posAttr = geometry.getAttribute("position");
          const triCount = posAttr.count / 3;
          toast.success(`STL loaded: ${triCount.toLocaleString()} triangles`);
        }

        const fileStats = computeStats(geometry);
        setUploadedGeometry(geometry);
        setUploadedFile(file);
        setStats(fileStats);
        setModelType("upload");
        setModelName(file.name);

        // Switch to viewer tab on mobile after upload
        if (isMobile) setMobileTab("viewer");
      } catch (err) {
        console.error("Failed to parse 3D file:", err);
        toast.error("Failed to parse file. It may be corrupted or in an unsupported format.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, [isMobile]);

  // When a preset model is selected, fetch it as a File so the quote API fires
  const handleModelSelect = useCallback(async (id: string) => {
    if (id === "upload") return;
    setModelType(id);
    setModelName(`${id}.stl`);
    setUploadedGeometry(null);
    setStats(DEFAULT_STATS);

    // Try to fetch the preset STL and wire it into the quote engine
    const url = PRESET_MODELS[id];
    if (url) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], `${id}.stl`, { type: 'application/octet-stream' });
          setUploadedFile(file);
        }
      } catch {
        // Preset file not available — quote panel stays in empty state
        setUploadedFile(null);
      }
    } else {
      setUploadedFile(null);
    }
  }, []);

  // ── Mobile Layout ──────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col h-[100dvh] overflow-hidden">
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
              />
              <ModelStats {...stats} modelName={modelName} />
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
                selectedColor={color}
                modelStats={stats}
                modelName={modelName}
                uploadedFile={uploadedFile}
              />
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".stl,.obj"
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
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <ConfigPanel
          onFileUpload={handleFileUpload}
          onColorChange={setColor}
          selectedColor={color}
          modelStats={stats}
          modelName={modelName}
          uploadedFile={uploadedFile}
        />
        <div className="flex-1 relative">
          <ModelViewer
            modelType={modelType}
            color={color}
            geometry={uploadedGeometry}
          />
          <ModelStats {...stats} modelName={modelName} />
          <ModelSelector
            selected={modelType}
            onSelect={handleModelSelect}
            onUploadClick={() => fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".stl,.obj"
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
