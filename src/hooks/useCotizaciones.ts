import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Cotizacion, CotizacionItem } from '@/types/database'

export function useCotizaciones() {
  return useQuery({
    queryKey: ['cotizaciones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotizaciones')
        .select('*, cliente:clientes(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Cotizacion[]
    },
  })
}

export function useCotizacion(id: string) {
  return useQuery({
    queryKey: ['cotizacion', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotizaciones')
        .select('*, cliente:clientes(*), items:cotizacion_items(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Cotizacion & { items: CotizacionItem[] }
    },
    enabled: !!id,
  })
}

type CotizacionInput = {
  cliente_id: string
  usuario_id: string
  fecha_vencimiento?: string
  descuento_pct: number
  iva_pct: number
  notas?: string
  items: Omit<CotizacionItem, 'id' | 'cotizacion_id'>[]
}

export function useCrearCotizacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CotizacionInput) => {
      const subtotal = input.items.reduce((s, i) => s + i.precio_total, 0)
      const descuento = subtotal * (input.descuento_pct / 100)
      const base = subtotal - descuento
      const iva = base * (input.iva_pct / 100)
      const total = base + iva

      const numero = `COT-${Date.now()}`

      const { data: cot, error } = await supabase
        .from('cotizaciones')
        .insert({
          numero,
          cliente_id: input.cliente_id,
          usuario_id: input.usuario_id,
          estado: 'borrador',
          fecha_emision: new Date().toISOString().split('T')[0],
          fecha_vencimiento: input.fecha_vencimiento ?? null,
          subtotal,
          descuento_pct: input.descuento_pct,
          iva_pct: input.iva_pct,
          total,
          notas: input.notas ?? null,
        })
        .select()
        .single()
      if (error) throw error

      if (input.items.length > 0) {
        const { error: itemsError } = await supabase.from('cotizacion_items').insert(
          input.items.map((item) => ({ ...item, cotizacion_id: cot.id }))
        )
        if (itemsError) throw itemsError
      }
      return cot
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cotizaciones'] }),
  })
}

export function useCambiarEstadoCotizacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: Cotizacion['estado'] }) => {
      const { error } = await supabase.from('cotizaciones').update({ estado }).eq('id', id)
      if (error) throw error

      if (estado === 'aprobada') {
        const { data: cot } = await supabase.from('cotizaciones').select('cliente_id').eq('id', id).single()
        if (cot) {
          const numero = `OT-${Date.now()}`
          await supabase.from('ordenes_trabajo').insert({
            numero,
            cotizacion_id: id,
            cliente_id: cot.cliente_id,
            estado: 'pendiente',
          })
        }
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
      qc.invalidateQueries({ queryKey: ['cotizacion', variables.id] })
      qc.invalidateQueries({ queryKey: ['ordenes'] })
    },
  })
}
