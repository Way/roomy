"use client";

import { useState, useRef } from "react";
import { furnitureCatalog, categoryLabels } from "@/lib/furniture-catalog";
import { useFloorPlanStore } from "@/store/floor-plan-store";
import { useCustomFurnitureStore } from "@/store/custom-furniture-store";
import { FurnitureDef, FurnitureCategory, CustomFurnitureDef } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CustomFurnitureDialog } from "@/components/CustomFurnitureDialog";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, X, Download, Upload, Loader2, Sparkles } from "lucide-react";

const categories: FurnitureCategory[] = [
  "living",
  "bedroom",
  "kitchen",
  "bathroom",
  "office",
  "dining",
  "custom",
];

export function FurnitureLibrary() {
  const addFurniture = useFloorPlanStore((s) => s.addFurniture);
  const customItems = useCustomFurnitureStore((s) => s.items);
  const removeItem = useCustomFurnitureStore((s) => s.removeItem);
  const exportToFile = useCustomFurnitureStore((s) => s.exportToFile);
  const importFromFile = useCustomFurnitureStore((s) => s.importFromFile);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<CustomFurnitureDef | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nluText, setNluText] = useState("");
  const [nluLoading, setNluLoading] = useState(false);
  const [nluError, setNluError] = useState<string | null>(null);

  const handleNluSubmit = async () => {
    const text = nluText.trim();
    if (!text || nluLoading) return;

    setNluLoading(true);
    setNluError(null);

    try {
      const res = await fetch("/api/parse-furniture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to parse");
      }

      const parsed = await res.json();

      addFurniture({
        type: `nlu-${Date.now()}`,
        label: parsed.label,
        category: parsed.category,
        shape: parsed.shape,
        defaultWidth: parsed.width,
        defaultHeight: parsed.height,
        color: parsed.color,
      });

      setNluText("");
    } catch (err) {
      setNluError(err instanceof Error ? err.message : "Failed to parse");
    } finally {
      setNluLoading(false);
    }
  };

  const handleAdd = (def: FurnitureDef) => {
    addFurniture(def);
  };

  const handleCreate = () => {
    setEditItem(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (item: CustomFurnitureDef) => {
    setEditItem(item);
    setDialogOpen(true);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importFromFile(reader.result as string);
      if (!result.success) {
        alert(result.error);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const getItemsForCategory = (cat: FurnitureCategory) => {
    const builtIn = furnitureCatalog.filter((f) => f.category === cat);
    const custom = customItems.filter((f) => f.category === cat);
    return { builtIn, custom };
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Furniture</h3>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleCreate}
          >
            <Plus className="h-3 w-3" />
            Create Custom
          </Button>
        </div>
        <div className="mb-2">
          <div className="flex gap-1">
            <Input
              value={nluText}
              onChange={(e) => {
                setNluText(e.target.value);
                if (nluError) setNluError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNluSubmit();
              }}
              placeholder='e.g. Black Table 160x80'
              className="h-7 text-xs"
              disabled={nluLoading}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 shrink-0"
              onClick={handleNluSubmit}
              disabled={!nluText.trim() || nluLoading}
            >
              {nluLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
            </Button>
          </div>
          {nluError && (
            <p className="text-xs text-destructive mt-1">{nluError}</p>
          )}
        </div>

        <Accordion type="multiple" defaultValue={categories}>
          {categories.map((cat) => {
            const { builtIn, custom } = getItemsForCategory(cat);
            if (builtIn.length === 0 && custom.length === 0) return null;
            return (
              <AccordionItem key={cat} value={cat}>
                <AccordionTrigger className="text-xs py-2">
                  {categoryLabels[cat]}
                  {custom.length > 0 && (
                    <span className="ml-1 text-muted-foreground">
                      (+{custom.length})
                    </span>
                  )}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-1.5">
                    {builtIn.map((def) => (
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
                    {custom.map((def) => (
                      <div key={def.id} className="relative group">
                        <button
                          onClick={() => handleAdd(def)}
                          className="flex flex-col items-center gap-1 p-2 rounded-md border border-dashed border-border hover:bg-accent hover:border-accent-foreground/20 transition-colors text-xs w-full"
                        >
                          <div
                            className={`w-8 h-6 ${def.shape === "circle" ? "rounded-full" : "rounded-sm"}`}
                            style={{ backgroundColor: def.color }}
                          />
                          <span className="text-center leading-tight text-muted-foreground">
                            {def.label}
                          </span>
                        </button>
                        <div className="absolute top-0.5 right-0.5 hidden group-hover:flex gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(def);
                            }}
                            className="p-0.5 rounded bg-background/80 hover:bg-accent border border-border"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeItem(def.id);
                            }}
                            className="p-0.5 rounded bg-background/80 hover:bg-destructive/20 border border-border"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <div className="flex gap-2 mt-3 pt-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs gap-1"
            onClick={exportToFile}
            disabled={customItems.length === 0}
          >
            <Download className="h-3 w-3" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs gap-1"
            onClick={handleImport}
          >
            <Upload className="h-3 w-3" />
            Import
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <CustomFurnitureDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editItem={editItem}
      />
    </ScrollArea>
  );
}
