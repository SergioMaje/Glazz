import { useState, useMemo, useRef, useCallback } from 'react'
import { Calculator, ShoppingCart, Printer, Scissors, AlertCircle, ImagePlus, X } from 'lucide-react'
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
import { useReferencias } from '@/hooks/useReferencias'
import type { ItemCotizacion } from './PanelCotizacion'

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


interface ConfiguradorProductoProps {
  onAgregarItem: (item: ItemCotizacion) => void
}

export function ConfiguradorProducto({ onAgregarItem }: ConfiguradorProductoProps) {
  const [tipoActivo, setTipoActivo] = useState<TipoProducto>('ventana')
  const [anchoCm, setAnchoCm] = useState(120)
  const [altoCm, setAltoCm] = useState(150)
  const [colorPerfil, setColorPerfil] = useState('#9CA3AF')
  const [plantillaId, setPlantillaId] = useState<string>('')
  const [referenciaId, setReferenciaId] = useState<string>('')
  const [especificaciones, setEspecificaciones] = useState('')

  const [imagenFicha, setImagenFicha] = useState<string | null>(null)
  const imagenInputRef = useRef<HTMLInputElement>(null)

  const previewRef = useRef<HTMLDivElement>(null)

  const { data: plantillas } = usePlantillas()
  const { data: referencias } = useReferencias()

  const plantillasFiltradas = plantillas?.filter((p) =>
    p.tipo_producto?.nombre === tipoActivo
  ) ?? []

  const plantillaSeleccionada = plantillas?.find((p) => p.id === plantillaId) ?? null

  const referenciasFiltradas = referencias?.filter((r) =>
    r.tipo_producto?.nombre === tipoActivo
  ) ?? []

  const referenciaSeleccionada = referencias?.find((r) => r.id === referenciaId) ?? null

  const handleImagenChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImagenFicha(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [])

  const handleSeleccionarReferencia = (refId: string) => {
    setReferenciaId(refId)
    const ref = referencias?.find((r) => r.id === refId)
    if (ref) setPlantillaId(ref.plantilla_id)
  }

  const handleSeleccionarPlantilla = (pid: string) => {
    setPlantillaId(pid)
    setReferenciaId('')
  }

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

  const cortesCalculados = useMemo(() => {
    if (!referenciaSeleccionada?.cortes?.length) return []
    return referenciaSeleccionada.cortes.map((c) => {
      let valor = 0
      switch (c.formula) {
        case 'ancho':              valor = anchoCm; break
        case 'alto':               valor = altoCm; break
        case 'ancho_menos_margen': valor = anchoCm - c.margen_cm; break
        case 'alto_menos_margen':  valor = altoCm - c.margen_cm; break
        case 'mitad_ancho':        valor = anchoCm / 2; break
        case 'mitad_alto':         valor = altoCm / 2; break
        case 'fijo':               valor = c.cantidad_fija_cm ?? 0; break
      }
      return { ...c, valor_cm: Math.max(0, valor) }
    })
  }, [referenciaSeleccionada, anchoCm, altoCm])

  const costoTotal = materiales.reduce((s, m) => s + m.costo_total, 0)
  const precioSugerido = costoTotal * MARGEN_VENTA

  const agregarACotizacion = () => {
    const tipoLabel = TIPOS.find((t) => t.key === tipoActivo)?.label ?? tipoActivo
    const colorLabel = COLORES_PERFIL.find((c) => c.value === colorPerfil)?.label ?? colorPerfil
    const referenciaNombre = referenciaSeleccionada?.nombre ?? ''
    const descripcion = `${tipoLabel} ${anchoCm}×${altoCm}cm — ${colorLabel} — ${referenciaNombre}`
    const precioRedondeado = Math.round(precioSugerido)

    onAgregarItem({
      plantilla_id: plantillaId || null,
      descripcion,
      ancho_cm: anchoCm,
      alto_cm: altoCm,
      area_m2: (anchoCm / 100) * (altoCm / 100),
      cantidad: 1,
      precio_unitario: precioRedondeado,
      precio_total: precioRedondeado,
      notas: especificaciones.trim() || null,
    })
    setEspecificaciones('')
  }

  const imprimir = () => {
    const svgEl = previewRef.current?.querySelector('svg')
    const svgHtml = svgEl ? new XMLSerializer().serializeToString(svgEl) : ''
    const tipoLabel = TIPOS.find((t) => t.key === tipoActivo)?.label ?? tipoActivo
    const plantillaNombre = plantillaSeleccionada?.nombre ?? '—'
    const referenciaNombre = referenciaSeleccionada?.nombre ?? null
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
            </tr>
          </thead>
          <tbody>
            ${materiales.map((m) => `
              <tr>
                <td>${m.item?.nombre ?? '—'}</td>
                <td>${m.cantidad_calculada.toFixed(2)}</td>
                <td>${m.item?.unidad_medida?.simbolo ?? '—'}</td>
                <td><span class="badge ${m.stock_ok ? 'ok' : 'no'}">${m.stock_ok ? 'Disponible' : 'Sin stock'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`

    const cortesHtml = cortesCalculados.length === 0 ? '' : `
      <div class="section">
        <h2>Medidas de corte</h2>
        <table>
          <thead>
            <tr>
              <th>Pieza</th>
              <th>Cantidad</th>
              <th class="right">Longitud (cm)</th>
            </tr>
          </thead>
          <tbody>
            ${cortesCalculados.map((c) => `
              <tr>
                <td>${c.nombre_pieza}</td>
                <td>${c.cantidad_piezas} ${c.cantidad_piezas === 1 ? 'pieza' : 'piezas'}</td>
                <td class="right"><strong>${c.valor_cm.toFixed(1)} cm</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`

    const imagenHtml = imagenFicha ? `
      <div class="section">
        <h2>Imagen de referencia</h2>
        <div class="img-wrap"><img src="${imagenFicha}" alt="Imagen de referencia" /></div>
      </div>` : ''

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
    .img-wrap{text-align:center;padding:8px 0}.img-wrap img{max-width:100%;max-height:260px;object-fit:contain;border:1px solid #e5e7eb;border-radius:6px}
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
      ${referenciaNombre ? `<div class="kv"><span>Referencia</span><strong>${referenciaNombre}</strong></div>` : ''}
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

  ${imagenHtml}
  ${materialesHtml}
  ${cortesHtml}
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
            <Tabs value={tipoActivo} onValueChange={(v) => { setTipoActivo(v as TipoProducto); setPlantillaId(''); setReferenciaId('') }}>
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
              <Label>Referencia <span className="text-destructive">*</span></Label>
              {referenciasFiltradas.length === 0 ? (
                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  No hay referencias configuradas para este tipo de producto
                </div>
              ) : (
                <Select value={referenciaId || undefined} onValueChange={handleSeleccionarReferencia}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una referencia..." />
                  </SelectTrigger>
                  <SelectContent>
                    {referenciasFiltradas.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Plantilla de materiales</Label>
              <Select value={plantillaId} onValueChange={handleSeleccionarPlantilla}>
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
            <CardTitle>Imagen de referencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={imagenInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImagenChange}
            />
            {imagenFicha ? (
              <div className="relative">
                <img
                  src={imagenFicha}
                  alt="Imagen de referencia"
                  className="max-h-48 w-full rounded-md border object-contain bg-muted/30"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute right-2 top-2 h-6 w-6"
                  onClick={() => setImagenFicha(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => imagenInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-md border-2 border-dashed border-input py-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <ImagePlus className="h-8 w-8" />
                <span>Haz clic para subir una imagen</span>
                <span className="text-xs">PNG, JPG, WEBP — la imagen se incluirá en la ficha impresa</span>
              </button>
            )}
            {imagenFicha && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => imagenInputRef.current?.click()}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                Cambiar imagen
              </Button>
            )}
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
                    <Badge variant={mat.stock_ok ? 'success' : 'destructive'} className="text-xs">
                      {mat.stock_ok ? 'OK' : 'Sin stock'}
                    </Badge>
                  </div>
                ))}
              </div>

              <Button className="mt-4 w-full" onClick={agregarACotizacion} disabled={!plantillaId || !referenciaId}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Agregar a cotización
              </Button>
            </CardContent>
          </Card>
        )}

        {cortesCalculados.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scissors className="h-5 w-5" />
                Medidas de corte
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cortesCalculados.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div className="flex-1">
                      <p className="font-medium">{c.nombre_pieza}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.cantidad_piezas} {c.cantidad_piezas === 1 ? 'pieza' : 'piezas'}
                      </p>
                    </div>
                    <span className="font-mono font-semibold">{c.valor_cm.toFixed(1)} cm</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
