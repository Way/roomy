"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomFurnitureDef, FurnitureCategory, FurnitureShape } from "@/lib/types";
import { categoryLabels } from "@/lib/furniture-catalog";
import { useCustomFurnitureStore } from "@/store/custom-furniture-store";

const categoryOptions: { value: FurnitureCategory; label: string }[] = [
  { value: "living", label: categoryLabels.living },
  { value: "bedroom", label: categoryLabels.bedroom },
  { value: "kitchen", label: categoryLabels.kitchen },
  { value: "bathroom", label: categoryLabels.bathroom },
  { value: "office", label: categoryLabels.office },
  { value: "dining", label: categoryLabels.dining },
  { value: "custom", label: categoryLabels.custom },
];

const shapeOptions: { value: FurnitureShape; label: string }[] = [
  { value: "rect", label: "Rectangle" },
  { value: "circle", label: "Circle" },
  { value: "ellipse", label: "Ellipse" },
];

interface CustomFurnitureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: CustomFurnitureDef;
}

function FurnitureForm({
  editItem,
  onClose,
}: {
  editItem?: CustomFurnitureDef;
  onClose: () => void;
}) {
  const addItem = useCustomFurnitureStore((s) => s.addItem);
  const updateItem = useCustomFurnitureStore((s) => s.updateItem);

  const [name, setName] = useState(editItem?.label ?? "");
  const [category, setCategory] = useState<FurnitureCategory>(
    editItem?.category ?? "custom"
  );
  const [shape, setShape] = useState<FurnitureShape>(editItem?.shape ?? "rect");
  const [width, setWidth] = useState(
    editItem ? String(editItem.defaultWidth) : "1.0"
  );
  const [height, setHeight] = useState(
    editItem ? String(editItem.defaultHeight) : "1.0"
  );
  const [color, setColor] = useState(editItem?.color ?? "#8B8B8B");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(width);
    const h = parseFloat(height);
    if (!name.trim() || isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return;

    const data = {
      label: name.trim(),
      category,
      shape,
      defaultWidth: w,
      defaultHeight: h,
      color,
    };

    if (editItem) {
      updateItem(editItem.id, data);
    } else {
      addItem(data);
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="furniture-name">Name</Label>
        <Input
          id="furniture-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Standing Desk"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="furniture-category">Category</Label>
        <select
          id="furniture-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as FurnitureCategory)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {categoryOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="furniture-shape">Shape</Label>
        <select
          id="furniture-shape"
          value={shape}
          onChange={(e) => setShape(e.target.value as FurnitureShape)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {shapeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="furniture-width">Width (m)</Label>
          <Input
            id="furniture-width"
            type="number"
            step="0.01"
            min="0.05"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="furniture-height">Depth (m)</Label>
          <Input
            id="furniture-height"
            type="number"
            step="0.01"
            min="0.05"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="furniture-color">Color</Label>
        <div className="flex items-center gap-2">
          <input
            id="furniture-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 rounded border border-input cursor-pointer"
          />
          <Input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="flex-1 font-mono"
            placeholder="#000000"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {editItem ? "Save" : "Create"}
        </Button>
      </div>
    </form>
  );
}

export function CustomFurnitureDialog({
  open,
  onOpenChange,
  editItem,
}: CustomFurnitureDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {editItem ? "Edit Custom Furniture" : "Create Custom Furniture"}
          </DialogTitle>
        </DialogHeader>
        {open && (
          <FurnitureForm
            key={editItem?.id ?? "new"}
            editItem={editItem}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
