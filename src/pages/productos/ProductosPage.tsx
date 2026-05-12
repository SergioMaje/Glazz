import { useState } from 'react'
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ConfiguradorProducto } from './ConfiguradorProducto'
import { PlantillaFormDialog } from './PlantillaFormDialog'
import { usePlantillas, useEliminarPlantilla } from '@/hooks/useProductos'
import { useToast } from '@/hooks/useToast'
import type { PlantillaProducto } from '@/types/database'

export function ProductosPage() {
  const [editPlantilla, setEditPlantilla] = useState<PlantillaProducto | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState<PlantillaProducto | null>(null)

  const { data: plantillas, isLoading } = usePlantillas()
  const eliminarPlantilla = useEliminarPlantilla()
  const { toast } = useToast()

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

  return (
    <div className="space-y-4">
      <Tabs defaultValue="configurador">
        <TabsList>
          <TabsTrigger value="configurador">Configurador</TabsTrigger>
          <TabsTrigger value="plantillas">Plantillas BOM</TabsTrigger>
        </TabsList>

        <TabsContent value="configurador" className="mt-4">
          <ConfiguradorProducto />
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
    </div>
  )
}
