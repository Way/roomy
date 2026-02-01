"use client";

import { furnitureCatalog, categoryLabels } from "@/lib/furniture-catalog";
import { useFloorPlanStore } from "@/store/floor-plan-store";
import { FurnitureDef, FurnitureCategory } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const categories: FurnitureCategory[] = [
  "living",
  "bedroom",
  "kitchen",
  "bathroom",
  "office",
  "dining",
];

export function FurnitureLibrary() {
  const addFurniture = useFloorPlanStore((s) => s.addFurniture);

  const handleAdd = (def: FurnitureDef) => {
    addFurniture(def);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <h3 className="text-sm font-semibold mb-2 text-foreground">Furniture</h3>
        <Accordion type="multiple" defaultValue={categories}>
          {categories.map((cat) => {
            const items = furnitureCatalog.filter((f) => f.category === cat);
            return (
              <AccordionItem key={cat} value={cat}>
                <AccordionTrigger className="text-xs py-2">
                  {categoryLabels[cat]}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((def) => (
                      <button
                        key={def.type}
                        onClick={() => handleAdd(def)}
                        className="flex flex-col items-center gap-1 p-2 rounded-md border border-border hover:bg-accent hover:border-accent-foreground/20 transition-colors text-xs"
                      >
                        <div
                          className={`w-8 h-6 ${def.shape === "circle" ? "rounded-full" : "rounded-sm"}`}
                          style={{ backgroundColor: def.color }}
                        />
                        <span className="text-center leading-tight text-muted-foreground">
                          {def.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </ScrollArea>
  );
}
