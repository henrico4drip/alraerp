import { useState, useEffect } from 'react'

export const tutorialSteps = [
    {
        id: 'welcome',
        page: 'Dashboard',
        title: 'Bem-vindo ao AlraERP+! 🎉',
        description: 'Vamos configurar sua loja em poucos minutos. Este tutorial vai te guiar pelas principais funcionalidades.',
        target: null,
        position: 'center',
        action: null
    },
    {
        id: 'settings-nav',
        page: 'Dashboard',
        title: 'Perfil de Administrador',
        description: 'Você está no perfil Admin (por isso a inicial "A" no botão acima). O sistema permite vários usuários! Clique nesse botão e vá em "Configurações" para ajustar sua loja.',
        target: '[data-tutorial="profile-menu-btn"]',
        position: 'left',
        action: 'navigate-settings'
    },
    {
        id: 'store-name',
        page: 'Settings',
        title: 'Configure sua Loja',
        description: 'Preencha o nome da sua loja, informações de contato e configure sua chave PIX para receber pagamentos.',
        target: '[data-tutorial="store-settings"]',
        position: 'bottom',
        action: null
    },
    {
        id: 'cashback-config',
        page: 'Settings',
        title: 'Ative o Cashback',
        description: 'Configure a porcentagem de cashback que seus clientes ganham. Isso aumenta a fidelização!',
        target: '[data-tutorial="cashback-settings"]',
        position: 'bottom',
        action: null
    },
    {
        id: 'inventory-nav',
        page: 'Settings',
        title: 'Vamos Cadastrar Produtos',
        description: 'Agora vamos adicionar produtos. Toque em ESTOQUE no rodapé.',
        target: '[data-tutorial="inventory-bottom-link"]',
        position: 'top',
        action: 'navigate-inventory'
    },
    {
        id: 'add-product',
        page: 'Inventory',
        title: 'Adicione seu Primeiro Produto',
        description: 'Clique em "Novo Produto" para cadastrar. Você pode adicionar nome, preço, código de barras e estoque.',
        target: '[data-tutorial="new-product-btn"]',
        position: 'bottom',
        action: null
    },
    {
        id: 'customers-nav',
        page: 'Inventory',
        title: 'Cadastre seus Clientes',
        description: 'Toque em CLIENTES no rodapé para registrar clientes.',
        target: '[data-tutorial="customers-bottom-link"]',
        position: 'top',
        action: 'navigate-customers'
    },
    {
        id: 'add-customer',
        page: 'Customers',
        title: 'Adicione um Cliente',
        description: 'Clique em "Novo Cliente" e adicione nome, telefone e email. O sistema rastreará automaticamente o cashback.',
        target: '[data-tutorial="new-customer-btn"]',
        position: 'bottom',
        action: null
    },
    {
        id: 'cashier-nav',
        page: 'Customers',
        title: 'Hora de Vender!',
        description: 'Vamos fazer sua primeira venda. Toque em CAIXA no rodapé.',
        target: '[data-tutorial="cashier-bottom-link"]',
        position: 'top',
        action: 'navigate-cashier'
    },
    {
        id: 'make-sale',
        page: 'Cashier',
        title: 'Realize uma Venda',
        description: 'Busque produtos, adicione ao carrinho, selecione o cliente e escolha a forma de pagamento. Simples assim!',
        target: '[data-tutorial="cashier-main"]',
        position: 'top',
        action: null
    },
    {
        id: 'dashboard-return',
        page: 'Dashboard',
        title: 'Voltar ao Dashboard',
        description: 'Clique no logo da alra ou no nome da sua loja para voltar.',
        target: '[data-tutorial="dashboard-link"], [data-tutorial="dashboard-logo"]',
        position: 'bottom',
        action: null
    },
    {
        id: 'dashboard-payments-button',
        page: 'Dashboard',
        title: 'Abrir Pagamentos pela Dashboard',
        description: 'Agora toque no botão PAGAMENTOS ao centro para seguir.',
        target: '[data-tutorial="dashboard-payments-button"]',
        position: 'bottom',
        action: 'navigate-payments'
    },
    {
        id: 'payment-features',
        page: 'Payments',
        title: 'Recursos de Pagamento',
        description: 'Gere QR PIX, envie cobrança por WhatsApp, edite/exclua parcelas, abata pagamentos e baixe PDF/HTML dos boletos.',
        target: '[data-tutorial="payments-main"]',
        position: 'top',
        action: null
    },
    {
        id: 'dashboard-metrics',
        page: 'Dashboard',
        title: 'Acompanhe suas Métricas',
        description: 'Toque no botão FATURAMENTO para ver indicadores e relatórios do seu negócio.',
        target: '[data-tutorial="dashboard-billing-button"]',
        position: 'bottom',
        action: 'navigate-dashboard'
    },
    {
        id: 'dashboard-nav',
        page: 'Payments',
        title: 'Veja seus Resultados',
        description: 'Por fim, acompanhe suas métricas no Dashboard. Clique no logo da alra ou no nome da sua loja.',
        target: '[data-tutorial="dashboard-link"]',
        position: 'bottom',
        action: 'navigate-dashboard'
    },
    {
        id: 'complete',
        page: 'Dashboard',
        title: 'Tutorial Completo! 🎊',
        description: 'Você já conhece todas as funcionalidades principais. Explore à vontade e boa sorte com suas vendas!',
        target: null,
        position: 'center',
        action: null
    }
]

