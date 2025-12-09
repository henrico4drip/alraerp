import React, { useState } from 'react'
import { Crown, Check, ShieldCheck, Zap } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'

export default function SubscriptionLockOverlay() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)

    const handleSubscribe = async (plan) => {
        try {
            setLoading(true)
            const API = import.meta.env.VITE_API_URL || 'http://localhost:4242'
            // Redireciona de volta para a origem atual
            const SITE = window.location.origin

            const res = await fetch(`${API}/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan,
                    user_id: user?.id,
                    user_email: user?.email,
                    // Não precisamos passar URLs customizadas aqui se o backend já define, 
                    // mas vamos garantir que o backend use a lógica padrão ou aceite overrides se suportado.
                    // O backend index.js atual usa window.location.origin (via referer) por padrão.
                }),
            })
            const json = await res.json()
            if (json?.url) {
                window.location.href = json.url
            } else {
                alert('Não foi possível iniciar o pagamento. Tente novamente.')
            }
        } catch (err) {
            console.error(err)
            alert('Erro ao conectar com o servidor de pagamentos.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full max-w-4xl p-4 animate-in fade-in zoom-in duration-500">
            <div className="bg-white/90 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl overflow-hidden flex flex-col md:flex-row">

                {/* Lado Esquerdo - Info */}
                <div className="p-8 md:p-10 md:w-5/12 bg-gradient-to-br from-[#3490c7] to-[#1e5f8a] text-white flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full filter blur-[80px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>

                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                            <ShieldCheck className="w-4 h-4" /> Período de Teste Finalizado
                        </div>
                        <h2 className="text-3xl font-bold mb-4 leading-tight">Sua loja cresceu,<br />continue com a gente!</h2>
                        <p className="text-blue-100 text-sm leading-relaxed mb-8">
                            Você utilizou todos os recursos premium do AlraERP+ por 7 dias. Para continuar vendendo e gerenciando seu negócio, escolha seu plano ideal.
                        </p>
                    </div>

                    <div className="space-y-4 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                <Crown className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm font-medium">Acesso ilimitado a tudo</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                <Zap className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm font-medium">Emissão fiscal instantânea</span>
                        </div>
                    </div>
                </div>

                {/* Lado Direito - Planos */}
                <div className="p-8 md:p-10 md:w-7/12 bg-white flex flex-col justify-center">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">Escolha o plano para liberar seu acesso</h3>

                    <div className="space-y-4">
                        {/* Plano Mensal */}
                        <div className="group relative border-2 border-gray-100 hover:border-blue-500 rounded-2xl p-4 transition-all cursor-pointer hover:shadow-lg hover:shadow-blue-500/10"
                            onClick={() => !loading && handleSubscribe('monthly')}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${loading ? 'border-gray-300' : 'border-blue-500 group-hover:bg-blue-500'}`}>
                                        <div className="w-2.5 h-2.5 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">Mensal</h4>
                                        <p className="text-xs text-gray-500">Cobrança recorrente a cada mês</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="block text-2xl font-bold text-gray-900">R$ 47,90</span>
                                    <span className="text-xs text-gray-400">/mês</span>
                                </div>
                            </div>
                        </div>

                        {/* Plano Anual - Destaque */}
                        <div className="relative border-2 border-[#3490c7] bg-blue-50/30 rounded-2xl p-4 cursor-pointer hover:shadow-xl hover:shadow-blue-500/20 transition-all transform hover:-translate-y-1"
                            onClick={() => !loading && handleSubscribe('annual')}
                        >
                            <div className="absolute -top-3 right-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                MELHOR CUSTO-BENEFÍCIO (20% OFF)
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-6 h-6 rounded-full border-2 border-[#3490c7] bg-[#3490c7] flex items-center justify-center`}>
                                        <Check className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">Anual</h4>
                                        <p className="text-xs text-gray-500">Pagamento único anual</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="block text-2xl font-bold text-gray-900">R$ 38,32</span>
                                    <span className="text-xs text-gray-400">/mês (eq.)</span>
                                </div>
                            </div>
                            <div className="mt-2 text-right">
                                <span className="text-xs text-blue-600 font-semibold bg-blue-100 px-2 py-0.5 rounded">R$ 459,84 /ano</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <Button
                            className="w-full h-12 text-lg font-bold rounded-xl bg-[#3490c7] hover:bg-[#2a7bb0] shadow-lg shadow-blue-500/30"
                            onClick={() => handleSubscribe('annual')}
                            disabled={loading}
                        >
                            {loading ? 'Processando...' : 'Liberar Acesso Agora'}
                        </Button>
                        <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Pagamento 100% seguro via Stripe
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
