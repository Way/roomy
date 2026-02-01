import { Point, Wall, Room, FloorPlanData, ColocatedVertex } from "./types";
import { distance } from "./geometry";

const COLOCATE_TOLERANCE = 0.15; // units

export function findColocatedVertices(
  point: Point,
  walls: Wall[],
  rooms: Room[],
  excludeWallId?: string,
  excludeRoomId?: string
): ColocatedVertex[] {
  const result: ColocatedVertex[] = [];

  for (const wall of walls) {
    if (wall.id === excludeWallId) continue;
    if (distance(point, wall.start) < COLOCATE_TOLERANCE) {
      result.push({ type: "wall-start", entityId: wall.id });
    }
    if (distance(point, wall.end) < COLOCATE_TOLERANCE) {
      result.push({ type: "wall-end", entityId: wall.id });
    }
  }

  for (const room of rooms) {
    if (room.id === excludeRoomId) continue;
    for (let i = 0; i < room.vertices.length; i++) {
      if (distance(point, room.vertices[i]) < COLOCATE_TOLERANCE) {
        result.push({ type: "room-vertex", entityId: room.id, vertexIndex: i });
      }
    }
  }

  return result;
}

export function moveSharedVertices(
  newPos: Point,
  colocated: ColocatedVertex[],
  floorPlan: FloorPlanData
): FloorPlanData {
  const updatedWalls = floorPlan.walls.map((wall) => {
    for (const cv of colocated) {
      if (cv.entityId === wall.id) {
        if (cv.type === "wall-start") {
          return { ...wall, start: { ...newPos } };
        }
        if (cv.type === "wall-end") {
          return { ...wall, end: { ...newPos } };
        }
      }
    }
    return wall;
  });

  const updatedRooms = floorPlan.rooms.map((room) => {
    let modified = false;
    const newVertices = room.vertices.map((v, i) => {
      for (const cv of colocated) {
        if (
          cv.entityId === room.id &&
          cv.type === "room-vertex" &&
          cv.vertexIndex === i
        ) {
          modified = true;
          return { ...newPos };
        }
      }
      return v;
    });
    if (modified) {
      return {
        ...room,
        vertices: newVertices,
        area: recalculateRoomArea(newVertices),
      };
    }
    return room;
  });

  return { ...floorPlan, walls: updatedWalls, rooms: updatedRooms };
}

export function recalculateRoomArea(vertices: Point[]): number {
  if (vertices.length < 3) return 0;
  // Shoelace formula
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.round(Math.abs(area / 2) * 10) / 10;
}
