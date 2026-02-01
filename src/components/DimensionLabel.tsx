"use client";

import { useCallback } from "react";
import { Group, Text, Rect } from "react-konva";
import Konva from "konva";
import { Wall } from "@/lib/types";
import { distance, midpoint, angleBetween } from "@/lib/geometry";

interface DimensionLabelProps {
  wall: Wall;
  pixelsPerUnit: number;
  units: "feet" | "meters";
  isDrawing?: boolean;
}

export function DimensionLabel({
  wall,
  pixelsPerUnit,
  units,
  isDrawing = false,
}: DimensionLabelProps) {
  const length = distance(wall.start, wall.end);
  if (length < 0.5) return null;

  const mid = midpoint(
    { x: wall.start.x * pixelsPerUnit, y: wall.start.y * pixelsPerUnit },
    { x: wall.end.x * pixelsPerUnit, y: wall.end.y * pixelsPerUnit }
  );

  const angle = angleBetween(wall.start, wall.end);
  const offset = 12;

  const rad = (angle * Math.PI) / 180;
  const offsetX = -Math.sin(rad) * offset;
  const offsetY = Math.cos(rad) * offset;

  const unitLabel = units === "feet" ? "ft" : "m";
  const text = `${length.toFixed(1)} ${unitLabel}`;

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      const stage = e.target.getStage();
      if (!stage) return;

      // Get the screen position of this label
      const stageBox = stage.container().getBoundingClientRect();
      const absPos = e.target.getAbsolutePosition();
      const scale = stage.scaleX();

      const screenX = stageBox.left + absPos.x * scale + stage.x();
      const screenY = stageBox.top + absPos.y * scale + stage.y();

      // Call the global dimension edit function
      const openEdit = (window as unknown as Record<string, unknown>)
        .__openDimensionEdit as
        | ((wallId: string, x: number, y: number) => void)
        | undefined;
      if (openEdit) {
        openEdit(wall.id, screenX, screenY);
      }
    },
    [wall.id]
  );

  return (
    <Group listening={!isDrawing}>
      {/* Clickable background for the label */}
      <Rect
        x={mid.x + offsetX - 25}
        y={mid.y + offsetY - 8}
        width={50}
        height={14}
        fill="transparent"
        onClick={handleClick}
        onMouseEnter={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = "pointer";
        }}
        onMouseLeave={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = "";
        }}
      />
      <Text
        x={mid.x + offsetX - 25}
        y={mid.y + offsetY - 6}
        width={50}
        text={text}
        fontSize={9}
        fill="#6B7280"
        align="center"
        listening={false}
      />
    </Group>
  );
}
