import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod/v4";
import {
  FloorPlanData,
  PlacedFurniture,
  FurnitureDef,
  EditorTool,
  SelectionTarget,
  DrawState,
  AlignmentGuide,
  Wall,
  WallOpening,
  Room,
  Point,
  RoomySaveFile,
} from "@/lib/types";
import {
  findColocatedVertices,
  moveSharedVertices,
  recalculateRoomArea,
} from "@/lib/vertex-utils";
import { normalizeWallOpenings } from "@/lib/wall-openings";
import { encodeFloorPlan } from "@/lib/share";

const PointSchema = z.object({ x: z.number(), y: z.number() });

const WallOpeningSchema = z.object({
  id: z.string(),
  type: z.enum(["door", "window"]),
  position: z.number(),
  width: z.number(),
  swingDirection: z.enum(["left-in", "left-out", "right-in", "right-out"]).optional(),
});

const WallSchema = z.object({
  id: z.string(),
  start: PointSchema,
  end: PointSchema,
  thickness: z.number(),
  hasWindow: z.boolean(),
  hasDoor: z.boolean(),
  openings: z.array(WallOpeningSchema).optional(),
});

const RoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  vertices: z.array(PointSchema),
  area: z.number(),
  color: z.string(),
  estimatedUse: z.string(),
});

const FloorPlanDataSchema = z.object({
  rooms: z.array(RoomSchema),
  walls: z.array(WallSchema),
  units: z.enum(["meters", "feet"]),
  scale: z.number(),
  overallWidth: z.number(),
  overallHeight: z.number(),
});

const PlacedFurnitureSchema = z.object({
  id: z.string(),
  definitionType: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number(),
  color: z.string(),
  shape: z.enum(["rect", "circle", "ellipse"]),
});

export const RoomySaveFileSchema = z.object({
  version: z.literal(1),
  savedAt: z.string(),
  floorPlan: FloorPlanDataSchema.nullable(),
  furniture: z.array(PlacedFurnitureSchema),
  uploadedImage: z.string().nullable(),
  canvasSettings: z.object({
    pixelsPerUnit: z.number(),
    zoom: z.number(),
    panOffset: PointSchema,
  }),
});

const ROOM_COLORS = [
  "rgba(59,130,246,0.3)",
  "rgba(34,197,94,0.3)",
  "rgba(234,179,8,0.3)",
  "rgba(239,68,68,0.3)",
  "rgba(168,85,247,0.3)",
  "rgba(249,115,22,0.3)",
  "rgba(6,182,212,0.3)",
  "rgba(236,72,153,0.3)",
];

interface HistorySnapshot {
  furniture: PlacedFurniture[];
  floorPlan: FloorPlanData | null;
}

interface FloorPlanStore {
  // Floor plan data
  floorPlan: FloorPlanData | null;
  setFloorPlan: (data: FloorPlanData) => void;
  clearFloorPlan: () => void;

  // Uploaded image
  uploadedImage: string | null;
  setUploadedImage: (base64: string | null) => void;

  // Furniture
  furniture: PlacedFurniture[];
  selectedFurnitureId: string | null;
  addFurniture: (def: FurnitureDef) => void;
  duplicateFurniture: (id: string) => void;
  updateFurniture: (id: string, updates: Partial<PlacedFurniture>) => void;
  removeFurniture: (id: string) => void;
  selectFurniture: (id: string | null) => void;

  // Editor state
  activeTool: EditorTool;
  setActiveTool: (tool: EditorTool) => void;
  selectedTarget: SelectionTarget | null;
  setSelectedTarget: (target: SelectionTarget | null) => void;
  clearSelection: () => void;
  drawState: DrawState | null;
  setDrawState: (state: DrawState | null) => void;
  alignmentGuides: AlignmentGuide[];
  setAlignmentGuides: (guides: AlignmentGuide[]) => void;

  // Wall operations
  updateWall: (id: string, updates: Partial<Wall>) => void;
  deleteWall: (id: string) => void;
  addWall: (wall: Omit<Wall, "id">) => Wall;
  moveWallEndpoint: (
    wallId: string,
    endpoint: "start" | "end",
    newPos: Point
  ) => void;
  splitWall: (wallId: string, splitPoint: Point) => void;

