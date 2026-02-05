# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `bun run dev` — start Next.js dev server (http://localhost:3000)
- `bun run build` — production build
- `bun run lint` — run ESLint (flat config with Next.js core-web-vitals + TypeScript rules)
- `bun install` — install dependencies

No test framework is configured.

## Environment

Requires `ANTHROPIC_API_KEY` env var for floor plan image analysis (Claude API).

## Architecture

**Roomy** is a single-page 2D room planning app built with Next.js 16 (App Router) + React 19 + TypeScript. Users upload a floor plan image, which is analyzed by Claude's vision API to extract rooms/walls/furniture, then edit the result on an interactive canvas.

### Key layers

- **Canvas rendering**: `react-konva` (Konva.js) handles all 2D drawing in `FloorPlanCanvas`. Components like `EditableRoomShape`, `EditableWallLine`, `FurnitureItem`, `WallLine`, `RoomShape` are Konva node wrappers.
- **State management**: Single Zustand store (`src/store/floor-plan-store.ts`) holds all app state — floor plan data, furniture, editor tool, selection, draw state, canvas settings, undo/redo history. Most components read/write through `useFloorPlanStore`.
- **AI analysis pipeline**: Image upload → `useAnalyzeFloorPlan` hook → `POST /api/analyze-floorplan` (Next.js route handler) → Anthropic SDK with vision → `parseLLMResponse` (Zod-validated) → store update. SVGs are rasterized to PNG before sending.
- **UI**: shadcn/ui (new-york style) + Tailwind CSS v4 + Radix primitives. Components in `src/components/ui/`.

### Floor plan data model (`src/lib/types.ts`)

- `FloorPlanData`: top-level container with `rooms: Room[]`, `walls: Wall[]`, units, scale, dimensions
- `Room`: named polygon (`vertices: Point[]`) with area and color
- `Wall`: line segment with thickness, optional `openings: WallOpening[]` (doors/windows)
- `PlacedFurniture`: positioned item with shape (rect/circle/ellipse), dimensions, rotation
- `EditorTool`: select | draw-wall | draw-room | add-door | add-window

### Geometry and snapping

- `src/lib/geometry.ts` — math utilities (distance, polygon area, point projection, grid snap)
- `src/lib/snapping.ts` — multi-priority snap system: endpoint magnetic snap → alignment guides → angle snap (45° increments) → grid snap
- `src/lib/vertex-utils.ts` — co-located vertex detection and shared vertex movement (walls and rooms share endpoints)

### Page structure

Single page (`src/app/page.tsx`) with three-panel layout:
- Left sidebar: `FloorPlanUploader` + `FurnitureLibrary` (catalog from `src/lib/furniture-catalog.ts`)
- Center: `FloorPlanCanvas` + `DimensionEditOverlay` (HTML overlay for inline dimension editing)
- Right sidebar: `PropertyPanel` (context-sensitive properties for selected wall/room/furniture)

`FloorPlanCanvas` and `DimensionEditOverlay` are dynamically imported with `ssr: false` since Konva requires the DOM.

### Path alias

`@/*` maps to `./src/*` (configured in tsconfig.json and used throughout).
