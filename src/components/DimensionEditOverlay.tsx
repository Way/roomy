"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useFloorPlanStore } from "@/store/floor-plan-store";
import { distance, resizeWallToLength } from "@/lib/geometry";

interface DimensionEditState {
  wallId: string;
  screenX: number;
  screenY: number;
  currentLength: number;
}

export function DimensionEditOverlay() {
  const [editState, setEditState] = useState<DimensionEditState | null>(null);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { floorPlan } = useFloorPlanStore();
  const units = floorPlan?.units === "feet" ? "ft" : "m";

  // Expose open function globally so DimensionLabel can call it
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__openDimensionEdit = (
      wallId: string,
      screenX: number,
      screenY: number
    ) => {
      const store = useFloorPlanStore.getState();
      const wall = store.floorPlan?.walls.find((w) => w.id === wallId);
      if (!wall) return;
      const len = distance(wall.start, wall.end);
      setEditState({ wallId, screenX, screenY, currentLength: len });
      setInputValue(len.toFixed(1));
    };

    return () => {
      delete (window as unknown as Record<string, unknown>).__openDimensionEdit;
    };
  }, []);

  useEffect(() => {
    if (editState && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editState]);

  const handleSubmit = useCallback(() => {
    if (!editState) return;
    const newLength = parseFloat(inputValue);
    if (isNaN(newLength) || newLength < 0.1) {
      setEditState(null);
      return;
    }

    const store = useFloorPlanStore.getState();
    const wall = store.floorPlan?.walls.find(
      (w) => w.id === editState.wallId
    );
    if (!wall) {
      setEditState(null);
      return;
    }

    const { start, end } = resizeWallToLength(
      wall.start,
      wall.end,
      newLength,
      "start"
    );

    store.moveWallEndpoint(wall.id, "end", end);
    store.pushHistory();
    setEditState(null);
  }, [editState, inputValue]);

  if (!editState) return null;

  return (
    <div
      className="absolute z-50"
      style={{
        left: editState.screenX - 40,
        top: editState.screenY - 16,
      }}
    >
      <div className="flex items-center gap-1 bg-white border border-blue-400 rounded shadow-lg px-1">
        <input
          ref={inputRef}
          type="number"
          step="0.1"
          min="0.1"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") setEditState(null);
          }}
          onBlur={handleSubmit}
          className="w-16 h-6 text-xs text-center border-none outline-none bg-transparent"
        />
        <span className="text-xs text-muted-foreground">{units}</span>
      </div>
    </div>
  );
}
