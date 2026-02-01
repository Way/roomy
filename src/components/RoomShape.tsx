"use client";

import { Group, Line, Text } from "react-konva";
import { Room } from "@/lib/types";
import { flattenVertices, polygonCentroid } from "@/lib/geometry";

interface RoomShapeProps {
  room: Room;
  pixelsPerUnit: number;
}

export function RoomShape({ room, pixelsPerUnit }: RoomShapeProps) {
  const scaledVertices = room.vertices.map((v) => ({
    x: v.x * pixelsPerUnit,
    y: v.y * pixelsPerUnit,
  }));

  const centroid = polygonCentroid(scaledVertices);
  const points = flattenVertices(scaledVertices);

  return (
    <Group>
      <Line
        points={points}
        closed
        fill={room.color}
        stroke={room.color.replace("0.3)", "0.6)")}
        strokeWidth={1}
      />
      <Text
        x={centroid.x - 40}
        y={centroid.y - 12}
        width={80}
        text={room.name}
        fontSize={11}
        fontStyle="bold"
        fill="#374151"
        align="center"
      />
      {room.area > 0 && (
        <Text
          x={centroid.x - 40}
          y={centroid.y + 2}
          width={80}
          text={`${room.area} sq m`}
          fontSize={9}
          fill="#6B7280"
          align="center"
        />
      )}
    </Group>
  );
}
