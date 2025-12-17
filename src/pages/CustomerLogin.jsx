import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Wallet, ArrowRight, Store, Lock, ShoppingBag, Calendar, ChevronDown, ChevronUp, Package } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Badge } from '@/components/ui/badge'

export default function CustomerLogin() {
    const { storeSlug } = useParams()

    const [loading, setLoading] = useState(false)
    const [identifier, setIdentifier] = useState('')
    const [error, setError] = useState('')

    const [customerData, setCustomerData] = useState(null)
    const [salesHistory, setSalesHistory] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [expandedSale, setExpandedSale] = useState(null)

    const [storeInfo, setStoreInfo] = useState(null)
    const [loadingStore, setLoadingStore] = useState(true)

    useEffect(() => {
        if (storeSlug) {
            setLoadingStore(true)
            supabase.rpc('get_store_public_info', { p_slug: storeSlug })
                .then(({ data, error }) => {
                    if (error) console.error('Erro ao buscar loja:', error)
                    if (data && data[0]) setStoreInfo(data[0])
                })
                .catch(err => console.error('Erro ao buscar loja:', err))
                .finally(() => setLoadingStore(false))
        } else {
            setLoadingStore(false)
        }
    }, [storeSlug])

    useEffect(() => {
        const url = customerData?.logo_url || storeInfo?.logo_url
        if (!url) return
        try {
            let link = document.querySelector('link[rel="icon"]')
            if (!link) {
                link = document.createElement('link')
                link.setAttribute('rel', 'icon')
                document.head.appendChild(link)
            }
            link.setAttribute('href', url)
            link.setAttribute('type', 'image/png')
        } catch {}
    }, [customerData?.logo_url, storeInfo?.logo_url])

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const clean = identifier.replace(/\D/g, '')
            if (clean.length < 5) throw new Error('Digite um CPF ou Telefone válido')

            // 1. Busca Saldo e Dados do Cliente
            const { data, error: rpcError } = await supabase.rpc('get_customer_balance', {
                p_slug: storeSlug,
                p_cpf: clean,
                p_phone: clean
            })

            if (rpcError) throw rpcError
            if (!data || data.length === 0) throw new Error('Cliente não encontrado nesta loja.')

            setCustomerData(data[0])

            // 2. Busca Histórico de Compras (Novo RPC)
            setLoadingHistory(true)
            const { data: historyData, error: historyError } = await supabase.rpc('get_customer_sales', {
                p_slug: storeSlug,
                p_cpf: clean,
                p_phone: clean
            })

            if (!historyError && historyData) {
                setSalesHistory(historyData)
            } else {
                console.error('Erro ao buscar histórico:', historyError)
            }
            setLoadingHistory(false)

        } catch (err) {
            console.error(err)
            setError(err.message || 'Erro ao consultar')
            setLoadingHistory(false)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        setCustomerData(null)
        setSalesHistory([])
        setIdentifier('')
        setExpandedSale(null)
    }

    const toggleSaleDetails = (saleId) => {
        setExpandedSale(expandedSale === saleId ? null : saleId)
    }

    // --- TELA DE SALDO E EXTRATO (LOGADO) ---
    if (customerData) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans">

                {/* Header da Loja */}
                <div className="w-full max-w-2xl mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {customerData.logo_url ? (
                            <img src={customerData.logo_url} className="w-12 h-12 object-contain bg-white rounded-full p-1 shadow-sm" />
                        ) : (
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                                <Store className="w-6 h-6 text-gray-400" />
                            </div>
                        )}
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{customerData.store_name || 'Loja Parceira'}</h1>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Portal do Cliente</p>
                        </div>
                    </div>
                    <Button variant="ghost" onClick={handleLogout} className="text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl">
                        Sair
                    </Button>
                </div>

                <div className="w-full max-w-2xl space-y-6">

                    {/* Cartão de Saldo - Design Premium */}
                    <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 rounded-3xl p-6 md:p-8 text-white shadow-2xl relative overflow-hidden transform transition-all hover:scale-[1.01]">
                        <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 p-24 bg-indigo-500/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="text-indigo-100 font-medium text-sm mb-1">Seu Saldo de Cashback</p>
                                    <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight flex items-baseline gap-1">
                                        <span className="text-2xl opacity-80">R$</span>
                                        {Number(customerData.cashback_balance || 0).toFixed(2)}
                                    </h2>
                                </div>
                                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
                                    <Wallet className="w-8 h-8 text-white" />
                                </div>
                            </div>

                            <div className="mt-8 pt-4 border-t border-white/10 flex items-center gap-4 text-sm font-medium text-indigo-100/80">
                                {customerData.cashback_expires_at ? (
                                    <span className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                                        <Calendar className="w-4 h-4" />
                                        Vence em {new Date(customerData.cashback_expires_at).toLocaleDateString('pt-BR')}
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" /> Sem expiração
                                    </span>
                                )}
                                <span className="flex items-center gap-1 ml-auto opacity-75 text-xs uppercase tracking-wide">
                                    <Lock className="w-3 h-3" /> Saldo Protegido
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Seção de Histórico */}
                    <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-700">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 px-1">
                            <ShoppingBag className="w-5 h-5 text-indigo-600" /> Últimas Compras
                        </h3>

                        {loadingHistory ? (
                            <div className="py-12 flex justify-center"><LoadingSpinner /></div>
                        ) : salesHistory.length > 0 ? (
                            <div className="space-y-3">
                                {salesHistory.map((sale) => (
                                    <div key={sale.sale_id || sale.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">

                                        {/* Resumo da Venda */}
                                        <div
                                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 transition-colors"
                                            onClick={() => toggleSaleDetails(sale.sale_id || sale.id)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
                                                    <ShoppingBag className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900">Compra #{sale.sale_number}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {new Date(sale.sale_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-gray-900">R$ {Number(sale.total_amount || 0).toFixed(2)}</p>
                                                <div className="flex justify-end gap-1 mt-0.5">
                                                    {Number(sale.cashback_earned) > 0 && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">+R${Number(sale.cashback_earned).toFixed(2)}</span>}
                                                    {Number(sale.cashback_used) > 0 && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">-R${Number(sale.cashback_used).toFixed(2)}</span>}
                                                </div>
                                            </div>
                                            <div className="ml-2 text-gray-400">
                                                {expandedSale === (sale.sale_id || sale.id) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            </div>
                                        </div>

                                        {/* Detalhes dos Itens (Expandable) */}
                                        {expandedSale === (sale.sale_id || sale.id) && (
                                            <div className="px-4 pb-4 pt-1 bg-gray-50/50 border-t border-gray-100 text-sm animate-in slide-in-from-top-1">
                                                <p className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">Itens da Compra</p>
                                                <div className="space-y-2">
                                                    {sale.items && Array.isArray(sale.items) && sale.items.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between items-center text-gray-700">
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <span className="bg-white border border-gray-200 text-gray-500 text-[10px] font-bold px-1.5 rounded h-5 flex items-center justify-center min-w-[24px]">
                                                                    {item.quantity}x
                                                                </span>
                                                                <span className="truncate">{item.name || item.product_name || 'Produto'}</span>
                                                            </div>
                                                            <span className="font-medium whitespace-nowrap ml-2">R$ {Number(item.total_price || 0).toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                    {!sale.items || sale.items.length === 0 && (
                                                        <p className="text-gray-400 italic text-xs">Sem detalhes dos itens.</p>
                                                    )}
                                                </div>
                                                {sale.cashback_earned > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center bg-green-50/50 p-2 rounded-lg">
                                                        <span className="text-xs font-medium text-green-700">Cashback Recebido</span>
                                                        <span className="font-bold text-green-700">+ R$ {Number(sale.cashback_earned).toFixed(2)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
                                <ShoppingBag className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                <p className="text-gray-500 font-medium">Nenhuma compra recente encontrada.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // --- TELA DE LOGIN ---
    return (
        <div className="min-h-screen w-full flex relative overflow-hidden bg-gray-900 font-sans">

            {/* Background Decorativo */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-20"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/90 via-gray-900/95 to-black/95 backdrop-blur-sm"></div>

            <div className="relative z-10 w-full max-w-md m-auto p-6">
                <Card className="w-full shadow-2xl border-0 bg-white/10 backdrop-blur-xl text-white rounded-3xl overflow-hidden ring-1 ring-white/20">
                    <CardHeader className="text-center pb-2 pt-8 border-b border-white/5">
                        {loadingStore ? (
                            <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/10 transform rotate-3 animate-pulse">
                                <Store className="w-8 h-8 text-white/20" />
                            </div>
                        ) : storeInfo?.logo_url ? (
                            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/20 transform rotate-3 p-1">
                                <img src={storeInfo.logo_url} alt={storeInfo.store_name} className="w-full h-full object-contain rounded-2xl" />
                            </div>
                        ) : (
                            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/20 transform rotate-3">
                                <Store className="w-8 h-8 text-white" />
                            </div>
                        )}
                        <CardTitle className="text-2xl font-bold tracking-tight text-white/90">
                            {storeInfo?.store_name || 'Portal do Cliente'}
                        </CardTitle>
                        <p className="text-sm text-indigo-200 font-medium">Acompanhe seu saldo e histórico</p>
                    </CardHeader>
                    <CardContent className="pt-8 pb-6 px-8">
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-indigo-100 ml-1 text-xs uppercase tracking-wide font-bold opacity-80">CPF ou Celular</Label>
                                <Input
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="Digite seu número..."
                                    className="rounded-xl border-white/10 h-14 bg-white/5 focus:bg-white/10 focus:border-indigo-400 transition-all text-center text-xl tracking-wide text-white placeholder:text-white/20"
                                    autoFocus
                                />
                            </div>

                            {error && (
                                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-center animate-in fade-in zoom-in-95">
                                    <p className="text-xs text-red-200 font-medium">{error}</p>
                                </div>
                            )}

                            <Button type="submit" className="w-full h-14 rounded-xl bg-white !text-indigo-900 hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-black/20 text-lg font-bold transition-all" disabled={loading}>
                                {loading ? <LoadingSpinner size={24} color="indigo" /> : 'Ver Meus Pontos'}
                                {!loading && <ArrowRight className="w-5 h-5 ml-2" />}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter className="justify-center py-6 bg-black/20 border-t border-white/5">
                        <p className="text-[10px] text-center text-white/40 flex items-center gap-1.5 uppercase tracking-widest font-semibold">
                            <Lock className="w-3 h-3" /> Ambiente Seguro • AlraERP
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
