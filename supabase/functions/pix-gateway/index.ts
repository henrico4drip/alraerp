import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonOk(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Safe JSON fetch helper — prevents "Unexpected end of JSON input"
async function safeFetchJson(url: string, options?: RequestInit): Promise<{ status: number, data: any, rawText: string }> {
  const res = await fetch(url, options);
  const rawText = await res.text();
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }
  return { status: res.status, data, rawText };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, payload } = await req.json();

    switch (action) {
      case 'create_pix': {
        const { gateway, amount, asaas_token, mp_token, description } = payload;
        if (!gateway || gateway === 'none') {
          return jsonOk({ error: 'Gateway invalido' });
        }

        if (gateway === 'mercadopago') {
          if (!mp_token) return jsonOk({ error: "Token do Mercado Pago não configurado." });
          const { status, data: mpJson } = await safeFetchJson("https://api.mercadopago.com/v1/payments", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${mp_token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
            body: JSON.stringify({
              transaction_amount: Number(amount),
              payment_method_id: 'pix',
              description: description || 'Compra ERP',
              payer: { email: "cliente@venda.com.br", first_name: "Cliente", last_name: "Loja" }
            })
          });
          console.log("[PIX-MP] Response:", status, JSON.stringify(mpJson).slice(0, 500));
          if (!mpJson?.id) return jsonOk({ error: mpJson?.message || `Mercado Pago retornou status ${status}: ${JSON.stringify(mpJson)}` });

          return jsonOk({
            txId: String(mpJson.id),
            qrCodePayload: mpJson.point_of_interaction?.transaction_data?.qr_code,
            qrCodeImage: mpJson.point_of_interaction?.transaction_data?.qr_code_base64
              ? "data:image/jpeg;base64," + mpJson.point_of_interaction.transaction_data.qr_code_base64
              : null
          });
        }

        if (gateway === 'asaas') {
          if (!asaas_token) return jsonOk({ error: "Token do ASAAS não configurado." });

          // Try production URL first, then sandbox
          const urls = [
            "https://api.asaas.com/v3",
            "https://sandbox.asaas.com/api/v3"
          ];

          let baseUrl = '';

          for (const url of urls) {
            console.log(`[PIX-ASAAS] Trying base URL: ${url}`);
            const { status, data: testJson, rawText } = await safeFetchJson(`${url}/customers?limit=1`, {
              headers: { 'access_token': asaas_token }
            });
            console.log(`[PIX-ASAAS] Test response (${status}):`, rawText.slice(0, 300));

            if (status === 200 && testJson?.data !== undefined) {
              baseUrl = url;
              break;
            }
          }

          if (!baseUrl) {
            return jsonOk({ error: "Não foi possível conectar ao ASAAS. Verifique se a API Key está correta (produção ou sandbox)." });
          }

          console.log(`[PIX-ASAAS] Using base URL: ${baseUrl}`);

          // Use ASAAS Static QR Code endpoint — generates immediate PIX (NO scheduling)
          // Money goes to ASAAS account, and we get a static QR that expires in 10 min
          const { data: qrJson, rawText: qrRaw, status: qrStatus } = await safeFetchJson(`${baseUrl}/pix/qrCodes/static`, {
            method: "POST",
            headers: { 'access_token': asaas_token, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              value: Number(amount),
              description: description || 'Compra ERP',
              allowsMultiplePayments: false,
              expirationSeconds: 600 // 10 minutes
            })
          });
          console.log("[PIX-ASAAS] Static QR response:", qrStatus, qrRaw.slice(0, 500));

          if (!qrJson?.payload && !qrJson?.encodedImage) {
            const errMsg = qrJson?.errors?.[0]?.description || qrRaw.slice(0, 200) || `Status ${qrStatus}`;
            return jsonOk({ error: `Erro ao gerar QR Code estático ASAAS: ${errMsg}` });
          }

          return jsonOk({
            txId: qrJson.id || null,
            qrCodePayload: qrJson.payload,
            qrCodeImage: qrJson.encodedImage ? "data:image/png;base64," + qrJson.encodedImage : null
          });
        }

        return jsonOk({ error: `Gateway '${gateway}' não suportado.` });
      }

      case 'check_pix_status': {
        const { gateway, txId, asaas_token, mp_token } = payload;
        if (gateway === 'mercadopago') {
          const { data: mpJson } = await safeFetchJson(`https://api.mercadopago.com/v1/payments/${txId}`, {
            headers: { 'Authorization': `Bearer ${mp_token}` }
          });
          const isPaid = mpJson?.status === 'approved';
          return jsonOk({ isPaid, rawStatus: mpJson?.status || 'unknown' });
        }

        if (gateway === 'asaas') {
          const urls = ["https://api.asaas.com/v3", "https://sandbox.asaas.com/api/v3"];
          for (const url of urls) {
            const { status, data: asaasJson } = await safeFetchJson(`${url}/payments/${txId}`, {
              headers: { 'access_token': asaas_token }
            });
            if (status === 200 && asaasJson?.status) {
              const isPaid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(asaasJson.status);
              return jsonOk({ isPaid, rawStatus: asaasJson.status });
            }
          }
          return jsonOk({ isPaid: false, rawStatus: 'UNKNOWN' });
        }
        return jsonOk({ error: 'Gateway desconhecido para check_pix_status' });
      }

      default:
        return jsonOk({ error: 'Ação desconhecida para pix-gateway' });
    }
  } catch (e: any) {
    console.error("[PIX-GATEWAY] Unhandled error:", e);
    return jsonOk({ error: e.message || 'Erro interno no gateway PIX' });
  }
})
