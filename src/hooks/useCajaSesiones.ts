import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CashRegisterSession, Usuario } from '@/types/database'

export type SesionCajaHistorial = CashRegisterSession & {
  abierta_por: Pick<Usuario, 'nombre' | 'apellido'> | null
  cerrada_por: Pick<Usuario, 'nombre' | 'apellido'> | null
}

export function useCajaActual() {
  return useQuery({
    queryKey: ['caja-actual'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_register_sessions')
        .select('*')
        .eq('status', 'open')
        .maybeSingle()
      if (error) throw error
      return data as CashRegisterSession | null
    },
  })
}

export function useAbrirCaja() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ opening_amount, opened_by }: { opening_amount: number; opened_by: string }) => {
      const { data, error } = await supabase
        .from('cash_register_sessions')
        .insert({ opening_amount, opened_by, status: 'open' })
        .select()
        .single()
      if (error) {
        if (error.code === '23505') throw new Error('Ya hay una caja abierta')
        throw error
      }
      return data as CashRegisterSession
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caja-actual'] }),
  })
}

export function useCerrarCaja() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, counted_amount, closed_by }: { sessionId: string; counted_amount: number; closed_by: string }) => {
      const { data: session, error: sessionError } = await supabase
        .from('cash_register_sessions')
        .select('opening_amount')
        .eq('id', sessionId)
        .single()
      if (sessionError) throw sessionError

      const { data: ventasEfectivo, error: ventasError } = await supabase
        .from('ventas')
        .select('monto')
        .eq('session_id', sessionId)
        .eq('metodo_pago', 'efectivo')
      if (ventasError) throw ventasError

      const totalEfectivo = (ventasEfectivo ?? []).reduce((acc, v) => acc + v.monto, 0)
      const expected_amount = session.opening_amount + totalEfectivo
      const difference = counted_amount - expected_amount

      const { error } = await supabase
        .from('cash_register_sessions')
        .update({
          closed_at: new Date().toISOString(),
          closed_by,
          expected_amount,
          counted_amount,
          difference,
          status: 'closed',
        })
        .eq('id', sessionId)
      if (error) throw error

      return { expected_amount, counted_amount, difference }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caja-actual'] })
      qc.invalidateQueries({ queryKey: ['historial-caja'] })
    },
  })
}

export function useHistorialCaja() {
  return useQuery({
    queryKey: ['historial-caja'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_register_sessions')
        .select(`
          *,
          abierta_por:usuarios!cash_register_sessions_opened_by_fkey(nombre, apellido),
          cerrada_por:usuarios!cash_register_sessions_closed_by_fkey(nombre, apellido)
        `)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
      if (error) throw error
      return data as SesionCajaHistorial[]
    },
  })
}
