import { useState } from 'react'
import { Loader2, Lock, DollarSign, ShoppingCart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { useCajaActual, useAbrirCaja, useCerrarCaja } from '@/hooks/useCajaSesiones'
import { useCotizacionesVendibles, useVenderCotizacion, useVentasSesion } from '@/hooks/useVentasCaja'
import { formatCOP } from '@/lib/utils'
import type { Cotizacion, Venta } from '@/types/database'

const METODO_LABEL: Record<Venta['metodo_pago'], string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
}

export function ResumenVentasSesion({ sessionId, openingAmount }: { sessionId: string; openingAmount: number }) {
  const { data: ventas, isLoading } = useVentasSesion(sessionId)

  if (isLoading) return <LoadingSpinner className="py-8" />

  const totales = { efectivo: 0, tarjeta: 0, transferencia: 0 } as Record<Venta['metodo_pago'], number>
  for (const v of ventas ?? []) totales[v.metodo_pago] += v.monto
  const totalGeneral = totales.efectivo + totales.tarjeta + totales.transferencia
  const efectivoEsperado = openingAmount + totales.efectivo

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-sm">
        {(Object.keys(METODO_LABEL) as Venta['metodo_pago'][]).map((metodo) => (
          <div key={metodo} className="rounded-md border p-2 text-center">
            <p className="text-xs text-muted-foreground">{METODO_LABEL[metodo]}</p>
            <p className="font-mono font-semibold">{formatCOP(totales[metodo])}</p>
          </div>
        ))}
      </div>

      {!ventas || ventas.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No se registraron ventas en este turno</p>
      ) : (
        <div className="max-h-48 overflow-y-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase text-muted-foreground">
                <th className="px-3 py-2">Cotización</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Método</th>
                <th className="px-3 py-2 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{v.cotizacion?.numero ?? '—'}</td>
                  <td className="px-3 py-2">
                    {v.cotizacion?.cliente ? `${v.cotizacion.cliente.nombre} ${v.cotizacion.cliente.apellido}` : '—'}
                  </td>
                  <td className="px-3 py-2">{METODO_LABEL[v.metodo_pago]}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCOP(v.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Separator />

      <div className="space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Fondo inicial</span><span className="font-mono">{formatCOP(openingAmount)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Total ventas ({ventas?.length ?? 0})</span><span className="font-mono">{formatCOP(totalGeneral)}</span></div>
        <div className="flex justify-between font-semibold"><span>Efectivo esperado en caja</span><span className="font-mono text-primary">{formatCOP(efectivoEsperado)}</span></div>
      </div>
    </div>
  )
}

function AbrirCajaCard() {
  const { usuario } = useAuth()
  const { toast } = useToast()
  const abrirCaja = useAbrirCaja()
  const [monto, setMonto] = useState('')

  const handleAbrir = async () => {
    const opening_amount = Number(monto)
    if (!usuario || !monto || opening_amount < 0) return
    try {
      await abrirCaja.mutateAsync({ opening_amount, opened_by: usuario.id })
      toast({ title: 'Caja abierta', variant: 'success' as never })
      setMonto('')
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Error al abrir caja', variant: 'destructive' })
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4" />
          Abrir caja
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ingresa el fondo inicial en efectivo para empezar a vender.
        </p>
        <div className="space-y-1">
          <Label>Monto inicial</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
          />
        </div>
        <Button className="w-full" onClick={handleAbrir} disabled={abrirCaja.isPending || !monto}>
          {abrirCaja.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Abrir caja
        </Button>
      </CardContent>
    </Card>
  )
}

function VenderDialog({
  cotizacion,
  open,
  onOpenChange,
  sessionId,
}: {
  cotizacion: Cotizacion | null
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string | undefined
}) {
  const { usuario } = useAuth()
  const { toast } = useToast()
  const venderCotizacion = useVenderCotizacion()
  const [metodoPago, setMetodoPago] = useState<Venta['metodo_pago']>('efectivo')

  const handleVender = async () => {
    if (!cotizacion || !usuario) return
    try {
      await venderCotizacion.mutateAsync({ cotizacion, sessionId, metodoPago, usuarioId: usuario.id })
      toast({ title: 'Venta registrada', variant: 'success' as never })
      onOpenChange(false)
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Error al vender', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Vender {cotizacion?.numero}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total a cobrar</span>
            <span className="font-mono font-semibold">{cotizacion ? formatCOP(cotizacion.total) : '—'}</span>
          </div>
          <div className="space-y-1">
            <Label>Método de pago</Label>
            <Select value={metodoPago} onValueChange={(v) => setMetodoPago(v as Venta['metodo_pago'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleVender} disabled={venderCotizacion.isPending}>
            {venderCotizacion.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CerrarCajaDialog({
  sessionId,
  openingAmount,
  open,
  onOpenChange,
}: {
  sessionId: string
  openingAmount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { usuario } = useAuth()
  const { toast } = useToast()
  const cerrarCaja = useCerrarCaja()
  const [conteo, setConteo] = useState('')
  const [resultado, setResultado] = useState<{ expected_amount: number; counted_amount: number; difference: number } | null>(null)

  const handleCerrar = async () => {
    const counted_amount = Number(conteo)
    if (!usuario || !conteo || counted_amount < 0) return
    try {
      const res = await cerrarCaja.mutateAsync({ sessionId, counted_amount, closed_by: usuario.id })
      setResultado(res)
      toast({ title: 'Caja cerrada', variant: 'success' as never })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Error al cerrar caja', variant: 'destructive' })
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setConteo('')
      setResultado(null)
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cerrar caja</DialogTitle>
        </DialogHeader>
        {resultado ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Esperado</span><span className="font-mono">{formatCOP(resultado.expected_amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Contado</span><span className="font-mono">{formatCOP(resultado.counted_amount)}</span></div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Diferencia</span>
              <span className={`font-mono ${resultado.difference === 0 ? '' : resultado.difference > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                {formatCOP(resultado.difference)}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <ResumenVentasSesion sessionId={sessionId} openingAmount={openingAmount} />
            <div className="space-y-1">
              <Label>Conteo físico de efectivo</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={conteo}
                onChange={(e) => setConteo(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          {resultado ? (
            <Button onClick={() => handleClose(false)}>Listo</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={handleCerrar} disabled={cerrarCaja.isPending || !conteo}>
                {cerrarCaja.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar cierre
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CajaPage() {
  const { data: sesion, isLoading: cargandoSesion } = useCajaActual()
  const { data: cotizaciones, isLoading: cargandoCotizaciones } = useCotizacionesVendibles()
  const [cotizacionAVender, setCotizacionAVender] = useState<Cotizacion | null>(null)
  const [cerrarOpen, setCerrarOpen] = useState(false)

  if (cargandoSesion) return <LoadingSpinner className="py-20" />

  if (!sesion) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Caja</h2>
        <AbrirCajaCard />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Caja</h2>
          <p className="text-sm text-muted-foreground">Fondo inicial: {formatCOP(sesion.opening_amount)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">Abierta</Badge>
          <Button variant="outline" onClick={() => setCerrarOpen(true)}>
            <DollarSign className="mr-2 h-4 w-4" />
            Cerrar caja
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Cotizaciones para vender</CardTitle></CardHeader>
        <CardContent className="p-0">
          {cargandoCotizaciones ? (
            <LoadingSpinner className="py-12" />
          ) : !cotizaciones || cotizaciones.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No hay cotizaciones aprobadas"
              description="Aprueba una cotización para que aparezca aquí y puedas venderla"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Número</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {cotizaciones.map((cot) => {
                    const cliente = cot.cliente as { nombre: string; apellido: string } | undefined
                    return (
                      <tr key={cot.id} className="border-b">
                        <td className="px-4 py-3 font-mono text-xs font-medium">{cot.numero}</td>
                        <td className="px-4 py-3">{cliente ? `${cliente.nombre} ${cliente.apellido}` : '—'}</td>
                        <td className="px-4 py-3 text-right font-mono font-medium">{formatCOP(cot.total)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" onClick={() => setCotizacionAVender(cot)}>Vender</Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <VenderDialog
        cotizacion={cotizacionAVender}
        open={!!cotizacionAVender}
        onOpenChange={(open) => !open && setCotizacionAVender(null)}
        sessionId={sesion.id}
      />
      <CerrarCajaDialog
        sessionId={sesion.id}
        openingAmount={sesion.opening_amount}
        open={cerrarOpen}
        onOpenChange={setCerrarOpen}
      />
    </div>
  )
}
