'use client'

import { useRef, useState, useEffect, useCallback, memo } from 'react'
import { Stage, Layer, Image as KonvaImage, Circle, Group, Line, Text } from 'react-konva'
import type Konva from 'konva'
import type { Hold, InteractionMode } from '@/types/beta'

const HOLD_COLOR = '#3b82f6'

const HOLD_TYPE_SHORT: Record<string, string> = {
  jug: 'JUG',
  crimp: 'CRI',
  sloper: 'SLO',
  pinch: 'PIN',
  pocket: 'POC',
  volume: 'VOL',
}

const LABEL_RING: Record<string, string> = {
  'start-left': '#facc15',
  'start-right': '#facc15',
  top: '#f43f5e',
}

const SELECTION_DASH = [4, 4]
const DELETE_X_POINTS_A = [-3, -3, 3, 3]
const DELETE_X_POINTS_B = [-3, 3, 3, -3]

interface RouteCanvasProps {
  imageBase64: string
  holds: Hold[]
  selectedHoldId: string | null
  mode: InteractionMode
  onAddHold: (x: number, y: number) => void
  onRemoveHold: (id: string) => void
  onUpdateHold: (update: Partial<Hold> & { id: string }) => void
  onSelectHold: (id: string | null) => void
}

export default memo(function RouteCanvas({
  imageBase64,
  holds,
  selectedHoldId,
  mode,
  onAddHold,
  onRemoveHold,
  onUpdateHold,
  onSelectHold,
}: RouteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [scale, setScale] = useState(1)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Load image
  useEffect(() => {
    const img = new window.Image()
    img.onload = () => setImage(img)
    img.src = `data:image/jpeg;base64,${imageBase64}`
  }, [imageBase64])

  // Compute stage size from container + image aspect ratio
  const updateSize = useCallback(() => {
    if (!containerRef.current || !image) return
    const containerWidth = containerRef.current.clientWidth
    const aspectRatio = image.height / image.width
    const displayWidth = containerWidth
    const displayHeight = containerWidth * aspectRatio
    setStageSize({ width: displayWidth, height: displayHeight })
    setScale(displayWidth / image.width)
  }, [image])

  useEffect(() => {
    updateSize()
    const observer = new ResizeObserver(updateSize)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [updateSize])

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Only add holds when clicking the background in add mode
    if (mode !== 'add') return
    const target = e.target
    const stage = e.target.getStage()
    if (target !== stage && target.getClassName() !== 'Image') return

    const pos = stage?.getPointerPosition()
    if (!pos) return
    onAddHold(pos.x / scale, pos.y / scale)
  }

  const handleDragEnd = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    onUpdateHold({
      id,
      x: node.x() / scale,
      y: node.y() / scale,
    })
  }

  const holdRadius = Math.max(12, 18 * scale)

  return (
    <div ref={containerRef} className="w-full">
      {stageSize.width > 0 ? (
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          onClick={handleStageClick}
          style={{ cursor: mode === 'add' ? 'crosshair' : 'default', touchAction: 'manipulation' }}
        >
          <Layer>
            {image ? (
              <KonvaImage
                image={image}
                width={stageSize.width}
                height={stageSize.height}
              />
            ) : null}
          </Layer>
          <Layer>
            {holds.map((hold) => {
              const isSelected = hold.id === selectedHoldId
              const isHovered = hold.id === hoveredId
              const labelColor = hold.label ? LABEL_RING[hold.label] : null
              const typeLabel = HOLD_TYPE_SHORT[hold.type] || hold.type.toUpperCase()
              const fontSize = Math.max(9, 11 * scale)

              return (
                <Group
                  key={hold.id}
                  x={hold.x * scale}
                  y={hold.y * scale}
                  draggable={mode === 'select'}
                  onDragEnd={(e) => handleDragEnd(hold.id, e)}
                  onClick={(e) => {
                    e.cancelBubble = true
                    if (mode === 'select') onSelectHold(hold.id)
                  }}
                  onMouseEnter={() => setHoveredId(hold.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Label ring */}
                  {labelColor ? (
                    <Circle
                      radius={holdRadius + 4}
                      stroke={labelColor}
                      strokeWidth={3}
                    />
                  ) : null}
                  {/* Selection ring */}
                  {isSelected ? (
                    <Circle
                      radius={holdRadius + 8}
                      stroke="#ffffff"
                      strokeWidth={2}
                      dash={SELECTION_DASH}
                    />
                  ) : null}
                  {/* Hold circle */}
                  <Circle
                    radius={holdRadius}
                    fill={HOLD_COLOR}
                    opacity={0.7}
                    stroke={isSelected ? '#ffffff' : 'rgba(0,0,0,0.5)'}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  {/* Hold type label */}
                  <Text
                    text={typeLabel}
                    x={holdRadius + 4}
                    y={-fontSize / 2}
                    fontSize={fontSize}
                    fontStyle="bold"
                    fill="#ffffff"
                    shadowColor="#000000"
                    shadowBlur={3}
                    shadowOffsetX={1}
                    shadowOffsetY={1}
                    listening={false}
                  />
                  {/* Delete X on hover */}
                  {isHovered && mode === 'select' ? (
                    <Group
                      onClick={(e) => {
                        e.cancelBubble = true
                        onRemoveHold(hold.id)
                      }}
                      x={holdRadius * 0.7}
                      y={-holdRadius * 0.7}
                    >
                      <Circle radius={8} fill="#ef4444" />
                      <Line
                        points={DELETE_X_POINTS_A}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                      <Line
                        points={DELETE_X_POINTS_B}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                    </Group>
                  ) : null}
                </Group>
              )
            })}
          </Layer>
        </Stage>
      ) : null}
    </div>
  )
})
