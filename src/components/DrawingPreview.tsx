"use client";

import { Layer, Line, Circle, Text } from "react-konva";
import { useFloorPlanStore } from "@/store/floor-plan-store";
import { distance, flattenVertices } from "@/lib/geometry";

interface DrawingPreviewProps {
  pixelsPerUnit: number;
}

export function DrawingPreview({ pixelsPerUnit }: DrawingPreviewProps) {
  const { drawState, floorPlan } = useFloorPlanStore();

  if (!drawState || drawState.points.length === 0) return null;

  const scaledPoints = drawState.points.map((p) => ({
    x: p.x * pixelsPerUnit,
    y: p.y * pixelsPerUnit,
  }));

  const previewScaled = drawState.previewPoint
    ? {
        x: drawState.previewPoint.x * pixelsPerUnit,
        y: drawState.previewPoint.y * pixelsPerUnit,
      }
    : null;

  const units = floorPlan?.units === "feet" ? "ft" : "m";

  // Completed edges
  const completedFlat = flattenVertices(scaledPoints);

  // Preview edge from last point to cursor
  const lastPoint = scaledPoints[scaledPoints.length - 1];
  const previewLength = previewScaled
    ? distance(
        drawState.points[drawState.points.length - 1],
        drawState.previewPoint!
      )
    : 0;

  // Close indicator for room drawing
  const isRoom = drawState.tool === "draw-room";
  const firstPoint = scaledPoints[0];
  const closeDistance = previewScaled
    ? distance(
        { x: previewScaled.x / pixelsPerUnit, y: previewScaled.y / pixelsPerUnit },
        drawState.points[0]
      )
    : Infinity;
  const nearClose = isRoom && drawState.points.length >= 3 && closeDistance < 0.5;

  return (
    <Layer listening={false}>
      {/* Completed edges */}
      {scaledPoints.length >= 2 && (
        <Line
          points={completedFlat}
          stroke="#2563EB"
          strokeWidth={2}
          dash={[8, 4]}
          closed={false}
        />
      )}

      {/* Fill preview for rooms */}
      {isRoom && scaledPoints.length >= 3 && (
        <Line
          points={completedFlat}
          closed
          fill="rgba(59,130,246,0.1)"
          stroke="transparent"
        />
      )}

      {/* Preview edge to cursor */}
      {previewScaled && (
        <Line
          points={[lastPoint.x, lastPoint.y, previewScaled.x, previewScaled.y]}
          stroke="#2563EB"
          strokeWidth={1}
          dash={[4, 4]}
          opacity={0.6}
        />
      )}

      {/* Close line for room (from cursor to first point) */}
      {isRoom && previewScaled && scaledPoints.length >= 2 && (
        <Line
          points={[
            previewScaled.x,
            previewScaled.y,
            firstPoint.x,
            firstPoint.y,
          ]}
          stroke={nearClose ? "#22C55E" : "#2563EB"}
          strokeWidth={1}
          dash={[4, 4]}
          opacity={0.4}
        />
      )}

      {/* Vertex dots */}
      {scaledPoints.map((p, i) => (
        <Circle
          key={i}
          x={p.x}
          y={p.y}
          radius={i === 0 && nearClose ? 8 : 4}
          fill={i === 0 && nearClose ? "#22C55E" : "#2563EB"}
          stroke="#fff"
          strokeWidth={1}
        />
      ))}

      {/* Length annotation on preview edge */}
      {previewScaled && previewLength > 0.1 && (
        <Text
          x={(lastPoint.x + previewScaled.x) / 2 + 8}
          y={(lastPoint.y + previewScaled.y) / 2 - 16}
          text={`${previewLength.toFixed(1)} ${units}`}
          fontSize={11}
          fill="#2563EB"
          fontStyle="bold"
        />
      )}

      {/* Edge length annotations for completed edges */}
      {scaledPoints.map((p, i) => {
        if (i === 0) return null;
        const prev = scaledPoints[i - 1];
        const edgeLen = distance(drawState.points[i - 1], drawState.points[i]);
        if (edgeLen < 0.1) return null;
        return (
          <Text
            key={`len-${i}`}
            x={(prev.x + p.x) / 2 + 8}
            y={(prev.y + p.y) / 2 - 16}
            text={`${edgeLen.toFixed(1)} ${units}`}
            fontSize={10}
            fill="#6B7280"
          />
        );
      })}
    </Layer>
  );
}
