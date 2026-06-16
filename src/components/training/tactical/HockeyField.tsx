'use client'

import type { ElementType } from '@/types/training.types'

export const FIELD_W = 1000
export const FIELD_H = 600

export const ELEMENT_COLORS: Record<ElementType, string> = {
  player:   '#FFC800',
  opponent: '#3b82f6',
  ball:     '#f59e0b',
  cone:     '#ef4444',
}

export const ELEMENT_BORDER_COLORS: Record<ElementType, string> = {
  player:   'rgba(0,0,0,0.85)',
  opponent: 'rgba(255,255,255,0.9)',
  ball:     'rgba(0,0,0,0.3)',
  cone:     'rgba(0,0,0,0.3)',
}

export const ELEMENT_LABEL_COLORS: Record<ElementType, string> = {
  player:   '#111111',
  opponent: '#ffffff',
  ball:     '#ffffff',
  cone:     '#ffffff',
}

export const ELEMENT_RADIUS: Record<ElementType, number> = {
  player:   20,
  opponent: 20,
  ball:     13,
  cone:     13,
}

interface FieldMetrics {
  mx: number; my: number; fw: number; fh: number
  cx: number; cy: number
  glLeft: number; glRight: number
  penDepth: number; penH: number; penY: number
  fkExtra: number; goalH: number; goalD: number; ccR: number
}

export function fieldMetrics(W: number, H: number): FieldMetrics {
  const mx = W * 0.055
  const my = H * 0.0667
  const fw = W - mx * 2
  const fh = H - my * 2
  const cx = W / 2
  const cy = H / 2
  const behindGoal = fw * 0.065
  const glLeft  = mx + behindGoal
  const glRight = mx + fw - behindGoal
  const penDepth = fw * 0.200
  const penH     = fh * 0.60
  const penY     = cy - penH / 2
  const fkExtra  = fw * 0.048
  const goalH    = fh * 0.15
  const goalD    = Math.min(behindGoal - 4 * (W / FIELD_W), 20 * (W / FIELD_W))
  const ccR      = fh * 0.14
  return { mx, my, fw, fh, cx, cy, glLeft, glRight, penDepth, penH, penY, fkExtra, goalH, goalD, ccR }
}

