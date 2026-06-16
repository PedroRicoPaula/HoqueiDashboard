'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTacticalStore } from '@/store/tacticalStore'
import {
  HockeyField, FIELD_W, FIELD_H,
  ELEMENT_COLORS, ELEMENT_BORDER_COLORS, ELEMENT_LABEL_COLORS, ELEMENT_RADIUS,
} from './HockeyField'

interface TacticalBoardProps {
  canEdit: boolean
}

export function TacticalBoard({ canEdit }: TacticalBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 1000, h: 600 })
  const [dragging, setDragging] = useState<{ id: string } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dragMovedRef = useRef(false)

  const {
    elements, frames, currentFrameIndex, isPlaying, playbackFrameIndex,
    pendingElementType, addElement, updatePosition, removeElement,
  } = useTacticalStore()

  const scaleX = containerSize.w > 0 ? containerSize.w / FIELD_W : 1
  const scaleY = containerSize.h > 0 ? containerSize.h / FIELD_H : 1
  const scale = Math.min(scaleX, scaleY)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ w: width, h: height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const currentPositions = frames[currentFrameIndex]?.positions ?? {}
  const playbackFrame = frames[playbackFrameIndex]

  function getNextPlayerLabel() {
    const nums = elements
      .filter(e => e.type === 'player' && e.label)
      .map(e => parseInt(e.label ?? '0'))
      .filter(n => !isNaN(n))
    let n = 1; while (nums.includes(n)) n++; return String(n)
  }

  function getNextOpponentLabel() {
    const letters = elements.filter(e => e.type === 'opponent' && e.label).map(e => e.label ?? '')
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') { if (!letters.includes(ch)) return ch }
    return '?'
  }

  const handleBoardClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isPlaying) return
    if (!pendingElementType) { setSelectedId(null); return }
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = (e.clientX - rect.left) / scaleX
    const y = (e.clientY - rect.top) / scaleY
    const label = pendingElementType === 'player'
      ? getNextPlayerLabel()
      : pendingElementType === 'opponent'
        ? getNextOpponentLabel()
        : undefined
    addElement(pendingElementType, x, y, label)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingElementType, isPlaying, scaleX, scaleY, addElement, elements])

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    if (!canEdit || isPlaying) return
    e.stopPropagation()
    dragMovedRef.current = false
    setDragging({ id })
  }, [canEdit, isPlaying])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      dragMovedRef.current = true
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = Math.max(0, Math.min(FIELD_W, (e.clientX - rect.left) / scaleX))
      const y = Math.max(0, Math.min(FIELD_H, (e.clientY - rect.top) / scaleY))
      updatePosition(dragging.id, x, y)
    }
    const onUp = () => setDragging(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging, scaleX, scaleY, updatePosition])

  const handleTouchStart = useCallback((e: React.TouchEvent, id: string) => {
    if (!canEdit || isPlaying) return
    e.stopPropagation()
    dragMovedRef.current = false
    setDragging({ id })
    setSelectedId(id)
  }, [canEdit, isPlaying])

  const handleTouchBoard = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (isPlaying || !pendingElementType) { setSelectedId(null); return }
    const touch = e.touches[0]
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = (touch.clientX - rect.left) / scaleX
    const y = (touch.clientY - rect.top) / scaleY
    const label = pendingElementType === 'player'
      ? getNextPlayerLabel()
      : pendingElementType === 'opponent'
        ? getNextOpponentLabel()
        : undefined
    addElement(pendingElementType, x, y, label)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingElementType, isPlaying, scaleX, scaleY, addElement, elements])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: TouchEvent) => {
      e.preventDefault()
      dragMovedRef.current = true
      const touch = e.touches[0]
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = Math.max(0, Math.min(FIELD_W, (touch.clientX - rect.left) / scaleX))
      const y = Math.max(0, Math.min(FIELD_H, (touch.clientY - rect.top) / scaleY))
      updatePosition(dragging.id, x, y)
    }
    const onUp = () => setDragging(null)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => { window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp) }
  }, [dragging, scaleX, scaleY, updatePosition])

  return (
    <div className="w-full h-full flex items-center justify-center p-2 bg-gray-950 min-h-0">
      <div
        ref={containerRef}
        className={cn(
          'relative rounded-xl overflow-hidden select-none shadow-2xl border border-gray-700',
          pendingElementType && !isPlaying ? 'cursor-crosshair' : 'cursor-default'
        )}
        style={{ aspectRatio: '5 / 3', maxWidth: '100%', maxHeight: '100%', width: '100%' }}
        onClick={handleBoardClick}
        onTouchStart={handleTouchBoard}
      >
        <div className="absolute inset-0 pointer-events-none">
          <HockeyField />
        </div>

        {!isPlaying && elements.map(el => {
          const pos = currentPositions[el.id]
          if (!pos) return null
          const r = ELEMENT_RADIUS[el.type] * scale
          const px = pos.x * scaleX
          const py = pos.y * scaleY
          const color = ELEMENT_COLORS[el.type]
          const borderColor = ELEMENT_BORDER_COLORS[el.type]
          const labelColor = ELEMENT_LABEL_COLORS[el.type]
          const isDragging = dragging?.id === el.id
          const isSelected = selectedId === el.id

          return (
            <div
              key={el.id}
              className="absolute"
              style={{
                left: px - r, top: py - r,
                width: r * 2, height: r * 2,
                cursor: isDragging ? 'grabbing' : 'grab',
                zIndex: isDragging ? 20 : 5,
                touchAction: 'none',
              }}
              onMouseDown={e => handleMouseDown(e, el.id)}
              onTouchStart={e => handleTouchStart(e, el.id)}
              onMouseEnter={() => setSelectedId(el.id)}
              onMouseLeave={() => { if (!dragging) setSelectedId(null) }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{
                width: '100%', height: '100%',
                borderRadius: el.type === 'cone' ? '20%' : '50%',
                backgroundColor: color,
                border: `${Math.max(1.5, 2.5 * scale)}px solid ${borderColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.5)' : '0 2px 6px rgba(0,0,0,0.35)',
              }}>
                {el.label && (
                  <span style={{
                    fontSize: Math.max(9, r * 0.65),
                    color: labelColor, fontWeight: 'bold', userSelect: 'none', lineHeight: 1,
                  }}>{el.label}</span>
                )}
              </div>
              {(isSelected || isDragging) && canEdit && !isPlaying && (
                <button
                  style={{
                    position: 'absolute', top: -8, right: -8,
                    width: Math.max(18, r * 0.8), height: Math.max(18, r * 0.8),
                    borderRadius: '50%', backgroundColor: '#ef4444',
                    border: '2px solid white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: 30,
                  }}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); removeElement(el.id); setSelectedId(null) }}
                  onTouchEnd={e => { e.stopPropagation(); removeElement(el.id); setSelectedId(null) }}
                >
                  <Trash2 style={{ width: '55%', height: '55%', color: 'white' }} />
                </button>
              )}
            </div>
          )
        })}

        <AnimatePresence>
          {isPlaying && playbackFrame && elements.map(el => {
            const pos = playbackFrame.positions[el.id]
            if (!pos) return null
            const r = ELEMENT_RADIUS[el.type] * scale
            const color = ELEMENT_COLORS[el.type]
            const borderColor = ELEMENT_BORDER_COLORS[el.type]
            const labelColor = ELEMENT_LABEL_COLORS[el.type]
            return (
              <motion.div
                key={el.id}
                initial={false}
                animate={{ x: pos.x * scaleX - r, y: pos.y * scaleY - r }}
                transition={{ duration: 0.9, ease: 'easeInOut' }}
                style={{ position: 'absolute', width: r * 2, height: r * 2, pointerEvents: 'none', zIndex: 10 }}
              >
                <div style={{
                  width: '100%', height: '100%',
                  borderRadius: el.type === 'cone' ? '20%' : '50%',
                  backgroundColor: color,
                  border: `${Math.max(1.5, 2.5 * scale)}px solid ${borderColor}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                }}>
                  {el.label && (
                    <span style={{ fontSize: Math.max(9, r * 0.65), color: labelColor, fontWeight: 'bold' }}>
                      {el.label}
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {elements.length === 0 && !pendingElementType && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-500 text-sm bg-white/80 px-4 py-2 rounded-lg text-center max-w-xs">
              Seleciona Jogador, Adversário, Bola ou Cone na barra e clica no campo
            </p>
          </div>
        )}

        {isPlaying && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
            {playbackFrameIndex + 1} / {frames.length}
          </div>
        )}
      </div>
    </div>
  )
}
