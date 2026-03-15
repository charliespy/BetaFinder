export type HoldType = 'jug' | 'crimp' | 'sloper' | 'pinch' | 'pocket' | 'volume'

export type HoldLabel = 'start-left' | 'start-right' | 'top' | null

export interface Hold {
  id: string
  x: number
  y: number
  type: HoldType
  label: HoldLabel
}

export interface RouteInfo {
  grade: string
  wallAngle: number
  holdColor: string
}

export interface AnalysisResult {
  holds: Hold[]
  route: RouteInfo
}

export type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error'
export type InteractionMode = 'select' | 'add'

export interface AnalysisState {
  imageBase64: string | null
  holds: Hold[]
  route: RouteInfo | null
  status: AnalysisStatus
  error: string | null
  selectedHoldId: string | null
  mode: InteractionMode
}

export type AnalysisAction =
  | { type: 'SET_IMAGE'; payload: string }
  | { type: 'ANALYZE_START' }
  | { type: 'ANALYZE_SUCCESS'; payload: AnalysisResult }
  | { type: 'ANALYZE_ERROR'; payload: string }
  | { type: 'ADD_HOLD'; payload: Hold }
  | { type: 'REMOVE_HOLD'; payload: string }
  | { type: 'UPDATE_HOLD'; payload: Partial<Hold> & { id: string } }
  | { type: 'SELECT_HOLD'; payload: string | null }
  | { type: 'SET_MODE'; payload: InteractionMode }

export const ROUTE_COLORS = [
  'red', 'blue', 'green', 'yellow', 'orange',
  'pink', 'purple', 'white', 'black', 'grey',
] as const

export type RouteColor = (typeof ROUTE_COLORS)[number]

export const MAX_IMAGE_PAYLOAD_BYTES = 10 * 1024 * 1024 // 10MB

export const HOLD_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    x: { type: 'number' as const },
    y: { type: 'number' as const },
    type: {
      type: 'string' as const,
      enum: ['jug', 'crimp', 'sloper', 'pinch', 'pocket', 'volume'],
    },
    label: {
      type: ['string', 'null'] as const,
      enum: ['start-left', 'start-right', 'top', null],
    },
  },
  required: ['id', 'x', 'y', 'type', 'label'] as const,
  additionalProperties: false as const,
}
