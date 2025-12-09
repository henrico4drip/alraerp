import React, { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTutorial } from '@/hooks/useTutorial'
import { X, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react'

export default function Tutorial() {
    const navigate = useNavigate()
    const location = useLocation()
    const {
        isActive,
        currentStep,
        totalSteps,
        nextStep,
        previousStep,
        skipTutorial,
        completeTutorial,
        getCurrentStepData,
        isLastStep,
        isFirstStep
    } = useTutorial()

    const stepData = getCurrentStepData()
    const targetRef = useRef(null)

    // Handle navigation actions
    useEffect(() => {
        if (!stepData || !stepData.action) return

        const handleAction = () => {
            switch (stepData.action) {
                case 'navigate-settings':
                    navigate('/settings')
                    break
                case 'navigate-inventory':
                    navigate('/inventory')
                    break
                case 'navigate-customers':
                    navigate('/customers')
                    break
                case 'navigate-cashier':
                    navigate('/cashier')
                    break
                case 'navigate-payments':
                    navigate('/payments')
                    break
                case 'navigate-dashboard':
                    navigate('/dashboard')
                    break
                default:
                    break
            }
        }

        // Small delay to ensure page is loaded
        const timer = setTimeout(handleAction, 300)
        return () => clearTimeout(timer)
    }, [stepData?.action, navigate])

    // Find and scroll to target element
    useEffect(() => {
        if (!stepData || !stepData.target) {
            targetRef.current = null
            return
        }

        const findTarget = () => {
            const element = document.querySelector(stepData.target)
            if (element) {
                targetRef.current = element
                // Scroll element into view
                element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }

        // Try to find element with delay to ensure DOM is ready
        const timer = setTimeout(findTarget, 500)
        return () => clearTimeout(timer)
    }, [stepData?.target, location.pathname])

    // Check if we're on the correct page for current step
    const isOnCorrectPage = () => {
        if (!stepData) return true
        const currentPage = location.pathname.split('/')[1] || 'Dashboard'
        const normalizedCurrent = currentPage.charAt(0).toUpperCase() + currentPage.slice(1).toLowerCase()
        return stepData.page.toLowerCase() === normalizedCurrent.toLowerCase() ||
            (stepData.page === 'Dashboard' && location.pathname === '/dashboard')
    }

    const handleNext = () => {
        if (isLastStep()) {
            completeTutorial()
        } else {
            nextStep()
        }
    }

    const handleKeyPress = (e) => {
        if (!isActive) return
        if (e.key === 'Escape') skipTutorial()
        if (e.key === 'ArrowRight') handleNext()
        if (e.key === 'ArrowLeft' && !isFirstStep()) previousStep()
    }

    useEffect(() => {
        window.addEventListener('keydown', handleKeyPress)
        return () => window.removeEventListener('keydown', handleKeyPress)
    }, [isActive, currentStep])

    if (!isActive || !stepData) return null

    // Calculate position for the tutorial card
    const getCardPosition = () => {
        if (!targetRef.current || stepData.position === 'center') {
            return {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                maxWidth: '400px',
                width: 'calc(100vw - 40px)'
            }
        }

        const rect = targetRef.current.getBoundingClientRect()
        const cardWidth = 400
        const cardHeight = 250
        const spacing = 20

        let style = { position: 'fixed' }

        switch (stepData.position) {
            case 'top':
                style.left = `${rect.left + rect.width / 2}px`
                style.top = `${rect.top - cardHeight - spacing}px`
                style.transform = 'translateX(-50%)'
                break
            case 'bottom':
                style.left = `${rect.left + rect.width / 2}px`
                style.top = `${rect.bottom + spacing}px`
                style.transform = 'translateX(-50%)'
                break
            case 'left':
                style.left = `${rect.left - cardWidth - spacing}px`
                style.top = `${rect.top + rect.height / 2}px`
                style.transform = 'translateY(-50%)'
                break
            case 'right':
                style.left = `${rect.right + spacing}px`
                style.top = `${rect.top + rect.height / 2}px`
                style.transform = 'translateY(-50%)'
                break
            default:
                style.top = '50%'
                style.left = '50%'
                style.transform = 'translate(-50%, -50%)'
        }

        return style
    }

    return (
        <>
            {/* Backdrop overlay */}
            <div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998] transition-opacity duration-300 pointer-events-none"
            />

            {/* Spotlight on target element */}
            {targetRef.current && (
                <div
                    className="fixed z-[9999] pointer-events-none"
                    style={{
                        top: targetRef.current.getBoundingClientRect().top - 8,
                        left: targetRef.current.getBoundingClientRect().left - 8,
                        width: targetRef.current.getBoundingClientRect().width + 16,
                        height: targetRef.current.getBoundingClientRect().height + 16,
                        border: '3px solid #3490c7',
                        borderRadius: '12px',
                        boxShadow: '0 0 0 4px rgba(52, 144, 199, 0.3), 0 0 30px rgba(52, 144, 199, 0.5)',
                        animation: 'pulse 2s ease-in-out infinite'
                    }}
                />
            )}

            {/* Tutorial card */}
            <div
                className="z-[10000] w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 animate-in fade-in slide-in-from-bottom-4 duration-300"
                style={getCardPosition()}
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="text-xs font-semibold text-[#3490c7] bg-blue-50 px-2 py-1 rounded-full">
                                Passo {currentStep + 1} de {totalSteps}
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">{stepData.title}</h3>
                    </div>
                    <button
                        onClick={skipTutorial}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                        title="Pular tutorial (Esc)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Description */}
                <p className="text-gray-600 mb-6 leading-relaxed">{stepData.description}</p>

                {/* Progress bar */}
                <div className="mb-6">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-[#3490c7] to-[#5eaef5] transition-all duration-500 ease-out"
                            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Navigation buttons */}
                <div className="flex items-center justify-between gap-3">
                    <button
                        onClick={skipTutorial}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        <SkipForward className="w-4 h-4" />
                        Pular
                    </button>

                    <div className="flex gap-2">
                        <button
                            onClick={previousStep}
                            disabled={isFirstStep()}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Voltar
                        </button>
                        <button
                            onClick={handleNext}
                            className="flex items-center gap-2 px-6 py-2 rounded-xl bg-[#3490c7] hover:bg-[#2980b9] text-white font-medium transition-colors shadow-lg shadow-blue-500/30"
                        >
                            {isLastStep() ? 'Concluir' : 'Próximo'}
                            {!isLastStep() && <ChevronRight className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Keyboard hints */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-400 text-center">
                        Use as setas ← → ou clique nos botões • Esc para pular
                    </p>
                </div>
            </div>

            <style>{`
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(52, 144, 199, 0.3), 0 0 30px rgba(52, 144, 199, 0.5);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(52, 144, 199, 0.2), 0 0 40px rgba(52, 144, 199, 0.7);
          }
        }
      `}</style>
        </>
    )
}
