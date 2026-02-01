"use client";

import { useRef, useEffect, useCallback } from "react";
import { Rect, Circle, Group, Text, Transformer } from "react-konva";
import Konva from "konva";
import { PlacedFurniture } from "@/lib/types";
import { useFloorPlanStore } from "@/store/floor-plan-store";
import { snapToGrid, GRID_SIZE_METERS } from "@/lib/geometry";

interface FurnitureItemProps {
  item: PlacedFurniture;
  pixelsPerUnit: number;
  isSelected: boolean;
}

export function FurnitureItem({ item, pixelsPerUnit, isSelected }: FurnitureItemProps) {
  const shapeRef = useRef<Konva.Rect | Konva.Circle>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const { selectFurniture, updateFurniture, snapEnabled } = useFloorPlanStore();

  useEffect(() => {
    if (isSelected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      let x = e.target.x() / pixelsPerUnit;
      let y = e.target.y() / pixelsPerUnit;

      if (snapEnabled) {
        x = snapToGrid(x, GRID_SIZE_METERS);
        y = snapToGrid(y, GRID_SIZE_METERS);
      }

      updateFurniture(item.id, { x, y });
      useFloorPlanStore.getState().pushHistory();
    },
    [item.id, pixelsPerUnit, snapEnabled, updateFurniture]
  );

  const handleTransformEnd = useCallback(() => {
    const node = shapeRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale and apply to width/height
    node.scaleX(1);
    node.scaleY(1);

    let newWidth = (item.width * pixelsPerUnit * scaleX) / pixelsPerUnit;
    let newHeight = (item.height * pixelsPerUnit * scaleY) / pixelsPerUnit;

    if (snapEnabled) {
      newWidth = snapToGrid(newWidth, GRID_SIZE_METERS);
      newHeight = snapToGrid(newHeight, GRID_SIZE_METERS);
    }

    updateFurniture(item.id, {
      x: node.x() / pixelsPerUnit,
      y: node.y() / pixelsPerUnit,
      width: Math.max(0.5, newWidth),
      height: Math.max(0.5, newHeight),
      rotation: node.rotation(),
    });
    useFloorPlanStore.getState().pushHistory();
  }, [item, pixelsPerUnit, snapEnabled, updateFurniture]);

  const px = item.x * pixelsPerUnit;
  const py = item.y * pixelsPerUnit;
  const pw = item.width * pixelsPerUnit;
  const ph = item.height * pixelsPerUnit;

  const handleClick = useCallback(() => {
    selectFurniture(item.id);
  }, [item.id, selectFurniture]);

  const labelFontSize = Math.min(10, Math.max(7, pw / item.label.length));

  return (
    <Group>
      {item.shape === "circle" ? (
        <Circle
          ref={shapeRef as React.RefObject<Konva.Circle>}
          x={px + pw / 2}
          y={py + ph / 2}
          radius={pw / 2}
          fill={item.color}
          stroke={isSelected ? "#2563EB" : "#374151"}
          strokeWidth={isSelected ? 2 : 1}
          rotation={item.rotation}
          draggable
          onClick={handleClick}
          onTap={handleClick}
          onDragEnd={handleDragEnd}
          onTransformEnd={handleTransformEnd}
        />
      ) : (
        <Rect
          ref={shapeRef as React.RefObject<Konva.Rect>}
          x={px}
          y={py}
          width={pw}
          height={ph}
          fill={item.color}
          stroke={isSelected ? "#2563EB" : "#374151"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={2}
          rotation={item.rotation}
          draggable
          onClick={handleClick}
          onTap={handleClick}
          onDragEnd={handleDragEnd}
          onTransformEnd={handleTransformEnd}
        />
      )}
      <Text
        x={px + 2}
        y={py + ph / 2 - labelFontSize / 2}
        width={pw - 4}
        text={item.label}
        fontSize={labelFontSize}
        fill="#1F2937"
        align="center"
        listening={false}
      />
      {isSelected && (
        <Transformer
          ref={transformerRef}
          rotateEnabled
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
            "middle-left",
            "middle-right",
            "top-center",
            "bottom-center",
          ]}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 10 || newBox.height < 10) return oldBox;
            return newBox;
          }}
        />
      )}
    </Group>
  );
}
