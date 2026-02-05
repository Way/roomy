"use client";

import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { Stage, Layer, Line, Rect, Circle, Image as KonvaImage } from "react-konva";
import Konva from "konva";
import { useFloorPlanStore } from "@/store/floor-plan-store";
import { EditableRoomShape } from "./EditableRoomShape";
import { EditableWallLine } from "./EditableWallLine";
import { DimensionLabel } from "./DimensionLabel";
import { FurnitureItem } from "./FurnitureItem";
import { Toolbar } from "./Toolbar";
import { AlignmentGuides } from "./AlignmentGuides";
import { DrawingPreview } from "./DrawingPreview";
import { GRID_SIZE_METERS } from "@/lib/geometry";
import { computeSnap } from "@/lib/snapping";
import { recalculateRoomArea } from "@/lib/vertex-utils";
import { Point } from "@/lib/types";

const ROOM_COLORS = [
  "rgba(59,130,246,0.3)",
  "rgba(34,197,94,0.3)",
  "rgba(234,179,8,0.3)",
  "rgba(239,68,68,0.3)",
  "rgba(168,85,247,0.3)",
  "rgba(249,115,22,0.3)",
  "rgba(6,182,212,0.3)",
  "rgba(236,72,153,0.3)",
];

export function FloorPlanCanvas() {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [overlayImage, setOverlayImage] = useState<HTMLImageElement | null>(
    null
  );
  const [spaceHeld, setSpaceHeld] = useState(false);

  const {
    floorPlan,
    furniture,
    selectedFurnitureId,
    selectFurniture,
    zoom,
    setZoom,
    panOffset,
    setPanOffset,
    showGrid,
    pixelsPerUnit,
    showImageOverlay,
    uploadedImage,
    activeTool,
    setActiveTool,
    selectedTarget,
    setSelectedTarget,
    clearSelection,
    drawState,
    setDrawState,
    setAlignmentGuides,
    addWall,
    addRoom,
    deleteWall,
    deleteRoom,
    removeFurniture,
    splitWall,
    snapEnabled,
    pushHistory,
    setPixelsPerUnit,
    calibrationPoints,
    setCalibrationPoints,
  } = useFloorPlanStore();

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Auto-fit floor plan to canvas when first loaded
  const prevFloorPlanRef = useRef<string | null>(null);
  useEffect(() => {
    if (!floorPlan || dimensions.width === 0 || dimensions.height === 0) return;
    // Only auto-fit when the floor plan identity changes (new analysis)
    const fpKey = `${floorPlan.overallWidth}x${floorPlan.overallHeight}:${floorPlan.rooms.length}`;
    if (prevFloorPlanRef.current === fpKey) return;
    prevFloorPlanRef.current = fpKey;

    const padding = 60; // px padding around the floor plan
    const availW = dimensions.width - padding * 2;
    const availH = dimensions.height - padding * 2;
    const ppu = Math.min(availW / floorPlan.overallWidth, availH / floorPlan.overallHeight);
    setPixelsPerUnit(Math.max(10, Math.floor(ppu)));
    // Center the floor plan in the canvas
    const planW = floorPlan.overallWidth * ppu;
    const planH = floorPlan.overallHeight * ppu;
    setPanOffset({
      x: (dimensions.width - planW) / 2,
      y: (dimensions.height - planH) / 2,
    });
    setZoom(1);
  }, [floorPlan, dimensions, setPixelsPerUnit, setPanOffset, setZoom]);

  // Load overlay image
  useEffect(() => {
    if (!uploadedImage || !showImageOverlay) {
      setOverlayImage(null);
      return;
    }
    const img = new window.Image();
    img.src = uploadedImage;
    img.onload = () => setOverlayImage(img);
  }, [uploadedImage, showImageOverlay]);

  // Stretch overlay image to fill exact floor plan bounds
  // The AI maps (0,0)→top-left and (overallWidth,overallHeight)→bottom-right,
  // so the image must fill the same coordinate space exactly.
  const overlayDimensions = useMemo(() => {
    if (!overlayImage || !floorPlan) return null;
    return {
      x: 0,
      y: 0,
      width: floorPlan.overallWidth * pixelsPerUnit,
      height: floorPlan.overallHeight * pixelsPerUnit,
    };
  }, [overlayImage, floorPlan, pixelsPerUnit]);

  // Snap helper
  const snapPoint = useCallback(
    (raw: Point, angleFrom?: Point): Point => {
      if (!snapEnabled) return raw;
      const extraSnapPoints =
        drawState?.tool === "draw-room" && drawState.points.length >= 3
          ? [drawState.points[0]]
          : undefined;
      const result = computeSnap(raw, {
        snapToGrid: true,
        gridSize: GRID_SIZE_METERS,
        walls: floorPlan?.walls ?? [],
        rooms: floorPlan?.rooms ?? [],
        excludeIds: [],
        angleSnapFrom: angleFrom,
        extraSnapPoints,
      });
      setAlignmentGuides(result.guides);
      return result.snappedPoint;
    },
    [snapEnabled, floorPlan, setAlignmentGuides, drawState]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Space for pan
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }

      // Tool shortcuts
      if (!e.metaKey && !e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case "v":
            setActiveTool("select");
            return;
          case "w":
            setActiveTool("draw-wall");
            return;
          case "r":
            setActiveTool("draw-room");
            return;
          case "d":
            setActiveTool("add-door");
            return;
          case "n":
            setActiveTool("add-window");
            return;
          case "c":
            setActiveTool("calibrate");
            return;
        }
      }

      // Escape
      if (e.key === "Escape") {
        const store = useFloorPlanStore.getState();
        if (store.activeTool === "calibrate") {
          store.setCalibrationPoints(null);
          store.setActiveTool("select");
          return;
        }
        if (drawState) {
          setDrawState(null);
          setAlignmentGuides([]);
        } else {
          clearSelection();
        }
        return;
      }

      // Backspace in draw-room removes last point
      if (e.key === "Backspace" && drawState?.tool === "draw-room") {
        e.preventDefault();
        if (drawState.points.length > 1) {
          setDrawState({
            ...drawState,
            points: drawState.points.slice(0, -1),
          });
        } else {
          setDrawState(null);
        }
        return;
      }

      // Delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        if (e.target instanceof HTMLInputElement) return;
        const store = useFloorPlanStore.getState();
        if (store.selectedTarget) {
          if (store.selectedTarget.type === "wall") {
            deleteWall(store.selectedTarget.id);
          } else if (store.selectedTarget.type === "room") {
            deleteRoom(store.selectedTarget.id);
          }
        } else if (store.selectedFurnitureId) {
          removeFurniture(store.selectedFurnitureId);
        }
        return;
      }

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          useFloorPlanStore.getState().redo();
        } else {
          useFloorPlanStore.getState().undo();
        }
        return;
      }

      // Arrow key nudge
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const store = useFloorPlanStore.getState();
        const hasSelection = store.selectedTarget || store.selectedFurnitureId;
        if (!hasSelection) return;
        e.preventDefault();
        const delta = e.shiftKey ? 0.5 : 0.1;
        const dx =
          e.key === "ArrowLeft" ? -delta : e.key === "ArrowRight" ? delta : 0;
        const dy =
          e.key === "ArrowUp" ? -delta : e.key === "ArrowDown" ? delta : 0;

        if (store.selectedFurnitureId) {
          const item = store.furniture.find(
            (f) => f.id === store.selectedFurnitureId
          );
          if (item) {
            store.updateFurniture(item.id, {
              x: item.x + dx,
              y: item.y + dy,
            });
            store.pushHistory();
          }
        } else if (store.selectedTarget && store.floorPlan) {
          if (store.selectedTarget.type === "wall") {
            const wall = store.floorPlan.walls.find(
              (w) => w.id === store.selectedTarget!.id
            );
            if (wall) {
              store.moveWallEndpoint(wall.id, "start", {
                x: wall.start.x + dx,
                y: wall.start.y + dy,
              });
              store.moveWallEndpoint(wall.id, "end", {
                x: wall.end.x + dx,
                y: wall.end.y + dy,
              });
              store.pushHistory();
            }
          } else if (store.selectedTarget.type === "room") {
            const room = store.floorPlan.rooms.find(
              (r) => r.id === store.selectedTarget!.id
            );
            if (room) {
              store.updateRoom(room.id, {
                vertices: room.vertices.map((v) => ({
                  x: v.x + dx,
                  y: v.y + dy,
                })),
              });
            }
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceHeld(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    drawState,
    setDrawState,
    setActiveTool,
    clearSelection,
    setAlignmentGuides,
    deleteWall,
    deleteRoom,
    removeFurniture,
  ]);

  // Mouse wheel zoom
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const scaleBy = 1.05;
      const newZoom = e.evt.deltaY < 0 ? zoom * scaleBy : zoom / scaleBy;
      setZoom(newZoom);
    },
    [zoom, setZoom]
  );

  // Get world coordinates from stage event
  const getWorldPos = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>): Point | null => {
      const stage = stageRef.current;
      if (!stage) return null;
      const pos = stage.getRelativePointerPosition();
      if (!pos) return null;
      return { x: pos.x / pixelsPerUnit, y: pos.y / pixelsPerUnit };
    },
    [pixelsPerUnit]
  );

  // Stage click handler - routes to tool-specific logic
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const clickedOnStage = e.target === e.target.getStage();

      // For drawing tools, allow clicks on existing shapes so we can snap to them
      const isDrawingTool = activeTool === "draw-wall" || activeTool === "draw-room";
      if (!clickedOnStage && !isDrawingTool) return;

      const worldPos = getWorldPos(e);
      if (!worldPos) return;

      if (activeTool === "select") {
        clearSelection();
        return;
      }

      if (activeTool === "draw-wall") {
        const lastPoint = drawState?.points[drawState.points.length - 1];
        const snapped = snapPoint(worldPos, lastPoint);

        if (!drawState || drawState.tool !== "draw-wall") {
          // Start new wall
          setDrawState({ tool: "draw-wall", points: [snapped] });
        } else if (drawState.points.length === 1) {
          // Complete wall
          const start = drawState.points[0];
          addWall({
            start,
            end: snapped,
            thickness: 0.1,
            hasWindow: false,
            hasDoor: false,
            openings: [],
          });
          // Chain: start next wall from this endpoint
          setDrawState({ tool: "draw-wall", points: [snapped] });
          setAlignmentGuides([]);
        }
        return;
      }

      if (activeTool === "draw-room") {
        const snapped = snapPoint(worldPos);

        if (!drawState || drawState.tool !== "draw-room") {
          setDrawState({ tool: "draw-room", points: [snapped] });
        } else {
          // Check if clicking near the first point to close
          const firstPoint = drawState.points[0];
          const dist = Math.sqrt(
            (snapped.x - firstPoint.x) ** 2 + (snapped.y - firstPoint.y) ** 2
          );

          if (drawState.points.length >= 3 && dist < 0.5) {
            // Close the polygon
            const roomCount = floorPlan?.rooms.length ?? 0;
            const color = ROOM_COLORS[roomCount % ROOM_COLORS.length];
            addRoom({
              name: `Room ${roomCount + 1}`,
              vertices: drawState.points,
              area: recalculateRoomArea(drawState.points),
              color,
              estimatedUse: "general",
            });
            setDrawState(null);
            setAlignmentGuides([]);
          } else {
            // Add vertex
            setDrawState({
              ...drawState,
              points: [...drawState.points, snapped],
            });
          }
        }
        return;
      }

      // Door/window tool - handled by wall click, so clicking empty space does nothing
      if (activeTool === "add-door" || activeTool === "add-window") {
        return;
      }

      if (activeTool === "calibrate") {
        const store = useFloorPlanStore.getState();
        if (!store.calibrationPoints) {
          setCalibrationPoints({ first: worldPos });
        } else if (!store.calibrationPoints.second) {
          setCalibrationPoints({ ...store.calibrationPoints, second: worldPos });
        }
        return;
      }
    },
    [
      activeTool,
      drawState,
      floorPlan,
      getWorldPos,
      snapPoint,
      clearSelection,
      setDrawState,
      setAlignmentGuides,
      addWall,
      addRoom,
      setCalibrationPoints,
    ]
  );

  // Double-click to close room
  const handleStageDblClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool === "draw-room" && drawState?.tool === "draw-room") {
        if (drawState.points.length >= 3) {
          const roomCount = floorPlan?.rooms.length ?? 0;
          const color = ROOM_COLORS[roomCount % ROOM_COLORS.length];
          addRoom({
            name: `Room ${roomCount + 1}`,
            vertices: drawState.points,
            area: recalculateRoomArea(drawState.points),
            color,
            estimatedUse: "general",
          });
          setDrawState(null);
          setAlignmentGuides([]);
        }
      }
    },
    [activeTool, drawState, floorPlan, addRoom, setDrawState, setAlignmentGuides]
  );

  // Mouse move for drawing preview
  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!drawState) return;
      const worldPos = getWorldPos(e);
      if (!worldPos) return;

      const lastPoint = drawState.points[drawState.points.length - 1];
      const snapped = snapPoint(
        worldPos,
        drawState.tool === "draw-wall" ? lastPoint : undefined
      );

      setDrawState({ ...drawState, previewPoint: snapped });
    },
    [drawState, getWorldPos, snapPoint, setDrawState]
  );

  // Cursor based on tool
  const getCursor = () => {
    if (spaceHeld) return "grab";
    switch (activeTool) {
      case "draw-wall":
      case "draw-room":
      case "calibrate":
        return "crosshair";
      case "add-door":
      case "add-window":
        return "pointer";
      default:
        return "default";
    }
  };

  // Grid
  const gridLines: { points: number[]; key: string }[] = [];
  if (showGrid) {
    const gridPx = GRID_SIZE_METERS * pixelsPerUnit;
    const totalW = floorPlan
      ? floorPlan.overallWidth * pixelsPerUnit
      : dimensions.width / zoom;
    const totalH = floorPlan
      ? floorPlan.overallHeight * pixelsPerUnit
      : dimensions.height / zoom;

    for (let x = 0; x <= totalW; x += gridPx) {
      gridLines.push({ points: [x, 0, x, totalH], key: `gv-${x}` });
    }
    for (let y = 0; y <= totalH; y += gridPx) {
      gridLines.push({ points: [0, y, totalW, y], key: `gh-${y}` });
    }
  }

  const totalWidth = floorPlan?.overallWidth ?? 40;
  const totalHeight = floorPlan?.overallHeight ?? 30;

  return (
    <div className="flex flex-col h-full">
      <Toolbar stageRef={stageRef} />
      <div
        ref={containerRef}
        className="flex-1 bg-white overflow-hidden relative"
        style={{ cursor: getCursor() }}
      >
        {dimensions.width > 0 && (
          <Stage
            ref={stageRef}
            width={dimensions.width}
            height={dimensions.height}
            scaleX={zoom}
            scaleY={zoom}
            x={panOffset.x}
            y={panOffset.y}
            draggable={spaceHeld}
            onDragEnd={(e) => {
              if (e.target === stageRef.current) {
                setPanOffset({ x: e.target.x(), y: e.target.y() });
              }
            }}
            onWheel={handleWheel}
            onClick={handleStageClick}
            onDblClick={handleStageDblClick}
            onMouseMove={handleStageMouseMove}
          >
            {/* Grid layer */}
            <Layer>
              {gridLines.map((line) => (
                <Line
                  key={line.key}
                  points={line.points}
                  stroke="#E5E7EB"
                  strokeWidth={0.5}
                  listening={false}
                />
              ))}
            </Layer>

            {/* Image overlay layer - preserves original aspect ratio */}
            {showImageOverlay && overlayImage && overlayDimensions && (
              <Layer opacity={0.3}>
                <KonvaImage
                  image={overlayImage}
                  x={overlayDimensions.x}
                  y={overlayDimensions.y}
                  width={overlayDimensions.width}
                  height={overlayDimensions.height}
                  listening={false}
                />
              </Layer>
            )}

            {/* Floor plan layer (rooms, walls, dimensions) */}
            {floorPlan && (
              <Layer>
                {floorPlan.rooms.map((room) => (
                  <EditableRoomShape
                    key={room.id}
                    room={room}
                    pixelsPerUnit={pixelsPerUnit}
                  />
                ))}
                {floorPlan.walls.map((wall) => (
                  <EditableWallLine
                    key={wall.id}
                    wall={wall}
                    pixelsPerUnit={pixelsPerUnit}
                  />
                ))}
                {floorPlan.walls.map((wall) => (
                  <DimensionLabel
                    key={`dim-${wall.id}`}
                    wall={wall}
                    pixelsPerUnit={pixelsPerUnit}
                    units={floorPlan.units}
                    isDrawing={activeTool !== "select"}
                  />
                ))}
              </Layer>
            )}

            {/* Alignment guides */}
            <AlignmentGuides
              totalWidth={totalWidth}
              totalHeight={totalHeight}
              pixelsPerUnit={pixelsPerUnit}
            />

            {/* Drawing preview */}
            <DrawingPreview pixelsPerUnit={pixelsPerUnit} />

            {/* Calibration preview */}
            {activeTool === "calibrate" && calibrationPoints && (
              <Layer>
                <Circle
                  x={calibrationPoints.first.x * pixelsPerUnit}
                  y={calibrationPoints.first.y * pixelsPerUnit}
                  radius={6 / zoom}
                  fill="rgba(59,130,246,0.8)"
                  listening={false}
                />
                {calibrationPoints.second && (
                  <>
                    <Circle
                      x={calibrationPoints.second.x * pixelsPerUnit}
                      y={calibrationPoints.second.y * pixelsPerUnit}
                      radius={6 / zoom}
                      fill="rgba(59,130,246,0.8)"
                      listening={false}
                    />
                    <Line
                      points={[
                        calibrationPoints.first.x * pixelsPerUnit,
                        calibrationPoints.first.y * pixelsPerUnit,
                        calibrationPoints.second.x * pixelsPerUnit,
                        calibrationPoints.second.y * pixelsPerUnit,
                      ]}
                      stroke="rgba(59,130,246,0.8)"
                      strokeWidth={2 / zoom}
                      dash={[6 / zoom, 4 / zoom]}
                      listening={false}
                    />
                  </>
                )}
              </Layer>
            )}

            {/* Furniture layer */}
            <Layer>
              {furniture.map((item) => (
                <FurnitureItem
                  key={item.id}
                  item={item}
                  pixelsPerUnit={pixelsPerUnit}
                  isSelected={item.id === selectedFurnitureId}
                />
              ))}
            </Layer>

            {/* Outline border for floor plan */}
            {floorPlan && (
              <Layer>
                <Rect
                  x={0}
                  y={0}
                  width={floorPlan.overallWidth * pixelsPerUnit}
                  height={floorPlan.overallHeight * pixelsPerUnit}
                  stroke="#9CA3AF"
                  strokeWidth={1}
                  dash={[4, 4]}
                  listening={false}
                />
              </Layer>
            )}
          </Stage>
        )}

        {/* Calibration instruction toast */}
        {activeTool === "calibrate" && (!calibrationPoints?.second) && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/90 border border-border rounded-md px-3 py-1.5 text-xs text-foreground shadow-sm pointer-events-none">
            {!calibrationPoints ? "Click the first point" : "Click the second point"}
          </div>
        )}

        {/* Empty state */}
        {!floorPlan && furniture.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">No floor plan loaded</p>
              <p className="text-sm mt-1">
                Upload a floor plan image, or press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">W</kbd> to start drawing walls
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
