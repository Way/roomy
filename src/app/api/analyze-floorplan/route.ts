import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  DIMENSION_EXTRACTION_PROMPT,
  GEOMETRY_CONSTRUCTION_PROMPT,
} from "@/lib/llm-prompt";
import {
  parseLLMResponse,
  parseDimensionExtraction,
} from "@/lib/parse-llm-response";
import { validateAndCorrectGeometry } from "@/lib/validate-geometry";

function getTextFromResponse(
  response: Anthropic.Messages.Message
): string | null {
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;
  return textBlock.text;
}

export async function POST(request: NextRequest) {
  try {
    const { image, mediaType } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    const supportedMediaTypes = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
    ];
    if (mediaType && !supportedMediaTypes.includes(mediaType)) {
      return NextResponse.json(
        {
          error: `Unsupported image type: ${mediaType}. Supported: PNG, JPEG, GIF, WebP.`,
        },
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
    const model = "claude-sonnet-4-20250514";

    // --- Pass 1: Extract dimensions and layout from the image ---
    const pass1Response = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: (mediaType || "image/png") as
                  | "image/png"
                  | "image/jpeg"
                  | "image/gif"
                  | "image/webp",
                data: image,
              },
            },
            {
              type: "text",
              text: DIMENSION_EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    const pass1Text = getTextFromResponse(pass1Response);
    if (!pass1Text) {
      return NextResponse.json(
        { error: "No text response from Claude (Pass 1: dimension extraction)" },
        { status: 500 }
      );
    }

    if (pass1Response.stop_reason === "max_tokens") {
      console.warn(
        "Pass 1 (dimension extraction) was truncated due to max_tokens"
      );
    }

    const extractedDimensions = parseDimensionExtraction(pass1Text);

    // --- Pass 2: Build geometry from extracted dimensions (text only, no image) ---
    const pass2Prompt = GEOMETRY_CONSTRUCTION_PROMPT.replace(
      "{{DIMENSIONS}}",
      JSON.stringify(extractedDimensions, null, 2)
    );

    const pass2Response = await client.messages.create({
      model,
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: pass2Prompt,
        },
      ],
    });

    const pass2Text = getTextFromResponse(pass2Response);
    if (!pass2Text) {
      return NextResponse.json(
        {
          error:
            "No text response from Claude (Pass 2: geometry construction)",
        },
        { status: 500 }
      );
    }

    if (pass2Response.stop_reason === "max_tokens") {
      console.warn(
        "Pass 2 (geometry construction) was truncated due to max_tokens"
      );
    }

    // Parse the geometry response
    const result = parseLLMResponse(pass2Text);

    // Post-process: validate and correct geometry
    result.floorPlan = validateAndCorrectGeometry(
      result.floorPlan,
      extractedDimensions
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Floor plan analysis error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
