import { Point, Wall, Room, AlignmentGuide } from "./types";
import { distance, snapToGrid, GRID_SIZE_METERS, projectPointOnLine } from "./geometry";

export interface SnapContext {
  snapToGrid: boolean;
  gridSize: number;
  walls: Wall[];
  rooms: Room[];
  excludeIds: string[];
  angleSnapFrom?: Point; // For angle snapping during wall drawing
  extraSnapPoints?: Point[]; // Additional high-priority snap targets (e.g. first vertex of in-progress polygon)
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

  if (context.extraSnapPoints) {
    endpoints.push(...context.extraSnapPoints);
  }

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

// --- Furniture snapping ---

export interface FurnitureSnapContext {
  snapToGrid: boolean;
  gridSize: number;
  walls: Wall[];
  rooms: Room[];
}

export interface FurnitureSnapResult {
  /** Snapped position (top-left corner in floor plan units) */
  x: number;
  y: number;
  guides: AlignmentGuide[];
}

const FURNITURE_ALIGN_TOLERANCE = 0.25; // units
const ROTATION_SNAP_INCREMENT = 15; // degrees
const ROTATION_SNAP_TOLERANCE = 5; // degrees

/**
 * Snap a rotation angle to the nearest increment (15°) if within tolerance.
 */
export function snapRotation(degrees: number): number {
  const nearest = Math.round(degrees / ROTATION_SNAP_INCREMENT) * ROTATION_SNAP_INCREMENT;
  if (Math.abs(degrees - nearest) < ROTATION_SNAP_TOLERANCE) {
    return nearest;
  }
  return degrees;
}

/**
 * Compute the axis-aligned bounding box of a rotated rectangle.
 * The rectangle's origin (x, y) is its top-left corner before rotation,
 * and rotation happens around that origin (Konva default for Rect).
 */
function rotatedBoundingBox(
  x: number,
  y: number,
  w: number,
  h: number,
  rotationDeg: number
): { minX: number; minY: number; maxX: number; maxY: number; cx: number; cy: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Four corners relative to origin (x, y), then rotated around (x, y)
  const corners = [
    { x: x, y: y }, // top-left (origin)
    { x: x + w * cos, y: y + w * sin }, // top-right
    { x: x - h * sin, y: y + h * cos }, // bottom-left
    { x: x + w * cos - h * sin, y: y + w * sin + h * cos }, // bottom-right
  ];

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/**
 * Snap a furniture item's edges to wall endpoints and room vertices
 * for easy horizontal/vertical alignment. Accounts for rotation by
 * using the axis-aligned bounding box of the rotated shape.
 */
export function computeFurnitureSnap(
  /** Raw position of furniture top-left corner in floor plan units */
  rawX: number,
  rawY: number,
  width: number,
  height: number,
  context: FurnitureSnapContext,
  /** Current rotation in degrees (default 0) */
  rotation: number = 0
): FurnitureSnapResult {
  const guides: AlignmentGuide[] = [];

  // Collect reference X and Y values from wall inner faces and room vertices.
  // Walls are rendered as thick strokes centered on the start→end line, so
  // each face is offset ±thickness/2 along the perpendicular normal.
  const refXs: number[] = [];
  const refYs: number[] = [];

  for (const wall of context.walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;

    // Perpendicular normal (unit)
    const nx = -dy / len;
    const ny = dx / len;
    const halfT = wall.thickness / 2;

    // Two face lines offset from the centerline
    for (const sign of [1, -1]) {
      const ox = nx * halfT * sign;
      const oy = ny * halfT * sign;
      refXs.push(wall.start.x + ox, wall.end.x + ox);
      refYs.push(wall.start.y + oy, wall.end.y + oy);
    }
  }
  for (const room of context.rooms) {
    for (const v of room.vertices) {
      refXs.push(v.x);
      refYs.push(v.y);
    }
  }

  // Compute rotated bounding box edges for snapping
  const bb = rotatedBoundingBox(rawX, rawY, width, height, rotation);

  const edgeXs = [bb.minX, bb.cx, bb.maxX];
  const edgeYs = [bb.minY, bb.cy, bb.maxY];

  let snappedX = false;
  let bestDx = Infinity;
  let snapDx = 0;
  let snapGuideX = 0;

  for (const ex of edgeXs) {
    for (const rx of refXs) {
      const d = Math.abs(ex - rx);
      if (d < FURNITURE_ALIGN_TOLERANCE && d < bestDx) {
        bestDx = d;
        snapDx = rx - ex;
        snapGuideX = rx;
        snappedX = true;
      }
    }
  }

  let snappedY = false;
  let bestDy = Infinity;
  let snapDy = 0;
  let snapGuideY = 0;

  for (const ey of edgeYs) {
    for (const ry of refYs) {
      const d = Math.abs(ey - ry);
      if (d < FURNITURE_ALIGN_TOLERANCE && d < bestDy) {
        bestDy = d;
        snapDy = ry - ey;
        snapGuideY = ry;
        snappedY = true;
      }
    }
  }

  let resultX = rawX;
  let resultY = rawY;

  if (snappedX) {
    resultX = rawX + snapDx;
    guides.push({ type: "vertical", position: snapGuideX });
  }
  if (snappedY) {
    resultY = rawY + snapDy;
    guides.push({ type: "horizontal", position: snapGuideY });
  }

  // Fall back to grid snap for axes that didn't align
  if (context.snapToGrid) {
    if (!snappedX) {
      resultX = snapToGrid(resultX, context.gridSize);
    }
    if (!snappedY) {
      resultY = snapToGrid(resultY, context.gridSize);
    }
  }

  return { x: resultX, y: resultY, guides };
}
