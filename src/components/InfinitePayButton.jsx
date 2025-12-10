import { useState } from 'react'
import { Smartphone, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { openInfiniteTap } from '@/utils/infinitepay'

/**
 * InfinitePayButton - Button component to trigger InfiniteTap payment
 * 
 * @param {Object} props
 * @param {number} props.amount - Payment amount in BRL
 * @param {string} props.orderId - Unique order ID
 * @param {string} props.customerName - Customer name (optional)
 * @param {string} props.description - Payment description (optional)
 * @param {Function} props.onSuccess - Callback when payment initiated successfully
 * @param {Function} props.onError - Callback when error occurs
 * @param {string} props.variant - Button variant (default, outline, etc.)
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.disabled - Disable button
 */
export default function InfinitePayButton({
    amount,
    orderId,
    customerName,
    description,
    onSuccess,
    onError,
    variant = 'default',
    className = '',
    disabled = false,
    children
}) {
    const [loading, setLoading] = useState(false)
    const [showInstructions, setShowInstructions] = useState(false)

    const handlePayment = async () => {
        if (!amount || !orderId) {
            alert('Dados de pagamento incompletos')
            return
        }

        setLoading(true)

        try {
            const success = await openInfiniteTap({
                amount,
                orderId,
                customerName,
                description: description || `Pedido #${orderId}`
            })

            if (success) {
                // Show instructions modal
                setShowInstructions(true)

                if (onSuccess) {
                    onSuccess({ amount, orderId })
                }
            } else {
                throw new Error('Não foi possível abrir o InfinitePay')
            }
        } catch (error) {
            console.error('Payment error:', error)
            alert('Erro ao processar pagamento. Verifique se o app InfinitePay está instalado.')

            if (onError) {
                onError(error)
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <Button
                onClick={handlePayment}
                disabled={disabled || loading}
                variant={variant}
                className={`gap-2 ${className}`}
            >
                {loading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Abrindo InfinitePay...
                    </>
                ) : (
                    <>
                        <Smartphone className="w-4 h-4" />
                        {children || 'Pagar com Maquininha'}
                    </>
                )}
            </Button>

            {/* Instructions Dialog */}
            <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Smartphone className="w-5 h-5 text-blue-600" />
                            Pagamento Iniciado
                        </DialogTitle>
                        <DialogDescription className="text-left space-y-4 pt-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <p className="text-sm text-blue-900 font-medium mb-2">
                                    O app InfinitePay deve abrir automaticamente
                                </p>
                                <p className="text-xs text-blue-700">
                                    Siga as instruções no app para processar o pagamento
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                                        1
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Aproxime o cartão</p>
                                        <p className="text-xs text-gray-500">Use a função NFC do celular</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                                        2
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Aguarde a aprovação</p>
                                        <p className="text-xs text-gray-500">O pagamento será processado</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                                        3
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Retorne ao sistema</p>
                                        <p className="text-xs text-gray-500">Você será redirecionado automaticamente</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex gap-2">
                                <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-yellow-800">
                                    Se o app não abrir, verifique se o InfinitePay está instalado no seu celular
                                </p>
                            </div>

                            <div className="text-center pt-2">
                                <Button
                                    onClick={() => setShowInstructions(false)}
                                    className="w-full rounded-xl"
                                >
                                    Entendi
                                </Button>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        </>
    )
}
