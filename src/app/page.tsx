"use client";

import dynamic from "next/dynamic";
import { FloorPlanUploader } from "@/components/FloorPlanUploader";
import { FurnitureLibrary } from "@/components/FurnitureLibrary";
import { PropertyPanel } from "@/components/PropertyPanel";
import { Separator } from "@/components/ui/separator";

const CalibrationDialog = dynamic(
  () =>
    import("@/components/CalibrationDialog").then((mod) => ({
      default: mod.CalibrationDialog,
    })),
  { ssr: false }
);

const DimensionEditOverlay = dynamic(
  () =>
    import("@/components/DimensionEditOverlay").then((mod) => ({
      default: mod.DimensionEditOverlay,
    })),
  { ssr: false }
);

const FloorPlanCanvas = dynamic(
  () =>
    import("@/components/FloorPlanCanvas").then((mod) => ({
      default: mod.FloorPlanCanvas,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-muted/30">
        <p className="text-sm text-muted-foreground">Loading canvas...</p>
      </div>
    ),
  }
);

export default function Home() {
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
        <h1 className="text-base font-semibold tracking-tight">Roomy</h1>
        <span className="text-xs text-muted-foreground">
          2D Room Planning Assistant
        </span>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-56 border-r border-border flex flex-col bg-background overflow-hidden">
          <FloorPlanUploader />
          <Separator />
          <div className="flex-1 overflow-hidden">
            <FurnitureLibrary />
          </div>
        </aside>

        {/* Center canvas */}
        <main className="flex-1 overflow-hidden relative">
          <FloorPlanCanvas />
          <DimensionEditOverlay />
          <CalibrationDialog />
        </main>

        {/* Right sidebar */}
        <aside className="w-56 border-l border-border bg-background overflow-y-auto">
          <PropertyPanel />
        </aside>
      </div>
    </div>
  );
}
