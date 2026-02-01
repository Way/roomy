import { FloorPlanData, Point } from "./types";
import { distance, polygonArea } from "./geometry";
import { DimensionExtraction } from "./parse-llm-response";

const SNAP_TOLERANCE = 0.15; // meters

/**
 * Ensure all room vertex arrays are in clockwise winding order.
 * Uses the signed area (shoelace formula) — negative = clockwise in screen coords (Y-down).
 */
function ensureClockwiseWinding(floorPlan: FloorPlanData): FloorPlanData {
  const rooms = floorPlan.rooms.map((room) => {
    const vertices = room.vertices;
    if (vertices.length < 3) return room;

    // Compute signed area (positive = counter-clockwise in Y-down coords)
    let signedArea = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      signedArea += vertices[i].x * vertices[j].y;
      signedArea -= vertices[j].x * vertices[i].y;
    }

    // If signed area is positive, vertices are counter-clockwise — reverse them
    if (signedArea > 0) {
      return { ...room, vertices: [...vertices].reverse() };
    }
    return room;
  });

  return { ...floorPlan, rooms };
}

/**
 * Find room edges that are nearly collinear and close together,
 * then snap them to share exact coordinates.
 */
function snapSharedEdges(floorPlan: FloorPlanData): FloorPlanData {
  const rooms = floorPlan.rooms.map((r) => ({
    ...r,
    vertices: r.vertices.map((v) => ({ ...v })),
  }));

  // Collect all vertices from all rooms
  const allVertices: { roomIdx: number; vertIdx: number; point: Point }[] = [];
  rooms.forEach((room, ri) => {
    room.vertices.forEach((v, vi) => {
      allVertices.push({ roomIdx: ri, vertIdx: vi, point: v });
    });
  });

  // For each pair of vertices from different rooms, snap if close
  for (let i = 0; i < allVertices.length; i++) {
    for (let j = i + 1; j < allVertices.length; j++) {
      if (allVertices[i].roomIdx === allVertices[j].roomIdx) continue;

      const a = allVertices[i].point;
      const b = allVertices[j].point;
      const d = distance(a, b);

      if (d > 0 && d < SNAP_TOLERANCE) {
        // Snap b to a (a is the reference)
        const target = rooms[allVertices[j].roomIdx];
        target.vertices[allVertices[j].vertIdx] = { x: a.x, y: a.y };
        allVertices[j].point = { x: a.x, y: a.y };
      }
    }
  }

  // Also snap wall endpoints to room vertices
  const walls = floorPlan.walls.map((w) => {
    const start = { ...w.start };
    const end = { ...w.end };

    for (const { point } of allVertices) {
      if (distance(start, point) > 0 && distance(start, point) < SNAP_TOLERANCE) {
        start.x = point.x;
        start.y = point.y;
      }
      if (distance(end, point) > 0 && distance(end, point) < SNAP_TOLERANCE) {
        end.x = point.x;
        end.y = point.y;
      }
    }

    return { ...w, start, end };
  });

  return { ...floorPlan, rooms, walls };
}

/**
 * Compare room bounding boxes against extracted dimension labels.
 * If a room's dimensions don't match, rescale its vertices.
 */
