import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Store } from 'lucide-react'

export default function Login() {
  const { login, signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@erp.local')
  const [password, setPassword] = useState('123456')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err?.message || 'Erro ao entrar')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      const res = await signUp(email.trim(), password)
      if (res?.session) {
        navigate('/billing', { replace: true })
      } else {
        setInfo('Conta criada. Verifique seu e-mail para confirmar e depois faça login.')
      }
    } catch (err) {
      setError(err?.message || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-4">
          <Store className="w-6 h-6 text-gray-700" />
          <span className="ml-2 text-lg font-semibold text-gray-900">ERP Login</span>
        </div>
        <Card className="border-0 shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] rounded-2xl">
          <CardHeader className="bg-gray-50 rounded-t-2xl border-b">
            <CardTitle className="text-base">Acesse sua conta</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label className="text-sm">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="text-sm">Senha</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  required
                  className="rounded-xl"
                />
              </div>
              {error && (
                <div className="text-sm text-red-600">{error}</div>
              )}
              {info && (
                <div className="text-sm text-green-600">{info}</div>
              )}
              <Button type="submit" className="w-full rounded-xl" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
              <Button type="button" className="w-full rounded-xl mt-2" onClick={handleSignUp} disabled={loading}>
                {loading ? 'Criando...' : 'Criar conta'}
              </Button>
            </form>
            <div className="mt-3 text-xs text-gray-500">
              Dica: use <span className="font-mono">admin@erp.local</span> / <span className="font-mono">123456</span> (seed de dev)
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}