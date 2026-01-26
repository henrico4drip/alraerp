
export class Pix {
    constructor(pixKey, merchantName, merchantCity, amount, txId = '***') {
        this.pixKey = pixKey;
        this.merchantName = merchantName;
        this.merchantCity = merchantCity;
        this.amount = amount;
        this.txId = txId;

        this.ID_PAYLOAD_FORMAT_INDICATOR = '00';
        this.ID_MERCHANT_ACCOUNT_INFORMATION = '26';
        this.ID_MERCHANT_ACCOUNT_INFORMATION_GUI = '00';
        this.ID_MERCHANT_ACCOUNT_INFORMATION_KEY = '01';
        this.ID_MERCHANT_ACCOUNT_INFORMATION_DESCRIPTION = '02';
        this.ID_MERCHANT_CATEGORY_CODE = '52';
        this.ID_TRANSACTION_CURRENCY = '53';
        this.ID_TRANSACTION_AMOUNT = '54';
        this.ID_COUNTRY_CODE = '58';
        this.ID_MERCHANT_NAME = '59';
        this.ID_MERCHANT_CITY = '60';
        this.ID_ADDITIONAL_DATA_FIELD_TEMPLATE = '62';
        this.ID_ADDITIONAL_DATA_FIELD_TEMPLATE_TXID = '05';
        this.ID_CRC16 = '63';
    }


    _getValue(id, value) {
        const size = String(value.length).padStart(2, '0');
        return id + size + value;
    }

    _normalize(str) {
        // Remove accents and convert to uppercase (BR Code standard)
        if (!str) return '';
        return str
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();
    }

    _formatPixKey(key) {
        if (!key) return '';
        const raw = key.toString().trim();

        // Email: contains @
        if (raw.includes('@')) return raw;

        // Random Key (EVP): 32 chars hex or 36 chars with dashes
        // Typically: 123e4567-e89b-12d3-a456-426614174000
        const isEVP = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(raw);
        if (isEVP) return raw;

        // Clean formatting for CPF/CNPJ/Phone
        // Remove spaces, parens, dashes, dots, slashes
        let cleaned = raw.replace(/[ \(\)\-\.\/]/g, '');

        // Phone heuristic: 
        // If original had '(' or started with '+', treat as phone.
        // Or if cleaned is exactly 10 or 11 digits and strictly NOT a valid CPF (hard to check validity here).
        // Safer: checks if original had phone indicators.
        if (/\(/.test(raw) || raw.startsWith('+')) {
            if (!cleaned.startsWith('+')) {
                // Assume Brazil +55 if missing
                return '+55' + cleaned;
            }
            return cleaned;
        }

        return cleaned;
    }

    _getMechantAccountInfo() {
        const gui = this._getValue(this.ID_MERCHANT_ACCOUNT_INFORMATION_GUI, 'br.gov.bcb.pix');
        const key = this._getValue(this.ID_MERCHANT_ACCOUNT_INFORMATION_KEY, this._formatPixKey(this.pixKey));
        // Description is optional, we skip it for simplicity or add empty if needed
        // const desc = this._getValue(this.ID_MERCHANT_ACCOUNT_INFORMATION_DESCRIPTION, ''); 
        return this._getValue(this.ID_MERCHANT_ACCOUNT_INFORMATION, gui + key);
    }

    _getAdditionalDataFieldTemplate() {
        const txid = this._getValue(this.ID_ADDITIONAL_DATA_FIELD_TEMPLATE_TXID, this.txId);
        return this._getValue(this.ID_ADDITIONAL_DATA_FIELD_TEMPLATE, txid);
    }

    getPayload() {
        // Normalize and limit merchant name and city
        const normalizedName = this._normalize(this.merchantName).substring(0, 25);
        const normalizedCity = this._normalize(this.merchantCity).substring(0, 15);

        let payload =
            this._getValue(this.ID_PAYLOAD_FORMAT_INDICATOR, '01') +
            this._getMechantAccountInfo() +
            this._getValue(this.ID_MERCHANT_CATEGORY_CODE, '0000') +
            this._getValue(this.ID_TRANSACTION_CURRENCY, '986') + // BRL
            this._getValue(this.ID_TRANSACTION_AMOUNT, this.amount.toFixed(2)) +
            this._getValue(this.ID_COUNTRY_CODE, 'BR') +
            this._getValue(this.ID_MERCHANT_NAME, normalizedName) +
            this._getValue(this.ID_MERCHANT_CITY, normalizedCity) +
            this._getAdditionalDataFieldTemplate();

        return payload + this._getCRC16(payload);
    }

    _getCRC16(payload) {
        payload += this.ID_CRC16 + '04';

        let polinomio = 0x1021;
        let resultado = 0xFFFF;

        for (let offset = 0; offset < payload.length; offset++) {
            resultado ^= (payload.charCodeAt(offset) << 8);
            for (let bitwise = 0; bitwise < 8; bitwise++) {
                if ((resultado <<= 1) & 0x10000) resultado ^= polinomio;
                resultado &= 0xFFFF;
            }
        }

        return this.ID_CRC16 + '04' + resultado.toString(16).toUpperCase().padStart(4, '0');
    }
}

