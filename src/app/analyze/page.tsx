'use client'

import { Component, useEffect, useReducer, useCallback, useState, useMemo, Suspense } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ArrowLeft, Loader2, RotateCw } from 'lucide-react'
import { getImage } from '@/lib/imageStore'
import { applyGridOverlay } from '@/lib/gridOverlay'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import HoldToolbar from '@/components/HoldToolbar'
import { ROUTE_COLORS } from '@/types/beta'
import type {
  AnalysisState,
  AnalysisAction,
  Hold,
  InteractionMode,
} from '@/types/beta'

const RouteCanvas = dynamic(() => import('@/components/RouteCanvas'), {
  ssr: false,
})

class CanvasErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null }

  static getDerivedStateFromError(err: Error) {
    return { error: err.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Canvas error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-xl border bg-black text-white">
          <p className="text-sm">Failed to render canvas: {this.state.error}</p>
          <button
            className="text-sm underline"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const initialState: AnalysisState = {
  imageBase64: null,
  holds: [],
  route: null,
  status: 'idle',
  error: null,
  selectedHoldId: null,
  mode: 'select',
}

function reducer(state: AnalysisState, action: AnalysisAction): AnalysisState {
  switch (action.type) {
    case 'SET_IMAGE':
      return { ...state, imageBase64: action.payload }
    case 'ANALYZE_START':
      return { ...state, status: 'loading', error: null }
    case 'ANALYZE_SUCCESS':
      return {
        ...state,
        status: 'success',
        holds: action.payload.holds,
        route: action.payload.route,
      }
    case 'ANALYZE_ERROR':
      return { ...state, status: 'error', error: action.payload }
    case 'ADD_HOLD':
      return { ...state, holds: [...state.holds, action.payload] }
    case 'REMOVE_HOLD':
      return {
        ...state,
        holds: state.holds.filter((h) => h.id !== action.payload),
        selectedHoldId:
          state.selectedHoldId === action.payload
            ? null
            : state.selectedHoldId,
      }
    case 'UPDATE_HOLD':
      return {
        ...state,
        holds: state.holds.map((h) =>
          h.id === action.payload.id ? { ...h, ...action.payload } : h
        ),
      }
    case 'SELECT_HOLD':
      return { ...state, selectedHoldId: action.payload }
    case 'SET_MODE':
      return { ...state, mode: action.payload, selectedHoldId: null }
    default:
      return state
  }
}

function AnalyzeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, dispatch] = useReducer(reducer, initialState)
  const [holdColor, setHoldColor] = useState(searchParams.get('color') || '')

  const width = parseInt(searchParams.get('w') || '0', 10)
  const height = parseInt(searchParams.get('h') || '0', 10)

  const runAnalysis = useCallback(
    async (image: string, color: string) => {
      if (!width || !height || !color) return
      dispatch({ type: 'ANALYZE_START' })
      const gridImage = await applyGridOverlay(image)
      fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: gridImage, width, height, holdColor: color }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error('Analysis failed')
          return res.json()
        })
        .then((result) => dispatch({ type: 'ANALYZE_SUCCESS', payload: result }))
        .catch((err) =>
          dispatch({ type: 'ANALYZE_ERROR', payload: err.message })
        )
    },
    [width, height]
  )

  // Run analysis on mount. Deps are intentionally limited to router/searchParams
  // because runAnalysis, width, height, and holdColor are derived from searchParams.
  useEffect(() => {
    const image = getImage()
    if (!image) {
      router.replace('/')
      return
    }
    dispatch({ type: 'SET_IMAGE', payload: image })

    if (!width || !height || !holdColor) {
      dispatch({ type: 'ANALYZE_ERROR', payload: 'Missing image dimensions or hold color' })
      return
    }

    runAnalysis(image, holdColor)
  }, [router, searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRerun = useCallback(() => {
    if (state.imageBase64 && holdColor) {
      runAnalysis(state.imageBase64, holdColor)
    }
  }, [state.imageBase64, holdColor, runAnalysis])

  const handleAddHold = useCallback((x: number, y: number) => {
    const hold: Hold = {
      id: crypto.randomUUID(),
      x,
      y,
      type: 'jug',
      label: null,
    }
    dispatch({ type: 'ADD_HOLD', payload: hold })
  }, [])

  const handleRemoveHold = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_HOLD', payload: id })
  }, [])

  const handleUpdateHold = useCallback(
    (update: Partial<Hold> & { id: string }) => {
      dispatch({ type: 'UPDATE_HOLD', payload: update })
    },
    []
  )

  const handleSelectHold = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_HOLD', payload: id })
  }, [])

  const handleModeChange = useCallback((mode: InteractionMode) => {
    dispatch({ type: 'SET_MODE', payload: mode })
  }, [])

  const selectedHold = useMemo(
    () => state.holds.find((h) => h.id === state.selectedHoldId) ?? null,
    [state.holds, state.selectedHoldId]
  )

  if (!state.imageBase64) return null

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a
              href="/"
              className="inline-flex items-center justify-center size-8 rounded-md hover:bg-accent"
              aria-label="Back to upload"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </a>
            <h1 className="text-xl font-semibold text-foreground text-balance">
              Hold Detection
            </h1>
          </div>
          <div className="flex items-center gap-3">
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
                    />
                    {color.charAt(0).toUpperCase() + color.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRerun}
              disabled={state.status === 'loading' || !holdColor}
            >
              <RotateCw className="size-4 mr-1.5" aria-hidden="true" />
              Rerun
            </Button>
          </div>
        </div>

        {state.status === 'loading' ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Detecting holds...
            </p>
          </div>
        ) : state.status === 'error' ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32">
            <p className="text-sm text-destructive">{state.error}</p>
            <a
              href="/"
              className="text-sm underline text-muted-foreground"
            >
              Go back
            </a>
          </div>
        ) : state.status === 'success' ? (
          <div className="flex flex-col gap-4">
            <HoldToolbar
              mode={state.mode}
              selectedHold={selectedHold}
              onModeChange={handleModeChange}
              onUpdateHold={handleUpdateHold}
              onDeleteHold={handleRemoveHold}
            />
            <CanvasErrorBoundary>
              <div className="overflow-hidden rounded-xl border bg-black">
                <RouteCanvas
                  imageBase64={state.imageBase64}
                  holds={state.holds}
                  selectedHoldId={state.selectedHoldId}
                  mode={state.mode}
                  onAddHold={handleAddHold}
                  onRemoveHold={handleRemoveHold}
                  onUpdateHold={handleUpdateHold}
                  onSelectHold={handleSelectHold}
                />
              </div>
            </CanvasErrorBoundary>
            <p className="text-xs text-muted-foreground text-center">
              {state.holds.length} hold{state.holds.length !== 1 ? 's' : ''} detected
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AnalyzeContent />
    </Suspense>
  )
}