  // Wall opening operations
  addWallOpening: (wallId: string, type: "door" | "window", position?: number) => void;
  removeWallOpening: (wallId: string, openingId: string) => void;
  updateWallOpening: (wallId: string, openingId: string, updates: Partial<WallOpening>) => void;

  // Room operations
  updateRoom: (id: string, updates: Partial<Room>) => void;
  deleteRoom: (id: string) => void;
  addRoom: (room: Omit<Room, "id">) => Room;
  moveRoomVertex: (
    roomId: string,
    vertexIndex: number,
    newPos: Point
  ) => void;

  // Canvas settings
  zoom: number;
  panOffset: { x: number; y: number };
  showGrid: boolean;
  snapEnabled: boolean;
  pixelsPerUnit: number;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setPixelsPerUnit: (ppu: number) => void;

  // Analysis state
  isAnalyzing: boolean;
  analysisError: string | null;
  analysisProgress: string | null;
  setIsAnalyzing: (v: boolean) => void;
  setAnalysisError: (err: string | null) => void;
  setAnalysisProgress: (progress: string | null) => void;

  // Undo/Redo
  history: HistorySnapshot[];
  historyIndex: number;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Show floor plan image overlay
  showImageOverlay: boolean;
  toggleImageOverlay: () => void;
  setShowImageOverlay: (v: boolean) => void;

  // Calibration
  calibrationPoints: { first: Point; second?: Point } | null;
  setCalibrationPoints: (pts: { first: Point; second?: Point } | null) => void;
  applyScaleCalibration: (realWorldDistance: number) => void;

  // Save/Load/Share
  saveToFile: () => void;
  loadFromFile: (data: RoomySaveFile) => void;
  shareToUrl: () => string;
}

