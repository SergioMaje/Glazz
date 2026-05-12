import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCategorias, useUnidadesMedida, useProveedores, useCrearItem, useEditarItem } from '@/hooks/useInventario'
import { useToast } from '@/hooks/useToast'
import type { ItemInventario } from '@/types/database'

const schema = z.object({
  codigo: z.string().min(1, 'El código es requerido'),
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  categoria_id: z.string().min(1, 'Selecciona una categoría'),
  unidad_medida_id: z.string().min(1, 'Selecciona una unidad'),
  proveedor_id: z.string().optional(),
  stock_actual: z.coerce.number().min(0),
  stock_minimo: z.coerce.number().min(0),
  precio_costo: z.coerce.number().min(0),
  precio_venta: z.coerce.number().min(0),
})

type FormData = z.infer<typeof schema>

interface ItemFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: ItemInventario | null
}

export function ItemFormDialog({ open, onOpenChange, item }: ItemFormDialogProps) {
  const { data: categorias } = useCategorias()
  const { data: unidades } = useUnidadesMedida()
  const { data: proveedores } = useProveedores()
  const crearItem = useCrearItem()
  const editarItem = useEditarItem()
  const { toast } = useToast()

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (open) {
      if (item) {
        reset({
          codigo: item.codigo,
          nombre: item.nombre,
          descripcion: item.descripcion ?? '',
          categoria_id: item.categoria_id,
          unidad_medida_id: item.unidad_medida_id,
          proveedor_id: item.proveedor_id ?? '',
          stock_actual: item.stock_actual,
          stock_minimo: item.stock_minimo,
          precio_costo: item.precio_costo,
          precio_venta: item.precio_venta,
        })
      } else {
        reset({ codigo: '', nombre: '', descripcion: '', stock_actual: 0, stock_minimo: 0, precio_costo: 0, precio_venta: 0 })
      }
    }
  }, [open, item, reset])

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        ...data,
        descripcion: data.descripcion || null,
        proveedor_id: (data.proveedor_id && data.proveedor_id !== 'ninguno') ? data.proveedor_id : null,
        activo: true,
      }
      if (item) {
        await editarItem.mutateAsync({ id: item.id, data: payload })
        toast({ title: 'Item actualizado', variant: 'success' as never })
      } else {
        await crearItem.mutateAsync(payload)
        toast({ title: 'Item creado exitosamente', variant: 'success' as never })
      }
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      const esDuplicado = msg.includes('duplicate') || msg.includes('unique') || msg.includes('23505')
      toast({
        title: esDuplicado ? 'El código ya existe' : 'Error al guardar',
        description: esDuplicado ? 'Usa un código diferente, ese ya está registrado.' : msg || undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar item' : 'Nuevo item de inventario'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código</Label>
              <Input placeholder="VID-001" {...register('codigo')} />
              {errors.codigo && <p className="text-xs text-destructive">{errors.codigo.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input placeholder="Vidrio templado 6mm" {...register('nombre')} />
              {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripción (opcional)</Label>
            <Input placeholder="Descripción del producto" {...register('descripcion')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select onValueChange={(v) => setValue('categoria_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  {categorias?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoria_id && <p className="text-xs text-destructive">{errors.categoria_id.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Unidad de medida</Label>
              <Select onValueChange={(v) => setValue('unidad_medida_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  {unidades?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre} ({u.simbolo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.unidad_medida_id && <p className="text-xs text-destructive">{errors.unidad_medida_id.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Proveedor (opcional)</Label>
            <Select onValueChange={(v) => setValue('proveedor_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sin proveedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Sin proveedor</SelectItem>
                {proveedores?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Stock inicial</Label>
              <Input type="number" step="0.01" {...register('stock_actual')} />
            </div>
            <div className="space-y-2">
              <Label>Stock mínimo</Label>
              <Input type="number" step="0.01" {...register('stock_minimo')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Precio costo (COP)</Label>
              <Input type="number" step="1" {...register('precio_costo')} />
            </div>
            <div className="space-y-2">
              <Label>Precio venta (COP)</Label>
              <Input type="number" step="1" {...register('precio_venta')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {item ? 'Guardar cambios' : 'Crear item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
