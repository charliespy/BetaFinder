import { NextResponse } from 'next/server'
import { createCanvas, loadImage } from 'canvas'
import client from '@/lib/openai'
import {
  HOLD_DETECTION_SYSTEM_PROMPT,
  buildUserPrompt,
  buildVerificationPrompt,
} from '@/lib/prompts'
import type { AnalysisResult, Hold } from '@/types/beta'

interface DetectionResponse {
  reasoning?: string
  holds: {
    id: string
    x: number
    y: number
    type: Hold['type']
    label: Hold['label']
  }[]
  route?: AnalysisResult['route']
}

async function drawGridOverlay(imageBase64: string): Promise<string> {
  const buffer = Buffer.from(imageBase64, 'base64')
  const img = await loadImage(buffer)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')

  ctx.drawImage(img, 0, 0)

  // Draw grid lines every 10%
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 1
  ctx.font = `${Math.max(12, Math.round(img.width / 80))}px sans-serif`
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'

  for (let pct = 10; pct <= 90; pct += 10) {
    const x = (pct / 100) * img.width
    const y = (pct / 100) * img.height

    // Vertical line
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, img.height)
    ctx.stroke()

    // Horizontal line
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(img.width, y)
    ctx.stroke()

    // Labels along top edge
    ctx.fillText(`${pct}%`, x + 2, 14)
    // Labels along left edge
    ctx.fillText(`${pct}%`, 2, y - 2)
  }

  return canvas.toBuffer('image/jpeg').toString('base64')
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
    const { imageBase64, width, height, holdColor } = await request.json()

    if (!imageBase64 || !width || !height || !holdColor) {
      return NextResponse.json(
        { error: 'Missing required fields: imageBase64, width, height, holdColor' },
        { status: 400 }
      )
    }

    // Draw grid overlay on image
    const gridImage = await drawGridOverlay(imageBase64)

    // --- First pass: detect holds ---
    const response = await client.responses.create({
      model: 'gpt-5.4',
      input: [
        { role: 'system', content: HOLD_DETECTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: `data:image/jpeg;base64,${gridImage}`,
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
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    x: { type: 'number' },
                    y: { type: 'number' },
                    type: {
                      type: 'string',
                      enum: ['jug', 'crimp', 'sloper', 'pinch', 'pocket', 'volume'],
                    },
                    label: {
                      type: ['string', 'null'],
                      enum: ['start-left', 'start-right', 'top', null],
                    },
                  },
                  required: ['id', 'x', 'y', 'type', 'label'],
                  additionalProperties: false,
                },
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
    })

    const firstPass: DetectionResponse = JSON.parse(response.output_text)

    // --- Verification pass: find missed holds ---
    const verificationResponse = await client.responses.create({
      model: 'gpt-5.4',
      input: [
        { role: 'system', content: HOLD_DETECTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: `data:image/jpeg;base64,${gridImage}`,
              detail: 'high',
            },
            {
              type: 'input_text',
              text: buildVerificationPrompt(width, height, holdColor, firstPass.holds),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'hold_verification',
          schema: {
            type: 'object',
            properties: {
              reasoning: { type: 'string' },
              holds: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    x: { type: 'number' },
                    y: { type: 'number' },
                    type: {
                      type: 'string',
                      enum: ['jug', 'crimp', 'sloper', 'pinch', 'pocket', 'volume'],
                    },
                    label: {
                      type: ['string', 'null'],
                      enum: ['start-left', 'start-right', 'top', null],
                    },
                  },
                  required: ['id', 'x', 'y', 'type', 'label'],
                  additionalProperties: false,
                },
              },
            },
            required: ['reasoning', 'holds'],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    })

    const secondPass: DetectionResponse = JSON.parse(verificationResponse.output_text)

    // Merge holds, re-id second pass holds to avoid conflicts
    const allPercentHolds = [
      ...firstPass.holds,
      ...secondPass.holds.map((h, i) => ({
        ...h,
        id: `v${i + 1}`,
      })),
    ]

    // Convert percentage coordinates to pixels
    const pixelHolds = convertPercentToPixels(allPercentHolds, width, height)

    const result: AnalysisResult = {
      holds: pixelHolds,
      route: firstPass.route!,
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
