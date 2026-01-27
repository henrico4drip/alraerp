export class Pix {
    private pixKey: string;
    private merchantName: string;
    private merchantCity: string;
    private amount: number;
    private txId: string;

    constructor(
        pixKey: string,
        merchantName: string,
        merchantCity: string,
        amount: number,
        txId: string = '***'
    ) {
        this.pixKey = pixKey;
        this.merchantName = merchantName;
        this.merchantCity = merchantCity;
        this.amount = amount;
        this.txId = txId || '***';
    }

    private formatLength(value: string): string {
        return value.length.toString().padStart(2, '0');
    }

    private crc16(payload: string): string {
        payload += '6304';
        let polynomial = 0x1021;
        let crc = 0xffff;

        for (let i = 0; i < payload.length; i++) {
            crc ^= payload.charCodeAt(i) << 8;
            for (let j = 0; j < 8; j++) {
                if ((crc & 0x8000) !== 0) {
                    crc = (crc << 1) ^ polynomial;
                } else {
                    crc = crc << 1;
                }
            }
        }

        return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
    }

    public getPayload(): string {
        const payloadKey = '00020126';
        const merchantAccountInfo = `0014BR.GOV.BCB.PIX01${this.formatLength(this.pixKey)}${this.pixKey}`;
        const merchantAccountInfoLen = this.formatLength(merchantAccountInfo);

        // Merchant Category Code (0000 = Not def)
        const mcc = '52040000';
        // Transaction Currency (986 = BRL)
        const currency = '5303986';
        // Amount
        const amountStr = this.amount.toFixed(2);
        const transactionAmount = `54${this.formatLength(amountStr)}${amountStr}`;

        // Country Code
        const country = '5802BR';
        // Merchant Name
        const name = this.merchantName.substring(0, 25);
        const merchantNameField = `59${this.formatLength(name)}${name}`;
        // Merchant City
        const city = this.merchantCity.substring(0, 15);
        const merchantCityField = `60${this.formatLength(city)}${city}`;

        // Additional Data Field Template (TxID)
        const txIdField = `05${this.formatLength(this.txId)}${this.txId}`;
        const additionalDataField = `62${this.formatLength(txIdField)}${txIdField}`;

        let payload = `${payloadKey}${merchantAccountInfoLen}${merchantAccountInfo}${mcc}${currency}${transactionAmount}${country}${merchantNameField}${merchantCityField}${additionalDataField}`;

        payload += this.crc16(payload);

        return payload;
    }
}
