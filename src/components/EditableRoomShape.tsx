"use client";

import { useState, useCallback, useRef } from "react";
import { Group, Line, Circle, Text, RegularPolygon } from "react-konva";
import Konva from "konva";
import { Room, Point } from "@/lib/types";
import { useFloorPlanStore } from "@/store/floor-plan-store";
import { flattenVertices, polygonCentroid, midpoint } from "@/lib/geometry";
import { computeSnap } from "@/lib/snapping";

interface EditableRoomShapeProps {
  room: Room;
  pixelsPerUnit: number;
}

export function EditableRoomShape({
  room,
  pixelsPerUnit,
}: EditableRoomShapeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const dragStartRef = useRef<Point | null>(null);

  const {
    selectedTarget,
    setSelectedTarget,
    moveRoomVertex,
    updateRoom,
    pushHistory,
    floorPlan,
    snapEnabled,
    setAlignmentGuides,
  } = useFloorPlanStore();

  const isSelected =
    selectedTarget?.type === "room" && selectedTarget.id === room.id;

  const scaledVertices = room.vertices.map((v) => ({
    x: v.x * pixelsPerUnit,
    y: v.y * pixelsPerUnit,
  }));
  const centroid = polygonCentroid(scaledVertices);
  const points = flattenVertices(scaledVertices);

  const snapPoint = useCallback(
    (worldPoint: Point): Point => {
      if (!snapEnabled || !floorPlan) return worldPoint;
      const result = computeSnap(worldPoint, {
        snapToGrid: true,
        gridSize: 0.5,
        walls: floorPlan.walls,
        rooms: floorPlan.rooms,
        excludeIds: [room.id],
      });
      setAlignmentGuides(result.guides);
      return result.snappedPoint;
    },
    [snapEnabled, floorPlan, room.id, setAlignmentGuides]
  );

  const handleSelect = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      setSelectedTarget({ type: "room", id: room.id });
    },
    [room.id, setSelectedTarget]
  );

  const handleVertexDrag = useCallback(
    (vertexIndex: number) =>
      (e: Konva.KonvaEventObject<DragEvent>) => {
        const worldX = e.target.x() / pixelsPerUnit;
        const worldY = e.target.y() / pixelsPerUnit;
        const snapped = snapPoint({ x: worldX, y: worldY });
        e.target.x(snapped.x * pixelsPerUnit);
        e.target.y(snapped.y * pixelsPerUnit);
        moveRoomVertex(room.id, vertexIndex, snapped);
      },
    [room.id, pixelsPerUnit, moveRoomVertex, snapPoint]
  );

  const handleVertexDragEnd = useCallback(() => {
    setAlignmentGuides([]);
    pushHistory();
  }, [setAlignmentGuides, pushHistory]);

  // Insert vertex at edge midpoint
  const handleMidpointClick = useCallback(
    (afterIndex: number) => (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      const nextIndex = (afterIndex + 1) % room.vertices.length;
      const mid = midpoint(room.vertices[afterIndex], room.vertices[nextIndex]);
      const newVertices = [...room.vertices];
      newVertices.splice(afterIndex + 1, 0, mid);
      updateRoom(room.id, { vertices: newVertices });
    },
    [room, updateRoom]
  );

  // Body drag to translate entire room
  const handleBodyDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      dragStartRef.current = { x: e.target.x(), y: e.target.y() };
    },
    []
  );

  const handleBodyDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!dragStartRef.current) return;
      const dx = (e.target.x() - dragStartRef.current.x) / pixelsPerUnit;
      const dy = (e.target.y() - dragStartRef.current.y) / pixelsPerUnit;

      e.target.x(0);
      e.target.y(0);

      if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;

      const newVertices = room.vertices.map((v) => ({
        x: v.x + dx,
        y: v.y + dy,
      }));
      updateRoom(room.id, { vertices: newVertices });
      setAlignmentGuides([]);
      dragStartRef.current = null;
    },
    [room, pixelsPerUnit, updateRoom, setAlignmentGuides]
  );

  const strokeColor = isSelected
    ? "#2563EB"
    : isHovered
    ? "#3B82F6"
    : room.color.replace("0.3)", "0.6)");

  return (
    <Group>
      {/* Room polygon */}
      <Line
        points={points}
        closed
        fill={room.color}
        stroke={strokeColor}
        strokeWidth={isSelected ? 2 : 1}
        onClick={handleSelect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        draggable={isSelected}
        onDragStart={handleBodyDragStart}
        onDragEnd={handleBodyDragEnd}
      />

      {/* Room name label */}
      <Text
        x={centroid.x - 40}
        y={centroid.y - 12}
        width={80}
        text={room.name}
        fontSize={11}
        fontStyle="bold"
        fill="#374151"
        align="center"
        listening={false}
      />

      {/* Room area label */}
      {room.area > 0 && (
        <Text
          x={centroid.x - 40}
          y={centroid.y + 2}
          width={80}
          text={`${room.area} sq m`}
          fontSize={9}
          fill="#6B7280"
          align="center"
          listening={false}
        />
      )}

      {/* Vertex handles (shown when selected or hovered) */}
      {(isSelected || isHovered) &&
        scaledVertices.map((v, i) => (
          <Circle
            key={`vertex-${i}`}
            x={v.x}
            y={v.y}
            radius={5}
            fill={isSelected ? "#2563EB" : "#93C5FD"}
            stroke="#fff"
            strokeWidth={1.5}
            draggable
            onDragMove={handleVertexDrag(i)}
            onDragEnd={handleVertexDragEnd}
            onClick={(e) => {
              e.cancelBubble = true;
              setSelectedTarget({
                type: "room",
                id: room.id,
                vertexIndex: i,
              });
            }}
          />
        ))}

      {/* Midpoint handles for inserting vertices (shown only when selected) */}
      {isSelected &&
        scaledVertices.map((v, i) => {
          const next = scaledVertices[(i + 1) % scaledVertices.length];
          const mid = { x: (v.x + next.x) / 2, y: (v.y + next.y) / 2 };
          return (
            <RegularPolygon
              key={`mid-${i}`}
              x={mid.x}
              y={mid.y}
              sides={4}
              radius={4}
              fill="#93C5FD"
              stroke="#fff"
              strokeWidth={1}
              rotation={45}
              onClick={handleMidpointClick(i)}
              onMouseEnter={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = "pointer";
              }}
              onMouseLeave={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = "";
              }}
            />
          );
        })}
    </Group>
  );
}
