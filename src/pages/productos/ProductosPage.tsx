import { useState } from 'react'
import { Plus, Pencil, Trash2, BookOpen, Scissors } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ConfiguradorProducto } from './ConfiguradorProducto'
import { PanelCotizacion } from './PanelCotizacion'
import { PlantillaFormDialog } from './PlantillaFormDialog'
import { ReferenciaFormDialog } from './ReferenciaFormDialog'
import { usePlantillas, useEliminarPlantilla } from '@/hooks/useProductos'
import { useReferencias, useEliminarReferencia } from '@/hooks/useReferencias'
import { useCrearCotizacion } from '@/hooks/useCotizaciones'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import type { PlantillaProducto, ReferenciaProducto } from '@/types/database'
import type { ItemCotizacion } from './PanelCotizacion'

export function ProductosPage() {
  const [editPlantilla, setEditPlantilla] = useState<PlantillaProducto | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState<PlantillaProducto | null>(null)

  const [editReferencia, setEditReferencia] = useState<ReferenciaProducto | null>(null)
  const [refFormOpen, setRefFormOpen] = useState(false)
  const [confirmarEliminarRef, setConfirmarEliminarRef] = useState<ReferenciaProducto | null>(null)

  // Estado del carrito de cotización
  const [clienteId, setClienteId] = useState('')
  const [itemsCotizacion, setItemsCotizacion] = useState<ItemCotizacion[]>([])
  const [descuentoPct, setDescuentoPct] = useState(0)
  const [ivaPct, setIvaPct] = useState(19)

  const { data: plantillas, isLoading } = usePlantillas()
  const eliminarPlantilla = useEliminarPlantilla()
  const { data: referencias, isLoading: loadingReferencias } = useReferencias()
  const eliminarReferencia = useEliminarReferencia()
  const crearCotizacion = useCrearCotizacion()
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'
  const { toast } = useToast()

  const handleAgregarItem = (item: ItemCotizacion) => {
    setItemsCotizacion((prev) => [...prev, item])
    toast({ title: 'Producto agregado a la cotización' })
  }

  const handleUpdateItem = (idx: number, field: 'cantidad' | 'precio_unitario', value: number) => {
    setItemsCotizacion((prev) => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      updated.precio_total = updated.cantidad * updated.precio_unitario
      return updated
    }))
  }

  const handleRemoveItem = (idx: number) => {
    setItemsCotizacion((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleGuardar = async (estado: 'borrador' | 'enviada') => {
    if (!clienteId || !usuario) {
      toast({ title: 'Selecciona un cliente', variant: 'destructive' })
      return
    }
    if (itemsCotizacion.length === 0) {
      toast({ title: 'Agrega al menos un producto', variant: 'destructive' })
      return
    }
    try {
      await crearCotizacion.mutateAsync({
        cliente_id: clienteId,
        usuario_id: usuario.id,
        descuento_pct: descuentoPct,
        iva_pct: ivaPct,
        items: itemsCotizacion,
      })
      toast({ title: estado === 'borrador' ? 'Borrador guardado' : 'Cotización enviada' })
      setClienteId('')
      setItemsCotizacion([])
      setDescuentoPct(0)
      setIvaPct(19)
    } catch {
      toast({ title: 'Error al guardar cotización', variant: 'destructive' })
    }
  }

  const handleEliminar = async () => {
    if (!confirmarEliminar) return
    try {
      await eliminarPlantilla.mutateAsync(confirmarEliminar.id)
      toast({ title: 'Plantilla eliminada' })
    } catch {
      toast({ title: 'Error al eliminar', variant: 'destructive' })
    }
    setConfirmarEliminar(null)
  }

  const handleEliminarReferencia = async () => {
    if (!confirmarEliminarRef) return
    try {
      await eliminarReferencia.mutateAsync(confirmarEliminarRef.id)
      toast({ title: 'Referencia eliminada' })
    } catch {
      toast({ title: 'Error al eliminar', variant: 'destructive' })
    }
    setConfirmarEliminarRef(null)
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="configurador">
        <TabsList>
          <TabsTrigger value="configurador">Configurador</TabsTrigger>
          <TabsTrigger value="plantillas">Plantillas BOM</TabsTrigger>
          {esAdmin && (
            <TabsTrigger value="referencias">Referencias</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="configurador" className="mt-4">
          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <ConfiguradorProducto onAgregarItem={handleAgregarItem} />
            <PanelCotizacion
              clienteId={clienteId}
              onClienteChange={setClienteId}
              items={itemsCotizacion}
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
        </TabsContent>

        <TabsContent value="plantillas" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Define qué materiales y fórmulas usa cada tipo de producto
              </p>
            </div>
            <Button onClick={() => { setEditPlantilla(null); setFormOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva plantilla
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <LoadingSpinner className="py-12" />
              ) : !plantillas || plantillas.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="No hay plantillas"
                  description="Crea una plantilla para empezar a configurar productos"
                />
              ) : (
                <div className="divide-y">
                  {plantillas.map((plantilla) => (
                    <div key={plantilla.id} className="flex items-start justify-between px-4 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{plantilla.nombre}</p>
                          <Badge variant="secondary" className="capitalize text-xs">
                            {plantilla.tipo_producto?.nombre}
                          </Badge>
                          {plantilla.requiere_medidas && (
                            <Badge variant="outline" className="text-xs">Con medidas</Badge>
                          )}
                        </div>
                        {plantilla.descripcion && (
                          <p className="text-xs text-muted-foreground">{plantilla.descripcion}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {plantilla.componentes?.map((c) => (
                            <span key={c.id} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {c.item?.nombre ?? 'Material'} · {c.formula}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-4 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditPlantilla(plantilla); setFormOpen(true) }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setConfirmarEliminar(plantilla)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {esAdmin && (
          <TabsContent value="referencias" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Presets de corte para los productos más vendidos. Solo visible para administradores.
                </p>
              </div>
              <Button onClick={() => { setEditReferencia(null); setRefFormOpen(true) }}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva referencia
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {loadingReferencias ? (
                  <LoadingSpinner className="py-12" />
                ) : !referencias || referencias.length === 0 ? (
                  <EmptyState
                    icon={Scissors}
                    title="No hay referencias"
                    description="Crea una referencia para definir las medidas de corte de tus productos más vendidos"
                  />
                ) : (
                  <div className="divide-y">
                    {referencias.map((ref) => (
                      <div key={ref.id} className="flex items-start justify-between px-4 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{ref.nombre}</p>
                            <Badge variant="secondary" className="capitalize text-xs">
                              {ref.tipo_producto?.nombre}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {ref.plantilla?.nombre}
                            </Badge>
                          </div>
                          {ref.descripcion && (
                            <p className="text-xs text-muted-foreground">{ref.descripcion}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {ref.cortes?.length ?? 0} {(ref.cortes?.length ?? 0) === 1 ? 'corte' : 'cortes'} configurados
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-4 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditReferencia(ref); setRefFormOpen(true) }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setConfirmarEliminarRef(ref)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <PlantillaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        plantilla={editPlantilla}
      />

      <ConfirmDialog
        open={!!confirmarEliminar}
        onOpenChange={(open) => { if (!open) setConfirmarEliminar(null) }}
        title="Eliminar plantilla"
        description={`¿Eliminar "${confirmarEliminar?.nombre}"? Los productos configurados con esta plantilla perderán su receta de materiales.`}
        onConfirm={handleEliminar}
        loading={eliminarPlantilla.isPending}
      />

      <ReferenciaFormDialog
        open={refFormOpen}
        onOpenChange={setRefFormOpen}
        referencia={editReferencia}
      />

      <ConfirmDialog
        open={!!confirmarEliminarRef}
        onOpenChange={(open) => { if (!open) setConfirmarEliminarRef(null) }}
        title="Eliminar referencia"
        description={`¿Eliminar "${confirmarEliminarRef?.nombre}"? Los configuradores que usen esta referencia perderán las medidas de corte.`}
        onConfirm={handleEliminarReferencia}
        loading={eliminarReferencia.isPending}
      />
    </div>
  )
}
