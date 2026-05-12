interface PreviewProductoProps {
  tipo: 'ventana' | 'puerta' | 'division' | 'espejo' | 'otro'
  anchoCm: number
  altoCm: number
  colorPerfil?: string
}

const CANVAS_W = 280
const CANVAS_H = 220
const MARCO_W = 12

export function PreviewProducto({ tipo, anchoCm, altoCm, colorPerfil = '#9CA3AF' }: PreviewProductoProps) {
  const maxDim = Math.max(anchoCm, altoCm, 1)
  const pad = 20

  const w = ((anchoCm / maxDim) * (CANVAS_W - pad * 2))
  const h = ((altoCm / maxDim) * (CANVAS_H - pad * 2))
  const x = (CANVAS_W - w) / 2
  const y = (CANVAS_H - h) / 2

  const frameColor = colorPerfil

  return (
    <svg
      width={CANVAS_W}
      height={CANVAS_H}
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      className="rounded-md border bg-slate-50"
    >
      <defs>
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(200,235,255,0.6)" />
          <stop offset="100%" stopColor="rgba(140,195,230,0.35)" />
        </linearGradient>
        <linearGradient id="mirror" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(220,235,250,0.9)" />
          <stop offset="50%" stopColor="rgba(180,210,240,0.7)" />
          <stop offset="100%" stopColor="rgba(200,225,245,0.85)" />
        </linearGradient>
        <pattern id="hatching" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        </pattern>
      </defs>

      {tipo === 'ventana' && (
        <g>
          <rect x={x} y={y} width={w} height={h} fill={frameColor} rx={2} />
          <rect x={x + MARCO_W} y={y + MARCO_W} width={(w - MARCO_W * 3) / 2} height={h - MARCO_W * 2} fill="url(#glass)" stroke={frameColor} strokeWidth={2} />
          <rect x={x + MARCO_W + (w - MARCO_W * 3) / 2 + MARCO_W} y={y + MARCO_W} width={(w - MARCO_W * 3) / 2} height={h - MARCO_W * 2} fill="url(#glass)" stroke={frameColor} strokeWidth={2} />
          <rect x={x + MARCO_W} y={y + 4} width={w - MARCO_W * 2} height={4} fill="rgba(0,0,0,0.1)" />
          <rect x={x + MARCO_W} y={y + h - 8} width={w - MARCO_W * 2} height={4} fill="rgba(0,0,0,0.1)" />
        </g>
      )}

      {tipo === 'puerta' && (
        <g>
          <rect x={x} y={y} width={w} height={h} fill={frameColor} rx={2} />
          <rect x={x + MARCO_W} y={y + MARCO_W} width={w - MARCO_W * 2} height={(h - MARCO_W * 2) * 0.65} fill="url(#glass)" />
          <rect x={x + MARCO_W} y={y + MARCO_W + (h - MARCO_W * 2) * 0.65 + MARCO_W / 2} width={w - MARCO_W * 2} height={(h - MARCO_W * 2) * 0.3} fill={frameColor} opacity={0.7} />
          <rect x={x + w - MARCO_W - 16} y={y + h / 2 - 18} width={5} height={36} rx={2} fill="rgba(100,100,100,0.7)" />
          <circle cx={x + w - MARCO_W - 13.5} cy={y + h / 2 - 18} r={4} fill="rgba(80,80,80,0.8)" />
        </g>
      )}

      {tipo === 'division' && (
        <g>
          <rect x={x} y={y} width={w} height={h} fill={frameColor} rx={2} />
          {[0, 1, 2].map((i) => {
            const panelW = (w - MARCO_W * 4) / 3
            return (
              <rect
                key={i}
                x={x + MARCO_W + i * (panelW + MARCO_W)}
                y={y + MARCO_W}
                width={panelW}
                height={h - MARCO_W * 2}
                fill="url(#glass)"
              />
            )
          })}
        </g>
      )}

      {tipo === 'espejo' && (
        <g>
          <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} fill={frameColor} rx={4} />
          <rect x={x} y={y} width={w} height={h} fill="url(#mirror)" />
          <rect x={x} y={y} width={w} height={h} fill="url(#hatching)" opacity={0.3} />
          <ellipse cx={x + w * 0.3} cy={y + h * 0.3} rx={w * 0.08} ry={h * 0.12} fill="rgba(255,255,255,0.4)" />
        </g>
      )}

      {tipo === 'otro' && (
        <g>
          <rect x={x} y={y} width={w} height={h} fill={frameColor} rx={2} />
          <rect x={x + MARCO_W} y={y + MARCO_W} width={w - MARCO_W * 2} height={h - MARCO_W * 2} fill="url(#glass)" />
        </g>
      )}

      <text x={CANVAS_W / 2} y={y - 6} textAnchor="middle" fontSize={10} fill="#6B7280">{anchoCm} cm</text>
      <text x={x - 6} y={CANVAS_H / 2} textAnchor="middle" fontSize={10} fill="#6B7280" transform={`rotate(-90, ${x - 6}, ${CANVAS_H / 2})`}>{altoCm} cm</text>
    </svg>
  )
}
