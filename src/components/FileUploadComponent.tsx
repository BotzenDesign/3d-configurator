import React, { useCallback, useRef, useState, useEffect } from "react";
import { Upload, FileType, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { validate3DFile, MAX_FILE_SIZE_MB } from "@/utils/fileValidation";

interface FileUploadComponentProps {
  onFileAccepted: (file: File) => void;
  className?: string;
}

export default function FileUploadComponent({ onFileAccepted, className = "" }: FileUploadComponentProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    setUploadProgress(0);

    const validation = validate3DFile(file);
    if (!validation.isValid) {
      setError(validation.error || "Invalid file");
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    const formData = new FormData();
    formData.append("file", file);

    // Simulated progress tick while network requests
    let simulatedProgress = 10;
    const interval = setInterval(() => {
      if (simulatedProgress < 85) {
        simulatedProgress += Math.random() * 10;
        setUploadProgress(Math.floor(simulatedProgress));
      }
    }, 200);

    fetch("/api/validate", {
      method: "POST",
      body: formData,
    })
      .then(async (res) => {
        clearInterval(interval);
        
        const data = await res.json();
        
        if (!res.ok || !data.isValid) {
          throw new Error(data.message || data.errors?.[0] || "Validation failed on server.");
        }

        setUploadProgress(100);
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          onFileAccepted(file);
        }, 500);
      })
      .catch((err) => {
        clearInterval(interval);
        setIsUploading(false);
        setUploadProgress(0);
        setError(err.message);
      });

  }, [onFileAccepted]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      if (isUploading) return;
      
      const file = e.dataTransfer.files[0];
      if (file) {
        processFile(file);
      }
    },
    [isUploading, processFile]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
          isDragging ? "border-primary bg-primary/10 scale-[1.02]" : "border-border hover:bg-muted/50 hover:border-muted-foreground/50"
        } ${isUploading ? "pointer-events-none opacity-80" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isUploading) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload 3D model file"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
      >
        {!isUploading ? (
          <>
            <Upload className={`mx-auto mb-3 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} size={32} />
            <p className="text-sm font-medium mb-1">Drag &amp; Drop your 3D model</p>
            <p className="text-xs text-muted-foreground mb-3">OR</p>
            <button 
              className="text-sm font-medium bg-background border border-border rounded-md px-4 py-1.5 hover:bg-secondary transition-colors"
              type="button"
            >
              Browse Files
            </button>
            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><FileType size={12} /> .STL, .OBJ</span>
              <span>Max {MAX_FILE_SIZE_MB}MB</span>
            </div>
          </>
        ) : (
          <div className="py-4">
            <Loader2 className="mx-auto mb-3 text-primary animate-spin" size={32} />
            <p className="text-sm font-medium mb-3">Processing File...</p>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-75 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{uploadProgress}% complete</p>
          </div>
        )}
        
        <input
          ref={fileRef}
          type="file"
          accept=".stl,.obj"
          className="hidden"
          onChange={handleChange}
          aria-hidden="true"
        />
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2 text-left animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={16} className="text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-xs text-destructive leading-snug">{error}</p>
        </div>
      )}
    </div>
  );
}

// Temporary icon fallback if missing in lucide-react install
function Loader2({ className, size }: { className?: string, size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
