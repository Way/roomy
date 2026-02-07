"use client";

import { useRef, useEffect } from "react";
import { Stage, Layer, Rect, Circle, Group, Text } from "react-konva";
import Konva from "konva";
import { RoomShape } from "@/components/RoomShape";
import { WallLine } from "@/components/WallLine";
import { DimensionLabel } from "@/components/DimensionLabel";
import { FloorPlanData, PlacedFurniture } from "@/lib/types";
import { contrastTextColor } from "@/lib/geometry";

const PRINT_WIDTH_PX = 750;
const PRINT_HEIGHT_PX = 950;

interface PrintFloorPlanRendererProps {
  floorPlan: FloorPlanData;
  furniture: PlacedFurniture[];
  onImageGenerated: (dataUrl: string, pixelsPerUnit: number) => void;
}

export function calculatePrintPPU(floorPlan: FloorPlanData): number {
  const aspectRatio = floorPlan.overallWidth / floorPlan.overallHeight;
  const ppu =
    aspectRatio > PRINT_WIDTH_PX / PRINT_HEIGHT_PX
      ? PRINT_WIDTH_PX / floorPlan.overallWidth
      : PRINT_HEIGHT_PX / floorPlan.overallHeight;
  return Math.floor(ppu);
}

export function PrintFloorPlanRenderer({
  floorPlan,
  furniture,
  onImageGenerated,
}: PrintFloorPlanRendererProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const printPPU = calculatePrintPPU(floorPlan);
  const stageWidth = Math.ceil(floorPlan.overallWidth * printPPU);
  const stageHeight = Math.ceil(floorPlan.overallHeight * printPPU);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (stageRef.current) {
        const dataUrl = stageRef.current.toDataURL({
          pixelRatio: 3,
          mimeType: "image/png",
        });
        onImageGenerated(dataUrl, printPPU);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [floorPlan, furniture, printPPU, onImageGenerated]);

  return (
    <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
      <Stage ref={stageRef} width={stageWidth} height={stageHeight}>
        {/* Floor plan layer: rooms, walls, dimensions */}
        <Layer>
          {floorPlan.rooms.map((room) => (
            <RoomShape key={room.id} room={room} pixelsPerUnit={printPPU} />
          ))}
          {floorPlan.walls.map((wall) => (
            <WallLine key={wall.id} wall={wall} pixelsPerUnit={printPPU} />
          ))}
          {floorPlan.walls.map((wall) => (
            <DimensionLabel
              key={`dim-${wall.id}`}
              wall={wall}
              pixelsPerUnit={printPPU}
              units={floorPlan.units}
              isDrawing
            />
          ))}
        </Layer>

        {/* Furniture layer (static, no interactivity) */}
        {furniture.length > 0 && (
          <Layer>
            {furniture.map((item) => {
              const px = item.x * printPPU;
              const py = item.y * printPPU;
              const pw = item.width * printPPU;
              const ph = item.height * printPPU;
              const labelFontSize = Math.min(
                10,
                Math.max(7, pw / item.label.length)
              );

              return (
                <Group key={item.id}>
                  {item.shape === "circle" ? (
                    <Circle
                      x={px + pw / 2}
                      y={py + ph / 2}
                      radius={pw / 2}
                      fill={item.color}
                      stroke="#374151"
                      strokeWidth={1}
                      rotation={item.rotation}
                    />
                  ) : (
                    <Rect
                      x={px}
                      y={py}
                      width={pw}
                      height={ph}
                      fill={item.color}
                      stroke="#374151"
                      strokeWidth={1}
                      cornerRadius={2}
                      rotation={item.rotation}
                    />
                  )}
                  <Text
                    x={px + 2}
                    y={py + ph / 2 - labelFontSize / 2}
                    width={pw - 4}
                    text={item.label}
                    fontSize={labelFontSize}
                    fill={contrastTextColor(item.color)}
                    align="center"
                    listening={false}
                  />
                </Group>
              );
            })}
          </Layer>
        )}
      </Stage>
    </div>
  );
}
