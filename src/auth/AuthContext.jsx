import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { base44 } from '@/api/base44Client'
import { supabase } from '@/api/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [supabaseClient, setSupabaseClient] = useState(null)

  useEffect(() => {
    const init = async () => {
      // Usa cliente Supabase compartilhado do módulo quando env estiver configurado
      if (supabase) {
        try {
          setSupabaseClient(supabase)
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) setUser(session.user)
          supabase.auth.onAuthStateChange((_event, sess) => {
            setUser(sess?.user || null)
          })
        } catch (e) {
          console.warn('Supabase não disponível, usando fallback local:', e?.message)
        }
      }
      if (!supabase) {
        await base44.auth.ensureSeedUser()
        const session = base44.auth.getSession()
        if (session) setUser(session.user)
      }
      setLoading(false)
    }
    init()
  }, [])

  // Dispara migração quando houver Supabase e usuário autenticado
  useEffect(() => {
    if (supabaseClient && user) {
      base44.migrate.toSupabase().catch((e) => console.warn('Migração falhou:', e?.message))
    }
  }, [supabaseClient, user])

  const login = useCallback(async (email, password) => {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password })
      if (error) throw error
      setUser(data.user)
      return { user: data.user }
    }
    const session = await base44.auth.login(email, password)
    setUser(session.user)
    return session
  }, [supabaseClient])

  const signUp = useCallback(async (email, password) => {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.auth.signUp({ email, password })
      if (error) throw error
      if (data?.session?.user) {
        setUser(data.session.user)
        return { user: data.session.user, session: data.session }
      }
      return { user: data?.user, session: null }
    }
    const users = await base44.entities.User.list()
    const exists = users.some(u => u.email === email)
    if (exists) throw new Error('Email já cadastrado')
    const newUser = await base44.entities.User.create({ email, password, name: email.split('@')[0], role: 'user' })
    const session = { user: newUser, created_at: new Date().toISOString() }
    localStorage.setItem('session', JSON.stringify(session))
    setUser(newUser)
    return { user: newUser, session }
  }, [supabaseClient])

  const logout = useCallback(async () => {
    if (supabaseClient) await supabaseClient.auth.signOut()
    try {
      // Limpa estado local por usuário (evita herdar logo e assinatura entre contas)
      localStorage.removeItem('logo_url')
      localStorage.removeItem('subscribed')
      localStorage.removeItem('settings')
      localStorage.removeItem('customers')
      localStorage.removeItem('products')
      localStorage.removeItem('sales')
      localStorage.removeItem('tanstack-query')
    } catch {}
    base44.auth.logout()
    setUser(null)
  }, [supabaseClient])

  const value = { user, loading, login, signUp, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}