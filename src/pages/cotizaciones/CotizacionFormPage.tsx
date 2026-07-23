import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfiguradorProducto } from '@/pages/productos/ConfiguradorProducto'
import { PanelCotizacion, type ItemCotizacion } from '@/pages/productos/PanelCotizacion'
import { useCrearCotizacion } from '@/hooks/useCotizaciones'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'

const vencimientoPorDefecto = () => {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + 7)
  return fecha.toISOString().split('T')[0]
}

export function CotizacionFormPage() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { toast } = useToast()
  const crearCotizacion = useCrearCotizacion()

  const [clienteId, setClienteId] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState(vencimientoPorDefecto)
  const [notas, setNotas] = useState('')
  const [items, setItems] = useState<ItemCotizacion[]>([])
  const [descuentoPct, setDescuentoPct] = useState(0)
  const [ivaPct, setIvaPct] = useState(19)

  const handleAgregarItem = (item: ItemCotizacion) => {
    setItems((prev) => [...prev, item])
    toast({ title: 'Producto agregado a la cotización' })
  }

  const handleUpdateItem = (idx: number, field: 'cantidad' | 'precio_unitario', value: number) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      updated.precio_total = updated.cantidad * updated.precio_unitario
      return updated
    }))
  }

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleGuardar = async (estado: 'borrador' | 'enviada') => {
    if (!clienteId || !usuario) {
      toast({ title: 'Selecciona un cliente', variant: 'destructive' })
      return
    }
    if (items.length === 0) {
      toast({ title: 'Agrega al menos un producto', variant: 'destructive' })
      return
    }
    if (!fechaVencimiento) {
      toast({ title: 'Indica la fecha de vencimiento de la cotización', variant: 'destructive' })
      return
    }
    try {
      await crearCotizacion.mutateAsync({
        cliente_id: clienteId,
        usuario_id: usuario.id,
        estado,
        fecha_vencimiento: fechaVencimiento,
        descuento_pct: descuentoPct,
        iva_pct: ivaPct,
        notas: notas || undefined,
        items,
      })
      toast({ title: estado === 'borrador' ? 'Borrador guardado' : 'Cotización enviada', variant: 'success' })
      navigate('/cotizaciones')
    } catch {
      toast({ title: 'Error al guardar cotización', variant: 'destructive' })
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <ConfiguradorProducto onAgregarItem={handleAgregarItem} />
      <PanelCotizacion
        clienteId={clienteId}
        onClienteChange={setClienteId}
        fechaVencimiento={fechaVencimiento}
        onFechaVencimientoChange={setFechaVencimiento}
        notas={notas}
        onNotasChange={setNotas}
        items={items}
        onUpdateItem={handleUpdateItem}
        onRemoveItem={handleRemoveItem}
        descuentoPct={descuentoPct}
        onDescuentoChange={setDescuentoPct}
        ivaPct={ivaPct}
        onIvaChange={setIvaPct}
        onGuardar={handleGuardar}
        isPending={crearCotizacion.isPending}
      />
    </div>
  )
}
