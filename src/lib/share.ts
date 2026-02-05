import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import type { RoomySaveFile } from "@/lib/types";
import { RoomySaveFileSchema } from "@/store/floor-plan-store";

const HASH_PREFIX = "#plan=";

export function encodeFloorPlan(data: RoomySaveFile): string {
  const shareData: RoomySaveFile = { ...data, uploadedImage: null };
  return compressToEncodedURIComponent(JSON.stringify(shareData));
}

export function decodeFloorPlan(compressed: string): RoomySaveFile {
  const json = decompressFromEncodedURIComponent(compressed);
  if (!json) throw new Error("Failed to decompress plan data");
  return RoomySaveFileSchema.parse(JSON.parse(json));
}

export function extractPlanFromHash(): RoomySaveFile | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash.startsWith(HASH_PREFIX)) return null;
  try {
    return decodeFloorPlan(hash.slice(HASH_PREFIX.length));
  } catch (e) {
    console.error("Failed to load plan from URL:", e);
    return null;
  }
}
