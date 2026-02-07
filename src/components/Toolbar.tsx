"use client";

import { useRef, useState, useEffect } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import Konva from "konva";
import { EditorTool } from "@/lib/types";
import { toast } from "sonner";
import { PrintDialog } from "@/components/PrintDialog";
import {
  MousePointer2,
  Minus,
  Pentagon,
  DoorOpen,
  Grid2x2,
  Ruler,
  Undo2,
  Redo2,
  Grid3x3,
  Magnet,
  Image,
  ZoomOut,
  ZoomIn,
  RotateCcw,
  Save,
  FolderOpen,
  Share2,
  Download,
  Printer,
  Ellipsis,
  type LucideIcon,
} from "lucide-react";

interface ToolbarProps {
  stageRef: React.RefObject<Konva.Stage | null>;
}

const tools: { tool: EditorTool; label: string; shortcut: string; icon: LucideIcon }[] = [
  { tool: "select", label: "Select", shortcut: "V", icon: MousePointer2 },
  { tool: "draw-wall", label: "Draw Wall", shortcut: "W", icon: Minus },
  { tool: "draw-room", label: "Draw Room", shortcut: "R", icon: Pentagon },
  { tool: "add-door", label: "Add Door", shortcut: "D", icon: DoorOpen },
  { tool: "add-window", label: "Add Window", shortcut: "N", icon: Grid2x2 },
  { tool: "calibrate", label: "Calibrate", shortcut: "C", icon: Ruler },
];

// Space reserved for the overflow "more" button so it doesn't cause extra reflow
const MORE_BTN_WIDTH = 44;

