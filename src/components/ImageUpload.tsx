'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { setImage } from '@/lib/imageStore'
import { ROUTE_COLORS } from '@/types/beta'

function resizeImage(base64: string, maxSize: number): Promise<{ base64: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        const scale = maxSize / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      const resized = canvas.toDataURL('image/jpeg', 0.9)
      const b64 = resized.split(',')[1]
      resolve({ base64: b64, width, height })
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = base64
  })
}

export default function ImageUpload() {
  const [preview, setPreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [holdColor, setHoldColor] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setError(null)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      const { base64, width, height } = await resizeImage(dataUrl, 2048)
      if (!setImage(base64)) {
        setError('Image too large to store. Try a smaller photo.')
        return
      }
      setPreview(`data:image/jpeg;base64,${base64}`)
      setDimensions({ width, height })
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleAnalyze = () => {
    if (!preview || !holdColor) return
    router.push(`/analyze?w=${dimensions?.width}&h=${dimensions?.height}&color=${holdColor}`)
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg">
      <button
        type="button"
        aria-label="Upload climbing wall photo"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        className={`
          relative flex flex-col items-center justify-center w-full aspect-[4/3]
          rounded-xl border-2 border-dashed cursor-pointer transition-[border-color,background-color]
          ${dragOver
            ? 'border-primary bg-primary/5'
            : preview
              ? 'border-border'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }
        `}
      >
        {preview ? (
          <img
            src={preview}
            alt="Climbing wall preview"
            width={dimensions?.width}
            height={dimensions?.height}
            className="w-full h-full object-contain rounded-lg"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            {dragOver ? (
              <ImageIcon className="size-10" aria-hidden="true" />
            ) : (
              <Upload className="size-10" aria-hidden="true" />
            )}
            <div className="text-center">
              <p className="text-sm font-medium">
                {dragOver ? 'Drop image here' : 'Click or drag a climbing wall photo'}
              </p>
              <p className="text-xs mt-1">JPG, PNG up to 20MB</p>
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
      </button>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {preview ? (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground">Route color:</label>
            <Select value={holdColor} onValueChange={(v) => setHoldColor(v ?? '')}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Select color" />
              </SelectTrigger>
              <SelectContent>
                {ROUTE_COLORS.map((color) => (
                  <SelectItem key={color} value={color}>
                    <span
                      className="inline-block size-3 rounded-full mr-1.5 border border-black/10"
                      style={{ backgroundColor: color === 'white' ? '#f0f0f0' : color }}
                      aria-hidden="true"
                    />
                    {color.charAt(0).toUpperCase() + color.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setPreview(null)
                setDimensions(null)
                setHoldColor('')
              }}
            >
              Change Photo
            </Button>
            <Button onClick={handleAnalyze} disabled={!holdColor}>
              Analyze Holds
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
