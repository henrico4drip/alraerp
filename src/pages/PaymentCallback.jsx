import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { parsePaymentCallback, getPendingPayment, clearPendingPayment } from '@/utils/infinitepay'
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PaymentCallback() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const [paymentResult, setPaymentResult] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Parse callback parameters
        const result = parsePaymentCallback(searchParams)
        const pendingPayment = getPendingPayment()

        setPaymentResult({
            ...result,
            pendingPayment
        })

        setLoading(false)

        // Clear pending payment after 5 seconds
        setTimeout(() => {
            clearPendingPayment()
        }, 5000)
    }, [searchParams])

    const handleContinue = () => {
        clearPendingPayment()
        navigate('/dashboard')
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Processando pagamento...</p>
                </div>
            </div>
        )
    }

    const { isApproved, isDeclined, isCancelled, transactionId, orderId, amount, errorMessage } = paymentResult || {}

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center space-y-6">
                {/* Status Icon */}
                {isApproved && (
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-12 h-12 text-green-600" />
                    </div>
                )}

                {isDeclined && (
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                        <XCircle className="w-12 h-12 text-red-600" />
                    </div>
                )}

                {isCancelled && (
                    <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle className="w-12 h-12 text-yellow-600" />
                    </div>
                )}

                {/* Status Message */}
                <div>
                    {isApproved && (
                        <>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Pagamento Aprovado!</h1>
                            <p className="text-gray-600">
                                Sua transação foi processada com sucesso.
                            </p>
                        </>
                    )}

                    {isDeclined && (
                        <>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Pagamento Recusado</h1>
                            <p className="text-gray-600">
                                {errorMessage || 'O pagamento não pôde ser processado. Tente novamente ou use outro método.'}
                            </p>
                        </>
                    )}

                    {isCancelled && (
                        <>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Pagamento Cancelado</h1>
                            <p className="text-gray-600">
                                A transação foi cancelada.
                            </p>
                        </>
                    )}
                </div>

                {/* Transaction Details */}
                {(transactionId || orderId || amount) && (
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-left border border-gray-200">
                        {amount && (
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">Valor:</span>
                                <span className="text-sm font-semibold text-gray-900">
                                    R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}
                        {orderId && (
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">Pedido:</span>
                                <span className="text-sm font-semibold text-gray-900">#{orderId}</span>
                            </div>
                        )}
                        {transactionId && (
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">Transação:</span>
                                <span className="text-sm font-mono text-gray-900 truncate max-w-[200px]">
                                    {transactionId}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="space-y-3">
                    <Button
                        onClick={handleContinue}
                        className="w-full h-12 rounded-xl text-lg"
                    >
                        {isApproved ? 'Continuar' : 'Voltar ao Sistema'}
                    </Button>

                    {isDeclined && (
                        <Button
                            onClick={() => navigate(-2)} // Go back 2 pages to retry
                            variant="outline"
                            className="w-full h-12 rounded-xl"
                        >
                            Tentar Novamente
                        </Button>
                    )}
                </div>

                {/* Help Text */}
                <p className="text-xs text-gray-400 mt-4">
                    {isApproved
                        ? 'O comprovante foi enviado automaticamente para o app InfinitePay'
                        : 'Se precisar de ajuda, entre em contato com o suporte'}
                </p>
            </div>
        </div>
    )
}
