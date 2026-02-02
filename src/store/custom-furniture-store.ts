import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod/v4";
import {
  CustomFurnitureDef,
  RoomyFurnitureLibraryFile,
} from "@/lib/types";

const CustomFurnitureDefSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  category: z.enum([
    "living",
    "bedroom",
    "kitchen",
    "bathroom",
    "office",
    "dining",
    "custom",
  ]),
  shape: z.enum(["rect", "circle", "ellipse"]),
  defaultWidth: z.number().positive(),
  defaultHeight: z.number().positive(),
  color: z.string(),
  isCustom: z.literal(true),
  createdAt: z.string(),
});

const FurnitureLibraryFileSchema = z.object({
  version: z.literal(1),
  savedAt: z.string(),
  furniture: z.array(CustomFurnitureDefSchema),
});

interface CustomFurnitureState {
  items: CustomFurnitureDef[];
  addItem: (item: Omit<CustomFurnitureDef, "id" | "type" | "isCustom" | "createdAt">) => void;
  updateItem: (id: string, updates: Partial<Omit<CustomFurnitureDef, "id" | "type" | "isCustom" | "createdAt">>) => void;
  removeItem: (id: string) => void;
  exportToFile: () => void;
  importFromFile: (json: string) => { success: boolean; error?: string; count?: number };
}

export const useCustomFurnitureStore = create<CustomFurnitureState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const id = uuidv4();
        const newItem: CustomFurnitureDef = {
          ...item,
          id,
          type: `custom-${id}`,
          isCustom: true,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ items: [...state.items, newItem] }));
      },

      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      exportToFile: () => {
        const { items } = get();
        const file: RoomyFurnitureLibraryFile = {
          version: 1,
          savedAt: new Date().toISOString(),
          furniture: items,
        };
        const blob = new Blob([JSON.stringify(file, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "custom-furniture.roomy-furniture.json";
        a.click();
        URL.revokeObjectURL(url);
      },

      importFromFile: (json: string) => {
        try {
          const parsed = JSON.parse(json);
          const result = FurnitureLibraryFileSchema.safeParse(parsed);
          if (!result.success) {
            return { success: false, error: "Invalid furniture library file format." };
          }
          const imported = result.data.furniture.map((item) => {
            const id = uuidv4();
            return {
              ...item,
              id,
              type: `custom-${id}`,
              createdAt: new Date().toISOString(),
            } satisfies CustomFurnitureDef;
          });
          set((state) => ({ items: [...state.items, ...imported] }));
          return { success: true, count: imported.length };
        } catch {
          return { success: false, error: "Failed to parse JSON file." };
        }
      },
    }),
    { name: "roomy-custom-furniture" }
  )
);
