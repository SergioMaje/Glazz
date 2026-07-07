import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PlantillaProducto, TipoProducto } from '@/types/database'

export function usePlantillas() {
  return useQuery({
    queryKey: ['plantillas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plantillas_producto')
        .select('*, tipo_producto:tipos_producto(*), componentes:plantilla_componentes(*, item:items_inventario(*))')
        .eq('activa', true)
        .order('nombre')
      if (error) throw error
      return data as PlantillaProducto[]
    },
  })
}

export function useTiposProducto() {
  return useQuery({
    queryKey: ['tipos_producto'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tipos_producto')
        .select('*')
        .eq('activo', true)
      if (error) throw error
      return data as TipoProducto[]
    },
  })
}

export function useCalcularMateriales(plantillaId: string | null, anchoCm: number, altoCm: number) {
  return useQuery({
    queryKey: ['calcular_materiales', plantillaId, anchoCm, altoCm],
    queryFn: async () => {
      if (!plantillaId || !anchoCm || !altoCm) return []
      const { data, error } = await supabase
        .from('plantilla_componentes')
        .select('*, item:items_inventario(*, unidad_medida:unidades_medida(*))')
        .eq('plantilla_id', plantillaId)
      if (error) throw error

      const anchoM = anchoCm / 100
      const altoM = altoCm / 100
      const area = anchoM * altoM
      const perimetro = 2 * (anchoM + altoM)

      return data.map((comp) => {
        let cantidad = 0
        switch (comp.formula) {
          case 'area': cantidad = area; break
          case 'perimetro': cantidad = perimetro; break
          case 'ancho': cantidad = anchoM; break
          case 'alto': cantidad = altoM; break
          case 'fijo': cantidad = comp.cantidad_fija ?? 1; break
        }
        const factor = 1 + (comp.desperdicio_pct / 100)
        return { ...comp, cantidad_calculada: cantidad * factor }
      })
    },
    enabled: !!plantillaId && anchoCm > 0 && altoCm > 0,
  })
}

type PlantillaInput = {
  nombre: string
  descripcion?: string
  tipo_producto_id: string
  requiere_medidas: boolean
  componentes: {
    item_id: string
    formula: 'area' | 'perimetro' | 'ancho' | 'alto' | 'fijo'
    cantidad_fija?: number | null
    desperdicio_pct: number
    obligatorio: boolean
  }[]
}

export function useEliminarPlantilla() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plantillas_producto').update({ activa: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plantillas'] }),
  })
}

export function useEditarPlantilla() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PlantillaInput }) => {
      const { error } = await supabase
        .from('plantillas_producto')
        .update({
          nombre: input.nombre,
          descripcion: input.descripcion ?? null,
          tipo_producto_id: input.tipo_producto_id,
          requiere_medidas: input.requiere_medidas,
        })
        .eq('id', id)
      if (error) throw error

      await supabase.from('plantilla_componentes').delete().eq('plantilla_id', id)

      if (input.componentes.length > 0) {
        const { error: compError } = await supabase.from('plantilla_componentes').insert(
          input.componentes.map((c) => ({ ...c, plantilla_id: id }))
        )
        if (compError) throw compError
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plantillas'] }),
  })
}

export function useCrearPlantilla() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: PlantillaInput) => {
      const { data: plantilla, error } = await supabase
        .from('plantillas_producto')
        .insert({
          nombre: input.nombre,
          descripcion: input.descripcion ?? null,
          tipo_producto_id: input.tipo_producto_id,
          requiere_medidas: input.requiere_medidas,
          activa: true,
        })
        .select()
        .single()
      if (error) throw error

      if (input.componentes.length > 0) {
        const { error: compError } = await supabase.from('plantilla_componentes').insert(
          input.componentes.map((c) => ({ ...c, plantilla_id: plantilla.id }))
        )
        if (compError) throw compError
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plantillas'] }),
  })
}