function useOverflowGroups(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [overflowed, setOverflowed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const groups = container.querySelectorAll<HTMLElement>("[data-toolbar-group]");
      const containerRight = container.getBoundingClientRect().right;
      const next = new Set<string>();
      let anyOverflow = false;

      // First pass: is anything clipped at all?
      for (const group of groups) {
        if (group.getBoundingClientRect().right > containerRight + 1) {
          anyOverflow = true;
          break;
        }
      }

      if (anyOverflow) {
        // Second pass: account for the more button width
        const effectiveRight = containerRight - MORE_BTN_WIDTH;
        for (const group of groups) {
          if (group.getBoundingClientRect().right > effectiveRight + 1) {
            const id = group.dataset.toolbarGroup;
            if (id) next.add(id);
          }
        }
      }

      setOverflowed((prev) => {
        if (prev.size !== next.size || [...next].some((id) => !prev.has(id))) {
          return next;
        }
        return prev;
      });
    };

    const ro = new ResizeObserver(update);
    ro.observe(container);
    // Catch child additions/removals (e.g. Overlay button appearing)
    const mo = new MutationObserver(update);
    mo.observe(container, { childList: true, subtree: true });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [containerRef]);

  return overflowed;
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const overflowedGroups = useOverflowGroups(containerRef);
  const hasOverflow = overflowedGroups.size > 0;

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const hasCalibrateTarget = floorPlan && (floorPlan.walls.length > 0 || floorPlan.rooms.length > 0);

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
    e.target.value = "";
  };

  // Which overflow groups follow the current one (for separator logic)
  const groupOrder = ["tools", "history", "view", "zoom", "actions"] as const;
  const hasMoreAfter = (id: string) =>
    groupOrder.slice(groupOrder.indexOf(id as (typeof groupOrder)[number]) + 1).some((g) => overflowedGroups.has(g));

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center bg-background border-b border-border">
        {/* Overflow-clipped toolbar area */}
        <div
          ref={containerRef}
          className="flex items-center gap-1 px-3 py-1.5 flex-1 min-w-0 overflow-hidden"
        >
          {/* Tools */}
          <div data-toolbar-group="tools" className={`flex items-center gap-1 shrink-0${overflowedGroups.has("tools") ? " invisible" : ""}`}>
            {tools.map((t) => {
              const disabled = t.tool === "calibrate" && !hasCalibrateTarget;
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
                      <t.icon className="size-3.5" />
                      {t.label}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t.label} ({t.shortcut})
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* History */}
          <div data-toolbar-group="history" className={`flex items-center gap-1 shrink-0${overflowedGroups.has("history") ? " invisible" : ""}`}>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={undo} disabled={!canUndo}>
                  <Undo2 className="size-3.5" />
                  Undo
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={redo} disabled={!canRedo}>
                  <Redo2 className="size-3.5" />
                  Redo
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
            </Tooltip>
          </div>

          {/* View toggles */}
          <div data-toolbar-group="view" className={`flex items-center gap-1 shrink-0${overflowedGroups.has("view") ? " invisible" : ""}`}>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={showGrid ? "secondary" : "ghost"} size="sm" className="h-7 px-2 text-xs" onClick={toggleGrid}>
                  <Grid3x3 className="size-3.5" />
                  Grid
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle grid</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={snapEnabled ? "secondary" : "ghost"} size="sm" className="h-7 px-2 text-xs" onClick={toggleSnap}>
                  <Magnet className="size-3.5" />
                  Snap
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle snap to grid</TooltipContent>
            </Tooltip>
            {uploadedImage && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant={showImageOverlay ? "secondary" : "ghost"} size="sm" className="h-7 px-2 text-xs" onClick={toggleImageOverlay}>
                    <Image className="size-3.5" />
                    Overlay
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle floor plan image overlay</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Zoom */}
          <div data-toolbar-group="zoom" className={`flex items-center gap-1 shrink-0${overflowedGroups.has("zoom") ? " invisible" : ""}`}>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setZoom(zoom - 0.1)} disabled={zoom <= 0.2}>
                  <ZoomOut className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom out</TooltipContent>
            </Tooltip>
            <span className="text-xs text-muted-foreground min-w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setZoom(zoom + 0.1)} disabled={zoom >= 5}>
                  <ZoomIn className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom in</TooltipContent>
            </Tooltip>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setZoom(1)}>
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          </div>

          {/* Spacer */}
          <div className="flex-1 shrink min-w-0" />

          {/* File actions */}
          <div data-toolbar-group="actions" className={`flex items-center gap-1 shrink-0${overflowedGroups.has("actions") ? " invisible" : ""}`}>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={saveToFile}>
              <Save className="size-3.5" />
              Save
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => loadInputRef.current?.click()}>
              <FolderOpen className="size-3.5" />
              Load
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handleShare} disabled={!floorPlan && furniture.length === 0}>
                  <Share2 className="size-3.5" />
                  Share
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy shareable link to clipboard</TooltipContent>
            </Tooltip>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handleExport}>
              <Download className="size-3.5" />
              Export PNG
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setShowPrintDialog(true)} disabled={!floorPlan}>
              <Printer className="size-3.5" />
              Print
            </Button>
          </div>
        </div>

        {/* Overflow "more" button — sits outside the clipped area */}
        {hasOverflow && (
          <div className="shrink-0 pr-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <Ellipsis className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {overflowedGroups.has("tools") && (
                  <>
                    <DropdownMenuLabel>Tools</DropdownMenuLabel>
                    {tools.map((t) => {
                      const disabled = t.tool === "calibrate" && !hasCalibrateTarget;
                      return (
                        <DropdownMenuItem key={t.tool} onClick={() => setActiveTool(t.tool)} disabled={disabled}>
                          <t.icon className="size-4" />
                          {t.label}
                          <span className="ml-auto text-xs text-muted-foreground">{t.shortcut}</span>
                        </DropdownMenuItem>
                      );
                    })}
                    {hasMoreAfter("tools") && <DropdownMenuSeparator />}
                  </>
                )}

                {overflowedGroups.has("history") && (
                  <>
                    <DropdownMenuItem onClick={undo} disabled={!canUndo}>
                      <Undo2 className="size-4" />
                      Undo
                      <span className="ml-auto text-xs text-muted-foreground">Ctrl+Z</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={redo} disabled={!canRedo}>
                      <Redo2 className="size-4" />
                      Redo
                      <span className="ml-auto text-xs text-muted-foreground">Ctrl+Shift+Z</span>
                    </DropdownMenuItem>
                    {hasMoreAfter("history") && <DropdownMenuSeparator />}
                  </>
                )}

                {overflowedGroups.has("view") && (
                  <>
                    <DropdownMenuCheckboxItem checked={showGrid} onCheckedChange={() => toggleGrid()}>
                      Grid
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={snapEnabled} onCheckedChange={() => toggleSnap()}>
                      Snap
                    </DropdownMenuCheckboxItem>
                    {uploadedImage && (
                      <DropdownMenuCheckboxItem checked={showImageOverlay} onCheckedChange={() => toggleImageOverlay()}>
                        Overlay
                      </DropdownMenuCheckboxItem>
                    )}
                    {hasMoreAfter("view") && <DropdownMenuSeparator />}
                  </>
                )}

                {overflowedGroups.has("zoom") && (
                  <>
                    <DropdownMenuItem onClick={() => setZoom(zoom - 0.1)} disabled={zoom <= 0.2}>
                      <ZoomOut className="size-4" />
                      Zoom Out
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setZoom(zoom + 0.1)} disabled={zoom >= 5}>
                      <ZoomIn className="size-4" />
                      Zoom In
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setZoom(1)}>
                      <RotateCcw className="size-4" />
                      Reset Zoom
                    </DropdownMenuItem>
                    {hasMoreAfter("zoom") && <DropdownMenuSeparator />}
                  </>
                )}

                {overflowedGroups.has("actions") && (
                  <>
                    <DropdownMenuItem onClick={saveToFile}>
                      <Save className="size-4" />
                      Save
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => loadInputRef.current?.click()}>
                      <FolderOpen className="size-4" />
                      Load
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleShare} disabled={!floorPlan && furniture.length === 0}>
                      <Share2 className="size-4" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExport}>
                      <Download className="size-4" />
                      Export PNG
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowPrintDialog(true)} disabled={!floorPlan}>
                      <Printer className="size-4" />
                      Print
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Hidden file input for Load */}
        <input
          ref={loadInputRef}
          type="file"
          accept=".json,.roomy.json"
          className="hidden"
          onChange={handleLoad}
        />
      </div>

      <PrintDialog
        open={showPrintDialog}
        onOpenChange={setShowPrintDialog}
      />
    </TooltipProvider>
  );
}
