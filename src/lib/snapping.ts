import { Point, Wall, Room, AlignmentGuide } from "./types";
import { distance, snapToGrid, GRID_SIZE_METERS, projectPointOnLine } from "./geometry";

export interface SnapContext {
  snapToGrid: boolean;
  gridSize: number;
  walls: Wall[];
  rooms: Room[];
  excludeIds: string[];
  angleSnapFrom?: Point; // For angle snapping during wall drawing
}

export interface SnapResult {
  snappedPoint: Point;
  guides: AlignmentGuide[];
}

const ENDPOINT_SNAP_TOLERANCE = 0.3; // units
const WALL_SEGMENT_SNAP_TOLERANCE = 0.2; // units — snap to nearest point on wall
const ALIGNMENT_SNAP_TOLERANCE = 0.2; // units
const ANGLE_SNAP_TOLERANCE = 5; // degrees

function getAllEndpoints(
  walls: Wall[],
  rooms: Room[],
  excludeIds: string[]
): Point[] {
  const points: Point[] = [];

  for (const wall of walls) {
    if (excludeIds.includes(wall.id)) continue;
    points.push(wall.start, wall.end);
  }

  for (const room of rooms) {
    if (excludeIds.includes(room.id)) continue;
    for (const v of room.vertices) {
      points.push(v);
    }
  }

  return points;
}

export function computeSnap(rawPoint: Point, context: SnapContext): SnapResult {
  const guides: AlignmentGuide[] = [];
  let result: Point = { ...rawPoint };

  const endpoints = getAllEndpoints(
    context.walls,
    context.rooms,
    context.excludeIds
  );

  // Priority 1: Magnetic endpoint snap
  let closestDist = Infinity;
  let closestEndpoint: Point | null = null;

  for (const ep of endpoints) {
    const d = distance(rawPoint, ep);
    if (d < ENDPOINT_SNAP_TOLERANCE && d < closestDist) {
      closestDist = d;
      closestEndpoint = ep;
    }
  }

  if (closestEndpoint) {
    return { snappedPoint: closestEndpoint, guides };
  }

  // Priority 1.5: Snap to nearest point on wall segment
  let closestWallDist = Infinity;
  let closestWallPoint: Point | null = null;

  for (const wall of context.walls) {
    if (context.excludeIds.includes(wall.id)) continue;
    const { projected, t } = projectPointOnLine(rawPoint, wall.start, wall.end);
    // Only snap to interior of wall (t between 0 and 1, exclusive of endpoints already handled)
    if (t > 0.01 && t < 0.99) {
      const d = distance(rawPoint, projected);
      if (d < WALL_SEGMENT_SNAP_TOLERANCE && d < closestWallDist) {
        closestWallDist = d;
        closestWallPoint = projected;
      }
    }
  }

  if (closestWallPoint) {
    return { snappedPoint: closestWallPoint, guides };
  }

  // Priority 2: Alignment guide snap (X and Y independently)
  let snappedX = false;
  let snappedY = false;

  for (const ep of endpoints) {
    if (!snappedX && Math.abs(rawPoint.x - ep.x) < ALIGNMENT_SNAP_TOLERANCE) {
      result.x = ep.x;
      guides.push({ type: "vertical", position: ep.x });
      snappedX = true;
    }
    if (!snappedY && Math.abs(rawPoint.y - ep.y) < ALIGNMENT_SNAP_TOLERANCE) {
      result.y = ep.y;
      guides.push({ type: "horizontal", position: ep.y });
      snappedY = true;
    }
    if (snappedX && snappedY) break;
  }

  // Priority 3: Angle snap (when drawing walls from a previous point)
  if (context.angleSnapFrom && !snappedX && !snappedY) {
    const from = context.angleSnapFrom;
    const dx = rawPoint.x - from.x;
    const dy = rawPoint.y - from.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const len = Math.sqrt(dx * dx + dy * dy);

    const snapAngles = [0, 45, 90, 135, 180, -45, -90, -135, -180];
    for (const target of snapAngles) {
      if (Math.abs(angle - target) < ANGLE_SNAP_TOLERANCE) {
        const rad = (target * Math.PI) / 180;
        result = {
          x: from.x + len * Math.cos(rad),
          y: from.y + len * Math.sin(rad),
        };
        break;
      }
    }
  }

  // Priority 4: Grid snap
  if (context.snapToGrid) {
    if (!snappedX) {
      result.x = snapToGrid(result.x, context.gridSize);
    }
    if (!snappedY) {
      result.y = snapToGrid(result.y, context.gridSize);
    }
  }

  return { snappedPoint: result, guides };
}
