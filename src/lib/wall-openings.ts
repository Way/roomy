import { Wall, WallOpening } from "./types";
import { v4 as uuidv4 } from "uuid";

/**
 * Converts legacy hasDoor/hasWindow booleans into the openings[] array.
 * Idempotent: if openings already exist, returns wall unchanged.
 */
export function normalizeWallOpenings(wall: Wall): Wall {
  if (wall.openings && wall.openings.length > 0) return wall;

  const openings: WallOpening[] = [];
  if (wall.hasDoor) {
    openings.push({ id: uuidv4(), type: "door", position: 0.5, width: 2.5 });
  }
  if (wall.hasWindow) {
    openings.push({
      id: uuidv4(),
      type: "window",
      position: 0.5,
      width: 2.0,
    });
  }

  return {
    ...wall,
    openings,
    hasDoor: false,
    hasWindow: false,
  };
}