export const useFloorPlanStore = create<FloorPlanStore>((set, get) => ({
  floorPlan: null,
  setFloorPlan: (data) => {
    const normalized = {
      ...data,
      walls: data.walls.map(normalizeWallOpenings),
    };
    set({ floorPlan: normalized });
    get().pushHistory();
  },
  clearFloorPlan: () => {
    set({
      floorPlan: null,
      furniture: [],
      uploadedImage: null,
      selectedFurnitureId: null,
      selectedTarget: null,
    });
    get().pushHistory();
  },

  uploadedImage: null,
  setUploadedImage: (base64) => set({ uploadedImage: base64 }),

  furniture: [],
  selectedFurnitureId: null,

  addFurniture: (def) => {
    const state = get();
    const centerX = state.floorPlan
      ? state.floorPlan.overallWidth / 2
      : 10;
    const centerY = state.floorPlan
      ? state.floorPlan.overallHeight / 2
      : 10;

    const item: PlacedFurniture = {
      id: uuidv4(),
      definitionType: def.type,
      label: def.label,
      x: centerX - def.defaultWidth / 2,
      y: centerY - def.defaultHeight / 2,
      width: def.defaultWidth,
      height: def.defaultHeight,
      rotation: 0,
      color: def.color,
      shape: def.shape,
    };

    set((s) => ({
      furniture: [...s.furniture, item],
      selectedFurnitureId: item.id,
      selectedTarget: null,
    }));
    get().pushHistory();
  },

  duplicateFurniture: (id) => {
    const state = get();
    const original = state.furniture.find((f) => f.id === id);
    if (!original) return;

    const duplicate: PlacedFurniture = {
      ...original,
      id: uuidv4(),
      x: original.x + 0.5,
      y: original.y + 0.5,
    };

    set((s) => ({
      furniture: [...s.furniture, duplicate],
      selectedFurnitureId: duplicate.id,
      selectedTarget: null,
    }));
    get().pushHistory();
  },

  updateFurniture: (id, updates) => {
    set((s) => ({
      furniture: s.furniture.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ),
    }));
  },

  removeFurniture: (id) => {
    set((s) => ({
      furniture: s.furniture.filter((f) => f.id !== id),
      selectedFurnitureId:
        s.selectedFurnitureId === id ? null : s.selectedFurnitureId,
    }));
    get().pushHistory();
  },

  selectFurniture: (id) =>
    set({ selectedFurnitureId: id, selectedTarget: id ? null : undefined }),

  // Editor state
  activeTool: "select",
  setActiveTool: (tool) =>
    set({ activeTool: tool, drawState: null, alignmentGuides: [], ...(tool !== "calibrate" ? { calibrationPoints: null } : {}) }),
  selectedTarget: null,
  setSelectedTarget: (target) =>
    set({ selectedTarget: target, selectedFurnitureId: null }),
  clearSelection: () =>
    set({ selectedTarget: null, selectedFurnitureId: null }),
  drawState: null,
  setDrawState: (state) => set({ drawState: state }),
  alignmentGuides: [],
  setAlignmentGuides: (guides) => set({ alignmentGuides: guides }),

  // Wall operations
  updateWall: (id, updates) => {
    const { floorPlan } = get();
    if (!floorPlan) return;
    set({
      floorPlan: {
        ...floorPlan,
        walls: floorPlan.walls.map((w) =>
          w.id === id ? { ...w, ...updates } : w
        ),
      },
    });
    get().pushHistory();
  },

  deleteWall: (id) => {
    const { floorPlan } = get();
    if (!floorPlan) return;
    set({
      floorPlan: {
        ...floorPlan,
        walls: floorPlan.walls.filter((w) => w.id !== id),
      },
      selectedTarget: null,
    });
    get().pushHistory();
  },

  addWall: (wallData) => {
    const { floorPlan } = get();
    const wall: Wall = { ...wallData, id: uuidv4() };

    if (floorPlan) {
      set({
        floorPlan: {
          ...floorPlan,
          walls: [...floorPlan.walls, wall],
        },
      });
    } else {
      // Create a new floor plan from scratch
      set({
        floorPlan: {
          rooms: [],
          walls: [wall],
          units: "meters",
          scale: 1,
          overallWidth: 12,
          overallHeight: 9,
        },
      });
    }
    get().pushHistory();
    return wall;
  },

  moveWallEndpoint: (wallId, endpoint, newPos) => {
    const { floorPlan } = get();
    if (!floorPlan) return;

    const wall = floorPlan.walls.find((w) => w.id === wallId);
    if (!wall) return;

    const oldPos = endpoint === "start" ? wall.start : wall.end;

    // Find co-located vertices at the old position
    const colocated = findColocatedVertices(
      oldPos,
      floorPlan.walls,
      floorPlan.rooms,
      wallId
    );

    // Move the wall endpoint itself
    let updated: FloorPlanData = {
      ...floorPlan,
      walls: floorPlan.walls.map((w) => {
        if (w.id !== wallId) return w;
        return endpoint === "start"
          ? { ...w, start: { ...newPos } }
          : { ...w, end: { ...newPos } };
      }),
    };

    // Move shared vertices
    if (colocated.length > 0) {
      updated = moveSharedVertices(newPos, colocated, updated);
    }

    set({ floorPlan: updated });
  },

  splitWall: (wallId, splitPoint) => {
    const { floorPlan } = get();
    if (!floorPlan) return;

    const wall = floorPlan.walls.find((w) => w.id === wallId);
    if (!wall) return;

    const wall1: Wall = {
      id: uuidv4(),
      start: { ...wall.start },
      end: { ...splitPoint },
      thickness: wall.thickness,
      hasWindow: false,
      hasDoor: false,
      openings: [],
    };

    const wall2: Wall = {
      id: uuidv4(),
      start: { ...splitPoint },
      end: { ...wall.end },
      thickness: wall.thickness,
      hasWindow: false,
      hasDoor: false,
      openings: [],
    };

    set({
      floorPlan: {
        ...floorPlan,
        walls: [
          ...floorPlan.walls.filter((w) => w.id !== wallId),
          wall1,
          wall2,
        ],
      },
      selectedTarget: null,
    });
    get().pushHistory();
  },

  // Wall opening operations
  addWallOpening: (wallId, type, position = 0.5) => {
    const { floorPlan } = get();
    if (!floorPlan) return;
    const opening: WallOpening = {
      id: uuidv4(),
      type,
      position,
      width: type === "door" ? 0.8 : 0.6,
    };
    set({
      floorPlan: {
        ...floorPlan,
        walls: floorPlan.walls.map((w) =>
          w.id === wallId
            ? { ...w, openings: [...(w.openings ?? []), opening] }
            : w
        ),
      },
    });
    get().pushHistory();
  },

  removeWallOpening: (wallId, openingId) => {
    const { floorPlan } = get();
    if (!floorPlan) return;
    set({
      floorPlan: {
        ...floorPlan,
        walls: floorPlan.walls.map((w) =>
          w.id === wallId
            ? { ...w, openings: (w.openings ?? []).filter((o) => o.id !== openingId) }
            : w
        ),
      },
    });
    get().pushHistory();
  },

  updateWallOpening: (wallId, openingId, updates) => {
    const { floorPlan } = get();
    if (!floorPlan) return;
    set({
      floorPlan: {
        ...floorPlan,
        walls: floorPlan.walls.map((w) =>
          w.id === wallId
            ? {
                ...w,
                openings: (w.openings ?? []).map((o) =>
                  o.id === openingId ? { ...o, ...updates } : o
                ),
              }
            : w
        ),
      },
    });
  },

  // Room operations
  updateRoom: (id, updates) => {
    const { floorPlan } = get();
    if (!floorPlan) return;
    set({
      floorPlan: {
        ...floorPlan,
        rooms: floorPlan.rooms.map((r) =>
          r.id === id ? { ...r, ...updates } : r
        ),
      },
    });
    get().pushHistory();
  },

  deleteRoom: (id) => {
    const { floorPlan } = get();
    if (!floorPlan) return;
    set({
      floorPlan: {
        ...floorPlan,
        rooms: floorPlan.rooms.filter((r) => r.id !== id),
      },
      selectedTarget: null,
    });
    get().pushHistory();
  },

  addRoom: (roomData) => {
    const { floorPlan } = get();
    const room: Room = { ...roomData, id: uuidv4() };

    if (floorPlan) {
      set({
        floorPlan: {
          ...floorPlan,
          rooms: [...floorPlan.rooms, room],
        },
      });
    } else {
      set({
        floorPlan: {
          rooms: [room],
          walls: [],
          units: "meters",
          scale: 1,
          overallWidth: 12,
          overallHeight: 9,
        },
      });
    }
    get().pushHistory();
    return room;
  },

  moveRoomVertex: (roomId, vertexIndex, newPos) => {
    const { floorPlan } = get();
    if (!floorPlan) return;

    const room = floorPlan.rooms.find((r) => r.id === roomId);
    if (!room || vertexIndex < 0 || vertexIndex >= room.vertices.length) return;

    const oldPos = room.vertices[vertexIndex];

    // Find co-located vertices
    const colocated = findColocatedVertices(
      oldPos,
      floorPlan.walls,
      floorPlan.rooms,
      undefined,
      roomId
    );

    // Move the room vertex
    const newVertices = room.vertices.map((v, i) =>
      i === vertexIndex ? { ...newPos } : v
    );

    let updated: FloorPlanData = {
      ...floorPlan,
      rooms: floorPlan.rooms.map((r) =>
        r.id === roomId
          ? { ...r, vertices: newVertices, area: recalculateRoomArea(newVertices) }
          : r
      ),
    };

    // Move shared vertices
    if (colocated.length > 0) {
      updated = moveSharedVertices(newPos, colocated, updated);
    }

    set({ floorPlan: updated });
  },

  // Canvas settings
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  showGrid: true,
  snapEnabled: true,
  pixelsPerUnit: 30,

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),
  setPanOffset: (offset) => set({ panOffset: offset }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  setPixelsPerUnit: (ppu) => set({ pixelsPerUnit: ppu }),

  isAnalyzing: false,
  analysisError: null,
  analysisProgress: null,
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),
  setAnalysisError: (err) => set({ analysisError: err }),
  setAnalysisProgress: (progress) => set({ analysisProgress: progress }),

  history: [{ furniture: [], floorPlan: null }],
  historyIndex: 0,

  pushHistory: () => {
    const { furniture, floorPlan, history, historyIndex } = get();
    const snapshot: HistorySnapshot = {
      furniture: JSON.parse(JSON.stringify(furniture)),
      floorPlan: floorPlan ? JSON.parse(JSON.stringify(floorPlan)) : null,
    };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(snapshot);
    if (newHistory.length > 50) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { historyIndex, history } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const snapshot = history[newIndex];
    set({
      furniture: JSON.parse(JSON.stringify(snapshot.furniture)),
      floorPlan: snapshot.floorPlan
        ? JSON.parse(JSON.stringify(snapshot.floorPlan))
        : null,
      historyIndex: newIndex,
      selectedFurnitureId: null,
      selectedTarget: null,
    });
  },

  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    const snapshot = history[newIndex];
    set({
      furniture: JSON.parse(JSON.stringify(snapshot.furniture)),
      floorPlan: snapshot.floorPlan
        ? JSON.parse(JSON.stringify(snapshot.floorPlan))
        : null,
      historyIndex: newIndex,
      selectedFurnitureId: null,
      selectedTarget: null,
    });
  },

  showImageOverlay: false,
  toggleImageOverlay: () =>
    set((s) => ({ showImageOverlay: !s.showImageOverlay })),
  setShowImageOverlay: (v) => set({ showImageOverlay: v }),

  calibrationPoints: null,
  setCalibrationPoints: (pts) => set({ calibrationPoints: pts }),

  saveToFile: () => {
    const { floorPlan, furniture, uploadedImage, pixelsPerUnit, zoom, panOffset } = get();
    const saveData: RoomySaveFile = {
      version: 1,
      savedAt: new Date().toISOString(),
      floorPlan: floorPlan ? JSON.parse(JSON.stringify(floorPlan)) : null,
      furniture: JSON.parse(JSON.stringify(furniture)),
      uploadedImage,
      canvasSettings: { pixelsPerUnit, zoom, panOffset: { ...panOffset } },
    };
    const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `roomy-${new Date().toISOString().slice(0, 19)}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  },

  loadFromFile: (data) => {
    set({
      floorPlan: data.floorPlan,
      furniture: data.furniture,
      uploadedImage: data.uploadedImage,
      pixelsPerUnit: data.canvasSettings.pixelsPerUnit,
      zoom: data.canvasSettings.zoom,
      panOffset: data.canvasSettings.panOffset,
      selectedFurnitureId: null,
      selectedTarget: null,
      drawState: null,
      activeTool: "select" as EditorTool,
    });
    get().pushHistory();
  },

  shareToUrl: () => {
    const { floorPlan, furniture, pixelsPerUnit, zoom, panOffset } = get();
    const saveData: RoomySaveFile = {
      version: 1,
      savedAt: new Date().toISOString(),
      floorPlan: floorPlan ? JSON.parse(JSON.stringify(floorPlan)) : null,
      furniture: JSON.parse(JSON.stringify(furniture)),
      uploadedImage: null,
      canvasSettings: { pixelsPerUnit, zoom, panOffset: { ...panOffset } },
    };
    const compressed = encodeFloorPlan(saveData);
    return `${window.location.origin}${window.location.pathname}#plan=${compressed}`;
  },

  applyScaleCalibration: (realWorldDistance) => {
    const { floorPlan, furniture, calibrationPoints } = get();
    if (!floorPlan || !calibrationPoints?.first || !calibrationPoints?.second) return;

    const p1 = calibrationPoints.first;
    const p2 = calibrationPoints.second;
    const currentDistance = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    if (currentDistance === 0) return;

    const factor = realWorldDistance / currentDistance;

    const scaledFloorPlan: FloorPlanData = {
      ...floorPlan,
      overallWidth: floorPlan.overallWidth * factor,
      overallHeight: floorPlan.overallHeight * factor,
      walls: floorPlan.walls.map((w) => ({
        ...w,
        start: { x: w.start.x * factor, y: w.start.y * factor },
        end: { x: w.end.x * factor, y: w.end.y * factor },
        thickness: w.thickness * factor,
        openings: w.openings?.map((o) => ({ ...o, width: o.width * factor })),
      })),
      rooms: floorPlan.rooms.map((r) => ({
        ...r,
        vertices: r.vertices.map((v) => ({ x: v.x * factor, y: v.y * factor })),
        area: r.area * factor * factor,
      })),
    };

    const scaledFurniture = furniture.map((f) => ({
      ...f,
      x: f.x * factor,
      y: f.y * factor,
      width: f.width * factor,
      height: f.height * factor,
    }));

    set({
      floorPlan: scaledFloorPlan,
      furniture: scaledFurniture,
      calibrationPoints: null,
      activeTool: "select" as EditorTool,
    });
    get().pushHistory();
  },
}));
