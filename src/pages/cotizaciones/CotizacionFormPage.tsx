import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useClientes } from '@/hooks/useClientes'
import { useCrearCotizacion } from '@/hooks/useCotizaciones'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { formatCOP } from '@/lib/utils'
import type { CotizacionItem } from '@/types/database'

type ItemLine = Omit<CotizacionItem, 'id' | 'cotizacion_id'>

export function CotizacionFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { usuario } = useAuth()
  const { toast } = useToast()
  const { data: clientes } = useClientes()
  const crearCotizacion = useCrearCotizacion()

  const [clienteId, setClienteId] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [descuentoPct, setDescuentoPct] = useState(0)
  const [ivaPct, setIvaPct] = useState(19)
  const [notas, setNotas] = useState('')
  const [items, setItems] = useState<ItemLine[]>([])

  useEffect(() => {
    const tipo = searchParams.get('tipo')
    const ancho = searchParams.get('ancho')
    const alto = searchParams.get('alto')
    const precio = searchParams.get('precio')

    if (tipo && ancho && alto && precio) {
      const precioNum = Math.round(parseFloat(precio))
      setItems([{
        plantilla_id: searchParams.get('plantilla') || null,
        referencia_id: searchParams.get('referencia') || null,
        descripcion: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} ${ancho}×${alto}cm`,
        ancho_cm: parseFloat(ancho),
        alto_cm: parseFloat(alto),
        area_m2: (parseFloat(ancho) / 100) * (parseFloat(alto) / 100),
        cantidad: 1,
        precio_unitario: precioNum,
        precio_total: precioNum,
        color_perfil: null,
        notas: null,
      }])
    }
  }, [searchParams])

  const addItem = () => {
    setItems([...items, { plantilla_id: null, referencia_id: null, descripcion: '', ancho_cm: null, alto_cm: null, area_m2: null, cantidad: 1, precio_unitario: 0, precio_total: 0, color_perfil: null, notas: null }])
  }

  const updateItem = (idx: number, field: keyof ItemLine, value: unknown) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      if (field === 'cantidad' || field === 'precio_unitario') {
        updated.precio_total = (updated.cantidad ?? 0) * (updated.precio_unitario ?? 0)
      }
      return updated
    }))
  }

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx))

  const subtotal = items.reduce((s, i) => s + i.precio_total, 0)
  const descuento = subtotal * (descuentoPct / 100)
  const base = subtotal - descuento
  const iva = base * (ivaPct / 100)
  const total = base + iva

  const guardar = async (estado: 'borrador' | 'enviada') => {
    if (!clienteId || !usuario) {
      toast({ title: 'Selecciona un cliente', variant: 'destructive' })
      return
    }
    if (items.length === 0) {
      toast({ title: 'Agrega al menos un item', variant: 'destructive' })
      return
    }
    try {
      await crearCotizacion.mutateAsync({
        cliente_id: clienteId,
        usuario_id: usuario.id,
        fecha_vencimiento: fechaVencimiento || undefined,
        descuento_pct: descuentoPct,
        iva_pct: ivaPct,
        notas: notas || undefined,
        items,
      })
      toast({ title: estado === 'borrador' ? 'Borrador guardado' : 'Cotización enviada', variant: 'success' as never })
      navigate('/cotizaciones')
    } catch {
      toast({ title: 'Error al guardar cotización', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader><CardTitle>Información del cliente</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue placeholder="Selecciona un cliente..." /></SelectTrigger>
              <SelectContent>
                {clientes?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre} {c.apellido}{c.empresa ? ` — ${c.empresa}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fecha de vencimiento</Label>
            <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Items</CardTitle>
          <Button size="sm" variant="outline" onClick={addItem}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar línea
          </Button>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No hay items. Agrega una línea o usa el configurador de productos.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid gap-2 rounded-md border p-3 sm:grid-cols-6">
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">Descripción</Label>
                    <Input
                      placeholder="Ventana corrediza..."
                      value={item.descripcion}
                      onChange={(e) => updateItem(idx, 'descripcion', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cantidad</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.cantidad}
                      onChange={(e) => updateItem(idx, 'cantidad', parseFloat(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Precio unit.</Label>
                    <Input
                      type="number"
                      value={item.precio_unitario}
                      onChange={(e) => updateItem(idx, 'precio_unitario', parseFloat(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Total</Label>
                    <div className="flex h-8 items-center rounded-md border bg-muted px-3 text-sm font-mono">
                      {formatCOP(item.precio_total)}
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Notas</CardTitle></CardHeader>
          <CardContent>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              rows={4}
              placeholder="Notas adicionales para el cliente..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-mono">{formatCOP(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Descuento (%)</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={descuentoPct}
                onChange={(e) => setDescuentoPct(parseFloat(e.target.value) || 0)}
                className="h-7 w-20 text-right font-mono text-sm"
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>IVA (%)</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={ivaPct}
                onChange={(e) => setIvaPct(parseFloat(e.target.value) || 0)}
                className="h-7 w-20 text-right font-mono text-sm"
              />
            </div>
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="font-mono text-primary">{formatCOP(total)}</span>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => guardar('borrador')} disabled={crearCotizacion.isPending}>
                {crearCotizacion.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar borrador
              </Button>
              <Button className="flex-1" onClick={() => guardar('enviada')} disabled={crearCotizacion.isPending}>
                Enviar cotización
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