function validateRoomDimensions(
  floorPlan: FloorPlanData,
  extracted: DimensionExtraction
): FloorPlanData {
  const rooms = floorPlan.rooms.map((room) => {
    // Find the matching extracted room
    const extractedRoom = extracted.rooms.find(
      (er) => er.name.toLowerCase() === room.name.toLowerCase()
    );
    if (!extractedRoom) return room;

    // Compute current bounding box
    const xs = room.vertices.map((v) => v.x);
    const ys = room.vertices.map((v) => v.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const currentWidth = maxX - minX;
    const currentHeight = maxY - minY;

    const targetWidth = extractedRoom.labeledWidth;
    const targetHeight = extractedRoom.labeledHeight;

    // Only rescale if the difference is significant (>5%)
    const widthRatio =
      currentWidth > 0 ? targetWidth / currentWidth : 1;
    const heightRatio =
      currentHeight > 0 ? targetHeight / currentHeight : 1;

    const needsWidthFix =
      Math.abs(widthRatio - 1) > 0.05 && currentWidth > 0;
    const needsHeightFix =
      Math.abs(heightRatio - 1) > 0.05 && currentHeight > 0;

    if (!needsWidthFix && !needsHeightFix) return room;

    // Rescale vertices relative to the top-left corner
    const vertices = room.vertices.map((v) => ({
      x: needsWidthFix ? minX + (v.x - minX) * widthRatio : v.x,
      y: needsHeightFix ? minY + (v.y - minY) * heightRatio : v.y,
    }));

    return { ...room, vertices };
  });

  return { ...floorPlan, rooms };
}

/**
 * Validate that the bounding box of all geometry matches overallWidth/overallHeight.
 * Scale proportionally if needed.
 */
function validateOverallBounds(floorPlan: FloorPlanData): FloorPlanData {
  // Compute actual bounding box from all room vertices and wall endpoints
  const allPoints: Point[] = [];
  floorPlan.rooms.forEach((r) => allPoints.push(...r.vertices));
  floorPlan.walls.forEach((w) => {
    allPoints.push(w.start, w.end);
  });

  if (allPoints.length === 0) return floorPlan;

  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const actualMinX = Math.min(...xs);
  const actualMinY = Math.min(...ys);
  const actualMaxX = Math.max(...xs);
  const actualMaxY = Math.max(...ys);
  const actualWidth = actualMaxX - actualMinX;
  const actualHeight = actualMaxY - actualMinY;

  const declaredWidth = floorPlan.overallWidth;
  const declaredHeight = floorPlan.overallHeight;

  // If actual bounds are close enough (within 10%), don't adjust
  if (
    actualWidth > 0 &&
    actualHeight > 0 &&
    Math.abs(actualWidth - declaredWidth) / declaredWidth < 0.1 &&
    Math.abs(actualHeight - declaredHeight) / declaredHeight < 0.1
  ) {
    return floorPlan;
  }

  // Scale to fit declared dimensions
  const scaleX = actualWidth > 0 ? declaredWidth / actualWidth : 1;
  const scaleY = actualHeight > 0 ? declaredHeight / actualHeight : 1;

  function scalePoint(p: Point): Point {
    return {
      x: (p.x - actualMinX) * scaleX,
      y: (p.y - actualMinY) * scaleY,
    };
  }

  const rooms = floorPlan.rooms.map((room) => ({
    ...room,
    vertices: room.vertices.map(scalePoint),
  }));

  const walls = floorPlan.walls.map((wall) => ({
    ...wall,
    start: scalePoint(wall.start),
    end: scalePoint(wall.end),
  }));

  return { ...floorPlan, rooms, walls };
}

/**
 * Recalculate all room areas from their vertices using the shoelace formula.
 */
function recalculateAllAreas(floorPlan: FloorPlanData): FloorPlanData {
  const rooms = floorPlan.rooms.map((room) => ({
    ...room,
    area: polygonArea(room.vertices),
  }));

  return { ...floorPlan, rooms };
}

/**
 * Remove duplicate wall segments (walls with the same start/end within tolerance).
 */
function deduplicateWalls(floorPlan: FloorPlanData): FloorPlanData {
  const walls = [...floorPlan.walls];
  const unique: typeof walls = [];

  for (const wall of walls) {
    const isDuplicate = unique.some((existing) => {
      // Check both orientations
      const fwdMatch =
        distance(existing.start, wall.start) < SNAP_TOLERANCE &&
        distance(existing.end, wall.end) < SNAP_TOLERANCE;
      const revMatch =
        distance(existing.start, wall.end) < SNAP_TOLERANCE &&
        distance(existing.end, wall.start) < SNAP_TOLERANCE;
      return fwdMatch || revMatch;
    });

    if (!isDuplicate) {
      unique.push(wall);
    } else {
      // Merge opening info onto the existing wall
      const existingIdx = unique.findIndex((existing) => {
        const fwdMatch =
          distance(existing.start, wall.start) < SNAP_TOLERANCE &&
          distance(existing.end, wall.end) < SNAP_TOLERANCE;
        const revMatch =
          distance(existing.start, wall.end) < SNAP_TOLERANCE &&
          distance(existing.end, wall.start) < SNAP_TOLERANCE;
        return fwdMatch || revMatch;
      });
      if (existingIdx >= 0) {
        const existing = unique[existingIdx];
        // Merge openings
        if (wall.openings && wall.openings.length > 0) {
          unique[existingIdx] = {
            ...existing,
            openings: [...(existing.openings || []), ...wall.openings],
          };
        }
        // Merge boolean flags
        if (wall.hasDoor) unique[existingIdx].hasDoor = true;
        if (wall.hasWindow) unique[existingIdx].hasWindow = true;
      }
    }
  }

  return { ...floorPlan, walls: unique };
}

/**
 * Main validation pipeline. Runs all post-processing steps in sequence.
 */
export function validateAndCorrectGeometry(
  floorPlan: FloorPlanData,
  extractedDimensions: DimensionExtraction
): FloorPlanData {
  let corrected = { ...floorPlan };
  corrected = ensureClockwiseWinding(corrected);
  corrected = snapSharedEdges(corrected);
  corrected = validateRoomDimensions(corrected, extractedDimensions);
  corrected = validateOverallBounds(corrected);
  corrected = deduplicateWalls(corrected);
  corrected = recalculateAllAreas(corrected);
  return corrected;
}
