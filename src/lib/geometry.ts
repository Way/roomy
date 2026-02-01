import { Point } from "./types";

export const GRID_SIZE_METERS = 0.1; // snap grid in meters

export function snapToGrid(value: number, gridSize: number = GRID_SIZE_METERS): number {
  return Math.round(value / gridSize) * gridSize;
}

export function distance(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function angleBetween(a: Point, b: Point): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
}

export function polygonCentroid(vertices: Point[]): Point {
  if (vertices.length === 0) return { x: 0, y: 0 };
  const sum = vertices.reduce(
    (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / vertices.length, y: sum.y / vertices.length };
}

export function flattenVertices(vertices: Point[]): number[] {
  return vertices.flatMap((v) => [v.x, v.y]);
}

export function polygonArea(vertices: Point[]): number {
  if (vertices.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area / 2);
}

export function pointAlongLine(from: Point, to: Point, dist: number): Point {
  const d = distance(from, to);
  if (d === 0) return { ...from };
  const t = dist / d;
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

export function projectPointOnLine(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): { projected: Point; t: number } {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { projected: { ...lineStart }, t: 0 };
  const t = Math.max(
    0,
    Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq)
  );
  return {
    projected: { x: lineStart.x + t * dx, y: lineStart.y + t * dy },
    t,
  };
}

export function resizeWallToLength(
  start: Point,
  end: Point,
  newLength: number,
  anchor: "start" | "end"
): { start: Point; end: Point } {
  const d = distance(start, end);
  if (d === 0) return { start, end: { x: start.x + newLength, y: start.y } };
  if (anchor === "start") {
    // Move end point
    return { start, end: pointAlongLine(start, end, newLength) };
  } else {
    // Move start point
    return { start: pointAlongLine(end, start, newLength), end };
  }
}

export function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
