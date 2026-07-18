import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatFecha(dateStr: string): string {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatFechaHora(dateStr: string): string {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function getSaludo(nombre: string): string {
  const hora = new Date().getHours()
  let saludo = 'Buenos días'
  if (hora >= 12 && hora < 18) saludo = 'Buenas tardes'
  else if (hora >= 18) saludo = 'Buenas noches'
  return `${saludo}, ${nombre}`
}
