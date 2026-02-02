"use client";

import { Group, Line, Rect, Arc } from "react-konva";
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
          const swing = opening.swingDirection ?? "left-in";
          const hingeLeft = swing.startsWith("left");
          const swingIn = swing.endsWith("-in");
          const hx = hingeLeft ? -ow / 2 : ow / 2;
          const hy = swingIn ? thickness / 2 : -thickness / 2;
          let arcRotation: number;
          if (hingeLeft && swingIn) arcRotation = 0;
          else if (hingeLeft && !swingIn) arcRotation = 270;
          else if (!hingeLeft && swingIn) arcRotation = 90;
          else arcRotation = 180;

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
              />
              <Line
                points={[hx, hy, hx, hy + (swingIn ? ow : -ow)]}
                stroke="#9CA3AF"
                strokeWidth={1}
              />
            </Group>
          );
        }
        return (
          <Group key={opening.id} x={ox} y={oy} rotation={wallAngleDeg}>
            {/* Wall break background */}
            <Rect
              x={-ow / 2}
              y={-thickness / 2}
              width={ow}
              height={thickness}
              fill="#EFF6FF"
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
            />
            {/* Center line (glass division) */}
            <Line
              points={[-ow / 2, 0, ow / 2, 0]}
              stroke="#3B82F6"
              strokeWidth={1}
            />
            {/* End ticks */}
            <Line
              points={[-ow / 2, -thickness / 2, -ow / 2, thickness / 2]}
              stroke="#3B82F6"
              strokeWidth={2}
            />
            <Line
              points={[ow / 2, -thickness / 2, ow / 2, thickness / 2]}
              stroke="#3B82F6"
              strokeWidth={2}
            />
          </Group>
        );
      })}
    </Group>
  );
}
