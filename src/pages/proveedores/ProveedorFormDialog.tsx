import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCrearProveedor, useEditarProveedor } from '@/hooks/useInventario'
import { useToast } from '@/hooks/useToast'
import type { Proveedor } from '@/types/database'

const schema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  nit: z.string().optional(),
  contacto: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
  direccion: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface ProveedorFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proveedor?: Proveedor | null
}

export function ProveedorFormDialog({ open, onOpenChange, proveedor }: ProveedorFormDialogProps) {
  const crearProveedor = useCrearProveedor()
  const editarProveedor = useEditarProveedor()
  const { toast } = useToast()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (open) {
      if (proveedor) {
        reset({
          nombre: proveedor.nombre,
          nit: proveedor.nit ?? '',
          contacto: proveedor.contacto ?? '',
          telefono: proveedor.telefono ?? '',
          email: proveedor.email ?? '',
          direccion: proveedor.direccion ?? '',
        })
      } else {
        reset({ nombre: '', nit: '', contacto: '', telefono: '', email: '', direccion: '' })
      }
    }
  }, [open, proveedor, reset])

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        nombre: data.nombre,
        nit: data.nit || null,
        contacto: data.contacto || null,
        telefono: data.telefono || null,
        email: data.email || null,
        direccion: data.direccion || null,
        activo: true,
      }
      if (proveedor) {
        await editarProveedor.mutateAsync({ id: proveedor.id, data: payload })
        toast({ title: 'Proveedor actualizado', variant: 'success' as never })
      } else {
        await crearProveedor.mutateAsync(payload)
        toast({ title: 'Proveedor creado', variant: 'success' as never })
      }
      onOpenChange(false)
    } catch {
      toast({ title: 'Error al guardar', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Nombre / Razón social</Label>
              <Input placeholder="Vidrios del Norte S.A.S." {...register('nombre')} />
              {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>NIT (opcional)</Label>
              <Input placeholder="900123456-1" {...register('nit')} />
            </div>
            <div className="space-y-1">
              <Label>Contacto (opcional)</Label>
              <Input placeholder="Nombre del contacto" {...register('contacto')} />
            </div>
            <div className="space-y-1">
              <Label>Teléfono (opcional)</Label>
              <Input placeholder="3001234567" {...register('telefono')} />
            </div>
            <div className="space-y-1">
              <Label>Correo electrónico (opcional)</Label>
              <Input type="email" placeholder="ventas@proveedor.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Dirección (opcional)</Label>
              <Input placeholder="Calle 10 # 20-30, Bogotá" {...register('direccion')} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {proveedor ? 'Guardar cambios' : 'Crear proveedor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
