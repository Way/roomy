"use client";

import { useRef } from "react";
import { useFloorPlanStore } from "@/store/floor-plan-store";
import { RoomySaveFileSchema } from "@/store/floor-plan-store";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Konva from "konva";
import { EditorTool } from "@/lib/types";
import { toast } from "sonner";

interface ToolbarProps {
  stageRef: React.RefObject<Konva.Stage | null>;
}

const tools: { tool: EditorTool; label: string; shortcut: string; icon: string }[] = [
  { tool: "select", label: "Select", shortcut: "V", icon: "↖" },
  { tool: "draw-wall", label: "Draw Wall", shortcut: "W", icon: "┃" },
  { tool: "draw-room", label: "Draw Room", shortcut: "R", icon: "⬠" },
  { tool: "add-door", label: "Add Door", shortcut: "D", icon: "🚪" },
  { tool: "add-window", label: "Add Window", shortcut: "N", icon: "⊞" },
  { tool: "calibrate", label: "Calibrate", shortcut: "C", icon: "📏" },
];

export function Toolbar({ stageRef }: ToolbarProps) {
  const {
    zoom,
    setZoom,
    showGrid,
    toggleGrid,
    snapEnabled,
    toggleSnap,
    undo,
    redo,
    historyIndex,
    history,
    showImageOverlay,
    toggleImageOverlay,
    uploadedImage,
    activeTool,
    setActiveTool,
    floorPlan,
    saveToFile,
    loadFromFile,
    shareToUrl,
    furniture,
  } = useFloorPlanStore();

  const loadInputRef = useRef<HTMLInputElement>(null);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleExport = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const uri = stage.toDataURL({ pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = "floor-plan.png";
    link.href = uri;
    link.click();
  };

  const handleShare = async () => {
    try {
      const url = shareToUrl();
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard!");
    } catch {
      toast.error("Failed to copy share link");
    }
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        const parsed = RoomySaveFileSchema.parse(json);
        loadFromFile(parsed);
      } catch (err) {
        alert("Invalid .roomy.json file: " + (err instanceof Error ? err.message : "Unknown error"));
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be loaded again
    e.target.value = "";
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 px-3 py-1.5 bg-background border-b border-border">
        {/* Tool selection */}
        {tools.map((t) => {
          const disabled = t.tool === "calibrate" && (!floorPlan || (floorPlan.walls.length === 0 && floorPlan.rooms.length === 0));
          return (
            <Tooltip key={t.tool}>
              <TooltipTrigger asChild>
                <Button
                  variant={activeTool === t.tool ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setActiveTool(t.tool)}
                  disabled={disabled}
                >
                  <span className="mr-1">{t.icon}</span>
                  {t.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t.label} ({t.shortcut})
              </TooltipContent>
            </Tooltip>
          );
        })}

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={undo}
              disabled={!canUndo}
            >
              Undo
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={redo}
              disabled={!canRedo}
            >
              Redo
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showGrid ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={toggleGrid}
            >
              Grid
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle grid</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={snapEnabled ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={toggleSnap}
            >
              Snap
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle snap to grid</TooltipContent>
        </Tooltip>

        {uploadedImage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showImageOverlay ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={toggleImageOverlay}
              >
                Overlay
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle floor plan image overlay</TooltipContent>
          </Tooltip>
        )}

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setZoom(zoom - 0.1)}
              disabled={zoom <= 0.2}
            >
              -
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom out</TooltipContent>
        </Tooltip>

        <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setZoom(zoom + 0.1)}
              disabled={zoom >= 5}
            >
              +
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom in</TooltipContent>
        </Tooltip>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setZoom(1)}
        >
          Reset
        </Button>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={saveToFile}
        >
          Save
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => loadInputRef.current?.click()}
        >
          Load
        </Button>
        <input
          ref={loadInputRef}
          type="file"
          accept=".json,.roomy.json"
          className="hidden"
          onChange={handleLoad}
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleShare}
              disabled={!floorPlan && furniture.length === 0}
            >
              Share
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy shareable link to clipboard</TooltipContent>
        </Tooltip>

        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={handleExport}
        >
          Export PNG
        </Button>
      </div>
    </TooltipProvider>
  );
}
