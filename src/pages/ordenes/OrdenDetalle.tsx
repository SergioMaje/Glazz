import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Play, CheckSquare, Truck, Loader2, Printer, Scissors, Calculator } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { formatFecha } from '@/lib/utils'
import { calcularCortes, calcularMateriales, nombreColorPerfil } from '@/lib/produccion'
import type { OrdenTrabajo, CotizacionItem } from '@/types/database'

const estadoConfig: Record<OrdenTrabajo['estado'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'warning' | 'success' | 'outline' }> = {
  pendiente: { label: 'Pendiente', variant: 'secondary' },
  en_produccion: { label: 'En producción', variant: 'default' },
  lista: { label: 'Lista', variant: 'success' },
  entregada: { label: 'Entregada', variant: 'outline' },
  cancelada: { label: 'Cancelada', variant: 'destructive' },
}

const SELECT_ITEMS_PRODUCCION = `
  *,
  referencia:referencias_producto(*, cortes:referencia_cortes(*)),
  plantilla:plantillas_producto(*, componentes:plantilla_componentes(*, item:items_inventario(*, unidad_medida:unidades_medida(*))))
`

function detalleProduccion(item: CotizacionItem) {
  const anchoCm = item.ancho_cm ?? 0
  const altoCm = item.alto_cm ?? 0
  const conMedidas = anchoCm > 0 && altoCm > 0

  const cortes = conMedidas && item.referencia?.cortes?.length
    ? calcularCortes([...item.referencia.cortes].sort((a, b) => a.orden - b.orden), anchoCm, altoCm)
    : []

  const materiales = conMedidas && item.plantilla?.componentes?.length
    ? calcularMateriales(item.plantilla.componentes, anchoCm, altoCm, item.cantidad)
    : []

  return { cortes, materiales }
}

