"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFloorPlanStore } from "@/store/floor-plan-store";
import { PlacedFurniture, FloorPlanData } from "@/lib/types";
import { contrastTextColor } from "@/lib/geometry";

const PrintFloorPlanRenderer = dynamic(
  () =>
    import("@/components/PrintFloorPlanRenderer").then(
      (mod) => mod.PrintFloorPlanRenderer
    ),
  { ssr: false }
);

interface PrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrintDialog({ open, onOpenChange }: PrintDialogProps) {
  const { floorPlan, furniture } = useFloorPlanStore();
  const hasFurniture = furniture.length > 0;

  const [includeFurniture, setIncludeFurniture] = useState(hasFurniture);
  const [includeCutouts, setIncludeCutouts] = useState(false);
  const [floorPlanImageUrl, setFloorPlanImageUrl] = useState<string | null>(
    null
  );
  const [printPPU, setPrintPPU] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const renderKeyRef = useRef(0);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const [previewContentWidth, setPreviewContentWidth] = useState(632);

  // The logical stage width (before pixelRatio upscaling)
  const stageWidth = useMemo(
    () => (floorPlan ? Math.ceil(floorPlan.overallWidth * printPPU) : 0),
    [floorPlan, printPPU]
  );

  // Scale factor so preview cut-outs match the preview image size
  const previewPPU = useMemo(() => {
    if (stageWidth <= 0) return printPPU;
    const scale = Math.min(1, previewContentWidth / stageWidth);
    return printPPU * scale;
  }, [printPPU, stageWidth, previewContentWidth]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setIncludeFurniture(hasFurniture);
      setIncludeCutouts(false);
      setFloorPlanImageUrl(null);
      setIsGenerating(true);
      renderKeyRef.current += 1;
    }
  }, [open, hasFurniture]);

  // Measure preview container width for scaling cut-outs to match image
  useEffect(() => {
    if (open && previewContentRef.current) {
      const measure = () => {
        if (previewContentRef.current) {
          setPreviewContentWidth(previewContentRef.current.clientWidth);
        }
      };
      // Measure after layout
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(previewContentRef.current);
      return () => ro.disconnect();
    }
  }, [open]);

  // Re-render when furniture toggle changes
  useEffect(() => {
    if (open && floorPlan) {
      setFloorPlanImageUrl(null);
      setIsGenerating(true);
      renderKeyRef.current += 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeFurniture]);

  const handleImageGenerated = useCallback(
    (dataUrl: string, ppu: number) => {
      setFloorPlanImageUrl(dataUrl);
      setPrintPPU(ppu);
      setIsGenerating(false);
    },
    []
  );

  const handlePrint = useCallback(() => {
    if (!floorPlanImageUrl || !floorPlan) return;

    const overlay = document.createElement("div");
    overlay.className = "print-overlay";

    // The floor plan image logical width (before pixelRatio upscaling).
    // Setting this as the CSS width ensures the image displays at printPPU
    // pixels-per-unit, matching the cut-out sizes exactly.
    const imgWidth = Math.ceil(floorPlan.overallWidth * printPPU);

    let cutoutsHtml = "";
    if (includeCutouts && furniture.length > 0) {
      const cutoutItems = furniture
        .map((item) => {
          const widthPx = item.width * printPPU;
          const heightPx = item.height * printPPU;
          const isCircle = item.shape === "circle";
          const unitLabel = floorPlan.units === "feet" ? "ft" : "m";

          return `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; break-inside: avoid;">
              <div style="
                width: ${widthPx}px;
                height: ${heightPx}px;
                background-color: ${item.color};
                border: 2px dashed #9CA3AF;
                border-radius: ${isCircle ? "50%" : "4px"};
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <span style="font-size: 10px; font-weight: 500; color: ${contrastTextColor(item.color)}; text-align: center;">${item.label}</span>
              </div>
              <span style="font-size: 9px; color: #6B7280; text-align: center;">
                ${item.width.toFixed(1)} × ${item.height.toFixed(1)} ${unitLabel}
              </span>
            </div>
          `;
        })
        .join("");

      cutoutsHtml = `
        <div class="print-page-break" style="width: ${imgWidth}px; padding: 16px; box-sizing: content-box;">
          <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 4px;">Furniture Cut-outs</h2>
          <p style="font-size: 12px; color: #6B7280; margin-bottom: 24px;">Cut along dashed lines. Same scale as floor plan.</p>
          <div style="display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-end;">
            ${cutoutItems}
          </div>
        </div>
      `;
    }

    const date = new Date().toLocaleDateString();
    const unitLabel = floorPlan.units === "feet" ? "ft" : "m";

    overlay.innerHTML = `
      <div style="padding: 16px;">
        <h1 style="font-size: 20px; font-weight: bold; margin-bottom: 4px;">Floor Plan</h1>
        <p style="font-size: 12px; color: #6B7280; margin-bottom: 16px;">
          ${floorPlan.overallWidth.toFixed(1)} × ${floorPlan.overallHeight.toFixed(1)} ${unitLabel} &middot; ${date}
        </p>
        <img src="${floorPlanImageUrl}" alt="Floor plan" style="width: ${imgWidth}px; height: auto;" />
      </div>
      ${cutoutsHtml}
    `;

    document.body.appendChild(overlay);
    document.body.classList.add("print-mode");

    const cleanup = () => {
      document.body.classList.remove("print-mode");
      if (overlay.parentNode) {
        document.body.removeChild(overlay);
      }
    };

    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  }, [floorPlanImageUrl, floorPlan, furniture, includeCutouts, printPPU]);

  if (!floorPlan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Print Floor Plan</DialogTitle>
          <DialogDescription>
            Preview and configure your print layout
          </DialogDescription>
        </DialogHeader>

        {/* Options */}
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="print-furniture"
              checked={includeFurniture}
              onCheckedChange={(checked) =>
                setIncludeFurniture(checked === true)
              }
              disabled={!hasFurniture}
            />
            <Label
              htmlFor="print-furniture"
              className={!hasFurniture ? "text-muted-foreground" : ""}
            >
              Show furniture on plan
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="print-cutouts"
              checked={includeCutouts}
              onCheckedChange={(checked) => setIncludeCutouts(checked === true)}
              disabled={!hasFurniture}
            />
            <Label
              htmlFor="print-cutouts"
              className={!hasFurniture ? "text-muted-foreground" : ""}
            >
              Include cut-out sheet
            </Label>
          </div>
        </div>

        {/* Preview */}
        <ScrollArea className="flex-1 min-h-0 border rounded-md bg-muted/30">
          <div className="p-6 space-y-6">
            {/* Page 1: Floor Plan */}
            <div ref={previewContentRef} className="bg-white shadow-sm rounded-lg p-6 mx-auto max-w-[680px]">
              <div className="mb-4">
                <h2 className="text-base font-bold">Floor Plan</h2>
                <p className="text-xs text-muted-foreground">
                  {floorPlan.overallWidth.toFixed(1)} ×{" "}
                  {floorPlan.overallHeight.toFixed(1)}{" "}
                  {floorPlan.units === "feet" ? "ft" : "m"} &middot;{" "}
                  {new Date().toLocaleDateString()}
                </p>
              </div>

              {isGenerating ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Generating preview...
                    </p>
                  </div>
                </div>
              ) : floorPlanImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={floorPlanImageUrl}
                  alt="Floor plan preview"
                  className="mx-auto"
                  style={{ width: stageWidth, maxWidth: "100%", height: "auto" }}
                />
              ) : (
                <div className="bg-muted rounded flex items-center justify-center h-48">
                  <p className="text-sm text-muted-foreground">
                    No preview available
                  </p>
                </div>
              )}
            </div>

            {/* Page 2: Cut-outs */}
            {includeCutouts && hasFurniture && (
              <div className="bg-white shadow-sm rounded-lg p-6 mx-auto max-w-[680px]">
                <div className="mb-4">
                  <h2 className="text-base font-bold">Furniture Cut-outs</h2>
                  <p className="text-xs text-muted-foreground">
                    Cut along dashed lines. Same scale as floor plan.
                  </p>
                </div>
                <FurnitureCutoutsPreview
                  furniture={furniture}
                  pixelsPerUnit={previewPPU}
                  units={floorPlan.units}
                />
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePrint} disabled={!floorPlanImageUrl || isGenerating}>
            Print
          </Button>
        </DialogFooter>

        {/* Hidden Konva renderer */}
        {open && floorPlan && (
          <PrintFloorPlanRenderer
            key={renderKeyRef.current}
            floorPlan={floorPlan}
            furniture={includeFurniture ? furniture : []}
            onImageGenerated={handleImageGenerated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FurnitureCutoutsPreview({
  furniture,
  pixelsPerUnit,
  units,
}: {
  furniture: PlacedFurniture[];
  pixelsPerUnit: number;
  units: FloorPlanData["units"];
}) {
  const unitLabel = units === "feet" ? "ft" : "m";

  return (
    <div className="flex flex-wrap gap-6 items-end">
      {furniture.map((item) => {
        const widthPx = item.width * pixelsPerUnit;
        const heightPx = item.height * pixelsPerUnit;
        const isCircle = item.shape === "circle";

        return (
          <div
            key={item.id}
            className="flex flex-col items-center gap-1"
            style={{ breakInside: "avoid" }}
          >
            <div
              className="border-2 border-dashed border-gray-400 flex items-center justify-center"
              style={{
                width: `${widthPx}px`,
                height: `${heightPx}px`,
                backgroundColor: item.color,
                borderRadius: isCircle ? "50%" : "4px",
              }}
            >
              <span
                className="text-[10px] font-medium text-center leading-tight px-1"
                style={{ color: contrastTextColor(item.color) }}
              >
                {item.label}
              </span>
            </div>
            <span className="text-[9px] text-gray-500 text-center">
              {item.width.toFixed(1)} × {item.height.toFixed(1)} {unitLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
