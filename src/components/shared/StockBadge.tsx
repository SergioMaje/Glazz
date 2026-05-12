import { Badge } from '@/components/ui/badge'

interface StockBadgeProps {
  stockActual: number
  stockMinimo: number
}

export function StockBadge({ stockActual, stockMinimo }: StockBadgeProps) {
  if (stockActual === 0) {
    return <Badge variant="destructive">Sin stock</Badge>
  }
  if (stockActual <= stockMinimo) {
    return <Badge variant="warning">Stock bajo</Badge>
  }
  return <Badge variant="success">OK</Badge>
}
