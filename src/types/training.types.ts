export type ElementType = 'player' | 'opponent' | 'ball' | 'cone'

export interface BoardElement {
  id: string
  type: ElementType
  label?: string
}

export interface FrameState {
  frameIndex: number
  positions: Record<string, { x: number; y: number }>
}

export interface PlaybookData {
  name?: string
  elements: BoardElement[]
  frames: FrameState[]
}
