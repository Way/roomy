"use client";

import { Layer, Line } from "react-konva";
import { useFloorPlanStore } from "@/store/floor-plan-store";

interface AlignmentGuidesProps {
  totalWidth: number;
  totalHeight: number;
  pixelsPerUnit: number;
}

export function AlignmentGuides({
  totalWidth,
  totalHeight,
  pixelsPerUnit,
}: AlignmentGuidesProps) {
  const { alignmentGuides } = useFloorPlanStore();

  if (alignmentGuides.length === 0) return null;

  const maxW = totalWidth * pixelsPerUnit;
  const maxH = totalHeight * pixelsPerUnit;

  return (
    <Layer listening={false}>
      {alignmentGuides.map((guide, i) => {
        const pos = guide.position * pixelsPerUnit;
        return (
          <Line
            key={`${guide.type}-${guide.position}-${i}`}
            points={
              guide.type === "horizontal"
                ? [0, pos, maxW, pos]
                : [pos, 0, pos, maxH]
            }
            stroke="#2563EB"
            strokeWidth={0.5}
            dash={[6, 4]}
            opacity={0.6}
          />
        );
      })}
    </Layer>
  );
}
