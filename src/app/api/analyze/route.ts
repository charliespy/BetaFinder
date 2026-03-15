import { NextResponse } from 'next/server'
import client from '@/lib/openai'
import { HOLD_DETECTION_SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts'
import type { AnalysisResult, Hold, RouteColor } from '@/types/beta'
import { HOLD_SCHEMA, MAX_IMAGE_PAYLOAD_BYTES, MAX_BASE64_LENGTH, ROUTE_COLORS } from '@/types/beta'

interface DetectionResponse {
  reasoning?: string
  holds: {
    id: string
    x: number
    y: number
    type: Hold['type']
    label: Hold['label']
    hexColor: string
  }[]
  route: AnalysisResult['route']
}

function convertPercentToPixels(
  holds: DetectionResponse['holds'],
  width: number,
  height: number
): Hold[] {
  return holds.map((h) => ({
    ...h,
    x: Math.round((h.x / 100) * width),
    y: Math.round((h.y / 100) * height),
  }))
}

export async function POST(request: Request) {
  try {
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: 'Payload too large. Maximum size is 10MB.' },
        { status: 413 }
      )
    }

    const { imageBase64, width, height, holdColor } = await request.json()

    if (!imageBase64 || !width || !height || !holdColor) {
      return NextResponse.json(
        { error: 'Missing required fields: imageBase64, width, height, holdColor' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      return NextResponse.json(
        { error: 'width and height must be positive integers' },
        { status: 400 }
      )
    }

    if (!ROUTE_COLORS.includes(holdColor as RouteColor)) {
      return NextResponse.json(
        { error: 'Invalid hold color' },
        { status: 400 }
      )
    }

    if (typeof imageBase64 !== 'string' || imageBase64.length > MAX_BASE64_LENGTH) {
      return NextResponse.json(
        { error: 'Image payload too large' },
        { status: 413 }
      )
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)

    let response
    try {
      response = await client.responses.create({
        model: 'gpt-5.4',
        input: [
          { role: 'system', content: HOLD_DETECTION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'input_image',
                image_url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'high',
              },
              {
                type: 'input_text',
                text: buildUserPrompt(width, height, holdColor),
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'hold_detection',
            schema: {
              type: 'object',
              properties: {
                reasoning: { type: 'string' },
                holds: {
                  type: 'array',
                  items: HOLD_SCHEMA,
                },
                route: {
                  type: 'object',
                  properties: {
                    grade: { type: 'string' },
                    wallAngle: { type: 'number' },
                    holdColor: { type: 'string' },
                  },
                  required: ['grade', 'wallAngle', 'holdColor'],
                  additionalProperties: false,
                },
              },
              required: ['reasoning', 'holds', 'route'],
              additionalProperties: false,
            },
            strict: true,
          },
        },
      }, { signal: controller.signal })
    } finally {
      clearTimeout(timeout)
    }

    let parsed: DetectionResponse
    try {
      parsed = JSON.parse(response.output_text)
    } catch {
      console.error('Failed to parse model response:', response.output_text.slice(0, 500))
      return NextResponse.json(
        { error: 'Model returned invalid JSON' },
        { status: 502 }
      )
    }

    const pixelHolds = convertPercentToPixels(parsed.holds, width, height)

    const result: AnalysisResult = {
      holds: pixelHolds,
      route: parsed.route,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    )
  }
}
