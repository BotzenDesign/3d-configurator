import { useState, useCallback, useRef } from "react";
import * as THREE from "three";
import Navbar from "@/components/Navbar";
import ModelViewer from "@/components/ModelViewer";
import ConfigPanel from "@/components/ConfigPanel";
import ModelSelector from "@/components/ModelSelector";
import ModelStats from "@/components/ModelStats";
import { parseSTL, computeStats } from "@/lib/stlParser";

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
  const [stats, setStats] = useState(DEFAULT_STATS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      try {
        const geometry = parseSTL(buffer);
        const fileStats = computeStats(geometry);
        setUploadedGeometry(geometry);
        setStats(fileStats);
        setModelType("upload");
        setModelName(file.name);
      } catch (err) {
        console.error("Failed to parse STL:", err);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleModelSelect = useCallback((id: string) => {
    if (id === "upload") return;
    setModelType(id);
    setUploadedGeometry(null);
    setStats(DEFAULT_STATS);
  }, []);

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
        />
        <div className="flex-1 relative">
          <ModelViewer
            modelType={modelType}
            color={color}
            geometry={uploadedGeometry}
          />
          <ModelStats {...stats} />
          <ModelSelector
            selected={modelType}
            onSelect={handleModelSelect}
            onUploadClick={() => fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".stl"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
        </div>
      </div>
    </div>
  );
}
