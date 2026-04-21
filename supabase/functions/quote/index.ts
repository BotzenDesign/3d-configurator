import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { fileValidationService } from "../../../server/services/fileValidationService.ts";
import { geometryAnalysisService } from "../../../server/services/geometryAnalysisService.ts";
import { pricingService } from "../../../server/services/pricingService.ts";
import { materialEstimationEngine, MaterialId } from "../../../server/services/materialEstimationEngine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const materialId = (formData.get("materialId") as MaterialId) || "PLA";
    const infillPercentage = parseInt((formData.get("infillPercentage") as string) || "20");
    const quantity = parseInt((formData.get("quantity") as string) || "1");

    if (!file) {
      throw new Error("No file uploaded. Must provide 'file' in multipart/form-data.");
    }

    const fileBuffer = new Uint8Array(await file.arrayBuffer());

    // 1. Validate File
    const validation = await fileValidationService.validateFile(
      fileBuffer,
      file.name,
      file.size
    );

    if (!validation.isValid) {
      return new Response(
        JSON.stringify({ error: "File validation failed", details: validation }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Geometry Analysis
    const fileType = validation.metadata!.fileType as "STL" | "OBJ";
    const geometry = await geometryAnalysisService.analyzeBuffer(fileBuffer, fileType);

    // 3. Material & Time Estimation
    const estimation = materialEstimationEngine.estimate({
      volumeCm3: geometry.volumeCm3,
      surfaceAreaCm2: geometry.surfaceAreaCm2,
      boundingBox: geometry.boundingBox,
      materialId: materialId,
      infill: {
        percentage: infillPercentage,
        pattern: "grid",
        shellCount: 2,
        topBottomLayers: 4,
      },
      needsSupport: false, 
    });

    // 4. Final Pricing Quote
    const quote = pricingService.quote(geometry, estimation, quantity);

    return new Response(
      JSON.stringify({
        success: true,
        validation,
        geometry,
        estimation,
        quote,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
