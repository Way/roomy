"use client";

import { useState, useRef, useCallback } from "react";
import { Group, Line, Circle, Rect, Arc } from "react-konva";
import Konva from "konva";
import { Wall, Point, WallOpening } from "@/lib/types";
import { useFloorPlanStore } from "@/store/floor-plan-store";
import { computeSnap } from "@/lib/snapping";
import { distance, projectPointOnLine } from "@/lib/geometry";

interface EditableWallLineProps {
  wall: Wall;
  pixelsPerUnit: number;
}

export function EditableWallLine({
  wall,
  pixelsPerUnit,
}: EditableWallLineProps) {
  const [isHovered, setIsHovered] = useState(false);
  const dragStartRef = useRef<Point | null>(null);

  const {
    selectedTarget,
    setSelectedTarget,
    moveWallEndpoint,
    splitWall,
    pushHistory,
    floorPlan,
    snapEnabled,
    setAlignmentGuides,
    activeTool,
    updateWall,
    addWallOpening,
    updateWallOpening,
  } = useFloorPlanStore();

  const isSelected =
    selectedTarget?.type === "wall" && selectedTarget.id === wall.id;

  const x1 = wall.start.x * pixelsPerUnit;
  const y1 = wall.start.y * pixelsPerUnit;
  const x2 = wall.end.x * pixelsPerUnit;
  const y2 = wall.end.y * pixelsPerUnit;
  const thickness = Math.max(wall.thickness * pixelsPerUnit, 2);

  // Wall angle in degrees for rotating opening markers
  const wallAngleDeg = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

  const handleSelect = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // During drawing tools, let the click bubble up to the stage handler
      // so it can start/continue drawing with snap-to-wall
      if (activeTool === "draw-wall" || activeTool === "draw-room") {
        return;
      }

      e.cancelBubble = true;

      // Door/window placement tools - add opening at click position
      if (activeTool === "add-door" || activeTool === "add-window") {
        const stage = e.target.getStage();
        const pos = stage?.getRelativePointerPosition();
        if (pos) {
          const worldX = pos.x / pixelsPerUnit;
          const worldY = pos.y / pixelsPerUnit;
          const { t } = projectPointOnLine(
            { x: worldX, y: worldY },
            wall.start,
            wall.end
          );
          const clampedT = Math.max(0.05, Math.min(0.95, t));
          addWallOpening(
            wall.id,
            activeTool === "add-door" ? "door" : "window",
            clampedT
          );
        }
        return;
      }

      setSelectedTarget({ type: "wall", id: wall.id });
    },
    [wall.id, wall.start, wall.end, pixelsPerUnit, setSelectedTarget, activeTool, addWallOpening]
  );

  const handleDoubleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getRelativePointerPosition();
      if (!pos) return;

      const worldX = pos.x / pixelsPerUnit;
      const worldY = pos.y / pixelsPerUnit;
      const { projected } = projectPointOnLine(
        { x: worldX, y: worldY },
        wall.start,
        wall.end
      );
      splitWall(wall.id, projected);
    },
    [wall, pixelsPerUnit, splitWall]
  );

  const snapPoint = useCallback(
    (worldPoint: Point): Point => {
      if (!snapEnabled || !floorPlan) return worldPoint;
      const result = computeSnap(worldPoint, {
        snapToGrid: true,
        gridSize: 0.5,
        walls: floorPlan.walls,
        rooms: floorPlan.rooms,
        excludeIds: [wall.id],
      });
      setAlignmentGuides(result.guides);
      return result.snappedPoint;
    },
    [snapEnabled, floorPlan, wall.id, setAlignmentGuides]
  );

  const handleEndpointDrag = useCallback(
    (endpoint: "start" | "end") =>
      (e: Konva.KonvaEventObject<DragEvent>) => {
        const px = e.target.x() / pixelsPerUnit;
        const py = e.target.y() / pixelsPerUnit;
        const snapped = snapPoint({ x: px, y: py });
        e.target.x(snapped.x * pixelsPerUnit);
        e.target.y(snapped.y * pixelsPerUnit);
        moveWallEndpoint(wall.id, endpoint, snapped);
      },
    [wall.id, pixelsPerUnit, moveWallEndpoint, snapPoint]
  );

  const handleEndpointDragEnd = useCallback(() => {
    setAlignmentGuides([]);
    pushHistory();
  }, [setAlignmentGuides, pushHistory]);

  const handleWallDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      dragStartRef.current = {
        x: e.target.x(),
        y: e.target.y(),
      };
    },
    []
  );

  const handleWallDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!dragStartRef.current) return;
      const dx = (e.target.x() - dragStartRef.current.x) / pixelsPerUnit;
      const dy = (e.target.y() - dragStartRef.current.y) / pixelsPerUnit;

      // Reset group position
      e.target.x(0);
      e.target.y(0);

      if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;

      const newStart = snapPoint({
        x: wall.start.x + dx,
        y: wall.start.y + dy,
      });
      const newEnd = snapPoint({ x: wall.end.x + dx, y: wall.end.y + dy });

      moveWallEndpoint(wall.id, "start", newStart);
      moveWallEndpoint(wall.id, "end", newEnd);
      setAlignmentGuides([]);
      pushHistory();
      dragStartRef.current = null;
    },
    [wall, pixelsPerUnit, moveWallEndpoint, pushHistory, snapPoint, setAlignmentGuides]
  );

  // Handle opening drag along wall
  const handleOpeningDragMove = useCallback(
    (opening: WallOpening) => (e: Konva.KonvaEventObject<DragEvent>) => {
      const stage = e.target.getStage();
      const stagePos = stage?.getRelativePointerPosition();
      if (!stagePos) return;
      const worldPos = {
        x: stagePos.x / pixelsPerUnit,
        y: stagePos.y / pixelsPerUnit,
      };
      const { t } = projectPointOnLine(worldPos, wall.start, wall.end);
      const clampedT = Math.max(0.05, Math.min(0.95, t));
      const newX = x1 + (x2 - x1) * clampedT;
      const newY = y1 + (y2 - y1) * clampedT;
      e.target.x(newX);
      e.target.y(newY);
    },
    [wall.start, wall.end, x1, y1, x2, y2, pixelsPerUnit]
  );

  const handleOpeningDragEnd = useCallback(
    (opening: WallOpening) => (e: Konva.KonvaEventObject<DragEvent>) => {
      const stage = e.target.getStage();
      const stagePos = stage?.getRelativePointerPosition();
      if (!stagePos) return;
      const worldPos = {
        x: stagePos.x / pixelsPerUnit,
        y: stagePos.y / pixelsPerUnit,
      };
      const { t } = projectPointOnLine(worldPos, wall.start, wall.end);
      const clampedT = Math.max(0.05, Math.min(0.95, t));
      updateWallOpening(wall.id, opening.id, { position: clampedT });
      pushHistory();
    },
    [wall.id, wall.start, wall.end, pixelsPerUnit, updateWallOpening, pushHistory]
  );

  const openings = wall.openings ?? [];

  return (
    <Group>
      {/* Invisible hit region for easier clicking */}
      <Line
        points={[x1, y1, x2, y2]}
        stroke="transparent"
        strokeWidth={20}
        lineCap="round"
        onClick={handleSelect}
        onDblClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        hitStrokeWidth={20}
      />

      {/* Visible wall - draggable when selected */}
      <Line
        points={[x1, y1, x2, y2]}
        stroke={isSelected ? "#2563EB" : isHovered ? "#3B82F6" : "#1F2937"}
        strokeWidth={thickness}
        lineCap="round"
        listening={isSelected}
        draggable={isSelected}
        onDragStart={handleWallDragStart}
        onDragEnd={handleWallDragEnd}
      />

      {/* Openings (doors & windows) - rotated to match wall angle */}
      {openings.map((opening) => {
        const ox = x1 + (x2 - x1) * opening.position;
        const oy = y1 + (y2 - y1) * opening.position;
        const ow = opening.width * pixelsPerUnit;

        if (opening.type === "door") {
          const swing = opening.swingDirection ?? "left-in";
          const hingeLeft = swing.startsWith("left");
          const swingIn = swing.endsWith("-in");
          // Hinge position along wall edge
          const hx = hingeLeft ? -ow / 2 : ow / 2;
          // "in" swings toward positive Y (below wall in local coords), "out" toward negative Y
          const hy = swingIn ? thickness / 2 : -thickness / 2;
          // Arc rotation: angle where the arc starts (door closed = along wall)
          // Konva arcs sweep clockwise from the rotation angle
          let arcRotation: number;
          if (hingeLeft && swingIn) arcRotation = 0;
          else if (hingeLeft && !swingIn) arcRotation = 270;
          else if (!hingeLeft && swingIn) arcRotation = 90;
          else arcRotation = 180;

          return (
            <Group
              key={opening.id}
              x={ox}
              y={oy}
              rotation={wallAngleDeg}
              draggable={isSelected}
              onDragMove={handleOpeningDragMove(opening)}
              onDragEnd={handleOpeningDragEnd(opening)}
            >
              {/* Door break in wall */}
              <Rect
                x={-ow / 2}
                y={-thickness / 2}
                width={ow}
                height={thickness}
                fill="#F9FAFB"
                stroke="#9CA3AF"
                strokeWidth={1}
                listening={false}
              />
              {/* Filled quarter-circle sweep area */}
              <Arc
                x={hx}
                y={hy}
                innerRadius={0}
                outerRadius={ow}
                angle={90}
                rotation={arcRotation}
                fill="rgba(156, 163, 175, 0.08)"
                stroke="#9CA3AF"
                strokeWidth={0.5}
                dash={[4, 4]}
                listening={false}
              />
              {/* Door leaf line (open position, perpendicular to wall) */}
              <Line
                points={[
                  hx,
                  hy,
                  hx,
                  hy + (swingIn ? ow : -ow),
                ]}
                stroke="#9CA3AF"
                strokeWidth={1}
                listening={false}
              />
            </Group>
          );
        }

        // Window
        return (
          <Group
            key={opening.id}
            x={ox}
            y={oy}
            rotation={wallAngleDeg}
            draggable={isSelected}
            onDragMove={handleOpeningDragMove(opening)}
            onDragEnd={handleOpeningDragEnd(opening)}
          >
            {/* Wall break background */}
            <Rect
              x={-ow / 2}
              y={-thickness / 2}
              width={ow}
              height={thickness}
              fill="#EFF6FF"
              listening={false}
            />
            {/* Glass pane fill */}
            <Rect
              x={-ow / 2}
              y={-thickness / 4}
              width={ow}
              height={thickness / 2}
              fill="rgba(96, 165, 250, 0.25)"
              stroke="#3B82F6"
              strokeWidth={1.5}
              listening={false}
            />
            {/* Center line (glass division) */}
            <Line
              points={[-ow / 2, 0, ow / 2, 0]}
              stroke="#3B82F6"
              strokeWidth={1}
              listening={false}
            />
            {/* End ticks */}
            <Line
              points={[-ow / 2, -thickness / 2, -ow / 2, thickness / 2]}
              stroke="#3B82F6"
              strokeWidth={2}
              listening={false}
            />
            <Line
              points={[ow / 2, -thickness / 2, ow / 2, thickness / 2]}
              stroke="#3B82F6"
              strokeWidth={2}
              listening={false}
            />
          </Group>
        );
      })}

      {/* Endpoint handles */}
      {(isSelected || isHovered) && (
        <>
          <Circle
            x={x1}
            y={y1}
            radius={6}
            fill={isSelected ? "#2563EB" : "#93C5FD"}
            stroke="#fff"
            strokeWidth={1.5}
            draggable
            onDragMove={handleEndpointDrag("start")}
            onDragEnd={handleEndpointDragEnd}
            onClick={(e) => {
              e.cancelBubble = true;
              setSelectedTarget({
                type: "wall",
                id: wall.id,
                endpoint: "start",
              });
            }}
          />
          <Circle
            x={x2}
            y={y2}
            radius={6}
            fill={isSelected ? "#2563EB" : "#93C5FD"}
            stroke="#fff"
            strokeWidth={1.5}
            draggable
            onDragMove={handleEndpointDrag("end")}
            onDragEnd={handleEndpointDragEnd}
            onClick={(e) => {
              e.cancelBubble = true;
              setSelectedTarget({
                type: "wall",
                id: wall.id,
                endpoint: "end",
              });
            }}
          />
        </>
      )}
    </Group>
  );
}
