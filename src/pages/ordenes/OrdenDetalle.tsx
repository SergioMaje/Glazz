import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Play, CheckSquare, Truck, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { formatFecha } from '@/lib/utils'
import type { OrdenTrabajo, CotizacionItem } from '@/types/database'

const estadoConfig: Record<OrdenTrabajo['estado'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'warning' | 'success' | 'outline' }> = {
  pendiente: { label: 'Pendiente', variant: 'secondary' },
  en_produccion: { label: 'En producción', variant: 'default' },
  lista: { label: 'Lista', variant: 'success' },
  entregada: { label: 'Entregada', variant: 'outline' },
  cancelada: { label: 'Cancelada', variant: 'destructive' },
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
      const { data } = await supabase.from('cotizacion_items').select('*').eq('cotizacion_id', orden.cotizacion_id)
      return data as CotizacionItem[]
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

        for (const cotItem of cotItems ?? []) {
          if (!cotItem.plantilla_id || !cotItem.ancho_cm || !cotItem.alto_cm) continue

          const anchoM = cotItem.ancho_cm / 100
          const altoM = cotItem.alto_cm / 100
          const area = anchoM * altoM
          const perimetro = 2 * (anchoM + altoM)

          const componentes = (cotItem.plantilla as { componentes: { item_id: string; formula: string; cantidad_fija: number | null; desperdicio_pct: number }[] } | null)?.componentes ?? []

          for (const comp of componentes) {
            let base = 0
            switch (comp.formula) {
              case 'area':      base = area;     break
              case 'perimetro': base = perimetro; break
              case 'ancho':     base = anchoM;   break
              case 'alto':      base = altoM;    break
              case 'fijo':      base = comp.cantidad_fija ?? 1; break
            }
            const cantidad = base * (1 + comp.desperdicio_pct / 100) * cotItem.cantidad
            if (cantidad <= 0) continue

            const { data: mat } = await supabase
              .from('items_inventario')
              .select('stock_actual')
              .eq('id', comp.item_id)
              .single()
            if (!mat) continue

            const anterior = mat.stock_actual
            const posterior = Math.max(0, anterior - cantidad)

            await supabase.from('movimientos_inventario').insert({
              item_id:           comp.item_id,
              tipo:              'produccion',
              cantidad,
              cantidad_anterior: anterior,
              cantidad_posterior: posterior,
              motivo:            `Orden ${orden.numero}`,
              referencia:        id,
              usuario_id:        usuario.id,
            })

            await supabase
              .from('items_inventario')
              .update({ stock_actual: posterior })
              .eq('id', comp.item_id)
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
        <Card>
          <CardHeader><CardTitle className="text-base">Items a producir</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs font-medium uppercase text-muted-foreground">
                  <th className="px-4 py-3 text-left">Descripción</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-left">Medidas</th>
                </tr>
              </thead>
              <tbody>
                {itemsCotizacion.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-3">{item.descripcion}</td>
                    <td className="px-4 py-3 text-right font-mono">{item.cantidad}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.ancho_cm && item.alto_cm ? `${item.ancho_cm}×${item.alto_cm}cm` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
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
