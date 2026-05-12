import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Usuario } from '@/types/database'

interface AuthContextType {
  user: User | null
  usuario: Usuario | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, nombre: string, apellido: string) => Promise<'ok' | 'confirmar_email'>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

async function fetchUsuario(userId: string): Promise<Usuario | null> {
  const { data } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) {
        fetchUsuario(session.user.id)
          .then((perfil) => setUsuario(perfil))
          .catch(() => setUsuario(null))
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUsuario(session.user.id)
          .then((perfil) => setUsuario(perfil))
          .catch(() => setUsuario(null))
      } else {
        setUsuario(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(traducirError(error.message))
  }

  const signUp = async (email: string, password: string, nombre: string, apellido: string): Promise<'ok' | 'confirmar_email'> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre, apellido } },
    })
    if (error) throw new Error(traducirError(error.message))
    // Si confirmación de email está activa, session es null hasta que confirmen
    if (data.session === null) return 'confirmar_email'
    return 'ok'
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { user, usuario, loading, signIn, signUp, signOut }
}

function traducirError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Credenciales incorrectas'
  if (msg.includes('Email not confirmed')) return 'Confirma tu correo electrónico'
  if (msg.includes('User already registered')) return 'El correo ya está registrado'
  if (msg.includes('Password should be at least')) return 'La contraseña debe tener al menos 6 caracteres'
  return 'Error de autenticación'
}
