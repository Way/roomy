"use client";

import { useRef, useEffect, useCallback } from "react";
import { Rect, Circle, Group, Text, Transformer } from "react-konva";
import Konva from "konva";
import { PlacedFurniture } from "@/lib/types";
import { useFloorPlanStore } from "@/store/floor-plan-store";
import { snapToGrid, GRID_SIZE_METERS, contrastTextColor } from "@/lib/geometry";
import { computeFurnitureSnap, snapRotation } from "@/lib/snapping";

interface FurnitureItemProps {
  item: PlacedFurniture;
  pixelsPerUnit: number;
  isSelected: boolean;
  onContextMenu?: (e: { itemId: string; clientX: number; clientY: number }) => void;
}

export function FurnitureItem({ item, pixelsPerUnit, isSelected, onContextMenu }: FurnitureItemProps) {
  const shapeRef = useRef<Konva.Rect | Konva.Circle>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const { selectFurniture, updateFurniture, snapEnabled, floorPlan, furniture, setAlignmentGuides } = useFloorPlanStore();

  useEffect(() => {
    if (isSelected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const getSnapContext = useCallback(() => ({
    snapToGrid: snapEnabled,
    gridSize: GRID_SIZE_METERS,
    walls: floorPlan?.walls ?? [],
    rooms: floorPlan?.rooms ?? [],
    furniture,
    excludeFurnitureId: item.id,
  }), [snapEnabled, floorPlan, furniture, item.id]);

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!snapEnabled) return;
      const rawX = e.target.x() / pixelsPerUnit;
      const rawY = e.target.y() / pixelsPerUnit;

      const snap = computeFurnitureSnap(rawX, rawY, item.width, item.height, getSnapContext(), item.rotation);
      e.target.x(snap.x * pixelsPerUnit);
      e.target.y(snap.y * pixelsPerUnit);
      setAlignmentGuides(snap.guides);
    },
    [pixelsPerUnit, snapEnabled, item.width, item.height, item.rotation, getSnapContext, setAlignmentGuides]
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const rawX = e.target.x() / pixelsPerUnit;
      const rawY = e.target.y() / pixelsPerUnit;

      if (snapEnabled) {
        const snap = computeFurnitureSnap(rawX, rawY, item.width, item.height, getSnapContext(), item.rotation);
        updateFurniture(item.id, { x: snap.x, y: snap.y });
      } else {
        updateFurniture(item.id, { x: rawX, y: rawY });
      }

      setAlignmentGuides([]);
      useFloorPlanStore.getState().pushHistory();
    },
    [item.id, item.width, item.height, pixelsPerUnit, snapEnabled, updateFurniture, getSnapContext, setAlignmentGuides]
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
    let newRotation = node.rotation();

    if (snapEnabled) {
      newWidth = snapToGrid(newWidth, GRID_SIZE_METERS);
      newHeight = snapToGrid(newHeight, GRID_SIZE_METERS);
      newRotation = snapRotation(newRotation);
    }

    let newX = node.x() / pixelsPerUnit;
    let newY = node.y() / pixelsPerUnit;

    if (snapEnabled) {
      const snap = computeFurnitureSnap(newX, newY, Math.max(0.05, newWidth), Math.max(0.05, newHeight), getSnapContext(), newRotation);
      newX = snap.x;
      newY = snap.y;
    }

    updateFurniture(item.id, {
      x: newX,
      y: newY,
      width: Math.max(0.05, newWidth),
      height: Math.max(0.05, newHeight),
      rotation: newRotation,
    });
    useFloorPlanStore.getState().pushHistory();
  }, [item, pixelsPerUnit, snapEnabled, updateFurniture, getSnapContext]);

  const px = item.x * pixelsPerUnit;
  const py = item.y * pixelsPerUnit;
  const pw = item.width * pixelsPerUnit;
  const ph = item.height * pixelsPerUnit;

  const handleClick = useCallback(() => {
    selectFurniture(item.id);
  }, [item.id, selectFurniture]);

  const handleContextMenu = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      e.evt.stopPropagation();
      selectFurniture(item.id);
      onContextMenu?.({
        itemId: item.id,
        clientX: e.evt.clientX,
        clientY: e.evt.clientY,
      });
    },
    [item.id, selectFurniture, onContextMenu]
  );

  const labelFontSize = Math.min(10, Math.max(7, pw / item.label.length));

  // Compute the visual center of the shape after rotation
  const isCircle = item.shape === "circle";
  const rad = ((item.rotation ?? 0) * Math.PI) / 180;
  const labelCenterX = isCircle
    ? px + pw / 2
    : px + (pw / 2) * Math.cos(rad) - (ph / 2) * Math.sin(rad);
  const labelCenterY = isCircle
    ? py + ph / 2
    : py + (pw / 2) * Math.sin(rad) + (ph / 2) * Math.cos(rad);

  return (
    <Group>
      {isCircle ? (
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
          onContextMenu={handleContextMenu}
          onDragMove={handleDragMove}
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
          onContextMenu={handleContextMenu}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onTransformEnd={handleTransformEnd}
        />
      )}
      <Text
        x={labelCenterX}
        y={labelCenterY - labelFontSize / 2}
        width={pw}
        offsetX={pw / 2}
        text={item.label}
        fontSize={labelFontSize}
        fill={contrastTextColor(item.color)}
        align="center"
        listening={false}
      />
      {isSelected && (
        <Transformer
          ref={transformerRef}
          rotateEnabled
          rotationSnaps={snapEnabled ? [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345] : []}
          rotationSnapTolerance={10}
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
