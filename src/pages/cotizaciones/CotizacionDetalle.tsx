import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useCotizacion, useCambiarEstadoCotizacion } from '@/hooks/useCotizaciones'
import { useToast } from '@/hooks/useToast'
import { formatCOP, formatFecha } from '@/lib/utils'
import type { Cotizacion } from '@/types/database'

const estadoConfig: Record<Cotizacion['estado'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'warning' | 'success' | 'outline' }> = {
  borrador: { label: 'Borrador', variant: 'secondary' },
  enviada: { label: 'Enviada', variant: 'default' },
  aprobada: { label: 'Aprobada', variant: 'success' },
  rechazada: { label: 'Rechazada', variant: 'destructive' },
  vencida: { label: 'Vencida', variant: 'warning' },
}

export function CotizacionDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data: cotizacion, isLoading } = useCotizacion(id ?? '')
  const cambiarEstado = useCambiarEstadoCotizacion()

  const handleEstado = async (estado: Cotizacion['estado']) => {
    if (!id) return
    try {
      await cambiarEstado.mutateAsync({ id, estado })
      toast({
        title: estado === 'aprobada' ? 'Cotización aprobada y orden creada' : 'Estado actualizado',
        variant: 'success' as never,
      })
    } catch {
      toast({ title: 'Error al actualizar estado', variant: 'destructive' })
    }
  }

  if (isLoading) return <LoadingSpinner className="py-20" />
  if (!cotizacion) return <p className="text-center text-muted-foreground">Cotización no encontrada</p>

  const cliente = cotizacion.cliente as { nombre: string; apellido: string; empresa?: string; telefono?: string; email?: string } | undefined
  const cfg = estadoConfig[cotizacion.estado]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/cotizaciones')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{cotizacion.numero}</h2>
          <p className="text-sm text-muted-foreground">Emitida el {formatFecha(cotizacion.fecha_emision)}</p>
        </div>
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Cliente</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{cliente ? `${cliente.nombre} ${cliente.apellido}` : '—'}</p>
            {cliente?.empresa && <p className="text-muted-foreground">{cliente.empresa}</p>}
            {cliente?.telefono && <p>{cliente.telefono}</p>}
            {cliente?.email && <p className="text-muted-foreground">{cliente.email}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Detalles</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Emisión:</span><span>{formatFecha(cotizacion.fecha_emision)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Vencimiento:</span><span>{cotizacion.fecha_vencimiento ? formatFecha(cotizacion.fecha_vencimiento) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">IVA:</span><span>{cotizacion.iva_pct}%</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Items</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase text-muted-foreground">
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3 text-right">Cant.</th>
                <th className="px-4 py-3 text-right">Precio unit.</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {cotizacion.items?.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="px-4 py-3">
                    <p>{item.descripcion}</p>
                    {item.ancho_cm && item.alto_cm && <p className="text-xs text-muted-foreground">{item.ancho_cm}×{item.alto_cm}cm</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{item.cantidad}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCOP(item.precio_unitario)}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium">{formatCOP(item.precio_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-2 p-4">
            <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-mono">{formatCOP(cotizacion.subtotal)}</span></div>
            {cotizacion.descuento_pct > 0 && <div className="flex justify-between text-sm text-muted-foreground"><span>Descuento ({cotizacion.descuento_pct}%)</span><span className="font-mono">-{formatCOP(cotizacion.subtotal * cotizacion.descuento_pct / 100)}</span></div>}
            <div className="flex justify-between text-sm"><span>IVA ({cotizacion.iva_pct}%)</span><span className="font-mono">{formatCOP(cotizacion.total - cotizacion.subtotal * (1 - cotizacion.descuento_pct / 100))}</span></div>
            <Separator />
            <div className="flex justify-between font-bold text-lg"><span>Total</span><span className="font-mono text-primary">{formatCOP(cotizacion.total)}</span></div>
          </div>
        </CardContent>
      </Card>

      {cotizacion.notas && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notas</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{cotizacion.notas}</p></CardContent>
        </Card>
      )}

      {(cotizacion.estado === 'borrador' || cotizacion.estado === 'enviada') && (
        <div className="flex gap-3">
          <Button
            className="flex-1"
            onClick={() => handleEstado('aprobada')}
            disabled={cambiarEstado.isPending}
          >
            {cambiarEstado.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
            Aprobar y crear orden
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleEstado('rechazada')}
            disabled={cambiarEstado.isPending}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Rechazar
          </Button>
        </div>
      )}
    </div>
  )
}
