import React, { useEffect, useState } from 'react'
import { supabase } from '@/api/supabaseClient'

export default function Onboarding({ settings }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [anchorRect, setAnchorRect] = useState(null)
  const steps = [
    { id: 'welcome', title: 'Bem-vindo ao AlraERP+', desc: 'O Dashboard mostra vendas, clientes e cashback. Explore os blocos para ver mais detalhes.', selector: '[data-nav="dashboard"]', placement: 'bottom' },
    { id: 'cashier', title: 'Para vender, clique em Caixa', desc: 'Na barra inferior, toque em CAIXA. No Caixa, busque/escaneie produtos, ajuste quantidade e finalize a venda.', selector: '[data-nav="caixa"]', placement: 'top' },
    { id: 'inventory', title: 'Cadastre seus produtos', desc: 'Em ESTOQUE, clique em Novo Produto. Preencha Nome/Preço/Custo/Estoque. O código de barras é gerado se não informar.', selector: '[data-nav="inventory"]', placement: 'top' },
    { id: 'labels', title: 'Imprimir etiquetas', desc: 'Em ESTOQUE, clique em Imprimir Etiquetas. Selecione produtos, quantidades, tipo de folha (58/88/A4), margens e parcelas. Clique em Imprimir.', selector: '[data-nav="print-labels"]', placement: 'right' },
    { id: 'customers', title: 'Ative o cashback', desc: 'Em CLIENTES/Marketing, defina o percentual e crie campanhas simples. Acompanhe retenção em Relatórios.', selector: '[data-nav="customers"]', placement: 'top' },
    { id: 'settings', title: 'Emissão fiscal e opções', desc: 'Em OPÇÕES, conecte NFC-e/NF-e, preencha dados da empresa e teste emissão. Veja logs e suporte.', selector: '[data-nav="settings"]', placement: 'left' },
    { id: 'plans', title: 'Planos e teste', desc: 'Conheça os planos e assine após os 7 dias de teste. O anual tem economia.', selector: '[data-nav="plans"], [href="/billing"]', placement: 'bottom' },
  ]
  useEffect(() => {
    try {
      const local = localStorage.getItem('onboarding_completed') === 'true'
      const remote = Boolean(settings?.onboarding_completed)
      if (!local && !remote) setOpen(true)
    } catch {}
  }, [settings])
  useEffect(() => {
    if (!open) return
    const s = steps[step]
    let el = null
    try { el = s?.selector ? document.querySelector(s.selector) : null } catch {}
    if (el) {
      const rect = el.getBoundingClientRect()
      setAnchorRect({ top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width, height: rect.height })
      try { el.setAttribute('data-onboard-highlight', 'true') } catch {}
    } else {
      setAnchorRect(null)
    }
    return () => {
      try {
        const prev = document.querySelector('[data-onboard-highlight="true"]')
        if (prev) prev.removeAttribute('data-onboard-highlight')
      } catch {}
    }
  }, [open, step])
  const finish = async () => {
    try { localStorage.setItem('onboarding_completed', 'true') } catch {}
    try {
      if (supabase && settings?.id) {
        await supabase.from('settings').update({ onboarding_completed: true }).eq('id', settings.id)
      }
    } catch {}
    setOpen(false)
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <style>{`
        [data-onboard-highlight="true"] { outline: 3px solid #3490c7; outline-offset: 3px; border-radius: 12px; }
      `}</style>
      <div className="absolute inset-0 bg-black/40" onClick={finish}></div>
      <div className="absolute" style={{ top: anchorRect ? (anchorRect.top + (steps[step].placement === 'bottom' ? anchorRect.height + 12 : steps[step].placement === 'top' ? -110 : 12)) : window.scrollY + 120, left: anchorRect ? anchorRect.left : 24 }}>
        <div className="bg-white rounded-2xl shadow-2xl w-[280px] sm:w-[360px] p-4 text-gray-900">
          <h3 className="text-base font-semibold mb-1">{steps[step].title}</h3>
          <p className="text-sm text-gray-600 mb-4">{steps[step].desc}</p>
          <div className="flex justify-between">
            <button className="px-3 py-2 rounded-lg bg-gray-100" onClick={finish}>Pular</button>
            <div className="flex gap-2">
              <button className="px-3 py-2 rounded-lg bg-gray-100" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>Voltar</button>
              <button className="px-3 py-2 rounded-lg bg-[#3490c7] text-white" onClick={() => step >= steps.length - 1 ? finish() : setStep(s => s + 1)}>{step >= steps.length - 1 ? 'Concluir' : 'Próximo'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
