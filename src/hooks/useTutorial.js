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
        title: 'Acesse as Configurações',
        description: 'Clique no ícone de engrenagem no menu lateral para acessar as configurações da sua loja.',
        target: '[data-tutorial="settings-link"]',
        position: 'right',
        action: null,
        waitForClick: true
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
        description: 'Clique em "Estoque" no menu lateral para acessar o gerenciamento de produtos.',
        target: '[data-tutorial="inventory-link"]',
        position: 'right',
        action: null,
        waitForClick: true
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
        description: 'Clique em "Clientes" no menu lateral para acessar o cadastro de clientes.',
        target: '[data-tutorial="customers-link"]',
        position: 'right',
        action: null,
        waitForClick: true
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
        description: 'Clique em "Caixa" no menu lateral para acessar o ponto de venda.',
        target: '[data-tutorial="cashier-link"]',
        position: 'right',
        action: null,
        waitForClick: true
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
        id: 'payments-nav',
        page: 'Cashier',
        title: 'Gerencie Pagamentos',
        description: 'Clique em "Pagamentos" no menu lateral para acessar o gerenciamento de pagamentos.',
        target: '[data-tutorial="payments-link"]',
        position: 'right',
        action: null,
        waitForClick: true
    },
    {
        id: 'payment-features',
        page: 'Payments',
        title: 'Recursos de Pagamento',
        description: 'Aqui você gera QR codes PIX, envia lembretes por WhatsApp e acompanha o status de cada parcela.',
        target: '[data-tutorial="payments-main"]',
        position: 'top',
        action: null
    },
    {
        id: 'dashboard-nav',
        page: 'Payments',
        title: 'Veja seus Resultados',
        description: 'Clique em "Dashboard" no menu lateral para ver suas métricas e relatórios.',
        target: '[data-tutorial="dashboard-link"]',
        position: 'right',
        action: null,
        waitForClick: true
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
