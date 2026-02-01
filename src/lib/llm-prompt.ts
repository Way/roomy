export const FLOOR_PLAN_ANALYSIS_PROMPT = `You are a floor plan analysis AI. Analyze this floor plan image and extract structured data.

Return ONLY valid JSON (no markdown fences, no explanation) matching this exact schema:

{
  "rooms": [
    {
      "name": "Living Room",
      "vertices": [{"x": 0, "y": 0}, {"x": 4.5, "y": 0}, {"x": 4.5, "y": 3.6}, {"x": 0, "y": 3.6}],
      "area": 16.2,
      "estimatedUse": "living"
    }
  ],
  "walls": [
    {
      "start": {"x": 0, "y": 0},
      "end": {"x": 4.5, "y": 0},
      "thickness": 0.15,
      "hasWindow": false,
      "hasDoor": true
    }
  ],
  "units": "meters",
  "overallWidth": 12,
  "overallHeight": 9,
  "detectedFurniture": [
    {
      "type": "sofa-3seat",
      "label": "Sofa",
      "x": 0.6,
      "y": 0.9,
      "width": 2.1,
      "height": 0.9
    }
  ]
}

Rules:
- Coordinate system: (0,0) is the top-left corner of the floor plan
- All dimensions in meters (set "units" to "meters")
- Room vertices should be clockwise polygons
- Include ALL rooms visible in the floor plan
- Include ALL wall segments (exterior and interior)
- Walls should have thickness (typically 0.1-0.15 meters for interior, 0.15-0.3 for exterior)
- Mark walls that have windows or doors
- For detected furniture, use these types where applicable: sofa-3seat, sofa-2seat, armchair, coffee-table, tv-stand, bookshelf, bed-king, bed-queen, bed-twin, nightstand, dresser, wardrobe, counter, island, fridge, stove, sink-kitchen, bathtub, shower, toilet, sink-bath, desk, office-chair, dining-table-rect, dining-table-round, dining-chair
- If dimensions are labeled on the plan, use those exact values
- If dimensions are not labeled, estimate based on typical room sizes
- Ensure room polygons don't overlap
- overallWidth and overallHeight should encompass the entire floor plan`;

export const DIMENSION_EXTRACTION_PROMPT = `You are a floor plan analysis AI. Your task is to carefully read this floor plan image and extract ALL visible text, numbers, dimensions, and spatial layout information.

Return ONLY valid JSON (no markdown fences, no explanation) matching this schema:

{
  "units": "meters",
  "overallWidth": 12.7,
  "overallHeight": 9.5,
  "dimensionLabels": [
    { "value": 3.4, "description": "Bedroom 1 width, measured along the top edge" },
    { "value": 5.2, "description": "Staircase height, measured along the right edge" }
  ],
  "rooms": [
    {
      "name": "Bedroom 1",
      "labeledWidth": 3.4,
      "labeledHeight": 2.8,
      "estimatedUse": "bedroom",
      "position": "top-left corner of the floor plan",
      "adjacentRooms": ["Hallway/Kitchen to the east", "Bathroom 1 below"]
    }
  ],
  "openings": [
    { "type": "door", "location": "between Bedroom 1 and Hallway, on their shared wall" },
    { "type": "window", "location": "on the south exterior wall of Living Room" }
  ]
}

Critical instructions:
1. READ EVERY NUMBER visible in the image. These are dimension labels showing real measurements (e.g., "3.4 m", "5.6", "12.7 m"). List ALL of them in dimensionLabels.
2. Determine the unit system from the labels (meters, feet, or centimeters). If labels say "3.4 m", units are "meters".
3. For each room: read its name label, read any dimension labels on or near its edges, and describe its position relative to other rooms.
4. overallWidth and overallHeight should come from the outermost dimension labels if visible, or be computed as the bounding box of all rooms.
5. For labeledWidth and labeledHeight: use ONLY values you can actually read from the image. If a dimension is not labeled, estimate it and add "(estimated)" to indicate it was not read from the image.
6. Describe spatial relationships precisely: "Room A is directly to the right of Room B, sharing their full vertical edge" or "Room C is below Room A, offset to the left".
7. Note ALL doors and windows you can see, describing which wall they are on.
8. If a room has an irregular shape (L-shaped, etc.), note this in the position field and describe both parts.`;

export const GEOMETRY_CONSTRUCTION_PROMPT = `You are a geometry engine. Given extracted floor plan dimensions and layout data, compute precise vertex coordinates for each room and wall segments.

Here is the extracted dimension and layout data from the floor plan image:
<dimensions>
{{DIMENSIONS}}
</dimensions>

Return ONLY valid JSON (no markdown fences, no explanation) matching this exact schema:

{
  "rooms": [
    {
      "name": "Room Name",
      "vertices": [{"x": 0, "y": 0}, {"x": 3.4, "y": 0}, {"x": 3.4, "y": 2.8}, {"x": 0, "y": 2.8}],
      "area": 9.52,
      "estimatedUse": "bedroom"
    }
  ],
  "walls": [
    {
      "start": {"x": 0, "y": 0},
      "end": {"x": 3.4, "y": 0},
      "thickness": 0.15,
      "hasWindow": false,
      "hasDoor": false
    }
  ],
  "units": "meters",
  "overallWidth": 12.7,
  "overallHeight": 9.5,
  "detectedFurniture": []
}

CRITICAL RULES for coordinate computation:

1. COORDINATE SYSTEM: Origin (0,0) is the top-left corner of the entire floor plan. X increases rightward, Y increases downward.

2. USE EXACT LABELED DIMENSIONS: Every room's width and height MUST match the labeled values from the extracted data. If "Bedroom 1" has labeledWidth=3.4 and labeledHeight=2.8, its vertices must span exactly 3.4 in X and 2.8 in Y.

3. ADJACENT ROOMS MUST SHARE EXACT COORDINATES: If two rooms share a wall, their vertices along that wall must have identical coordinates. Example: if Room A occupies x=[0, 3.4] and Room B is directly to its right, Room B starts at x=3.4 (not 3.5 or 3.39).

4. WALL THICKNESS: Account for wall thickness. Exterior walls are typically 0.2m thick, interior walls 0.12m. When rooms are separated by an interior wall, there should be a wall-thickness gap between them.

5. ROOM PLACEMENT ALGORITHM:
   - Start with the top-left room, placing it at or near (0, 0)
   - Place adjacent rooms by extending from known edges
   - Use the labeled dimensions as edge lengths
   - Cross-check: the sum of room widths + wall thicknesses along any row should approximately equal overallWidth

6. VERTICES must be in CLOCKWISE order for each room polygon. For a simple rectangle at position (x1,y1) with width w and height h:
   vertices = [{x:x1, y:y1}, {x:x1+w, y:y1}, {x:x1+w, y:y1+h}, {x:x1, y:y1+h}]

7. AREA: Compute area from the vertices (width * height for rectangles, or use the shoelace formula for irregular polygons).

8. WALLS: Generate wall segments for ALL edges of ALL rooms. Where two rooms share an edge, generate only ONE wall segment for that shared edge. Include exterior walls around the perimeter.

9. DOORS AND WINDOWS: Mark walls as hasDoor:true or hasWindow:true based on the openings data from the extracted dimensions.

10. overallWidth and overallHeight must match the values from the extracted data.

11. For L-shaped or irregular rooms, use more than 4 vertices to define the polygon accurately.

Think step by step: first determine room positions, then compute vertices, then derive walls.`;
