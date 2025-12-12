import React, { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { supabase } from '@/api/supabaseClient'
import { useNavigate, Link, useLocation } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()
  const { user, login, signUp } = useAuth()

  useEffect(() => {
    if (user) navigate('/dashboard')
  }, [user, navigate])



  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [showSignupForm, setShowSignupForm] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [companySegment, setCompanySegment] = useState('')
  const location = useLocation()

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
      try {
        const profile = {
          companyName: companyName.trim(),
          companyPhone: companyPhone.trim(),
          companyEmail: (companyEmail || email).trim(),
          companySegment: companySegment.trim(),
          createdAt: new Date().toISOString(),
        }
        window.localStorage.setItem('signup_profile', JSON.stringify(profile))
        window.localStorage.setItem('registration_completed', 'true') // Pixel tracking
        const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        window.localStorage.setItem('trial_until', until.toISOString())
      } catch { }
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err?.message || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search)
      const mode = params.get('mode')
      const signup = params.get('signup')
      if (mode === 'signup' || signup === '1') setShowSignupForm(true)
    } catch { }
  }, [location.search])
  const oauthLogin = async (provider) => {
    if (!supabase) return
    const redirectTo = `${window.location.origin}/dashboard`
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })
    if (error) setError(error.message || 'Falha no login social')
  }

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Poppins', sans-serif; }
        .login-bg { background: linear-gradient(180deg, #4fa6dd 0%, #5eaef5 40%, #6db8f9 100%); min-height: 100vh; padding: 20px 0; }
        header.login-header { display: flex; justify-content: space-between; align-items: center; padding: clamp(12px, 2vw, 20px) 5%; max-width: 1200px; margin: 0 auto; color: white; }
        header.login-header .nav-links a { color: white; text-decoration: none; margin-left: clamp(12px, 2vw, 25px); font-weight: 500; font-size: clamp(0.85rem, 1.2vw, 1rem); }
        .login-card { background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 20px; padding: 40px 30px; width: 100%; max-width: 400px; box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1); color: white; text-align: center; position: relative; overflow: hidden; margin: 0 auto; }
        .login-card::before { content: ''; position: absolute; top: 0; left: -50%; width: 100%; height: 100%; background: linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent); transform: skewX(-25deg); pointer-events: none; }
        .logo { font-size: 2rem; font-weight: 700; margin-bottom: 10px; letter-spacing: 1px; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .logo span { font-size: 1rem; font-weight: 300; vertical-align: super; }
        .subtitle { font-size: 0.9rem; margin-bottom: 30px; opacity: 0.8; font-weight: 300; }
        .input-group { position: relative; margin-bottom: 20px; }
        .input-group i { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: rgba(255, 255, 255, 0.8); font-size: 0.9rem; }
        .input-field { width: 100%; background: rgba(0, 0, 0, 0.15); border: 1px solid rgba(255, 255, 255, 0.2); padding: 12px 15px 12px 45px; border-radius: 50px; color: white; font-size: 0.9rem; outline: none; transition: all 0.3s; }
        .input-field::placeholder { color: rgba(255, 255, 255, 0.6); }
        .input-field:focus { background: rgba(0, 0, 0, 0.25); border-color: rgba(255, 255, 255, 0.5); box-shadow: 0 0 8px rgba(255, 255, 255, 0.2); }
        .form-options { display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 25px; padding: 0 10px; }
        .remember-me { display: flex; align-items: center; gap: 5px; cursor: pointer; opacity: 0.9; }
        .forgot-link { color: white; text-decoration: none; font-weight: 600; opacity: 0.9; transition: opacity 0.2s; }
        .forgot-link:hover { opacity: 1; text-decoration: underline; }
        .btn-login { width: 100%; background-color: #76cc2e; color: white; border: none; padding: 12px; border-radius: 50px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: transform 0.2s, background 0.2s; box-shadow: 0 4px 15px rgba(118, 204, 46, 0.3); text-transform: uppercase; }
        .btn-login:hover { background-color: #65b025; transform: translateY(-2px); }
        .divider { margin: 25px 0; font-size: 0.8rem; opacity: 0.7; position: relative; }
        .divider::before, .divider::after { content: ''; position: absolute; top: 50%; width: 30%; height: 1px; background: rgba(255,255,255,0.3); }
        .divider::before { left: 0; }
        .divider::after { right: 0; }
        .social-icons { display: flex; justify-content: center; gap: 15px; margin-bottom: 25px; }
        .social-btn { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; transition: all 0.3s; }
        .social-btn:hover { background: white; color: #333; transform: scale(1.1); }
        .card-footer { font-size: 0.85rem; opacity: 0.9; }
        .card-footer a { color: #fff; font-weight: 700; text-decoration: none; }
        .card-footer a:hover { text-decoration: underline; }
      `}</style>
      <div className="login-bg">
        <header className="login-header">
          <Link to="/" className="text-white text-decoration-none">
            <div className="logo">alra <span>erp+</span></div>
          </Link>
          <nav className="nav-links">
            <Link to="/support">Suporte</Link>
            <Link to="/billing">Planos</Link>
            {showSignupForm && (
              <a href="#" onClick={(e) => { e.preventDefault(); setShowSignupForm(false); }}>Login</a>
            )}
          </nav>
        </header>
        <div className="login-card">
          <div className="logo">alra <span>erp+</span></div>
          <p className="subtitle">Bem-vindo de volta!</p>
          <form onSubmit={(e) => showSignupForm ? handleSignUp(e) : handleSubmit(e)} autoComplete="off">
            <div className="input-group">
              <i className="fas fa-envelope"></i>
              <input type="email" className="input-field" placeholder="Seu e-mail" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            </div>
            <div className="input-group">
              <i className="fas fa-lock"></i>
              <input type="password" className="input-field" placeholder="Sua senha" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            {showSignupForm && (
              <div style={{ marginTop: 10, textAlign: 'left' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 10 }}>Informações da empresa</h3>
                <div className="input-group">
                  <i className="fas fa-building"></i>
                  <input type="text" className="input-field" placeholder="Nome da empresa" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <div className="input-group">
                  <i className="fas fa-phone"></i>
                  <input type="text" className="input-field" placeholder="Telefone" required value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
                </div>
                <div className="input-group">
                  <i className="fas fa-envelope-open"></i>
                  <input type="email" className="input-field" placeholder="E-mail da empresa (opcional)" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} />
                </div>
                <div className="input-group">
                  <i className="fas fa-tags"></i>
                  <input type="text" className="input-field" placeholder="Segmento (ex.: Moda, Eletrônicos)" value={companySegment} onChange={(e) => setCompanySegment(e.target.value)} />
                </div>
              </div>
            )}
            <div className="form-options">
              <label className="remember-me"><input type="checkbox" /> Lembrar de mim</label>
              <a href="#" className="forgot-link">Esqueceu a senha?</a>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn-login" disabled={loading}>{loading ? (showSignupForm ? 'Criando...' : 'Entrando...') : (showSignupForm ? 'Criar conta' : 'Entrar')}</button>
              {showSignupForm && (
                <button type="button" className="btn-login" style={{ background: '#ffffff22' }} onClick={() => setShowSignupForm(false)}>Login</button>
              )}
            </div>
          </form>
          {error && <div style={{ color: '#ffdddd', marginTop: 10, fontSize: '0.9rem' }}>{error}</div>}
          {info && <div style={{ color: '#ddffdd', marginTop: 10, fontSize: '0.9rem' }}>{info}</div>}
          <div className="divider">ou continue com</div>
          <div className="social-icons">
            <div className="social-btn" title="Google" onClick={() => oauthLogin('google')}><i className="fab fa-google"></i></div>
            <div className="social-btn" title="Facebook" onClick={() => oauthLogin('facebook')}><i className="fab fa-facebook-f"></i></div>
            <div className="social-btn" title="Apple" onClick={() => oauthLogin('apple')}><i className="fab fa-apple"></i></div>
          </div>
          {!showSignupForm && (
            <div className="card-footer">Não tem uma conta? <a href="#" onClick={(e) => { e.preventDefault(); setShowSignupForm(true) }}>Cadastre-se agora</a></div>
          )}
        </div>
      </div>
    </>
  )
}
