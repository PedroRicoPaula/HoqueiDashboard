'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useTacticalStore } from '@/store/tacticalStore'

interface PlaybackOverlayProps {
  scaleX: number
  scaleY: number
}

const ELEMENT_COLORS: Record<string, string> = {
  player:   '#FFC800',
  opponent: '#3b82f6',
  ball:     '#f59e0b',
  cone:     '#ef4444',
}

const ELEMENT_RADIUS: Record<string, number> = {
  player:   20,
  opponent: 20,
  ball:     13,
  cone:     13,
}

export function PlaybackOverlay({ scaleX, scaleY }: PlaybackOverlayProps) {
  const { elements, frames, playbackFrameIndex, isPlaying } = useTacticalStore()

  if (!isPlaying) return null

  const currentFrame = frames[playbackFrameIndex]
  if (!currentFrame) return null

  return (
    <div className="absolute inset-0 pointer-events-none">
      <AnimatePresence>
        {elements.map((el) => {
          const pos = currentFrame.positions[el.id]
          if (!pos) return null

          const x = pos.x * scaleX
          const y = pos.y * scaleY
          const r = ELEMENT_RADIUS[el.type] ?? 12
          const color = ELEMENT_COLORS[el.type] ?? '#888'

          return (
            <motion.div
              key={el.id}
              initial={false}
              animate={{ x: x - r, y: y - r }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                width: r * 2,
                height: r * 2,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: el.type === 'cone' ? '2px' : '50%',
                  backgroundColor: color,
                  border: '2px solid rgba(0,0,0,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 8px rgba(0,0,0,0.6)',
                }}
              >
                {el.label && (
                  <span style={{ fontSize: 9, color: 'white', fontWeight: 'bold' }}>
                    {el.label}
                  </span>
                )}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
