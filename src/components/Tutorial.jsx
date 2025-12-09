import React, { useEffect, useRef, useLayoutEffect, useState } from 'react'
import { base44 } from '@/api/base44Client'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTutorial } from '@/hooks/useTutorial'
import { X, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react'

export default function Tutorial() {
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        console.log('Tutorial Component Loaded: Robust Version')
    }, [])

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
    const [spotRect, setSpotRect] = useState(null)

    // Navegar automaticamente apenas no passo de métricas do Dashboard
    useEffect(() => {
        if (stepData?.id === 'dashboard-metrics') {
            const timer = setTimeout(() => navigate('/dashboard'), 100)
            return () => clearTimeout(timer)
        }
    }, [stepData?.id])

    // Find and scroll to target element
    useLayoutEffect(() => {
        if (!stepData || !stepData.target) {
            targetRef.current = null
            return
        }

        const findTarget = () => {
            const sel = stepData.target
            let element = sel ? document.querySelector(sel) : null
            // Fallbacks para rodapé e ações da dashboard
            if (!element && sel) {
                const map = {
                    '[data-tutorial="inventory-bottom-link"]': () => document.querySelector('a[data-tutorial="inventory-bottom-link"]'),
                    '[data-tutorial="customers-bottom-link"]': () => document.querySelector('a[data-tutorial="customers-bottom-link"]'),
                    '[data-tutorial="cashier-bottom-link"]': () => document.querySelector('a[data-tutorial="cashier-bottom-link"]'),
                    '[data-tutorial="settings-link"]': () => document.querySelector('a[data-tutorial="settings-link"]'),
                    '[data-tutorial="dashboard-payments-button"]': () => document.querySelector('a[data-tutorial="dashboard-payments-button"]')
                }
                const fn = map[sel]
                if (fn) element = fn() || null
            }
            if (element) {
                targetRef.current = element
                element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                const r = element.getBoundingClientRect()
                setSpotRect({ top: r.top, left: r.left, width: r.width, height: r.height })
            } else {
                targetRef.current = null
                setSpotRect(null)
            }
        }

        // Try to find element with delay to ensure DOM is ready
        // Primeira tentativa imediata
        findTarget()
        let tries = 0
        const interval = setInterval(() => {
            if (targetRef.current) { clearInterval(interval); return }
            tries++
            findTarget()
            if (targetRef.current || tries >= 10) clearInterval(interval)
        }, 150)
        return () => clearInterval(interval)
    }, [stepData?.target, location.pathname, currentStep])

    useLayoutEffect(() => {
        // Limpa alvo ao trocar de passo para evitar spotlight atrasado
        targetRef.current = null
        setSpotRect(null)
    }, [currentStep])

    useEffect(() => {
        const onReflow = () => {
            if (!targetRef.current) return
            const r = targetRef.current.getBoundingClientRect()
            setSpotRect({ top: r.top, left: r.left, width: r.width, height: r.height })
        }
        window.addEventListener('resize', onReflow)
        window.addEventListener('scroll', onReflow, true)
        return () => { window.removeEventListener('resize', onReflow); window.removeEventListener('scroll', onReflow, true) }
    }, [])

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

    // Create a tutorial payment when entering Payments and there are none
    useEffect(() => {
        const maybeCreateTutorialSale = async () => {
            if (stepData?.id !== 'payment-features') return
            try {
                const createdFlag = localStorage.getItem('tutorial_sale_created') === 'true'
                const list = await base44.entities.Sale.list()
                const hasSchedule = (list || []).some(s => Array.isArray(s?.payments?.schedule) && s.payments.schedule.length > 0)
                if (!hasSchedule && !createdFlag) {
                    const now = new Date()
                    const saleData = {
                        sale_number: 'TUTORIAL',
                        customer_name: 'Cliente Tutorial',
                        total_amount: 100,
                        payments: [
                            {
                                method: 'Carnê',
                                schedule: [
                                    { index: 1, amount: 100, due_date: now.toISOString() }
                                ]
                            }
                        ],
                        items: [],
                        sale_date: now.toISOString()
                    }
                    await base44.entities.Sale.create(saleData)
                    localStorage.setItem('tutorial_sale_created', 'true')
                }
            } catch { }
        }
        maybeCreateTutorialSale()
    }, [stepData?.id])

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
        const cardWidth = Math.min(320, window.innerWidth - 24)
        const cardHeight = 160
        const spacing = 12
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight

        let left = 0
        let top = 0

        switch (stepData.position) {
            case 'top':
                left = rect.left + (rect.width / 2) - (cardWidth / 2)
                top = rect.top - cardHeight - spacing
                break
            case 'bottom':
                left = rect.left + (rect.width / 2) - (cardWidth / 2)
                top = rect.bottom + spacing
                break
            case 'left':
                left = rect.left - cardWidth - spacing
                top = rect.top + (rect.height / 2) - (cardHeight / 2)
                break
            case 'right':
                left = rect.right + spacing
                top = rect.top + (rect.height / 2) - (cardHeight / 2)
                break
            default:
                return {
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    maxWidth: '400px',
                    width: 'calc(100vw - 40px)'
                }
        }

        // Constrain to viewport boundaries with padding
        const padding = 12
        const nearBottom = rect.bottom > (viewportHeight - 120)
        if (nearBottom && stepData.position === 'top') {
            top = top - 64
        }
        const nearTop = rect.top < 120
        if (nearTop && stepData.position === 'bottom') {
            top = top + 64
        }
        // Extra afastamento para elementos da Dashboard
        if (stepData?.id === 'dashboard-payments-button' && stepData.position === 'bottom') {
            top = rect.bottom + (spacing + 24)
        }
        if (stepData?.id === 'dashboard-return' && stepData.position === 'bottom') {
            top = rect.bottom - 56
        }
        if (stepData?.id === 'dashboard-nav' && stepData.position === 'bottom') {
            top = rect.bottom - 56
        }
        left = Math.max(padding, Math.min(left, viewportWidth - cardWidth - padding))
        top = Math.max(padding, Math.min(top, viewportHeight - cardHeight - padding))

        return {
            position: 'fixed',
            left: `${left}px`,
            top: `${top}px`,
            maxWidth: `${cardWidth}px`,
            width: `${cardWidth}px`
        }
    }

    return (
        <>
            {/* Spotlight on target element */}
            {spotRect && (
                <div
                    className="fixed z-[9999] pointer-events-none"
                    style={{
                        top: spotRect.top - 8,
                        left: spotRect.left - 8,
                        width: spotRect.width + 16,
                        height: spotRect.height + 16,
                        border: '3px solid #3490c7',
                        borderRadius: '12px',
                        boxShadow: '0 0 0 4px rgba(52, 144, 199, 0.3), 0 0 30px rgba(52, 144, 199, 0.5)',
                        animation: 'pulse 2s ease-in-out infinite'
                    }}
                />
            )}

            {/* Tutorial card */}
            <div
                className="z-[10000] w-full max-w-sm bg-white rounded-xl shadow-xl p-3 sm:p-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
                style={getCardPosition()}
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="text-xs font-semibold text-[#3490c7] bg-blue-50 px-2 py-1 rounded-full">
                                Passo {currentStep + 1} de {totalSteps}
                            </div>
                        </div>
                        <h3 className="text-base font-bold text-gray-900">{stepData.title}</h3>
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
                <p className="text-gray-600 mb-3 leading-relaxed text-xs">{stepData.description}</p>

                {/* Progress bar */}
                <div className="mb-3">
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
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
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Voltar
                        </button>
                        <button
                            onClick={handleNext}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#3490c7] hover:bg-[#2980b9] text-white font-medium transition-colors shadow-lg shadow-blue-500/30 text-xs"
                        >
                            {isLastStep() ? 'Concluir' : 'Próximo'}
                            {!isLastStep() && <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>

                {/* Keyboard hints */}
                <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-[10px] text-gray-400 text-center">
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
