export interface Point {
  x: number;
  y: number;
}

export interface Room {
  id: string;
  name: string;
  vertices: Point[];
  area: number;
  color: string;
  estimatedUse: string;
}

export type DoorSwingDirection =
  | "left-in"
  | "left-out"
  | "right-in"
  | "right-out";

export interface WallOpening {
  id: string;
  type: "door" | "window";
  position: number; // 0-1 fractional position along wall
  width: number; // in floor plan units
  swingDirection?: DoorSwingDirection; // door only, default "left-in"
}

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
  hasWindow: boolean;
  hasDoor: boolean;
  openings?: WallOpening[];
}

export type FurnitureShape = "rect" | "circle" | "ellipse";

export type FurnitureCategory =
  | "living"
  | "bedroom"
  | "kitchen"
  | "bathroom"
  | "office"
  | "dining";

export interface FurnitureDef {
  type: string;
  label: string;
  category: FurnitureCategory;
  shape: FurnitureShape;
  defaultWidth: number;
  defaultHeight: number;
  color: string;
}

export interface PlacedFurniture {
  id: string;
  definitionType: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  shape: FurnitureShape;
}

export interface FloorPlanData {
  rooms: Room[];
  walls: Wall[];
  units: "meters" | "feet";
  scale: number;
  overallWidth: number;
  overallHeight: number;
}

// Editor types

export type EditorTool =
  | "select"
  | "draw-wall"
  | "draw-room"
  | "add-door"
  | "add-window"
  | "calibrate";

export interface SelectionTarget {
  type: "wall" | "room" | "furniture";
  id: string;
  vertexIndex?: number;
  endpoint?: "start" | "end";
}

export interface DrawState {
  tool: "draw-wall" | "draw-room";
  points: Point[];
  previewPoint?: Point;
}

export interface AlignmentGuide {
  type: "horizontal" | "vertical";
  position: number; // in floor plan units
}

export interface ColocatedVertex {
  type: "wall-start" | "wall-end" | "room-vertex";
  entityId: string;
  vertexIndex?: number;
}

export interface RoomySaveFile {
  version: 1;
  savedAt: string;
  floorPlan: FloorPlanData | null;
  furniture: PlacedFurniture[];
  uploadedImage: string | null;
  canvasSettings: {
    pixelsPerUnit: number;
    zoom: number;
    panOffset: { x: number; y: number };
  };
}

export interface AnalysisResult {
  floorPlan: FloorPlanData;
  detectedFurniture: Array<{
    type: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}
