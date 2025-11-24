import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function TrialOffer() {
  const navigate = useNavigate()

  useEffect(() => {
    const linkFont = document.createElement('link')
    linkFont.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700;800&display=swap'
    linkFont.rel = 'stylesheet'
    document.head.appendChild(linkFont)

    const linkIcon = document.createElement('link')
    linkIcon.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
    linkIcon.rel = 'stylesheet'
    document.head.appendChild(linkIcon)
  }, [])

  const handleStartTrial = async () => {
    try {
      const API = import.meta.env.VITE_API_URL || 'http://localhost:4242'
      const res = await fetch(`${API}/create-trial-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'monthly' }),
      })
      const json = await res.json()
      if (json?.url) {
        window.location.href = json.url
        return
      }
      navigate('/dashboard')
    } catch {
      navigate('/dashboard')
    }
  }

  const styles = {
    gradientBg: {
      background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      fontFamily: "'Poppins', sans-serif",
      minHeight: '100vh',
      color: 'white',
    },
    glassContainer: 'bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-3xl overflow-hidden',
    btnPrimary: 'bg-[#76cc2e] hover:bg-[#65b025] text-white text-lg font-bold py-4 px-10 rounded-full shadow-[0_10px_20px_rgba(118,204,46,0.3)] transform transition hover:-translate-y-1 hover:scale-105 uppercase tracking-wide w-full md:w-auto',
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 md:p-8" style={styles.gradientBg}>
      <div className="w-full max-w-6xl flex justify-between items-center mb-10 px-4">
        <div className="text-2xl font-bold">alra<span className="text-sm font-light align-top ml-0.5">erp+</span></div>
        <button onClick={() => navigate('/login')} className="text-white/80 hover:text-white font-medium">Sair</button>
      </div>

      <div className={`w-full max-w-5xl ${styles.glassContainer}`}>
        <div className="flex flex-col md:flex-row">
          <div className="p-8 md:p-12 md:w-3/5 flex flex-col justify-center">
            <div className="inline-block bg-[#3490c7]/20 border border-[#3490c7]/50 rounded-full px-4 py-1 text-sm font-bold text-white mb-6 w-max">🚀 Acesso Total Liberado</div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">Experimente tudo.<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-100">Pague zero agora.</span></h1>
            <p className="text-white/90 text-lg mb-10 font-light leading-relaxed">Você tem <strong>7 dias de teste grátis</strong> para usar o sistema completo. Emita notas, gerencie estoque e fidelize clientes. Sem compromisso.</p>
            <div className="grid grid-cols-1 gap-6 mb-10">
              <div className="flex items-start gap-4">
                <div className="min-w-[50px] h-[50px] bg-white rounded-xl flex items-center justify-center text-[#3490c7] text-xl shadow-md"><i className="fas fa-chart-line"></i></div>
                <div><h3 className="font-bold text-lg">Controle Financeiro Total</h3><p className="text-white/70 text-sm">Visualize seu lucro real e fluxo de caixa em tempo real.</p></div>
              </div>
              <div className="flex items-start gap-4">
                <div className="min-w-[50px] h-[50px] bg-white rounded-xl flex items-center justify-center text-[#3490c7] text-xl shadow-md"><i className="fas fa-qrcode"></i></div>
                <div><h3 className="font-bold text-lg">Emissão Fiscal Ilimitada</h3><p className="text-white/70 text-sm">NFC-e e NF-e emitidas em segundos, sem burocracia.</p></div>
              </div>
              <div className="flex items-start gap-4">
                <div className="min-w-[50px] h-[50px] bg-white rounded-xl flex items-center justify-center text-[#3490c7] text-xl shadow-md"><i className="fas fa-gift"></i></div>
                <div><h3 className="font-bold text-lg">Cashback Integrado</h3><p className="text-white/70 text-sm">A ferramenta nº 1 para fazer o cliente voltar à sua loja.</p></div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md md:w-2/5 p-8 md:p-12 flex flex-col justify-center items-center text-center border-l border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#3490c7] rounded-full filter blur-[100px] opacity-20 pointer-events-none"></div>
            <h2 className="text-2xl font-bold mb-2 relative z-10">Comece seus 7 dias grátis</h2>
            <p className="text-white/70 text-sm mb-8 relative z-10">Nenhuma cobrança será feita hoje.</p>
            <div className="w-full bg-white/5 rounded-2xl p-6 mb-8 border border-white/10 relative z-10">
              <div className="flex justify-between text-sm mb-3 border-b border-white/10 pb-3"><span className="opacity-70">Hoje</span><span className="font-bold">R$ 0,00</span></div>
              <div className="flex justify-between text-sm"><span className="opacity-70">Após 7 dias</span><span className="font-bold">R$ 47,90/mês</span></div>
              <div className="mt-4 text-xs text-center text-white bg-[#3490c7]/10 py-1 rounded"><i className="fas fa-bell mr-1"></i> Enviaremos um lembrete antes de cobrar.</div>
            </div>
            <button onClick={handleStartTrial} className={`${styles.btnPrimary} relative z-10`}>Liberar Meu Acesso <i className="fas fa-arrow-right ml-2"></i></button>
            <p className="mt-6 text-xs text-white/50 relative z-10"><i className="fas fa-lock mr-1"></i> Ambiente seguro. Cancele a qualquer momento nas configurações.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
