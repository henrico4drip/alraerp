import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Wallet, ArrowRight, Store, Lock } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function CustomerLogin() {
    const { storeSlug } = useParams()
    const navigate = useNavigate()

    const [loading, setLoading] = useState(false)
    const [identifier, setIdentifier] = useState('') // Pode ser CPF ou Telefone
    const [error, setError] = useState('')
    const [storeInfo, setStoreInfo] = useState(null)

    // Se já tiver logado nesta sessão, mostra direto o saldo (simples verificação local)
    const [customerData, setCustomerData] = useState(null)

    useEffect(() => {
        // Tenta buscar info básica da loja (opcional, só pra mostrar nome/logo no login)
        // Como a tabela settings tem RLS pra owner, talvez não consigamos ler sem o RPC.
        // O RPC get_customer_balance retorna o store_name se o login for sucesso.
        // Para UX, o ideal seria ter um endpoint público pra dados da loja, mas vamos focar no login direto.
    }, [storeSlug])

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            // Limpa input
            const clean = identifier.replace(/\D/g, '')
            if (clean.length < 5) throw new Error('Digite um CPF ou Telefone válido')

            // Chama RPC
            // Vamos tentar passar o input como CPF e como Phone. O RPC verifica qual bate.
            const { data, error: rpcError } = await supabase.rpc('get_customer_balance', {
                p_slug: storeSlug,
                p_cpf: clean, // Tenta passar como CPF (se for cpf valido o RPC compara)
                p_phone: clean // Tenta passar como Phone
            })

            if (rpcError) throw rpcError

            // O RPC retorna array de linhas. Se vazio, não achou.
            if (!data || data.length === 0) {
                throw new Error('Cliente não encontrado nesta loja ou dados incorretos.')
            }

            setCustomerData(data[0])
        } catch (err) {
            console.error(err)
            setError(err.message || 'Erro ao consultar')
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        setCustomerData(null)
        setIdentifier('')
    }

    if (customerData) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md shadow-xl border-0 rounded-3xl overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center text-white relative overflow-hidden">
                        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-white/10 rotate-12 blur-3xl pointer-events-none"></div>
                        {customerData.logo_url && <img src={customerData.logo_url} className="w-20 h-20 object-contain mx-auto bg-white rounded-full p-2 mb-4 shadow-lg" />}
                        <h2 className="text-2xl font-bold relative z-10">{customerData.store_name || 'Loja Parceira'}</h2>
                        <p className="text-blue-100 text-sm relative z-10">Programa de Fidelidade</p>
                    </div>
                    <CardContent className="p-8 text-center space-y-6">
                        <div>
                            <p className="text-gray-500 font-medium mb-1">Olá, {customerData.customer_name?.split(' ')[0]}!</p>
                            <h3 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
                                <Wallet className="w-8 h-8 text-green-500" />
                                R$ {Number(customerData.cashback_balance || 0).toFixed(2)}
                            </h3>
                            <p className="text-xs text-gray-400 mt-2 uppercase tracking-wide font-semibold">Seu Saldo Disponível</p>
                        </div>

                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                            <p className="text-orange-800 text-sm font-medium">Vencimento</p>
                            <p className="text-orange-600 font-bold text-lg">
                                {customerData.cashback_expires_at
                                    ? new Date(customerData.cashback_expires_at).toLocaleDateString('pt-BR')
                                    : 'Sem validade'}
                            </p>
                        </div>

                        <p className="text-sm text-gray-500">
                            Use seu saldo de cashback na sua próxima compra em nossa loja informando seu telefone ou CPF.
                        </p>
                    </CardContent>
                    <CardFooter className="bg-gray-50 p-4 flex justify-center">
                        <Button variant="ghost" onClick={handleLogout} className="text-gray-500 hover:text-gray-700">Sair</Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-sm shadow-2xl border-white/50 bg-white/80 backdrop-blur-xl rounded-3xl">
                <CardHeader className="text-center pb-2">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600">
                        <Store className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-xl text-gray-900">Consultar Cashback</CardTitle>
                    <p className="text-sm text-gray-500">Digite seu CPF ou Celular para ver seu saldo na loja.</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-gray-700 ml-1">CPF ou Celular</Label>
                            <Input
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                placeholder="Ex: 11999990000"
                                className="rounded-xl border-gray-200 h-11 bg-white/50 focus:bg-white transition-all text-center text-lg tracking-wide"
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-center">
                                <p className="text-xs text-red-600 font-medium">{error}</p>
                            </div>
                        )}

                        <Button type="submit" className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 text-base font-semibold" disabled={loading}>
                            {loading ? <LoadingSpinner size={20} color="white" /> : 'Ver Saldo'} <ArrowRight className="w-4 h-4 ml-2 opacity-80" />
                        </Button>

                    </form>
                </CardContent>
                <CardFooter className="justify-center pb-6">
                    <p className="text-xs text-center text-gray-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Ambiente Seguro • AlraERP+
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
