'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ROUTE_COLORS } from '@/types/beta'

interface ColorPickerProps {
  value: string
  onValueChange: (value: string) => void
  className?: string
}

export default function ColorPicker({ value, onValueChange, className = 'w-36' }: ColorPickerProps) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v ?? '')}>
      <SelectTrigger className={className}>
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
  )
}
