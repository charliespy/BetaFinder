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
