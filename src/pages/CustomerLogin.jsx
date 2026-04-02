import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/api/supabaseClient'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Wallet, ArrowRight, ArrowLeft, Store, Lock, ShoppingBag, Calendar, ChevronDown, ChevronUp, Package, FileText, AlertCircle, CheckCircle2, Clock, QrCode } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { isBefore, startOfDay, isValid } from 'date-fns'

// ── PIX EMV helpers (mesma lógica de Payments.jsx) ──
const pad = (n, size = 2) => String(n).padStart(size, '0')
const emvField = (id, value) => {
  const v = String(value)
  return `${pad(id)}${pad(v.length)}${v}`
}
const crc16 = (payload) => {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021
      else crc = crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}
const removeDiacritics = (s) => s.normalize('NFD').replace(/\p{Diacritic}+/gu, '')
const sanitizeEmvText = (s, maxLen) => {
  const cleaned = removeDiacritics(String(s || '')).replace(/[^A-Za-z0-9 .\-]/g, '').toUpperCase()
  return cleaned.slice(0, maxLen || cleaned.length)
}
const sanitizeTxid = (s) => String(s || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || 'TX'

const buildPixEmvPayload = ({ key, amount, name, city, txid, description }) => {
  const gui = emvField(0, 'br.gov.bcb.pix')
  const chave = emvField(1, key)
  const desc = description ? emvField(2, String(description).slice(0, 99)) : ''
  const mai = emvField(26, `${gui}${chave}${desc}`)
  const mcc = emvField(52, '0000')
  const curr = emvField(53, '986')
  const v = Number(amount || 0).toFixed(2)
  const amountField = emvField(54, v)
  const country = emvField(58, 'BR')
  const merchantName = emvField(59, sanitizeEmvText(name || 'LOJA', 25))
  const merchantCity = emvField(60, sanitizeEmvText(city || 'CIDADE', 15))
  const tx = emvField(5, sanitizeTxid(txid))
  const addData = emvField(62, `${tx}`)
  const poi = emvField(1, '11')
  const partial = `${emvField(0, '01')}${poi}${mai}${mcc}${curr}${amountField}${country}${merchantName}${merchantCity}${addData}`
  const crcHeader = '63' + '04'
  const full = partial + crcHeader
  return partial + crcHeader + crc16(full)
}

// ── Componente Principal ──
export default function CustomerLogin() {
    const { storeSlug } = useParams()

    // Login state
    const [loading, setLoading] = useState(false)
    const [identifier, setIdentifier] = useState('')
    const [error, setError] = useState('')

    // Customer data
    const [customerData, setCustomerData] = useState(null)
    const [salesHistory, setSalesHistory] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [expandedSale, setExpandedSale] = useState(null)

    // Store info
    const [storeInfo, setStoreInfo] = useState(null)
    const [loadingStore, setLoadingStore] = useState(true)

    // View navigation: 'hub' | 'cashback' | 'crediario'
    const [activeView, setActiveView] = useState('hub')

    // PIX QR expanded for a specific installment
    const [expandedPixInstId, setExpandedPixInstId] = useState(null)

    // ── Derived data: Installments from salesHistory ──
    const installmentsSales = useMemo(() => {
        return salesHistory.filter(sale => {
            const payments = Array.isArray(sale.payments) ? sale.payments : (sale.payments ? [sale.payments] : [])
            return payments.some(p => p.method === 'Carnê' && Array.isArray(p.schedule))
        })
    }, [salesHistory])

    const hasInstallments = installmentsSales.length > 0

    const installmentsSummary = useMemo(() => {
        let totalOpen = 0, totalPaid = 0, countOpen = 0, countPaid = 0, countOverdue = 0
        const today = startOfDay(new Date())
        for (const sale of installmentsSales) {
            const payments = Array.isArray(sale.payments) ? sale.payments : [sale.payments]
            for (const p of payments) {
                if (p?.method !== 'Carnê' || !Array.isArray(p.schedule)) continue
                for (const inst of p.schedule) {
                    if (inst.status === 'paid') {
                        totalPaid += Number(inst.value_paid || inst.amount || 0)
                        countPaid++
                    } else {
                        totalOpen += Number(inst.amount || 0)
                        countOpen++
                        const due = new Date(inst.due_date)
                        if (isValid(due) && isBefore(due, today)) countOverdue++
                    }
                }
            }
        }
        return { totalOpen, totalPaid, countOpen, countPaid, countOverdue, total: totalOpen + totalPaid }
    }, [installmentsSales])

    // ── Store info effect ──
    useEffect(() => {
        if (storeSlug) {
            setLoadingStore(true)
            supabase.rpc('get_store_public_info', { p_slug: storeSlug })
                .then(async ({ data, error }) => {
                    if (!error && data && data[0]) {
                        setStoreInfo(data[0])
                    } else {
                        await fallbackSettings()
                    }
                })
                .catch(async () => { await fallbackSettings() })
                .finally(() => setLoadingStore(false))
        } else {
            setLoadingStore(false)
            fallbackSettings()
        }
    }, [storeSlug])

    // ── Favicon effect ──
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
        } catch { }
    }, [customerData?.logo_url, storeInfo?.logo_url])

    // ── Login ──
    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const clean = identifier.replace(/\D/g, '')
            if (clean.length < 5) throw new Error('Digite um CPF ou Telefone válido')

            const isCpf = clean.length === 11 && clean[2] !== '9'
            let phoneClean = clean
            if (!isCpf && phoneClean.startsWith('55') && phoneClean.length > 11) {
                phoneClean = phoneClean.slice(2)
            }

            const rpcParams = {
                p_slug: storeSlug || '',
                p_cpf: isCpf ? clean : '',
                p_phone: isCpf ? '' : phoneClean
            }

            // 1. Balance + Store Info (now includes pix_key, company_city)
            const { data, error: rpcError } = await supabase.rpc('get_customer_balance', rpcParams)
            if (rpcError) throw rpcError
            if (!data || data.length === 0) throw new Error('Cliente não encontrado. Verifique o número digitado.')
            setCustomerData(data[0])

            // 2. Sales History (now includes payments JSONB)
            setLoadingHistory(true)
            const { data: historyData, error: historyError } = await supabase.rpc('get_customer_sales', rpcParams)
            if (!historyError && historyData) {
                setSalesHistory(historyData)
                // Determine initial view
                const hasCarnes = historyData.some(sale => {
                    const payments = Array.isArray(sale.payments) ? sale.payments : (sale.payments ? [sale.payments] : [])
                    return payments.some(p => p.method === 'Carnê' && Array.isArray(p.schedule))
                })
                setActiveView(hasCarnes ? 'hub' : 'cashback')
            } else {
                setActiveView('cashback')
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
        setActiveView('hub')
        setExpandedPixInstId(null)
    }

    const toggleSaleDetails = (saleId) => {
        setExpandedSale(expandedSale === saleId ? null : saleId)
    }

    const getItemsDescription = (sale) => {
        if (!sale.items || !Array.isArray(sale.items) || sale.items.length === 0) return 'Compra'
        const names = sale.items.slice(0, 3).map(i => i.name || i.product_name || 'Produto')
        const suffix = sale.items.length > 3 ? ` +${sale.items.length - 3}` : ''
        return names.join(', ') + suffix
    }

    const generatePixQrUrl = (amount, txid) => {
        const pixKey = customerData?.pix_key
        if (!pixKey) return null
        const payload = buildPixEmvPayload({
            key: pixKey,
            amount,
            name: customerData?.store_name || 'LOJA',
            city: customerData?.company_city || 'CIDADE',
            txid,
            description: `Parcela`,
        })
        return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payload)}`
    }

    const getPixPayload = (amount, txid) => {
        const pixKey = customerData?.pix_key
        if (!pixKey) return ''
        return buildPixEmvPayload({
            key: pixKey,
            amount,
            name: customerData?.store_name || 'LOJA',
            city: customerData?.company_city || 'CIDADE',
            txid,
            description: `Parcela`,
        })
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            alert('Código Pix copiado!')
        }).catch(() => {
            // Fallback
            const ta = document.createElement('textarea')
            ta.value = text
            document.body.appendChild(ta)
            ta.select()
            document.execCommand('copy')
            document.body.removeChild(ta)
            alert('Código Pix copiado!')
        })
    }

    const fallbackSettings = async () => {
        try {
            const list = await base44.entities.Settings.list()
            if (Array.isArray(list) && list.length > 0) {
                const s = list[0]
                setStoreInfo({
                    store_name: s.erp_name || 'Portal do Cliente',
                    logo_url: s.logo_url || null,
                })
            }
        } catch { }
    }

    // ── Shared Header ──
    const renderHeader = (showBack = false, backTo = 'hub') => (
        <div className="w-full max-w-2xl mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
                {showBack && (
                    <button onClick={() => setActiveView(backTo)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                )}
                {customerData?.logo_url ? (
                    <img src={customerData.logo_url} className="w-12 h-12 object-contain bg-white rounded-full p-1 shadow-sm" />
                ) : (
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <Store className="w-6 h-6 text-gray-400" />
                    </div>
                )}
                <div>
                    <h1 className="text-xl font-bold text-gray-900 leading-tight">{customerData?.store_name || 'Loja Parceira'}</h1>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Portal do Cliente</p>
                </div>
            </div>
            <Button variant="ghost" onClick={handleLogout} className="text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl">
                Sair
            </Button>
        </div>
    )

    // ══════════════════════════════════════════════════
    // RENDER: HUB (2 botões — Cashback e Crediário)
    // ══════════════════════════════════════════════════
    const renderHub = () => (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans">
            {renderHeader(false)}

            <div className="w-full max-w-2xl space-y-6">
                {/* Saudação */}
                <div className="text-center py-4">
                    <p className="text-gray-500 text-sm">Olá,</p>
                    <h2 className="text-2xl font-bold text-gray-900">{customerData?.customer_name || 'Cliente'}</h2>
                    <p className="text-gray-400 text-xs mt-1">O que deseja consultar?</p>
                </div>

                {/* 2 Cards Grandes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Cashback Card */}
                    <button
                        onClick={() => setActiveView('cashback')}
                        className="group bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 rounded-3xl p-6 text-white shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] text-left relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-20 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                        <div className="relative z-10">
                            <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/10">
                                <Wallet className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-lg font-bold mb-1">Cashback</h3>
                            <p className="text-3xl font-extrabold tracking-tight">
                                R$ {Number(customerData?.cashback_balance || 0).toFixed(2)}
                            </p>
                            <p className="text-indigo-200 text-xs mt-2 flex items-center gap-1">
                                Ver saldo e compras <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                            </p>
                        </div>
                    </button>

                    {/* Crediário Card */}
                    <button
                        onClick={() => setActiveView('crediario')}
                        className="group bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-3xl p-6 text-white shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] text-left relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-20 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                        <div className="relative z-10">
                            <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/10">
                                <FileText className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-lg font-bold mb-1">Crediário</h3>
                            <p className="text-3xl font-extrabold tracking-tight">
                                {installmentsSummary.countOpen} parcela{installmentsSummary.countOpen !== 1 ? 's' : ''}
                            </p>
                            <p className="text-orange-100 text-xs mt-2 flex items-center gap-1">
                                {installmentsSummary.countOverdue > 0 ? (
                                    <><AlertCircle className="w-3 h-3" /> {installmentsSummary.countOverdue} atrasada{installmentsSummary.countOverdue !== 1 ? 's' : ''}</>
                                ) : (
                                    <>Ver parcelas <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" /></>
                                )}
                            </p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    )

    // ══════════════════════════════════════════════════
    // RENDER: CASHBACK (tela existente, reorganizada)
    // ══════════════════════════════════════════════════
    const renderCashback = () => (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans">
            {renderHeader(hasInstallments, 'hub')}

            <div className="w-full max-w-2xl space-y-6">
                {/* Cartão de Saldo */}
                <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 rounded-3xl p-6 md:p-8 text-white shadow-2xl relative overflow-hidden transform transition-all hover:scale-[1.01]">
                    <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 p-24 bg-indigo-500/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-indigo-100 font-medium text-sm mb-1">Seu Saldo de Cashback</p>
                                <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight flex items-baseline gap-1">
                                    <span className="text-2xl opacity-80">R$</span>
                                    {Number(customerData?.cashback_balance || 0).toFixed(2)}
                                </h2>
                            </div>
                            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
                                <Wallet className="w-8 h-8 text-white" />
                            </div>
                        </div>

                        <div className="mt-8 pt-4 border-t border-white/10 flex items-center gap-4 text-sm font-medium text-indigo-100/80">
                            {customerData?.cashback_expires_at ? (
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

                {/* Histórico de Compras */}
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

    // ══════════════════════════════════════════════════
    // RENDER: CREDIÁRIO
    // ══════════════════════════════════════════════════
    const renderCrediario = () => {
        const today = startOfDay(new Date())

        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans">
                {renderHeader(true, 'hub')}

                <div className="w-full max-w-2xl space-y-6">

                    {/* Resumo */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
                            <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Em Aberto</p>
                            <p className="text-xl font-extrabold text-red-700 mt-1">R$ {installmentsSummary.totalOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            <p className="text-[10px] text-red-400 mt-0.5">{installmentsSummary.countOpen} parcela{installmentsSummary.countOpen !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
                            <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Já Pago</p>
                            <p className="text-xl font-extrabold text-green-700 mt-1">R$ {installmentsSummary.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            <p className="text-[10px] text-green-400 mt-0.5">{installmentsSummary.countPaid} parcela{installmentsSummary.countPaid !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total</p>
                            <p className="text-xl font-extrabold text-gray-700 mt-1">R$ {installmentsSummary.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{installmentsSummary.countOpen + installmentsSummary.countPaid} no total</p>
                        </div>
                    </div>

                    {installmentsSummary.countOverdue > 0 && (
                        <div className="bg-red-500 text-white rounded-2xl p-4 flex items-center gap-3 shadow-lg shadow-red-200 animate-in slide-in-from-top-2">
                            <AlertCircle className="w-6 h-6 shrink-0" />
                            <div>
                                <p className="font-bold text-sm">Atenção!</p>
                                <p className="text-red-100 text-xs">Você tem {installmentsSummary.countOverdue} parcela{installmentsSummary.countOverdue !== 1 ? 's' : ''} em atraso. Regularize para evitar juros.</p>
                            </div>
                        </div>
                    )}

                    {/* Lista de Vendas com Parcelas */}
                    <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-700">
                        {installmentsSales.map((sale) => {
                            const payments = Array.isArray(sale.payments) ? sale.payments : [sale.payments]
                            const carnePayments = payments.filter(p => p?.method === 'Carnê' && Array.isArray(p.schedule))
                            const itemsDesc = getItemsDescription(sale)

                            return (
                                <div key={sale.sale_id || sale.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                    {/* Header da Venda */}
                                    <div className="p-5 bg-slate-50/50 border-b border-gray-100">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-orange-100 p-3 rounded-2xl text-orange-600 shadow-sm shrink-0">
                                                <Package className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className="font-extrabold text-gray-900 text-sm tracking-tight capitalize">Compra #{sale.sale_number}</p>
                                                    <span className="text-[10px] bg-white border border-gray-200 text-gray-400 px-1.5 py-0.5 rounded-full font-bold">
                                                        {sale.sale_date ? new Date(sale.sale_date).toLocaleDateString('pt-BR') : ''}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 font-medium line-clamp-1">{itemsDesc}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="font-black text-gray-900 text-sm">R$ {Number(sale.total_amount || 0).toFixed(2)}</p>
                                                <button 
                                                    onClick={() => setExpandedSale(expandedSale === (sale.id || sale.sale_id) ? null : (sale.id || sale.sale_id))}
                                                    className="text-[10px] text-orange-600 font-bold hover:underline flex items-center justify-end gap-0.5 mt-0.5"
                                                >
                                                    Ver Itens {expandedSale === (sale.id || sale.sale_id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Detalhamento dos Itens (Expandível) */}
                                        {expandedSale === (sale.id || sale.sale_id) && (
                                            <div className="mt-4 space-y-2 animate-in slide-in-from-top-2 duration-300">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-2">Produtos desta compra:</p>
                                                {Array.isArray(sale.items) && sale.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                                                        <div className="flex items-center gap-3">
                                                            <span className="w-7 h-7 flex items-center justify-center bg-gray-50 rounded-lg text-[10px] font-bold text-gray-400 border border-gray-50">
                                                                {item.quantity}x
                                                            </span>
                                                            <span className="font-bold text-gray-700 text-xs sm:text-sm">{item.name || item.product_name || 'Item'}</span>
                                                        </div>
                                                        <span className="font-extrabold text-gray-900 text-xs sm:text-sm">R$ {Number(item.total_price || (item.unit_price * item.quantity) || 0).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Parcelas */}
                                    <div className="divide-y divide-gray-50">
                                        {carnePayments.map((payment, pIdx) => {
                                            const schedule = [...(payment.schedule || [])].sort((a, b) => {
                                                const aIdx = typeof a.index === 'number' ? a.index : parseInt(a.index) || 0
                                                const bIdx = typeof b.index === 'number' ? b.index : parseInt(b.index) || 0
                                                return aIdx - bIdx
                                            })
                                            const totalInstallments = schedule.filter(i => !String(i.index).includes('.P')).length

                                            return schedule.filter(i => !String(i.index).includes('.P')).map((inst, iIdx) => {
                                                const isPaid = inst.status === 'paid'
                                                const dueDate = new Date(inst.due_date)
                                                const isOverdue = !isPaid && isValid(dueDate) && isBefore(dueDate, today)
                                                const instId = `${sale.sale_id || sale.id}-${pIdx}-${inst.index}`
                                                const isPixExpanded = expandedPixInstId === instId
                                                const txid = `${sale.sale_id || sale.id}-${String(inst.index).padStart(2, '0')}`
                                                const pixKey = customerData?.pix_key

                                                return (
                                                    <div key={instId} className={`px-4 py-4 ${isPaid ? 'opacity-50 grayscale-[0.3]' : 'hover:bg-slate-50/50 transition-colors'}`}>
                                                        <div className="flex items-center gap-3">
                                                            {/* Status Icon */}
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                                                                isPaid ? 'bg-emerald-100 text-emerald-600' :
                                                                isOverdue ? 'bg-red-100 text-red-600' :
                                                                'bg-amber-100 text-amber-600'
                                                            }`}>
                                                                {isPaid ? <CheckCircle2 className="w-5 h-5 text-emerald-600/70" /> :
                                                                 isOverdue ? <AlertCircle className="w-5 h-5 text-red-600/70" /> :
                                                                 <Clock className="w-5 h-5 text-amber-600/70" />}
                                                            </div>

                                                            {/* Info */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-extrabold text-gray-900 text-sm tracking-tight uppercase">
                                                                    Parcela {inst.index} de {totalInstallments}
                                                                </p>
                                                                <p className="text-xs text-gray-500 font-medium">
                                                                    {isPaid ? (
                                                                        <>Quitada em {inst.payment_date ? new Date(inst.payment_date).toLocaleDateString('pt-BR') : '-'}</>
                                                                    ) : isOverdue ? (
                                                                        <span className="text-red-600 font-bold">Venceu em {isValid(dueDate) ? dueDate.toLocaleDateString('pt-BR') : '-'}</span>
                                                                    ) : (
                                                                        <>Vence em {isValid(dueDate) ? dueDate.toLocaleDateString('pt-BR') : '-'}</>
                                                                    )}
                                                                </p>
                                                            </div>

                                                            {/* Value */}
                                                            <div className="text-right shrink-0">
                                                                <p className={`font-black text-base ${isPaid ? 'text-emerald-600' : 'text-gray-900'}`}>
                                                                    R$ {Number(inst.amount || inst.value_paid || 0).toFixed(2)}
                                                                </p>
                                                                {isPaid ? (
                                                                    <span className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Pago</span>
                                                                ) : isOverdue ? (
                                                                    <span className="text-[10px] text-red-600 font-black uppercase tracking-widest">Atrasado</span>
                                                                ) : (
                                                                    <span className="text-[10px] text-amber-600 font-black uppercase tracking-widest">Pendente</span>
                                                                )}
                                                            </div>

                                                            {/* PIX button (only for open installments with pix key) */}
                                                            {!isPaid && pixKey && (
                                                                <button
                                                                    onClick={() => setExpandedPixInstId(isPixExpanded ? null : instId)}
                                                                    className={`p-2.5 rounded-2xl transition-all shrink-0 shadow-sm border ${isPixExpanded ? 'bg-cyan-600 border-cyan-500 text-white shadow-cyan-200' : 'bg-white border-gray-100 text-gray-400 hover:text-cyan-600 hover:border-cyan-200 hover:bg-cyan-50'}`}
                                                                    title="Pagar com PIX"
                                                                >
                                                                    <QrCode className="w-5 h-5" />
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* PIX QR Code expandido */}
                                                        {isPixExpanded && !isPaid && pixKey && (
                                                            <div className="mt-4 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-3xl p-6 text-white shadow-xl shadow-cyan-200 animate-in zoom-in-95 duration-300">
                                                                <div className="flex flex-col items-center gap-4 text-center">
                                                                    <div className="bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                                                                        <p className="text-[10px] font-black uppercase tracking-widest">Pagamento Digital</p>
                                                                    </div>
                                                                    <div className="bg-white p-4 rounded-3xl shadow-2xl">
                                                                       <img
                                                                            src={generatePixQrUrl(inst.amount, txid)}
                                                                            alt="QR Code PIX"
                                                                            className="w-44 h-44 object-contain"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-3xl font-black mb-1">R$ {Number(inst.amount).toFixed(2)}</p>
                                                                        <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Chave Pix: {pixKey}</p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => copyToClipboard(getPixPayload(inst.amount, txid))}
                                                                        className="w-full bg-white text-cyan-700 font-black text-sm py-4 rounded-2xl transition-all shadow-xl hover:bg-cyan-50 active:scale-[0.98] uppercase tracking-wide"
                                                                    >
                                                                        Copia e Cola Pix
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {installmentsSales.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
                            <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">Nenhum crediário encontrado.</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ══════════════════════════════════════════════════
    // RENDER: LOGIN (tela de login — inalterada)
    // ══════════════════════════════════════════════════
    if (customerData) {
        if (activeView === 'crediario') return renderCrediario()
        if (activeView === 'cashback') return renderCashback()
        return renderHub()
    }

    return (
        <div className="min-h-screen w-full flex relative overflow-hidden bg-gray-900 font-sans">
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
                        <p className="text-sm text-indigo-200 font-medium">Acompanhe seu saldo e parcelas</p>
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
                                {loading ? <LoadingSpinner size={24} color="indigo" /> : 'Acessar Minha Conta'}
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
