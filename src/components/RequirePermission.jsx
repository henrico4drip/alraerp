import { useProfile } from '@/context/ProfileContext'
import { ShieldAlert } from 'lucide-react'

export default function RequirePermission({ permission, children }) {
    const { currentProfile } = useProfile()

    // Admin tem acesso total
    if (currentProfile?.role === 'admin' || currentProfile?.permissions?.all) {
        return children
    }

    // Verifica se tem a permissão específica
    const hasPermission = currentProfile?.permissions?.[permission]

    if (!hasPermission) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 relative">
                {/* Blur background */}
                <div className="absolute inset-0 backdrop-blur-sm bg-gray-100/50"></div>

                {/* Access denied card */}
                <div className="relative z-10 bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center space-y-6 border border-gray-200">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                        <ShieldAlert className="w-10 h-10 text-red-600" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Restrito</h2>
                        <p className="text-gray-600">
                            Você não tem permissão para acessar esta área do sistema.
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                            Entre em contato com o administrador para solicitar acesso.
                        </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <p className="text-xs text-gray-500 font-medium">Seu perfil:</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">{currentProfile?.name}</p>
                        <p className="text-xs text-gray-400 mt-1 capitalize">{currentProfile?.role}</p>
                    </div>
                </div>
            </div>
        )
    }

    return children
}
