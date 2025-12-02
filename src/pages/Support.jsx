import React from 'react'
import { Link } from 'react-router-dom'

export default function Support() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #4fa6dd 0%, #5eaef5 40%, #6db8f9 100%)', color: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 5%' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>alra <span style={{ fontWeight: 300, fontSize: '0.8rem', verticalAlign: 'super' }}>erp+</span></div>
          <nav style={{ display: 'flex', gap: 18 }}>
            <Link to="/" style={{ color: '#fff', textDecoration: 'none' }}>Início</Link>
            <Link to="/billing" style={{ color: '#fff', textDecoration: 'none' }}>Planos</Link>
            <Link to="/login" style={{ color: '#fff', textDecoration: 'none' }}>Login</Link>
          </nav>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24, marginTop: 32 }}>
          <div style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 16, padding: 24 }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 8 }}>Suporte</h1>
            <p style={{ opacity: 0.9, marginBottom: 16 }}>Estamos aqui para ajudar. Em breve você encontrará FAQs, tutoriais e canais de atendimento nesta página.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, padding: 16 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>FAQ</h3>
                  <p style={{ fontSize: '0.9rem', opacity: 0.85 }}>Perguntas frequentes sobre recursos, planos e uso do sistema.</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, padding: 16 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>Tutoriais</h3>
                  <p style={{ fontSize: '0.9rem', opacity: 0.85 }}>Guias passo a passo para configurar e operar cada módulo.</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, padding: 16 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>Atendimento</h3>
                  <p style={{ fontSize: '0.9rem', opacity: 0.85 }}>Canais de contato e horários de suporte.</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, padding: 16 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>Canais de Suporte</h3>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <a href="https://instagram.com/alraerp.app" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'none' }}>
                      Instagram: @alraerp.app
                    </a>
                    <a href="https://wa.me/5551997618951" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'none' }}>
                      WhatsApp: (51) 9 9761-8951
                    </a>
                    <a href="mailto:suportealraerp@gmail.com" style={{ color: '#fff', textDecoration: 'none' }}>
                      E-mail: suportealraerp@gmail.com
                    </a>
                  </div>
                </div>
              </div>
            <div style={{ marginTop: 20 }}>
              <Link to="/billing" style={{ color: '#fff', textDecoration: 'underline' }}>Ver Planos</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