export function useTutorial() {
    const [isActive, setIsActive] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)
    const [completedSteps, setCompletedSteps] = useState([])

    // Load tutorial state from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('tutorial_progress')
            if (saved) {
                const data = JSON.parse(saved)
                setCurrentStep(data.currentStep || 0)
                setCompletedSteps(data.completedSteps || [])
                setIsActive(data.isActive || false)
            } else {
                // Check if user is new (no onboarding completed)
                const onboardingDone = localStorage.getItem('onboarding_completed') === 'true'
                const tutorialDone = localStorage.getItem('tutorial_completed') === 'true'
                if (!onboardingDone && !tutorialDone) {
                    setIsActive(true)
                }
            }
        } catch (err) {
            console.error('Error loading tutorial state:', err)
        }
    }, [])

    // Save tutorial state to localStorage
    const saveState = (step, completed, active) => {
        try {
            localStorage.setItem('tutorial_progress', JSON.stringify({
                currentStep: step,
                completedSteps: completed,
                isActive: active,
                lastUpdated: new Date().toISOString()
            }))
        } catch (err) {
            console.error('Error saving tutorial state:', err)
        }
    }

    const startTutorial = () => {
        setIsActive(true)
        setCurrentStep(0)
        setCompletedSteps([])
        saveState(0, [], true)
    }

    const nextStep = () => {
        const next = currentStep + 1
        const newCompleted = [...completedSteps, currentStep]
        setCurrentStep(next)
        setCompletedSteps(newCompleted)
        saveState(next, newCompleted, true)
    }

    const previousStep = () => {
        const prev = Math.max(0, currentStep - 1)
        setCurrentStep(prev)
        saveState(prev, completedSteps, true)
    }

    const skipTutorial = () => {
        setIsActive(false)
        try {
            localStorage.setItem('tutorial_completed', 'true')
            localStorage.removeItem('tutorial_progress')
        } catch (err) {
            console.error('Error skipping tutorial:', err)
        }
    }

    const completeTutorial = () => {
        setIsActive(false)
        try {
            localStorage.setItem('tutorial_completed', 'true')
            localStorage.setItem('onboarding_completed', 'true')
            localStorage.removeItem('tutorial_progress')
        } catch (err) {
            console.error('Error completing tutorial:', err)
        }
    }

    const restartTutorial = () => {
        try {
            localStorage.removeItem('tutorial_completed')
            localStorage.removeItem('tutorial_progress')
        } catch (err) {
            console.error('Error restarting tutorial:', err)
        }
        startTutorial()
    }

    const getCurrentStepData = () => {
        return tutorialSteps[currentStep] || null
    }

    const isLastStep = () => {
        return currentStep >= tutorialSteps.length - 1
    }

    const isFirstStep = () => {
        return currentStep === 0
    }

    return {
        isActive,
        currentStep,
        completedSteps,
        totalSteps: tutorialSteps.length,
        startTutorial,
        nextStep,
        previousStep,
        skipTutorial,
        completeTutorial,
        restartTutorial,
        getCurrentStepData,
        isLastStep,
        isFirstStep
    }
}
