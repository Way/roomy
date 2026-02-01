import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { AnalysisResult, FloorPlanData, Room, Wall } from "./types";
import { normalizeWallOpenings } from "./wall-openings";

const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const RoomSchema = z.object({
  name: z.string(),
  vertices: z.array(PointSchema).min(3),
  area: z.number(),
  estimatedUse: z.string(),
});

const WallSchema = z.object({
  start: PointSchema,
  end: PointSchema,
  thickness: z.number().default(0.12),
  hasWindow: z.boolean().default(false),
  hasDoor: z.boolean().default(false),
});

const FurnitureSchema = z.object({
  type: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const LLMResponseSchema = z.object({
  rooms: z.array(RoomSchema),
  walls: z.array(WallSchema),
  units: z.enum(["meters", "feet"]).default("meters"),
  overallWidth: z.number(),
  overallHeight: z.number(),
  detectedFurniture: z.array(FurnitureSchema).default([]),
});

const ROOM_COLORS = [
  "rgba(147, 197, 253, 0.3)", // blue
  "rgba(167, 243, 208, 0.3)", // green
  "rgba(253, 230, 138, 0.3)", // yellow
  "rgba(252, 165, 165, 0.3)", // red
  "rgba(196, 181, 253, 0.3)", // purple
  "rgba(253, 186, 116, 0.3)", // orange
  "rgba(165, 243, 252, 0.3)", // cyan
  "rgba(249, 168, 212, 0.3)", // pink
];

// --- Dimension Extraction Schema (Pass 1) ---

const DimensionLabelSchema = z.object({
  value: z.number(),
  description: z.string(),
});

const RoomDimensionSchema = z.object({
  name: z.string(),
  labeledWidth: z.number(),
  labeledHeight: z.number(),
  estimatedUse: z.string(),
  position: z.string(),
  adjacentRooms: z.array(z.string()).default([]),
});

const OpeningInfoSchema = z.object({
  type: z.enum(["door", "window"]),
  location: z.string(),
});

const DimensionExtractionSchema = z.object({
  units: z.enum(["meters", "feet", "centimeters"]).default("meters"),
  overallWidth: z.number(),
  overallHeight: z.number(),
  dimensionLabels: z.array(DimensionLabelSchema).default([]),
  rooms: z.array(RoomDimensionSchema),
  openings: z.array(OpeningInfoSchema).default([]),
});

export type DimensionExtraction = z.infer<typeof DimensionExtractionSchema>;

// --- JSON Extraction ---

function extractJSON(text: string): string {
  // Try to find JSON in markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find a JSON object directly
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  return text;
}

// --- Dimension Extraction Parser (Pass 1) ---

export function parseDimensionExtraction(rawText: string): DimensionExtraction {
  const jsonString = extractJSON(rawText);
  const parsed = JSON.parse(jsonString);
  const validated = DimensionExtractionSchema.parse(parsed);

  // Normalize centimeters to meters
  if (validated.units === "centimeters") {
    return {
      ...validated,
      units: "meters",
      overallWidth: validated.overallWidth / 100,
      overallHeight: validated.overallHeight / 100,
      dimensionLabels: validated.dimensionLabels.map((l) => ({
        ...l,
        value: l.value / 100,
      })),
      rooms: validated.rooms.map((r) => ({
        ...r,
        labeledWidth: r.labeledWidth / 100,
        labeledHeight: r.labeledHeight / 100,
      })),
    };
  }

  return validated;
}

// --- Geometry Response Parser (Pass 2 / Legacy) ---

export function parseLLMResponse(rawText: string): AnalysisResult {
  const jsonString = extractJSON(rawText);
  const parsed = JSON.parse(jsonString);
  const validated = LLMResponseSchema.parse(parsed);

  const rooms: Room[] = validated.rooms.map((r, i) => ({
    id: uuidv4(),
    name: r.name,
    vertices: r.vertices,
    area: r.area,
    color: ROOM_COLORS[i % ROOM_COLORS.length],
    estimatedUse: r.estimatedUse,
  }));

  const walls: Wall[] = validated.walls.map((w) =>
    normalizeWallOpenings({
      id: uuidv4(),
      start: w.start,
      end: w.end,
      thickness: w.thickness,
      hasWindow: w.hasWindow,
      hasDoor: w.hasDoor,
    })
  );

  const floorPlan: FloorPlanData = {
    rooms,
    walls,
    units: validated.units,
    scale: 1,
    overallWidth: validated.overallWidth,
    overallHeight: validated.overallHeight,
  };

  return {
    floorPlan,
    detectedFurniture: validated.detectedFurniture,
  };
}
