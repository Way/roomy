"use client";

import { Group, Line, Rect } from "react-konva";
import { Wall } from "@/lib/types";

interface WallLineProps {
  wall: Wall;
  pixelsPerUnit: number;
}

export function WallLine({ wall, pixelsPerUnit }: WallLineProps) {
  const x1 = wall.start.x * pixelsPerUnit;
  const y1 = wall.start.y * pixelsPerUnit;
  const x2 = wall.end.x * pixelsPerUnit;
  const y2 = wall.end.y * pixelsPerUnit;
  const thickness = Math.max(wall.thickness * pixelsPerUnit, 2);
  const wallAngleDeg = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

  const openings = wall.openings ?? [];

  return (
    <Group>
      <Line
        points={[x1, y1, x2, y2]}
        stroke="#1F2937"
        strokeWidth={thickness}
        lineCap="round"
      />
      {openings.map((opening) => {
        const ox = x1 + (x2 - x1) * opening.position;
        const oy = y1 + (y2 - y1) * opening.position;
        const ow = opening.width * pixelsPerUnit;

        if (opening.type === "door") {
          return (
            <Group key={opening.id} x={ox} y={oy} rotation={wallAngleDeg}>
              <Rect
                x={-ow / 2}
                y={-thickness / 2}
                width={ow}
                height={thickness}
                fill="#F9FAFB"
                stroke="#9CA3AF"
                strokeWidth={1}
              />
            </Group>
          );
        }
        return (
          <Group key={opening.id} x={ox} y={oy} rotation={wallAngleDeg}>
            <Line
              points={[-ow / 2, 0, ow / 2, 0]}
              stroke="#60A5FA"
              strokeWidth={3}
              dash={[4, 4]}
            />
            <Line
              points={[-ow / 2, -thickness / 3, ow / 2, -thickness / 3]}
              stroke="#60A5FA"
              strokeWidth={1}
            />
            <Line
              points={[-ow / 2, thickness / 3, ow / 2, thickness / 3]}
              stroke="#60A5FA"
              strokeWidth={1}
            />
          </Group>
        );
      })}
    </Group>
  );
}
