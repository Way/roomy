"use client";

import { useEffect, useRef, useState } from "react";
import { useFloorPlanStore } from "@/store/floor-plan-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CalibrationDialog() {
  const { calibrationPoints, setCalibrationPoints, applyScaleCalibration, floorPlan } =
    useFloorPlanStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  const isOpen = !!(calibrationPoints?.first && calibrationPoints?.second);

  // Compute current distance between the two points
  const currentDistance =
    isOpen
      ? Math.sqrt(
          (calibrationPoints!.second!.x - calibrationPoints!.first.x) ** 2 +
            (calibrationPoints!.second!.y - calibrationPoints!.first.y) ** 2
        )
      : 0;

  // Pre-fill with current distance when dialog opens
  useEffect(() => {
    if (isOpen) {
      setValue(currentDistance.toFixed(2));
      // Focus input after render
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [isOpen, currentDistance]);

  if (!isOpen) return null;

  const handleApply = () => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    applyScaleCalibration(num);
  };

  const handleCancel = () => {
    setCalibrationPoints(null);
    useFloorPlanStore.getState().setActiveTool("select");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const units = floorPlan?.units ?? "meters";

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20">
      <div
        className="bg-background border border-border rounded-lg shadow-lg p-4 w-72 space-y-3"
        onKeyDown={handleKeyDown}
      >
        <h3 className="text-sm font-semibold">Set Real-World Distance</h3>
        <p className="text-xs text-muted-foreground">
          Current distance between the two points: {currentDistance.toFixed(2)} {units}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="calibration-distance" className="text-xs">
            Real distance ({units})
          </Label>
          <Input
            ref={inputRef}
            id="calibration-distance"
            type="number"
            step="0.01"
            min="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" className="text-xs" onClick={handleCancel}>
            Cancel
          </Button>
          <Button size="sm" className="text-xs" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
