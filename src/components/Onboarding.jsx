import React, { useEffect, useState } from 'react'
import { supabase } from '@/api/supabaseClient'

export default function Onboarding({ settings }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const steps = [
    { title: 'Bem-vindo ao AlraERP+', desc: 'Veja seu painel com vendas, clientes e cashback.' },
    { title: 'Cadastre produtos', desc: 'Adicione estoque com código de barras e preços.' },
    { title: 'Imprima etiquetas', desc: 'Gere etiquetas com parcelas e códigos.' },
    { title: 'Ative o cashback', desc: 'Aumente retenção com recompensas simples.' },
  ]
  useEffect(() => {
    try {
      const local = localStorage.getItem('onboarding_completed') === 'true'
      const remote = Boolean(settings?.onboarding_completed)
      if (!local && !remote) setOpen(true)
    } catch {}
  }, [settings])
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={finish}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-gray-900">
        <h3 className="text-xl font-semibold mb-2">{steps[step].title}</h3>
        <p className="text-sm text-gray-600 mb-6">{steps[step].desc}</p>
        <div className="flex justify-between">
          <button className="px-4 py-2 rounded-lg bg-gray-100" onClick={finish}>Pular</button>
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-lg bg-gray-100" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>Voltar</button>
            <button className="px-4 py-2 rounded-lg bg-[#3490c7] text-white" onClick={() => step >= steps.length - 1 ? finish() : setStep(s => s + 1)}>{step >= steps.length - 1 ? 'Concluir' : 'Próximo'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
