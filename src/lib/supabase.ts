import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type { Usuario, Categoria, UnidadMedida, Proveedor, ItemInventario, MovimientoInventario, TipoProducto, PlantillaProducto, PlantillaComponente, Cliente, Cotizacion, CotizacionItem, OrdenTrabajo } from '@/types/database'
