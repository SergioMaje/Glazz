import { useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useCrearPlantilla, useEditarPlantilla, useTiposProducto } from '@/hooks/useProductos'
import { useItems } from '@/hooks/useInventario'
import { useToast } from '@/hooks/useToast'
import type { PlantillaProducto } from '@/types/database'

const componenteSchema = z.object({
  item_id: z.string().min(1, 'Selecciona un material'),
  formula: z.enum(['area', 'perimetro', 'ancho', 'alto', 'fijo']),
  cantidad_fija: z.coerce.number().min(0).optional(),
  desperdicio_pct: z.coerce.number().min(0).max(100),
  obligatorio: z.boolean(),
})

const schema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  tipo_producto_id: z.string().min(1, 'Selecciona un tipo'),
  requiere_medidas: z.boolean(),
  componentes: z.array(componenteSchema).min(1, 'Agrega al menos un material'),
})

type FormData = z.infer<typeof schema>

const FORMULAS: { value: string; label: string }[] = [
  { value: 'area', label: 'Área (m²)' },
  { value: 'perimetro', label: 'Perímetro (ml)' },
  { value: 'ancho', label: 'Ancho (m)' },
  { value: 'alto', label: 'Alto (m)' },
  { value: 'fijo', label: 'Cantidad fija' },
]

interface PlantillaFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plantilla?: PlantillaProducto | null
}

export function PlantillaFormDialog({ open, onOpenChange, plantilla }: PlantillaFormDialogProps) {
  const crearPlantilla = useCrearPlantilla()
  const editarPlantilla = useEditarPlantilla()
  const { data: tipos } = useTiposProducto()
  const { data: items } = useItems()
  const { toast } = useToast()

  const { register, control, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      tipo_producto_id: '',
      requiere_medidas: true,
      componentes: [{ item_id: '', formula: 'area', cantidad_fija: 1, desperdicio_pct: 10, obligatorio: true }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'componentes' })
  const watchedComponentes = watch('componentes')

  useEffect(() => {
    if (!open) return
    if (plantilla) {
      reset({
        nombre: plantilla.nombre,
        descripcion: plantilla.descripcion ?? '',
        tipo_producto_id: plantilla.tipo_producto_id,
        requiere_medidas: plantilla.requiere_medidas,
        componentes: plantilla.componentes?.map((c) => ({
          item_id: c.item_id,
          formula: c.formula,
          cantidad_fija: c.cantidad_fija ?? 1,
          desperdicio_pct: c.desperdicio_pct,
          obligatorio: c.obligatorio,
        })) ?? [],
      })
    } else {
      reset({
        nombre: '',
        descripcion: '',
        tipo_producto_id: '',
        requiere_medidas: true,
        componentes: [{ item_id: '', formula: 'area', cantidad_fija: 1, desperdicio_pct: 10, obligatorio: true }],
      })
    }
  }, [open, plantilla, reset])

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        ...data,
        descripcion: data.descripcion || undefined,
        componentes: data.componentes.map((c) => ({
          ...c,
          cantidad_fija: c.formula === 'fijo' ? (c.cantidad_fija ?? 1) : null,
        })),
      }
      if (plantilla) {
        await editarPlantilla.mutateAsync({ id: plantilla.id, input: payload })
        toast({ title: 'Plantilla actualizada', variant: 'success' as never })
      } else {
        await crearPlantilla.mutateAsync(payload)
        toast({ title: 'Plantilla creada', variant: 'success' as never })
      }
      onOpenChange(false)
    } catch {
      toast({ title: 'Error al guardar la plantilla', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plantilla ? 'Editar plantilla' : 'Nueva plantilla de producto'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Info básica */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Nombre de la plantilla</Label>
              <Input placeholder="Ventana corrediza 2 hojas" {...register('nombre')} />
              {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Tipo de producto</Label>
              <Controller
                control={control}
                name="tipo_producto_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tipos?.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="capitalize">{t.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.tipo_producto_id && <p className="text-xs text-destructive">{errors.tipo_producto_id.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Descripción (opcional)</Label>
              <Input placeholder="Descripción breve..." {...register('descripcion')} />
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="requiere_medidas" {...register('requiere_medidas')} className="h-4 w-4" />
              <Label htmlFor="requiere_medidas" className="cursor-pointer font-normal">
                Requiere ingresar medidas (ancho × alto)
              </Label>
            </div>
          </div>

          <Separator />

          {/* Componentes / BOM */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Materiales (BOM)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ item_id: '', formula: 'area', cantidad_fija: 1, desperdicio_pct: 10, obligatorio: true })}
              >
                <Plus className="mr-1 h-3 w-3" />
                Agregar material
              </Button>
            </div>

            {errors.componentes?.root && (
              <p className="text-xs text-destructive">{errors.componentes.root.message}</p>
            )}

            <div className="space-y-3">
              {fields.map((field, index) => {
                const formula = watchedComponentes[index]?.formula
                return (
                  <div key={field.id} className="rounded-lg border p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Material</Label>
                        <Controller
                          control={control}
                          name={`componentes.${index}.item_id`}
                          render={({ field: f }) => (
                            <Select value={f.value} onValueChange={f.onChange}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Selecciona material..." />
                              </SelectTrigger>
                              <SelectContent>
                                {items?.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.nombre} ({item.unidad_medida?.simbolo})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {errors.componentes?.[index]?.item_id && (
                          <p className="text-xs text-destructive">{errors.componentes[index]?.item_id?.message}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Fórmula de cálculo</Label>
                        <Controller
                          control={control}
                          name={`componentes.${index}.formula`}
                          render={({ field: f }) => (
                            <Select value={f.value} onValueChange={f.onChange}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FORMULAS.map(({ value, label }) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      {formula === 'fijo' ? (
                        <div className="space-y-1">
                          <Label className="text-xs">Cantidad fija</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-8 text-sm"
                            {...register(`componentes.${index}.cantidad_fija`)}
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-xs">Desperdicio %</Label>
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            className="h-8 text-sm"
                            {...register(`componentes.${index}.desperdicio_pct`)}
                          />
                        </div>
                      )}

                      {formula === 'fijo' && (
                        <div className="space-y-1">
                          <Label className="text-xs">Desperdicio %</Label>
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            className="h-8 text-sm"
                            {...register(`componentes.${index}.desperdicio_pct`)}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <input type="checkbox" {...register(`componentes.${index}.obligatorio`)} className="h-3 w-3" />
                        Obligatorio
                      </label>
                      {fields.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive" onClick={() => remove(index)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {plantilla ? 'Guardar cambios' : 'Crear plantilla'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
