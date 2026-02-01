import { FurnitureDef } from "./types";

export const furnitureCatalog: FurnitureDef[] = [
  // Living Room
  { type: "sofa-3seat", label: "3-Seat Sofa", category: "living", shape: "rect", defaultWidth: 2.1, defaultHeight: 0.9, color: "#6B8E9B" },
  { type: "sofa-2seat", label: "2-Seat Sofa", category: "living", shape: "rect", defaultWidth: 1.5, defaultHeight: 0.9, color: "#6B8E9B" },
  { type: "armchair", label: "Armchair", category: "living", shape: "rect", defaultWidth: 0.8, defaultHeight: 0.8, color: "#7BA196" },
  { type: "coffee-table", label: "Coffee Table", category: "living", shape: "rect", defaultWidth: 1.2, defaultHeight: 0.6, color: "#B8956A" },
  { type: "tv-stand", label: "TV Stand", category: "living", shape: "rect", defaultWidth: 1.5, defaultHeight: 0.45, color: "#8B7355" },
  { type: "bookshelf", label: "Bookshelf", category: "living", shape: "rect", defaultWidth: 0.9, defaultHeight: 0.3, color: "#8B7355" },
  { type: "round-table", label: "Round Side Table", category: "living", shape: "circle", defaultWidth: 0.6, defaultHeight: 0.6, color: "#B8956A" },

  // Bedroom
  { type: "bed-king", label: "King Bed", category: "bedroom", shape: "rect", defaultWidth: 2.0, defaultHeight: 2.0, color: "#9B8EC6" },
  { type: "bed-queen", label: "Queen Bed", category: "bedroom", shape: "rect", defaultWidth: 1.5, defaultHeight: 2.0, color: "#9B8EC6" },
  { type: "bed-twin", label: "Twin Bed", category: "bedroom", shape: "rect", defaultWidth: 1.0, defaultHeight: 2.0, color: "#9B8EC6" },
  { type: "nightstand", label: "Nightstand", category: "bedroom", shape: "rect", defaultWidth: 0.6, defaultHeight: 0.45, color: "#B8956A" },
  { type: "dresser", label: "Dresser", category: "bedroom", shape: "rect", defaultWidth: 1.5, defaultHeight: 0.45, color: "#8B7355" },
  { type: "wardrobe", label: "Wardrobe", category: "bedroom", shape: "rect", defaultWidth: 1.2, defaultHeight: 0.6, color: "#8B7355" },

  // Kitchen
  { type: "counter", label: "Counter", category: "kitchen", shape: "rect", defaultWidth: 1.2, defaultHeight: 0.6, color: "#A0A0A0" },
  { type: "island", label: "Kitchen Island", category: "kitchen", shape: "rect", defaultWidth: 1.5, defaultHeight: 0.9, color: "#A0A0A0" },
  { type: "fridge", label: "Refrigerator", category: "kitchen", shape: "rect", defaultWidth: 0.75, defaultHeight: 0.75, color: "#C0C0C0" },
  { type: "stove", label: "Stove/Oven", category: "kitchen", shape: "rect", defaultWidth: 0.75, defaultHeight: 0.6, color: "#808080" },
  { type: "sink-kitchen", label: "Kitchen Sink", category: "kitchen", shape: "rect", defaultWidth: 0.6, defaultHeight: 0.6, color: "#B0C4DE" },

  // Bathroom
  { type: "bathtub", label: "Bathtub", category: "bathroom", shape: "rect", defaultWidth: 1.5, defaultHeight: 0.75, color: "#B0C4DE" },
  { type: "shower", label: "Shower", category: "bathroom", shape: "rect", defaultWidth: 0.9, defaultHeight: 0.9, color: "#87CEEB" },
  { type: "toilet", label: "Toilet", category: "bathroom", shape: "rect", defaultWidth: 0.45, defaultHeight: 0.7, color: "#E8E8E8" },
  { type: "sink-bath", label: "Bathroom Sink", category: "bathroom", shape: "rect", defaultWidth: 0.6, defaultHeight: 0.45, color: "#B0C4DE" },

  // Office
  { type: "desk", label: "Desk", category: "office", shape: "rect", defaultWidth: 1.5, defaultHeight: 0.75, color: "#B8956A" },
  { type: "office-chair", label: "Office Chair", category: "office", shape: "circle", defaultWidth: 0.6, defaultHeight: 0.6, color: "#555555" },
  { type: "filing-cabinet", label: "Filing Cabinet", category: "office", shape: "rect", defaultWidth: 0.45, defaultHeight: 0.6, color: "#808080" },

  // Dining
  { type: "dining-table-rect", label: "Dining Table (Rect)", category: "dining", shape: "rect", defaultWidth: 1.5, defaultHeight: 0.9, color: "#B8956A" },
  { type: "dining-table-round", label: "Dining Table (Round)", category: "dining", shape: "circle", defaultWidth: 1.2, defaultHeight: 1.2, color: "#B8956A" },
  { type: "dining-chair", label: "Dining Chair", category: "dining", shape: "rect", defaultWidth: 0.45, defaultHeight: 0.45, color: "#8B7355" },
];

export const categoryLabels: Record<string, string> = {
  living: "Living Room",
  bedroom: "Bedroom",
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  office: "Office",
  dining: "Dining",
};