export function OrdenDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { usuario } = useAuth()
  const qc = useQueryClient()

  const { data: orden, isLoading } = useQuery({
    queryKey: ['orden', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select('*, cliente:clientes(*)')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as OrdenTrabajo
    },
    enabled: !!id,
  })

  const { data: itemsCotizacion } = useQuery({
    queryKey: ['orden_items', orden?.cotizacion_id],
    queryFn: async () => {
      if (!orden?.cotizacion_id) return []
      const { data, error } = await supabase
        .from('cotizacion_items')
        .select(SELECT_ITEMS_PRODUCCION)
        .eq('cotizacion_id', orden.cotizacion_id)
      if (error) throw error
      return data as unknown as CotizacionItem[]
    },
    enabled: !!orden?.cotizacion_id,
  })

  const cambiarEstado = useMutation({
    mutationFn: async (nuevoEstado: OrdenTrabajo['estado']) => {
      const updates: Partial<OrdenTrabajo> = { estado: nuevoEstado }
      if (nuevoEstado === 'en_produccion') updates.fecha_inicio = new Date().toISOString().split('T')[0]
      if (nuevoEstado === 'entregada') updates.fecha_entrega_real = new Date().toISOString().split('T')[0]

      const { error } = await supabase.from('ordenes_trabajo').update(updates).eq('id', id!)
      if (error) throw error

      if (nuevoEstado === 'entregada' && orden?.cotizacion_id && usuario) {
        const { data: cotItems } = await supabase
          .from('cotizacion_items')
          .select('*, plantilla:plantillas_producto(componentes:plantilla_componentes(*))')
          .eq('cotizacion_id', orden.cotizacion_id)

        for (const cotItem of (cotItems ?? []) as unknown as CotizacionItem[]) {
          if (!cotItem.plantilla?.componentes || !cotItem.ancho_cm || !cotItem.alto_cm) continue

          const materiales = calcularMateriales(
            cotItem.plantilla.componentes,
            cotItem.ancho_cm,
            cotItem.alto_cm,
            cotItem.cantidad
          )

          for (const mat of materiales) {
            if (mat.cantidad_calculada <= 0) continue

            const { data: inv } = await supabase
              .from('items_inventario')
              .select('stock_actual')
              .eq('id', mat.item_id)
              .single()
            if (!inv) continue

            const anterior = inv.stock_actual
            const posterior = Math.max(0, anterior - mat.cantidad_calculada)

            await supabase.from('movimientos_inventario').insert({
              item_id:           mat.item_id,
              tipo:              'produccion',
              cantidad:          mat.cantidad_calculada,
              cantidad_anterior: anterior,
              cantidad_posterior: posterior,
              motivo:            `Orden ${orden.numero}`,
              referencia:        id,
              usuario_id:        usuario.id,
            })

            await supabase
              .from('items_inventario')
              .update({ stock_actual: posterior })
              .eq('id', mat.item_id)
          }
        }
      }
    },
    onSuccess: (_data, nuevoEstado) => {
      qc.invalidateQueries({ queryKey: ['orden', id] })
      qc.invalidateQueries({ queryKey: ['ordenes'] })
      if (nuevoEstado === 'entregada') {
        qc.invalidateQueries({ queryKey: ['items'] })
        qc.invalidateQueries({ queryKey: ['movimientos'] })
        qc.invalidateQueries({ queryKey: ['dashboard_stock_bajo'] })
        qc.invalidateQueries({ queryKey: ['dashboard_total_items'] })
      }
      toast({ title: nuevoEstado === 'entregada' ? 'Orden entregada — stock descontado' : 'Estado actualizado', variant: 'success' as never })
    },
    onError: () => toast({ title: 'Error al actualizar', variant: 'destructive' }),
  })

  const imprimirFichaProduccion = () => {
    if (!orden || !itemsCotizacion?.length) return
    const cli = orden.cliente as { nombre: string; apellido: string; telefono?: string } | undefined
    const fecha = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const itemsHtml = itemsCotizacion.map((item, idx) => {
      const { cortes, materiales } = detalleProduccion(item)
      const color = nombreColorPerfil(item.color_perfil)

      const cortesHtml = cortes.length === 0 ? '' : `
        <h3>Medidas de corte</h3>
        <table>
          <thead><tr><th>Pieza</th><th>Cantidad</th>${item.referencia?.es_corrediza ? '<th>Tipo</th>' : ''}<th class="right">Longitud (cm)</th></tr></thead>
          <tbody>
            ${cortes.map((c) => `
              <tr>
                <td>${c.nombre_pieza}</td>
                <td>${c.cantidad_piezas} ${c.cantidad_piezas === 1 ? 'pieza' : 'piezas'}${item.cantidad > 1 ? ` × ${item.cantidad} und = ${c.cantidad_piezas * item.cantidad}` : ''}</td>
                ${item.referencia?.es_corrediza ? `<td><span class="badge ${c.es_corredizo ? 'corrediza' : 'fija'}">${c.es_corredizo ? 'Corrediza' : 'Fija'}</span></td>` : ''}
                <td class="right"><strong>${c.valor_cm.toFixed(1)} cm</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>`

      const materialesHtml = materiales.length === 0 ? '' : `
        <h3>Materiales</h3>
        <table>
          <thead><tr><th>Material</th><th class="right">Cantidad total</th><th>Unidad</th></tr></thead>
          <tbody>
            ${materiales.map((m) => `
              <tr>
                <td>${m.item?.nombre ?? '—'}</td>
                <td class="right">${m.cantidad_calculada.toFixed(2)}</td>
                <td>${m.item?.unidad_medida?.simbolo ?? '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`

      const sinInfo = cortes.length === 0 && materiales.length === 0
        ? '<p class="warn">Sin referencia/plantilla guardada — verificar medidas de corte manualmente.</p>'
        : ''

      return `
        <div class="item">
          <div class="item-head">
            <span class="num">${idx + 1}</span>
            <div>
              <p class="desc">${item.descripcion}</p>
              <p class="meta">
                ${item.ancho_cm && item.alto_cm ? `${item.ancho_cm} × ${item.alto_cm} cm` : 'Sin medidas'}
                · Cantidad: ${item.cantidad}
                ${color ? ` · Perfil: ${color}` : ''}
              </p>
              ${item.notas ? `<p class="notas">${item.notas.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</p>` : ''}
            </div>
          </div>
          ${cortesHtml}
          ${materialesHtml}
          ${sinInfo}
        </div>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Ficha de Producción — ${orden.numero}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111;padding:1.5cm}
    h1{font-size:20px;font-weight:700;margin-bottom:2px}
    .sub{color:#666;font-size:12px;margin-bottom:20px}
    .head-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-bottom:20px}
    .kv{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f3f4f6}
    .kv strong{font-weight:600}
    .item{border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:16px;page-break-inside:avoid}
    .item-head{display:flex;gap:12px;margin-bottom:8px}
    .num{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#111;color:#fff;font-weight:700;font-size:13px;flex-shrink:0}
    .desc{font-weight:700;font-size:14px}
    .meta{color:#555;font-size:12px;margin-top:2px}
    .notas{color:#374151;font-size:12px;margin-top:4px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:6px 8px}
    h3{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:.05em;margin:10px 0 6px}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;padding:4px;font-size:10px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb}
    td{padding:4px;border-bottom:1px solid #f3f4f6}
    .right{text-align:right}
    .badge{display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:600}
    .badge.corrediza{background:#dbeafe;color:#1e40af}
    .badge.fija{background:#f3f4f6;color:#374151}
    .warn{color:#92400e;background:#fef3c7;border:1px solid #fde68a;border-radius:4px;padding:6px 8px;font-size:12px;margin-top:8px}
    @media print{body{padding:1cm}}
  </style>
</head>
<body>
  <h1>Ficha de Producción — ${orden.numero}</h1>
  <div class="sub">Generada el ${fecha} · VidrioSystem</div>
  <div class="head-grid">
    <div class="kv"><span>Cliente</span><strong>${cli ? `${cli.nombre} ${cli.apellido}` : '—'}</strong></div>
    <div class="kv"><span>Teléfono</span><strong>${cli?.telefono ?? '—'}</strong></div>
    <div class="kv"><span>Estado</span><strong>${estadoConfig[orden.estado].label}</strong></div>
    <div class="kv"><span>Entrega estimada</span><strong>${orden.fecha_entrega_estimada ? formatFecha(orden.fecha_entrega_estimada) : '—'}</strong></div>
  </div>
  ${itemsHtml}
</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  if (isLoading) return <LoadingSpinner className="py-20" />
  if (!orden) return <p className="text-center text-muted-foreground">Orden no encontrada</p>

  const cliente = orden.cliente as { nombre: string; apellido: string; telefono?: string; email?: string } | undefined
  const cfg = estadoConfig[orden.estado]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/ordenes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{orden.numero}</h2>
          <p className="text-sm text-muted-foreground">Creada el {formatFecha(orden.created_at)}</p>
        </div>
        {itemsCotizacion && itemsCotizacion.length > 0 && (
          <Button variant="outline" size="sm" onClick={imprimirFichaProduccion}>
            <Printer className="mr-2 h-4 w-4" />
            Ficha de producción
          </Button>
        )}
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Cliente</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{cliente ? `${cliente.nombre} ${cliente.apellido}` : '—'}</p>
            {cliente?.telefono && <p>{cliente.telefono}</p>}
            {cliente?.email && <p className="text-muted-foreground">{cliente.email}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Fechas</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Inicio:</span><span>{orden.fecha_inicio ? formatFecha(orden.fecha_inicio) : 'Pendiente'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Entrega estimada:</span><span>{orden.fecha_entrega_estimada ? formatFecha(orden.fecha_entrega_estimada) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Entrega real:</span><span>{orden.fecha_entrega_real ? formatFecha(orden.fecha_entrega_real) : '—'}</span></div>
          </CardContent>
        </Card>
      </div>

      {itemsCotizacion && itemsCotizacion.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold">Items a producir</h3>
          {itemsCotizacion.map((item, idx) => {
            const { cortes, materiales } = detalleProduccion(item)
            const color = nombreColorPerfil(item.color_perfil)
            return (
              <Card key={item.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {idx + 1}
                    </span>
                    <div className="flex-1 space-y-1">
                      <CardTitle className="text-sm leading-snug">{item.descripcion}</CardTitle>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{item.ancho_cm && item.alto_cm ? `${item.ancho_cm} × ${item.alto_cm} cm` : 'Sin medidas'}</span>
                        <span>Cantidad: <span className="font-mono font-semibold text-foreground">{item.cantidad}</span></span>
                        {color && (
                          <span className="flex items-center gap-1.5">
                            {item.color_perfil && (
                              <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: item.color_perfil }} />
                            )}
                            Perfil: {color}
                          </span>
                        )}
                        {item.referencia && <Badge variant="outline" className="text-xs">{item.referencia.nombre}</Badge>}
                      </div>
                      {item.notas && (
                        <p className="rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">{item.notas}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cortes.length === 0 && materiales.length === 0 ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Este ítem no tiene referencia ni plantilla guardada — verificar medidas de corte manualmente.
                    </p>
                  ) : (
                    <>
                      {cortes.length > 0 && (
                        <div>
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <Scissors className="h-3.5 w-3.5" />
                            Medidas de corte
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {cortes.map((c) => (
                              <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-medium">{c.nombre_pieza}</p>
                                    {item.referencia?.es_corrediza && (
                                      <Badge variant={c.es_corredizo ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                        {c.es_corredizo ? 'Corrediza' : 'Fija'}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {c.cantidad_piezas} {c.cantidad_piezas === 1 ? 'pieza' : 'piezas'}
                                    {item.cantidad > 1 && ` × ${item.cantidad} und = ${c.cantidad_piezas * item.cantidad}`}
                                  </p>
                                </div>
                                <span className="font-mono font-semibold">{c.valor_cm.toFixed(1)} cm</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {materiales.length > 0 && (
                        <div>
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <Calculator className="h-3.5 w-3.5" />
                            Materiales (total × {item.cantidad} {item.cantidad === 1 ? 'unidad' : 'unidades'})
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {materiales.map((m) => (
                              <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                                <p className="font-medium">{m.item?.nombre ?? '—'}</p>
                                <span className="font-mono text-muted-foreground">
                                  {m.cantidad_calculada.toFixed(2)} {m.item?.unidad_medida?.simbolo ?? ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {orden.notas && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notas</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{orden.notas}</p></CardContent>
        </Card>
      )}

      <Separator />

      <div className="flex flex-wrap gap-3">
        {orden.estado === 'pendiente' && (
          <Button onClick={() => cambiarEstado.mutate('en_produccion')} disabled={cambiarEstado.isPending}>
            {cambiarEstado.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Iniciar producción
          </Button>
        )}
        {orden.estado === 'en_produccion' && (
          <Button onClick={() => cambiarEstado.mutate('lista')} disabled={cambiarEstado.isPending}>
            {cambiarEstado.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />}
            Marcar como lista
          </Button>
        )}
        {orden.estado === 'lista' && (
          <Button onClick={() => cambiarEstado.mutate('entregada')} disabled={cambiarEstado.isPending}>
            {cambiarEstado.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
            Marcar como entregada
          </Button>
        )}
      </div>
    </div>
  )
}
