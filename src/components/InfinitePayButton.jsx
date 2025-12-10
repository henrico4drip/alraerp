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
    const [device, setDevice] = useState(null)

    const handlePayment = async () => {
        if (!amount || !orderId) {
            alert('Dados de pagamento incompletos')
            return
        }

        setLoading(true)

        try {
            // Check if Web Bluetooth is supported
            if (!navigator.bluetooth) {
                throw new Error('Bluetooth não está disponível neste navegador.')
            }

            // Request Bluetooth Device
            // Note: In a real integration, filters would be specific to the manufacturer (e.g., PAX, Gertec)
            const selectedDevice = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['battery_service'] // Required to access generic services if acceptAllDevices is true
            })

            setDevice(selectedDevice)

            // Connect to GATT Server (Simulated handshake)
            if (selectedDevice.gatt) {
                await selectedDevice.gatt.connect()
            }

            // Simulate Payment Processing time
            setShowInstructions(true)

            // Simulate success after 5 seconds (Time to insert card and type PIN)
            setTimeout(() => {
                if (onSuccess) {
                    onSuccess({ amount, orderId })
                }
            }, 5000)

        } catch (error) {
            console.error('Payment error:', error)
            // If user cancelled manually, don't alert loudly
            if (error.name !== 'NotFoundError' && error.message !== 'User cancelled the requestDevice() chooser.') {
                alert('Erro na conexão Bluetooth: ' + error.message)
            }
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
                        Conectando...
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
                            Processando na Maquininha
                        </DialogTitle>
                        <DialogDescription className="text-left space-y-4 pt-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <p className="text-sm text-blue-900 font-medium mb-2">
                                    Conectado a {device?.name || 'Dispositivo'}
                                </p>
                                <p className="text-xs text-blue-700">
                                    Aguarde o processamento na maquininha
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                                        1
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Insira ou aproxime o cartão</p>
                                        <p className="text-xs text-gray-500">Na maquininha selecionada</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                                        2
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Digite a senha</p>
                                        <p className="text-xs text-gray-500">Se solicitado</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                                        3
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Aguarde a confirmação</p>
                                        <p className="text-xs text-gray-500">O sistema irá finalizar automaticamente</p>
                                    </div>
                                </div>
                            </div>

                            <div className="text-center pt-2">
                                <Button
                                    onClick={() => setShowInstructions(false)}
                                    className="w-full rounded-xl"
                                    variant="outline"
                                >
                                    Cancelar / Fechar
                                </Button>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        </>
    )
}
