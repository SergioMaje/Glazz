import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator, ShoppingCart, Printer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { PreviewProducto } from './PreviewProducto'
import { usePlantillas } from '@/hooks/useProductos'
import { formatCOP } from '@/lib/utils'

type TipoProducto = 'ventana' | 'puerta' | 'division' | 'espejo'

const TIPOS: { key: TipoProducto; label: string }[] = [
  { key: 'ventana', label: 'Ventana' },
  { key: 'puerta', label: 'Puerta' },
  { key: 'division', label: 'División' },
  { key: 'espejo', label: 'Espejo' },
]

const COLORES_PERFIL = [
  { value: '#9CA3AF', label: 'Natural' },
  { value: '#111827', label: 'Negro' },
  { value: '#B45309', label: 'Bronce' },
  { value: '#FFFFFF', label: 'Blanco' },
]

const MARGEN_VENTA = 1.35

const FMT = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })

export function ConfiguradorProducto() {
  const navigate = useNavigate()
  const [tipoActivo, setTipoActivo] = useState<TipoProducto>('ventana')
  const [anchoCm, setAnchoCm] = useState(120)
  const [altoCm, setAltoCm] = useState(150)
  const [colorPerfil, setColorPerfil] = useState('#9CA3AF')
  const [plantillaId, setPlantillaId] = useState<string>('')
  const [especificaciones, setEspecificaciones] = useState('')

  const previewRef = useRef<HTMLDivElement>(null)

  const { data: plantillas } = usePlantillas()

  const plantillasFiltradas = plantillas?.filter((p) =>
    p.tipo_producto?.nombre === tipoActivo
  ) ?? []

  const plantillaSeleccionada = plantillas?.find((p) => p.id === plantillaId) ?? null

  const materiales = useMemo(() => {
    if (!plantillaSeleccionada?.componentes) return []
    const anchoM = anchoCm / 100
    const altoM = altoCm / 100
    const area = anchoM * altoM
    const perimetro = 2 * (anchoM + altoM)

    return plantillaSeleccionada.componentes.map((comp) => {
      let cantidad = 0
      switch (comp.formula) {
        case 'area': cantidad = area; break
        case 'perimetro': cantidad = perimetro; break
        case 'ancho': cantidad = anchoM; break
        case 'alto': cantidad = altoM; break
        case 'fijo': cantidad = comp.cantidad_fija ?? 1; break
      }
      const factor = 1 + comp.desperdicio_pct / 100
      const cantidadFinal = cantidad * factor
      const costo = cantidadFinal * (comp.item?.precio_costo ?? 0)
      const stockOk = (comp.item?.stock_actual ?? 0) >= cantidadFinal

      return { ...comp, cantidad_calculada: cantidadFinal, costo_total: costo, stock_ok: stockOk }
    })
  }, [plantillaSeleccionada, anchoCm, altoCm])

  const costoTotal = materiales.reduce((s, m) => s + m.costo_total, 0)
  const precioSugerido = costoTotal * MARGEN_VENTA

  const irACotizacion = () => {
    const params = new URLSearchParams({
      tipo: tipoActivo,
      ancho: anchoCm.toString(),
      alto: altoCm.toString(),
      plantilla: plantillaId,
      costo: costoTotal.toString(),
      precio: precioSugerido.toString(),
    })
    navigate(`/cotizaciones/nueva?${params.toString()}`)
  }

  const imprimir = () => {
    const svgEl = previewRef.current?.querySelector('svg')
    const svgHtml = svgEl ? new XMLSerializer().serializeToString(svgEl) : ''
    const tipoLabel = TIPOS.find((t) => t.key === tipoActivo)?.label ?? tipoActivo
    const plantillaNombre = plantillaSeleccionada?.nombre ?? '—'
    const areaM2 = ((anchoCm / 100) * (altoCm / 100)).toFixed(2)
    const perimetroMl = (2 * (anchoCm / 100 + altoCm / 100)).toFixed(2)
    const fecha = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const materialesHtml = materiales.length === 0 ? '' : `
      <div class="section">
        <h2>Materiales</h2>
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Cantidad</th>
              <th>Unidad</th>
              <th>Stock</th>
              <th class="right">Costo</th>
            </tr>
          </thead>
          <tbody>
            ${materiales.map((m) => `
              <tr>
                <td>${m.item?.nombre ?? '—'}</td>
                <td>${m.cantidad_calculada.toFixed(2)}</td>
                <td>${m.item?.unidad_medida?.simbolo ?? '—'}</td>
                <td><span class="badge ${m.stock_ok ? 'ok' : 'no'}">${m.stock_ok ? 'Disponible' : 'Sin stock'}</span></td>
                <td class="right">${FMT.format(m.costo_total)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4"><strong>Total materiales</strong></td>
              <td class="right"><strong>${FMT.format(costoTotal)}</strong></td>
            </tr>
          </tfoot>
        </table>
        <div class="cost-box">
          <div class="cost-row"><span>Costo de materiales</span><span>${FMT.format(costoTotal)}</span></div>
          <div class="cost-row accent"><span>Precio sugerido (×${MARGEN_VENTA})</span><span>${FMT.format(precioSugerido)}</span></div>
        </div>
      </div>`

    const specsHtml = especificaciones.trim() ? `
      <div class="section">
        <h2>Especificaciones adicionales</h2>
        <div class="specs">${especificaciones.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</div>
      </div>` : ''

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Ficha de Producto — ${tipoLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111;padding:2cm}
    h1{font-size:20px;font-weight:700;margin-bottom:2px}
    .sub{color:#666;font-size:12px;margin-bottom:24px}
    .section{margin-bottom:22px}
    h2{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:.05em;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin-bottom:10px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px}
    .kv{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f3f4f6;font-size:13px}
    .kv strong{font-weight:600}
    .preview{display:flex;justify-content:center;padding:12px 0}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;padding:5px 4px;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb}
    td{padding:5px 4px;border-bottom:1px solid #f3f4f6}
    tfoot td{border-top:2px solid #e5e7eb;border-bottom:none;padding-top:8px}
    .right{text-align:right}
    .badge{display:inline-block;padding:1px 7px;border-radius:3px;font-size:11px;font-weight:600}
    .badge.ok{background:#dcfce7;color:#166534}
    .badge.no{background:#fee2e2;color:#991b1b}
    .cost-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;margin-top:10px}
    .cost-row{display:flex;justify-content:space-between;padding:3px 0;font-size:13px}
    .cost-row.accent{font-weight:700;font-size:15px;color:#1d4ed8;border-top:1px solid #e5e7eb;margin-top:6px;padding-top:6px}
    .specs{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;line-height:1.6;color:#374151}
    @media print{body{padding:1cm}}
  </style>
</head>
<body>
  <h1>Ficha de Producto — ${tipoLabel}</h1>
  <div class="sub">Generada el ${fecha} · VidrioSystem</div>

  <div class="section">
    <h2>Datos generales</h2>
    <div class="grid2">
      <div class="kv"><span>Tipo</span><strong>${tipoLabel}</strong></div>
      <div class="kv"><span>Plantilla</span><strong>${plantillaNombre}</strong></div>
      <div class="kv"><span>Ancho</span><strong>${anchoCm} cm</strong></div>
      <div class="kv"><span>Alto</span><strong>${altoCm} cm</strong></div>
      <div class="kv"><span>Área</span><strong>${areaM2} m²</strong></div>
      <div class="kv"><span>Perímetro</span><strong>${perimetroMl} ml</strong></div>
    </div>
  </div>

  <div class="section">
    <h2>Vista previa</h2>
    <div class="preview">${svgHtml}</div>
  </div>

  ${materialesHtml}
  ${specsHtml}
</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Tipo de producto</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={tipoActivo} onValueChange={(v) => { setTipoActivo(v as TipoProducto); setPlantillaId('') }}>
              <TabsList className="grid w-full grid-cols-4">
                {TIPOS.map(({ key, label }) => (
                  <TabsTrigger key={key} value={key}>{label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Medidas y materiales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ancho (cm)</Label>
                <Input
                  type="number"
                  min={10}
                  max={500}
                  value={anchoCm}
                  onChange={(e) => setAnchoCm(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Alto (cm)</Label>
                <Input
                  type="number"
                  min={10}
                  max={500}
                  value={altoCm}
                  onChange={(e) => setAltoCm(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color del perfil</Label>
              <Select value={colorPerfil} onValueChange={setColorPerfil}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: colorPerfil }} />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {COLORES_PERFIL.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full border" style={{ backgroundColor: value }} />
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Plantilla de materiales</Label>
              <Select value={plantillaId} onValueChange={setPlantillaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una plantilla..." />
                </SelectTrigger>
                <SelectContent>
                  {plantillasFiltradas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Especificaciones adicionales</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={especificaciones}
              onChange={(e) => setEspecificaciones(e.target.value)}
              placeholder="Ej: Vidrio templado 6mm, bisagras ocultas, sellado con silicona neutra, acabado satinado..."
              rows={4}
              className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </CardContent>
        </Card>

        {materiales.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Materiales calculados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {materiales.map((mat) => (
                  <div key={mat.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div className="flex-1">
                      <p className="font-medium">{mat.item?.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {mat.cantidad_calculada.toFixed(2)} {mat.item?.unidad_medida?.simbolo}
                        {mat.desperdicio_pct > 0 && ` (inc. ${mat.desperdicio_pct}% desperdicio)`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono">{formatCOP(mat.costo_total)}</span>
                      <Badge variant={mat.stock_ok ? 'success' : 'destructive'} className="text-xs">
                        {mat.stock_ok ? 'OK' : 'Sin stock'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg bg-muted/50 p-3">
                <div className="flex justify-between text-sm">
                  <span>Costo de materiales:</span>
                  <span className="font-mono">{formatCOP(costoTotal)}</span>
                </div>
                <div className="mt-1 flex justify-between font-semibold">
                  <span>Precio sugerido (×{MARGEN_VENTA}):</span>
                  <span className="font-mono text-primary">{formatCOP(precioSugerido)}</span>
                </div>
              </div>

              <Button className="mt-4 w-full" onClick={irACotizacion} disabled={!plantillaId}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Guardar como cotización
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Vista previa en tiempo real</CardTitle>
              <Button variant="outline" size="sm" onClick={imprimir}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir ficha
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4" ref={previewRef}>
            <PreviewProducto
              tipo={tipoActivo}
              anchoCm={anchoCm}
              altoCm={altoCm}
              colorPerfil={colorPerfil}
            />
            <Separator />
            <div className="w-full space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dimensiones</span>
                <span className="font-medium">{anchoCm} × {altoCm} cm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Área</span>
                <span className="font-medium">{((anchoCm / 100) * (altoCm / 100)).toFixed(2)} m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Perímetro</span>
                <span className="font-medium">{(2 * (anchoCm / 100 + altoCm / 100)).toFixed(2)} ml</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
