import { useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/hooks/useAuth'

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/inventario': 'Inventario',
  '/proveedores': 'Proveedores',
  '/productos': 'Configurador de Productos',
  '/cotizaciones': 'Cotizaciones',
  '/clientes': 'Clientes',
  '/ordenes': 'Órdenes de Trabajo',
  '/reportes': 'Reportes',
}

function getTitle(pathname: string): string {
  for (const [path, title] of Object.entries(routeTitles)) {
    if (pathname === path || pathname.startsWith(path + '/')) return title
  }
  return 'VidrioSystem'
}

export function Navbar() {
  const location = useLocation()
  const { usuario } = useAuth()
  const title = getTitle(location.pathname)
  const initials = usuario ? `${usuario.nombre[0]}${usuario.apellido[0]}`.toUpperCase() : 'VS'

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-6">
      <div className="pl-10 lg:pl-0">
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
        </Button>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
