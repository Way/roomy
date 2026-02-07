"use client";

import { useFloorPlanStore } from "@/store/floor-plan-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { distance } from "@/lib/geometry";
import type { DoorSwingDirection } from "@/lib/types";

export function PropertyPanel() {
  const {
    furniture,
    selectedFurnitureId,
    updateFurniture,
    removeFurniture,
    floorPlan,
    selectedTarget,
    updateWall,
    deleteWall,
    updateRoom,
    deleteRoom,
    addWallOpening,
    removeWallOpening,
    updateWallOpening,
  } = useFloorPlanStore();

  const selectedFurniture = furniture.find(
    (f) => f.id === selectedFurnitureId
  );
  const units = floorPlan?.units === "feet" ? "ft" : "m";
  const sqUnits = floorPlan?.units === "feet" ? "sq ft" : "sq m";

  // Wall selected
  if (selectedTarget?.type === "wall" && floorPlan) {
    const wall = floorPlan.walls.find((w) => w.id === selectedTarget.id);
    if (!wall) return null;

    const length = distance(wall.start, wall.end);

    return (
      <div className="p-4 space-y-4">
        <h3 className="text-sm font-semibold">Wall Properties</h3>

        <div className="space-y-1">
          <Label className="text-xs">
            Length: {length.toFixed(1)} {units}
          </Label>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">
            Thickness: {wall.thickness.toFixed(1)} {units}
          </Label>
          <Slider
            value={[wall.thickness]}
            onValueChange={([v]) =>
              updateWall(wall.id, { thickness: v })
            }
            min={0.1}
            max={2.0}
            step={0.1}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-xs">Start Point</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">X</Label>
              <Input
                type="number"
                step="0.1"
                value={wall.start.x.toFixed(1)}
                onChange={(e) =>
                  useFloorPlanStore.getState().moveWallEndpoint(wall.id, "start", {
                    x: parseFloat(e.target.value) || 0,
                    y: wall.start.y,
                  })
                }
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Y</Label>
              <Input
                type="number"
                step="0.1"
                value={wall.start.y.toFixed(1)}
                onChange={(e) =>
                  useFloorPlanStore.getState().moveWallEndpoint(wall.id, "start", {
                    x: wall.start.x,
                    y: parseFloat(e.target.value) || 0,
                  })
                }
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">End Point</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">X</Label>
              <Input
                type="number"
                step="0.1"
                value={wall.end.x.toFixed(1)}
                onChange={(e) =>
                  useFloorPlanStore.getState().moveWallEndpoint(wall.id, "end", {
                    x: parseFloat(e.target.value) || 0,
                    y: wall.end.y,
                  })
                }
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Y</Label>
              <Input
                type="number"
                step="0.1"
                value={wall.end.y.toFixed(1)}
                onChange={(e) =>
                  useFloorPlanStore.getState().moveWallEndpoint(wall.id, "end", {
                    x: wall.end.x,
                    y: parseFloat(e.target.value) || 0,
                  })
                }
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-xs">Openings</Label>
          {(wall.openings ?? []).map((opening) => (
            <div
              key={opening.id}
              className="p-2 bg-muted rounded text-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">
                  {opening.type}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeWallOpening(wall.id, opening.id)}
                >
                  &times;
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Position: {Math.round(opening.position * 100)}%
                </Label>
                <Slider
                  value={[opening.position * 100]}
                  onValueChange={([v]) =>
                    updateWallOpening(wall.id, opening.id, {
                      position: v / 100,
                    })
                  }
                  min={5}
                  max={95}
                  step={1}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Width ({units})
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="8"
                  value={opening.width}
                  onChange={(e) =>
                    updateWallOpening(wall.id, opening.id, {
                      width: parseFloat(e.target.value) || 2,
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>
              {opening.type === "door" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Swing Direction
                  </Label>
                  <div className="grid grid-cols-2 gap-1">
                    {(
                      [
                        ["left-in", "Left In"],
                        ["right-in", "Right In"],
                        ["left-out", "Left Out"],
                        ["right-out", "Right Out"],
                      ] as [DoorSwingDirection, string][]
                    ).map(([dir, label]) => (
                      <Button
                        key={dir}
                        variant={
                          (opening.swingDirection ?? "left-in") === dir
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() =>
                          updateWallOpening(wall.id, opening.id, {
                            swingDirection: dir,
                          })
                        }
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => addWallOpening(wall.id, "door")}
            >
              + Door
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => addWallOpening(wall.id, "window")}
            >
              + Window
            </Button>
          </div>
        </div>

        <Separator />

        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => deleteWall(wall.id)}
        >
          Delete Wall
        </Button>
      </div>
    );
  }

  // Room selected
  if (selectedTarget?.type === "room" && floorPlan) {
    const room = floorPlan.rooms.find((r) => r.id === selectedTarget.id);
    if (!room) return null;

    return (
      <div className="p-4 space-y-4">
        <h3 className="text-sm font-semibold">Room Properties</h3>

        <div className="space-y-2">
          <Label htmlFor="room-name" className="text-xs">
            Name
          </Label>
          <Input
            id="room-name"
            value={room.name}
            onChange={(e) => updateRoom(room.id, { name: e.target.value })}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="room-use" className="text-xs">
            Estimated Use
          </Label>
          <Input
            id="room-use"
            value={room.estimatedUse}
            onChange={(e) =>
              updateRoom(room.id, { estimatedUse: e.target.value })
            }
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Color</Label>
          <input
            type="color"
            value={
              room.color.startsWith("rgba")
                ? "#3B82F6"
                : room.color
            }
            onChange={(e) => {
              const hex = e.target.value;
              const r = parseInt(hex.slice(1, 3), 16);
              const g = parseInt(hex.slice(3, 5), 16);
              const b = parseInt(hex.slice(5, 7), 16);
              updateRoom(room.id, {
                color: `rgba(${r},${g},${b},0.3)`,
              });
            }}
            className="w-full h-8 rounded cursor-pointer"
          />
        </div>

        <Separator />

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Area: {room.area} {sqUnits}
          </p>
          <p>Vertices: {room.vertices.length}</p>
        </div>

        <Separator />

        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => deleteRoom(room.id)}
        >
          Delete Room
        </Button>
      </div>
    );
  }

  // Furniture selected
  if (selectedFurniture) {
    return (
      <div className="p-4 space-y-4">
        <h3 className="text-sm font-semibold">Properties</h3>

        <div className="space-y-2">
          <Label htmlFor="label" className="text-xs">
            Label
          </Label>
          <Input
            id="label"
            value={selectedFurniture.label}
            onChange={(e) =>
              updateFurniture(selectedFurniture.id, { label: e.target.value })
            }
            className="h-8 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Width ({units})</Label>
            <Input
              type="number"
              step="0.01"
              min="0.05"
              value={selectedFurniture.width}
              onChange={(e) =>
                updateFurniture(selectedFurniture.id, {
                  width: parseFloat(e.target.value) || 0.05,
                })
              }
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Height ({units})</Label>
            <Input
              type="number"
              step="0.01"
              min="0.05"
              value={selectedFurniture.height}
              onChange={(e) =>
                updateFurniture(selectedFurniture.id, {
                  height: parseFloat(e.target.value) || 0.05,
                })
              }
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">X ({units})</Label>
            <Input
              type="number"
              step="0.1"
              value={selectedFurniture.x.toFixed(1)}
              onChange={(e) =>
                updateFurniture(selectedFurniture.id, {
                  x: parseFloat(e.target.value) || 0,
                })
              }
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Y ({units})</Label>
            <Input
              type="number"
              step="0.1"
              value={selectedFurniture.y.toFixed(1)}
              onChange={(e) =>
                updateFurniture(selectedFurniture.id, {
                  y: parseFloat(e.target.value) || 0,
                })
              }
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">
            Rotation: {selectedFurniture.rotation.toFixed(0)}°
          </Label>
          <Slider
            value={[selectedFurniture.rotation]}
            onValueChange={([v]) =>
              updateFurniture(selectedFurniture.id, { rotation: v })
            }
            min={0}
            max={360}
            step={5}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Color</Label>
          <input
            type="color"
            value={selectedFurniture.color}
            onChange={(e) =>
              updateFurniture(selectedFurniture.id, { color: e.target.value })
            }
            className="w-full h-8 rounded cursor-pointer"
          />
        </div>

        <Separator />

        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => removeFurniture(selectedFurniture.id)}
        >
          Delete
        </Button>
      </div>
    );
  }

  // Nothing selected - show floor plan info
  return (
    <div className="p-4 text-sm text-muted-foreground">
      {floorPlan ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">Floor Plan Info</h3>
          <div className="space-y-1 text-xs">
            <p>
              Size: {floorPlan.overallWidth} x {floorPlan.overallHeight}{" "}
              {floorPlan.units}
            </p>
            <p>Rooms: {floorPlan.rooms.length}</p>
            <p>Walls: {floorPlan.walls.length}</p>
          </div>
          <Separator />
          {floorPlan.rooms.map((room) => (
            <div key={room.id} className="text-xs">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-sm border"
                  style={{ backgroundColor: room.color }}
                />
                <span className="font-medium">{room.name}</span>
              </div>
              <span className="text-muted-foreground ml-4.5">
                {room.area} {sqUnits}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p>
          Select a furniture item to edit its properties, or upload a floor plan
          to get started.
        </p>
      )}
    </div>
  );
}