export function canvasDrawField(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const m = fieldMetrics(W, H)
  const stroke = '#1a1a1a'
  const sw = 2.5 * (W / FIELD_W)
  const swThin = 2 * (W / FIELD_W)
  const cornerR = 28 * (W / FIELD_W)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#f0f4f0'
  ctx.strokeStyle = stroke
  ctx.lineWidth = sw
  ctx.beginPath()
  ctx.moveTo(m.mx + cornerR, m.my)
  ctx.lineTo(m.mx + m.fw - cornerR, m.my)
  ctx.quadraticCurveTo(m.mx + m.fw, m.my, m.mx + m.fw, m.my + cornerR)
  ctx.lineTo(m.mx + m.fw, m.my + m.fh - cornerR)
  ctx.quadraticCurveTo(m.mx + m.fw, m.my + m.fh, m.mx + m.fw - cornerR, m.my + m.fh)
  ctx.lineTo(m.mx + cornerR, m.my + m.fh)
  ctx.quadraticCurveTo(m.mx, m.my + m.fh, m.mx, m.my + m.fh - cornerR)
  ctx.lineTo(m.mx, m.my + cornerR)
  ctx.quadraticCurveTo(m.mx, m.my, m.mx + cornerR, m.my)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.lineWidth = swThin
  ctx.strokeStyle = stroke

  ctx.beginPath(); ctx.moveTo(m.cx, m.my); ctx.lineTo(m.cx, m.my + m.fh); ctx.stroke()
  ctx.beginPath(); ctx.arc(m.cx, m.cy, m.ccR, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = stroke
  ctx.beginPath(); ctx.arc(m.cx, m.cy, 5 * (W / FIELD_W), 0, Math.PI * 2); ctx.fill()

  ctx.strokeStyle = stroke
  ctx.strokeRect(m.glLeft, m.penY, m.penDepth, m.penH)
  ctx.fillStyle = stroke
  ctx.beginPath(); ctx.arc(m.glLeft + m.penDepth, m.cy, 5 * (W / FIELD_W), 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(m.glLeft + m.penDepth + m.fkExtra, m.cy, 5 * (W / FIELD_W), 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#d0d8d0'
  ctx.fillRect(m.glLeft - m.goalD, m.cy - m.goalH / 2, m.goalD, m.goalH)
  ctx.strokeRect(m.glLeft - m.goalD, m.cy - m.goalH / 2, m.goalD, m.goalH)

  ctx.strokeStyle = stroke
  ctx.strokeRect(m.glRight - m.penDepth, m.penY, m.penDepth, m.penH)
  ctx.fillStyle = stroke
  ctx.beginPath(); ctx.arc(m.glRight - m.penDepth, m.cy, 5 * (W / FIELD_W), 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(m.glRight - m.penDepth - m.fkExtra, m.cy, 5 * (W / FIELD_W), 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#d0d8d0'
  ctx.fillRect(m.glRight, m.cy - m.goalH / 2, m.goalD, m.goalH)
  ctx.strokeRect(m.glRight, m.cy - m.goalH / 2, m.goalD, m.goalH)
}

export function canvasDrawElements(
  ctx: CanvasRenderingContext2D,
  elements: { id: string; type: ElementType; label?: string }[],
  positions: Record<string, { x: number; y: number }>,
  W: number, H: number,
) {
  const scaleX = W / FIELD_W
  const scaleY = H / FIELD_H
  const rs = Math.min(scaleX, scaleY)

  elements.forEach(el => {
    const pos = positions[el.id]
    if (!pos) return
    const x = pos.x * scaleX
    const y = pos.y * scaleY
    const r = ELEMENT_RADIUS[el.type] * rs
    const color = ELEMENT_COLORS[el.type]
    const borderCol = ELEMENT_BORDER_COLORS[el.type]
    const labelCol = ELEMENT_LABEL_COLORS[el.type]

    ctx.save()
    ctx.shadowBlur = 4 * rs
    ctx.shadowColor = 'rgba(0,0,0,0.4)'
    ctx.fillStyle = color
    ctx.strokeStyle = borderCol
    ctx.lineWidth = 2.5 * rs

    ctx.beginPath()
    if (el.type === 'cone') {
      const half = r
      ctx.moveTo(x - half + 3 * rs, y - half)
      ctx.lineTo(x + half - 3 * rs, y - half)
      ctx.quadraticCurveTo(x + half, y - half, x + half, y - half + 3 * rs)
      ctx.lineTo(x + half, y + half - 3 * rs)
      ctx.quadraticCurveTo(x + half, y + half, x + half - 3 * rs, y + half)
      ctx.lineTo(x - half + 3 * rs, y + half)
      ctx.quadraticCurveTo(x - half, y + half, x - half, y + half - 3 * rs)
      ctx.lineTo(x - half, y - half + 3 * rs)
      ctx.quadraticCurveTo(x - half, y - half, x - half + 3 * rs, y - half)
      ctx.closePath()
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2)
    }
    ctx.fill()
    ctx.stroke()

    if (el.label) {
      ctx.shadowBlur = 0
      ctx.fillStyle = labelCol
      ctx.font = `bold ${Math.round(r * 0.7)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(el.label, x, y)
    }
    ctx.restore()
  })
}

export function HockeyField() {
  const W = FIELD_W, H = FIELD_H
  const m = fieldMetrics(W, H)
  const stroke = '#1a1a1a'
  const sw = 2.5, swThin = 2

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      className="w-full h-full" style={{ background: '#ffffff' }}
      aria-label="Campo de hóquei em patins">
      <rect x={m.mx} y={m.my} width={m.fw} height={m.fh}
        fill="#f0f4f0" stroke={stroke} strokeWidth={sw} rx="28" ry="28" />
      <rect x={m.glLeft} y={m.penY} width={m.penDepth} height={m.penH}
        fill="none" stroke={stroke} strokeWidth={swThin} />
      <circle cx={m.glLeft + m.penDepth} cy={m.cy} r="5" fill={stroke} />
      <circle cx={m.glLeft + m.penDepth + m.fkExtra} cy={m.cy} r="5" fill={stroke} />
      <rect x={m.glLeft - m.goalD} y={m.cy - m.goalH / 2} width={m.goalD} height={m.goalH}
        fill="#d0d8d0" stroke={stroke} strokeWidth={swThin} />
      <rect x={m.glRight - m.penDepth} y={m.penY} width={m.penDepth} height={m.penH}
        fill="none" stroke={stroke} strokeWidth={swThin} />
      <circle cx={m.glRight - m.penDepth} cy={m.cy} r="5" fill={stroke} />
      <circle cx={m.glRight - m.penDepth - m.fkExtra} cy={m.cy} r="5" fill={stroke} />
      <rect x={m.glRight} y={m.cy - m.goalH / 2} width={m.goalD} height={m.goalH}
        fill="#d0d8d0" stroke={stroke} strokeWidth={swThin} />
      <line x1={m.cx} y1={m.my} x2={m.cx} y2={m.my + m.fh} stroke={stroke} strokeWidth={swThin} />
      <circle cx={m.cx} cy={m.cy} r={m.ccR} fill="none" stroke={stroke} strokeWidth={swThin} />
      <circle cx={m.cx} cy={m.cy} r="5" fill={stroke} />
    </svg>
  )
}
