import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { BoardElement, FrameState, PlaybookData, ElementType } from '@/types/training.types'

interface TacticalState {
  tacticName: string
  elements: BoardElement[]
  frames: FrameState[]
  currentFrameIndex: number
  isPlaying: boolean
  playbackFrameIndex: number
  pendingElementType: ElementType | null

  setTacticName: (name: string) => void
  addElement: (type: ElementType, x: number, y: number, label?: string) => void
  removeElement: (id: string) => void
  updatePosition: (elementId: string, x: number, y: number) => void
  addFrame: () => void
  removeFrame: (index: number) => void
  goToFrame: (index: number) => void
  setPendingElement: (type: ElementType | null) => void
  startPlayback: () => void
  stopPlayback: () => void
  toPlaybook: () => PlaybookData
  loadPlaybook: (data: PlaybookData) => void
  reset: () => void
}

let playbackTimer: ReturnType<typeof setTimeout> | null = null

export const useTacticalStore = create<TacticalState>((set, get) => ({
  tacticName: 'Tática',
  elements: [],
  frames: [{ frameIndex: 0, positions: {} }],
  currentFrameIndex: 0,
  isPlaying: false,
  playbackFrameIndex: 0,
  pendingElementType: null,

  setTacticName: (name) => set({ tacticName: name }),

  addElement: (type, x, y, label) => {
    const id = uuidv4()
    const newElement: BoardElement = { id, type, label }
    set((state) => ({
      elements: [...state.elements, newElement],
      frames: state.frames.map((frame) => ({
        ...frame,
        positions: { ...frame.positions, [id]: { x, y } },
      })),
      pendingElementType: null,
    }))
  },

  removeElement: (id) => {
    set((state) => ({
      elements: state.elements.filter((e) => e.id !== id),
      frames: state.frames.map((frame) => {
        const positions = { ...frame.positions }
        delete positions[id]
        return { ...frame, positions }
      }),
    }))
  },

  updatePosition: (elementId, x, y) => {
    set((state) => ({
      frames: state.frames.map((frame, idx) => {
        if (idx !== state.currentFrameIndex) return frame
        return { ...frame, positions: { ...frame.positions, [elementId]: { x, y } } }
      }),
    }))
  },

  addFrame: () => {
    set((state) => {
      const currentFrame = state.frames[state.currentFrameIndex]
      const newFrame: FrameState = {
        frameIndex: state.frames.length,
        positions: { ...currentFrame.positions },
      }
      return { frames: [...state.frames, newFrame], currentFrameIndex: state.frames.length }
    })
  },

  removeFrame: (index) => {
    set((state) => {
      if (state.frames.length <= 1) return state
      const newFrames = state.frames
        .filter((_, i) => i !== index)
        .map((f, i) => ({ ...f, frameIndex: i }))
      return {
        frames: newFrames,
        currentFrameIndex: Math.min(state.currentFrameIndex, newFrames.length - 1),
      }
    })
  },

  goToFrame: (index) => set({ currentFrameIndex: index }),

  setPendingElement: (type) => set({ pendingElementType: type }),

  startPlayback: () => {
    const { frames } = get()
    if (frames.length < 2) return
    set({ isPlaying: true, playbackFrameIndex: 0 })
    let idx = 0
    const advance = () => {
      idx += 1
      if (idx >= frames.length) { set({ isPlaying: false, playbackFrameIndex: 0 }); return }
      set({ playbackFrameIndex: idx })
      playbackTimer = setTimeout(advance, 1200)
    }
    playbackTimer = setTimeout(advance, 1200)
  },

  stopPlayback: () => {
    if (playbackTimer) { clearTimeout(playbackTimer); playbackTimer = null }
    set({ isPlaying: false, playbackFrameIndex: 0 })
  },

  toPlaybook: (): PlaybookData => {
    const { tacticName, elements, frames } = get()
    return { name: tacticName, elements, frames }
  },

  loadPlaybook: (data: PlaybookData) => {
    set({
      tacticName: data.name ?? 'Tática',
      elements: data.elements,
      frames: data.frames.length > 0 ? data.frames : [{ frameIndex: 0, positions: {} }],
      currentFrameIndex: 0,
      isPlaying: false,
      playbackFrameIndex: 0,
      pendingElementType: null,
    })
  },

  reset: () => {
    if (playbackTimer) { clearTimeout(playbackTimer); playbackTimer = null }
    set({
      tacticName: 'Tática',
      elements: [],
      frames: [{ frameIndex: 0, positions: {} }],
      currentFrameIndex: 0,
      isPlaying: false,
      playbackFrameIndex: 0,
      pendingElementType: null,
    })
  },
}))
