import { useCallback } from "react";
import { useFloorPlanStore } from "@/store/floor-plan-store";
import { furnitureCatalog } from "@/lib/furniture-catalog";
import { v4 as uuidv4 } from "uuid";
import { PlacedFurniture } from "@/lib/types";
import { rasterizeSvgToBase64Png } from "@/lib/rasterize-svg";

export function useAnalyzeFloorPlan() {
  const {
    setFloorPlan,
    setIsAnalyzing,
    setAnalysisError,
    setAnalysisProgress,
    uploadedImage,
  } = useFloorPlanStore();

  const analyze = useCallback(async () => {
    if (!uploadedImage) {
      setAnalysisError("No image uploaded");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisProgress("Reading dimensions...");

    try {
      // Extract base64 data and media type from data URL
      const match = uploadedImage.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
      if (!match) {
        throw new Error("Invalid image format");
      }

      let [, mediaType, base64Data] = match;

      // SVG is not supported by Claude's vision API — rasterize to PNG
      if (mediaType === "image/svg+xml") {
        try {
          const rasterized = await rasterizeSvgToBase64Png(uploadedImage);
          base64Data = rasterized.base64Data;
          mediaType = rasterized.mediaType;
        } catch {
          throw new Error(
            "Failed to convert SVG to PNG for analysis. Try uploading a PNG or JPG instead."
          );
        }
      }

      setAnalysisProgress("Extracting dimensions & layout...");

      const response = await fetch("/api/analyze-floorplan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Data, mediaType }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Analysis failed");
      }

      setAnalysisProgress("Building floor plan...");

      const result = await response.json();
      setFloorPlan(result.floorPlan);

      // Auto-place detected furniture
      if (result.detectedFurniture?.length > 0) {
        const store = useFloorPlanStore.getState();
        const newFurniture: PlacedFurniture[] = result.detectedFurniture.map(
          (df: { type: string; label: string; x: number; y: number; width: number; height: number }) => {
            const catalogItem = furnitureCatalog.find((c) => c.type === df.type);
            return {
              id: uuidv4(),
              definitionType: df.type,
              label: df.label || catalogItem?.label || df.type,
              x: df.x,
              y: df.y,
              width: df.width || catalogItem?.defaultWidth || 3,
              height: df.height || catalogItem?.defaultHeight || 3,
              rotation: 0,
              color: catalogItem?.color || "#888888",
              shape: catalogItem?.shape || "rect",
            } satisfies PlacedFurniture;
          }
        );

        useFloorPlanStore.setState({
          furniture: [...store.furniture, ...newFurniture],
        });
        useFloorPlanStore.getState().pushHistory();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Analysis failed";
      setAnalysisError(message);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(null);
    }
  }, [uploadedImage, setFloorPlan, setIsAnalyzing, setAnalysisError, setAnalysisProgress]);

  return { analyze };
}
