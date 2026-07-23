import type { PlantillaComponente, ReferenciaCorte } from '@/types/database'

export const COLORES_PERFIL = [
  { value: '#9CA3AF', label: 'Natural' },
  { value: '#111827', label: 'Negro' },
  { value: '#B45309', label: 'Bronce' },
  { value: '#FFFFFF', label: 'Blanco' },
]

export function nombreColorPerfil(hex: string | null): string | null {
  if (!hex) return null
  return COLORES_PERFIL.find((c) => c.value === hex)?.label ?? hex
}

export const TIPO_LABELS: Record<string, string> = {
  ventana: 'Ventana',
  puerta: 'Puerta',
  division: 'División',
  espejo: 'Espejo',
  otro: 'Otro',
}

export type CorteCalculado = ReferenciaCorte & { valor_cm: number }

export function calcularCortes(
  cortes: ReferenciaCorte[],
  anchoCm: number,
  altoCm: number
): CorteCalculado[] {
  return cortes.map((c) => {
    let valor = 0
    switch (c.formula) {
      case 'ancho':              valor = anchoCm; break
      case 'alto':               valor = altoCm; break
      case 'ancho_menos_margen': valor = anchoCm - c.margen_cm; break
      case 'alto_menos_margen':  valor = altoCm - c.margen_cm; break
      case 'mitad_ancho':        valor = anchoCm / 2; break
      case 'mitad_alto':         valor = altoCm / 2; break
      case 'fijo':               valor = c.cantidad_fija_cm ?? 0; break
    }
    return { ...c, valor_cm: Math.max(0, valor) }
  })
}

export type MaterialCalculado<T extends PlantillaComponente = PlantillaComponente> = T & {
  cantidad_calculada: number
}

/**
 * Cantidad de material que consume una medida segun su formula, incluyendo el
 * desperdicio. Lo usan tanto los componentes de la plantilla BOM como las opciones
 * adicionales elegidas al cotizar.
 */
export function cantidadPorFormula(
  formula: PlantillaComponente['formula'],
  cantidadFija: number | null,
  desperdicioPct: number,
  anchoCm: number,
  altoCm: number,
  unidades = 1
): number {
  const anchoM = anchoCm / 100
  const altoM = altoCm / 100

  let cantidad = 0
  switch (formula) {
    case 'area':      cantidad = anchoM * altoM; break
    case 'perimetro': cantidad = 2 * (anchoM + altoM); break
    case 'ancho':     cantidad = anchoM; break
    case 'alto':      cantidad = altoM; break
    case 'fijo':      cantidad = cantidadFija ?? 1; break
  }
  return cantidad * (1 + desperdicioPct / 100) * unidades
}

export function calcularMateriales<T extends PlantillaComponente>(
  componentes: T[],
  anchoCm: number,
  altoCm: number,
  unidades = 1
): MaterialCalculado<T>[] {
  return componentes.map((comp) => ({
    ...comp,
    cantidad_calculada: cantidadPorFormula(
      comp.formula,
      comp.cantidad_fija,
      comp.desperdicio_pct,
      anchoCm,
      altoCm,
      unidades
    ),
  }))
}
