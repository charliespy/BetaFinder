'use client'

import { MousePointer, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Hold, HoldType, HoldLabel, InteractionMode } from '@/types/beta'

const HOLD_TYPES: { value: HoldType; label: string }[] = [
  { value: 'jug', label: 'Jug' },
  { value: 'crimp', label: 'Crimp' },
  { value: 'sloper', label: 'Sloper' },
  { value: 'pinch', label: 'Pinch' },
  { value: 'pocket', label: 'Pocket' },
  { value: 'volume', label: 'Volume' },
]

const HOLD_LABELS: { value: string; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'start-left', label: 'Start (Left)' },
  { value: 'start-right', label: 'Start (Right)' },
  { value: 'top', label: 'Top' },
]

interface HoldToolbarProps {
  mode: InteractionMode
  selectedHold: Hold | null
  onModeChange: (mode: InteractionMode) => void
  onUpdateHold: (update: Partial<Hold> & { id: string }) => void
  onDeleteHold: (id: string) => void
}

export default function HoldToolbar({
  mode,
  selectedHold,
  onModeChange,
  onUpdateHold,
  onDeleteHold,
}: HoldToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-card">
      <div className="flex gap-1">
        <Button
          variant={mode === 'select' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onModeChange('select')}
        >
          <MousePointer className="size-3.5" aria-hidden="true" data-icon="inline-start" />
          Select
        </Button>
        <Button
          variant={mode === 'add' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onModeChange('add')}
        >
          <Plus className="size-3.5" aria-hidden="true" data-icon="inline-start" />
          Add
        </Button>
      </div>

      {selectedHold ? (
        <div className="flex items-center gap-2 ml-2 pl-2 border-l">
          <Select
            value={selectedHold.type}
            onValueChange={(val) =>
              onUpdateHold({ id: selectedHold.id, type: val as HoldType })
            }
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOLD_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedHold.label ?? 'none'}
            onValueChange={(val) =>
              onUpdateHold({
                id: selectedHold.id,
                label: (val === 'none' ? null : val) as HoldLabel,
              })
            }
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOLD_LABELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="destructive"
            size="icon-sm"
            aria-label="Delete hold"
            onClick={() => onDeleteHold(selectedHold.id)}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ) : mode === 'add' ? (
        <p className="text-xs text-muted-foreground ml-2">
          Click on the image to place a hold
        </p>
      ) : (
        <p className="text-xs text-muted-foreground ml-2">
          Click a hold to select it
        </p>
      )}
    </div>
  )
}
