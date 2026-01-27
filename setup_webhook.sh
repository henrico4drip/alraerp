#!/bin/bash

# Configurações
EVO_URL="http://84.247.143.180:8080"
API_KEY="Henrico9516"
INSTANCE="erp_ef3bd9b9"
WEBHOOK_URL="https://greotjobqprtmrprptdb.supabase.co/functions/v1/whatsapp-proxy"

echo "Configurando Webhook (v2) para instância $INSTANCE..."

# 1. Habilitar Webhook (Formato v2)
curl -X POST "$EVO_URL/webhook/set/$INSTANCE" \
  -H "apikey: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"webhook\": {
      \"enabled\": true,
      \"url\": \"$WEBHOOK_URL\",
      \"byEvents\": false,
      \"events\": [
        \"MESSAGES_UPSERT\",
        \"MESSAGES_UPDATE\",
        \"SEND_MESSAGE\"
      ]
    }
  }"

echo -e "\n\nWebhook configurado com sucesso!"
