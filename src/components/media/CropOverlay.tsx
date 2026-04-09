import { useState, useRef, useCallback } from 'react'

interface Props {
  imageUrl: string
  onConfirm: (dataUrl: string) => void
  onCancel: () => void
}

type Handle = 'move' | 'tl' | 'tr' | 'bl' | 'br'
interface Box { x: number; y: number; w: number; h: number }

const PRESETS: { label: string; ratio: number | null }[] = [
  { label: 'Fri', ratio: null },
  { label: '4:5', ratio: 4 / 5 },
  { label: '1:1', ratio: 1 },
  { label: '16:9', ratio: 16 / 9 },
]

const MIN = 40
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export function CropOverlay({ imageUrl, onConfirm, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [disp, setDisp] = useState({ w: 0, h: 0 })
  const [crop, setCrop] = useState<Box>({ x: 0, y: 0, w: 0, h: 0 })
  const [preset, setPreset] = useState('Fri')
  const drag = useRef<{ handle: Handle; mx: number; my: number; box0: Box } | null>(null)

  const handleLoad = useCallback(() => {
    const img = imgRef.current
    if (!img) return
    const { width: dw, height: dh } = img.getBoundingClientRect()
    setNat({ w: img.naturalWidth, h: img.naturalHeight })
    setDisp({ w: dw, h: dh })
    setCrop({ x: 0, y: 0, w: dw, h: dh })
  }, [])

  const snapToRatio = (label: string, ratio: number | null) => {
    setPreset(label)
    if (ratio === null || disp.w === 0) return
    let cw = disp.w
    let ch = Math.round(cw / ratio)
    if (ch > disp.h) { ch = disp.h; cw = Math.round(ch * ratio) }
    setCrop({
      x: Math.round((disp.w - cw) / 2),
      y: Math.round((disp.h - ch) / 2),
      w: cw,
      h: ch,
    })
  }

  const onPD = (e: React.PointerEvent, handle: Handle) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { handle, mx: e.clientX, my: e.clientY, box0: { ...crop } }
  }

  const onPM = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    const { handle, mx, my, box0 } = drag.current
    const dx = e.clientX - mx
    const dy = e.clientY - my
    const lockedRatio = PRESETS.find(p => p.label === preset)?.ratio ?? null
    setCrop(() => {
      let { x, y, w, h } = box0
      if (handle === 'move') {
        return { x: clamp(x + dx, 0, disp.w - w), y: clamp(y + dy, 0, disp.h - h), w, h }
      }
      if (handle === 'tl') {
        const nx = clamp(x + dx, 0, x + w - MIN)
        const ny = clamp(y + dy, 0, y + h - MIN)
        w = x + w - nx; h = y + h - ny; x = nx; y = ny
      } else if (handle === 'tr') {
        w = clamp(w + dx, MIN, disp.w - x)
        const ny = clamp(y + dy, 0, y + h - MIN)
        h = y + h - ny; y = ny
      } else if (handle === 'bl') {
        const nx = clamp(x + dx, 0, x + w - MIN)
        w = x + w - nx; x = nx
        h = clamp(h + dy, MIN, disp.h - y)
      } else {
        w = clamp(w + dx, MIN, disp.w - x)
        h = clamp(h + dy, MIN, disp.h - y)
      }
      if (lockedRatio) {
        h = Math.round(w / lockedRatio)
        if (y + h > disp.h) { h = disp.h - y; w = Math.round(h * lockedRatio) }
        if (x + w > disp.w) { w = disp.w - x; h = Math.round(w / lockedRatio) }
      }
      return { x, y, w, h }
    })
  }, [disp, preset])

  const handleConfirm = () => {
    if (disp.w === 0) return
    const scale = nat.w / disp.w
    const sx = Math.round(crop.x * scale)
    const sy = Math.round(crop.y * scale)
    const sw = Math.round(crop.w * scale)
    const sh = Math.round(crop.h * scale)
    fetch(imageUrl)
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = sw
          canvas.height = sh
          canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
          URL.revokeObjectURL(blobUrl)
          onConfirm(canvas.toDataURL('image/jpeg', 0.92))
        }
        img.src = blobUrl
      })
  }

  const isReady = disp.w > 0

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col select-none touch-none">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-black/70">
        <button
          onClick={onCancel}
          className="text-white/60 hover:text-white text-sm font-medium px-2 py-1"
        >
          Annuller
        </button>
        <span className="text-white text-sm font-semibold">Beskær billede</span>
        <button
          onClick={handleConfirm}
          disabled={!isReady}
          className="text-blue-400 hover:text-blue-300 text-sm font-semibold px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Anvend
        </button>
      </div>

      {/* Ratio presets */}
      <div className="flex items-center justify-center gap-2 py-2 shrink-0 bg-black/50">
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => snapToRatio(p.label, p.ratio)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              preset === p.label
                ? 'bg-white text-black'
                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Image + crop area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-neutral-900">
        <div
          style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}
          onPointerMove={onPM}
          onPointerUp={() => { drag.current = null }}
          onPointerLeave={() => { drag.current = null }}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            onLoad={handleLoad}
            draggable={false}
            alt=""
            style={{
              display: 'block',
              maxWidth: '90vw',
              maxHeight: '65vh',
              userSelect: 'none',
              WebkitUserSelect: 'none' as any,
            }}
          />
          {isReady && (
            <>
              {/* Dark overlay — 4 rects outside crop box */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: crop.y, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: crop.y + crop.h, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: crop.y, left: 0, width: crop.x, height: crop.h, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: crop.y, left: crop.x + crop.w, right: 0, height: crop.h, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />

              {/* Crop box */}
              <div
                onPointerDown={e => onPD(e, 'move')}
                style={{
                  position: 'absolute',
                  top: crop.y,
                  left: crop.x,
                  width: crop.w,
                  height: crop.h,
                  outline: '1.5px solid rgba(255,255,255,0.9)',
                  cursor: 'move',
                  touchAction: 'none',
                  boxSizing: 'border-box',
                }}
              >
                {/* Rule of thirds guide lines */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.2)' }} />
                  <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.2)' }} />
                  <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.2)' }} />
                  <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.2)' }} />
                </div>

                {/* Corner drag handles */}
                {(['tl', 'tr', 'bl', 'br'] as const).map(h => (
                  <div
                    key={h}
                    onPointerDown={e => onPD(e, h)}
                    style={{
                      position: 'absolute',
                      width: 18,
                      height: 18,
                      background: 'white',
                      borderRadius: 2,
                      cursor: h === 'tl' || h === 'br' ? 'nwse-resize' : 'nesw-resize',
                      top: h[0] === 't' ? -5 : 'auto',
                      bottom: h[0] === 'b' ? -5 : 'auto',
                      left: h[1] === 'l' ? -5 : 'auto',
                      right: h[1] === 'r' ? -5 : 'auto',
                      touchAction: 'none',
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer — pixel readout */}
      <div className="py-2 shrink-0 text-center bg-black/50">
        <p className="text-white/30 text-xs">
          {isReady ? `${Math.round(crop.w)} × ${Math.round(crop.h)}` : ''}
        </p>
      </div>
    </div>
  )
}
