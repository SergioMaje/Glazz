import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Cotizacion, Venta } from '@/types/database'

export type VentaConCotizacion = Venta & {
  cotizacion: { numero: string; cliente: { nombre: string; apellido: string } | null } | null
}

export function useVentasSesion(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['ventas-sesion', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ventas')
        .select('*, cotizacion:cotizaciones(numero, cliente:clientes(nombre, apellido))')
        .eq('session_id', sessionId as string)
        .order('created_at')
      if (error) throw error
      return data as VentaConCotizacion[]
    },
    enabled: !!sessionId,
  })
}

export function useCotizacionesVendibles() {
  return useQuery({
    queryKey: ['cotizaciones-vendibles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotizaciones')
        .select('*, cliente:clientes(*)')
        .eq('estado', 'aprobada')
        .order('fecha_emision')
      if (error) throw error
      return data as Cotizacion[]
    },
  })
}

export function useVenderCotizacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cotizacion,
      sessionId,
      metodoPago,
      usuarioId,
    }: {
      cotizacion: Cotizacion
      sessionId: string | undefined
      metodoPago: Venta['metodo_pago']
      usuarioId: string
    }) => {
      if (!sessionId) throw new Error('Debes abrir caja antes de vender')

      const { error: ventaError } = await supabase.from('ventas').insert({
        cotizacion_id: cotizacion.id,
        session_id: sessionId,
        metodo_pago: metodoPago,
        monto: cotizacion.total,
        usuario_id: usuarioId,
      })
      if (ventaError) throw ventaError

      const { error: cotizacionError } = await supabase
        .from('cotizaciones')
        .update({ estado: 'vendida' })
        .eq('id', cotizacion.id)
      if (cotizacionError) throw cotizacionError
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caja-actual'] })
      qc.invalidateQueries({ queryKey: ['cotizaciones-vendibles'] })
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
    },
  })
}
