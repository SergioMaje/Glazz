import type { OrdenTrabajo } from '@/types/database'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'warning' | 'success' | 'outline'

export const ESTADOS_ORDEN_CONFIG: Record<OrdenTrabajo['estado'], { label: string; variant: BadgeVariant }> = {
  pendiente: { label: 'Pendiente', variant: 'secondary' },
  en_produccion: { label: 'En producción', variant: 'default' },
  lista: { label: 'Lista', variant: 'success' },
  entregada: { label: 'Entregada', variant: 'outline' },
  cancelada: { label: 'Cancelada', variant: 'destructive' },
}

export const ESTADOS_ACTIVOS: OrdenTrabajo['estado'][] = ['pendiente', 'en_produccion', 'lista']
