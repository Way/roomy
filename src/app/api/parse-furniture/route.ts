import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";

const ParsedFurnitureSchema = z.object({
  label: z.string(),
  shape: z.enum(["rect", "circle", "ellipse"]),
  width: z.number(),
  height: z.number(),
  color: z.string(),
  category: z.enum([
    "living",
    "bedroom",
    "kitchen",
    "bathroom",
    "office",
    "dining",
    "custom",
  ]),
});

const SYSTEM_PROMPT = `You parse natural language furniture descriptions into structured JSON.

Given a text like "Black Table 160x80", extract:
- label: human-readable name (e.g. "Table")
- shape: "rect", "circle", or "ellipse". Use "circle" for round items, "ellipse" for oval items, "rect" for everything else.
- width: width in meters. If the user writes "160" or "160cm", interpret as 1.60m. If they write "1.6" or "1.6m", use 1.6m. Numbers >= 10 are assumed centimeters.
- height: depth/height in meters, same parsing rules. For circle shapes, set height = width.
- color: hex color string. Parse color names (black → #333333, white → #F5F5F5, red → #CC4444, blue → #4477BB, green → #558855, brown → #8B6944, gray/grey → #999999, beige → #D4C5A9, yellow → #CCAA33, orange → #CC7733, pink → #CC6688, purple → #8855AA, navy → #334466). Default to #999999 if no color specified.
- category: best fit from living, bedroom, kitchen, bathroom, office, dining, custom.

Respond ONLY with a JSON object, no markdown, no explanation.`;

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-20250414",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text.trim() }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No response from model" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(textBlock.text);
    const validated = ParsedFurnitureSchema.parse(parsed);

    return NextResponse.json(validated);
  } catch (error) {
    console.error("Parse furniture error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to parse furniture description";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
