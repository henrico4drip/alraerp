/**
 * InfinitePay Integration Helper
 * Handles InfiniteTap deeplink integration for card payments
 */

/**
 * Generate InfiniteTap deeplink for payment
 * @param {Object} paymentData - Payment information
 * @param {number} paymentData.amount - Amount in BRL (e.g., 100.50)
 * @param {string} paymentData.orderId - Unique order identifier
 * @param {string} paymentData.customerName - Customer name (optional)
 * @param {string} paymentData.description - Payment description (optional)
 * @returns {string} InfiniteTap deeplink URL
 */
export function generateInfiniteTapLink(paymentData) {
    const { amount, orderId, customerName, description } = paymentData

    // Format amount to cents (InfinitePay uses cents)
    const amountInCents = Math.round(amount * 100)

    // Build deeplink URL
    const baseUrl = 'infinitepay://payment'
    const params = new URLSearchParams({
        amount: amountInCents.toString(),
        order_id: orderId,
        ...(customerName && { customer_name: customerName }),
        ...(description && { description: description }),
        // Return URL for callback
        return_url: `${window.location.origin}/payment-callback`
    })

    return `${baseUrl}?${params.toString()}`
}

/**
 * Open InfiniteTap app for payment
 * @param {Object} paymentData - Payment information
 * @returns {Promise<boolean>} True if app opened successfully
 */
export async function openInfiniteTap(paymentData) {
    try {
        const deeplink = generateInfiniteTapLink(paymentData)

        // Store payment data in sessionStorage for callback
        sessionStorage.setItem('pending_payment', JSON.stringify({
            orderId: paymentData.orderId,
            amount: paymentData.amount,
            timestamp: new Date().toISOString()
        }))

        // Try to open the app
        window.location.href = deeplink

        // Wait a bit to see if app opened
        await new Promise(resolve => setTimeout(resolve, 1000))

        return true
    } catch (error) {
        console.error('Error opening InfiniteTap:', error)
        return false
    }
}

/**
 * Check if InfinitePay app is installed
 * This is a best-effort check, not 100% reliable
 */
export function checkInfinitePayInstalled() {
    // On mobile browsers, we can try to detect if the deeplink works
    // This is not perfect but gives a hint
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            // If we're still here after 2s, app probably not installed
            resolve(false)
        }, 2000)

        // Try to open a minimal deeplink
        const testLink = 'infinitepay://check'
        window.location.href = testLink

        // If app opens, page will blur
        window.addEventListener('blur', () => {
            clearTimeout(timeout)
            resolve(true)
        }, { once: true })
    })
}

/**
 * Parse payment callback from InfinitePay
 * @param {URLSearchParams} params - URL search params from callback
 * @returns {Object} Parsed payment result
 */
export function parsePaymentCallback(params) {
    const status = params.get('status') // 'approved', 'declined', 'cancelled'
    const transactionId = params.get('transaction_id')
    const orderId = params.get('order_id')
    const amount = params.get('amount')
    const errorMessage = params.get('error_message')

    return {
        status,
        transactionId,
        orderId,
        amount: amount ? parseFloat(amount) / 100 : null, // Convert cents to BRL
        errorMessage,
        isApproved: status === 'approved',
        isDeclined: status === 'declined',
        isCancelled: status === 'cancelled'
    }
}

/**
 * Get pending payment from sessionStorage
 * @returns {Object|null} Pending payment data
 */
export function getPendingPayment() {
    try {
        const data = sessionStorage.getItem('pending_payment')
        return data ? JSON.parse(data) : null
    } catch {
        return null
    }
}

/**
 * Clear pending payment from sessionStorage
 */
export function clearPendingPayment() {
    sessionStorage.removeItem('pending_payment')
}
