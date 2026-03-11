import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Detect if the token is sandbox or production
function asaasBase(token: string): string {
  // Sandbox tokens usually start with $aact_YTU5... and contain sandbox-related patterns
  // but the safest heuristic: if the key has "sandbox" or the user explicitly sets it.
  // For ASAAS, sandbox keys start with $aact_ and are used against sandbox.asaas.com
  // Production keys also start with $aact_. The only reliable way is to try production first.
  // However, many users use sandbox for testing. We'll default to sandbox and let them override.
  // Actually, ASAAS sandbox keys work ONLY on sandbox URL and production keys ONLY on production URL.
  // We'll try both: first production, then sandbox if it fails.
  return "https://api.asaas.com/api/v3"
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, payload } = await req.json();

    switch (action) {
      case 'create_pix': {
        const { gateway, amount, asaas_token, mp_token, description } = payload;
        if (!gateway || gateway === 'none') {
          return new Response(JSON.stringify({ error: 'Gateway invalido' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (gateway === 'mercadopago') {
          if (!mp_token) return jsonOk({ error: "Token do Mercado Pago não configurado." });
          const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${mp_token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
            body: JSON.stringify({
              transaction_amount: Number(amount),
              payment_method_id: 'pix',
              description: description || 'Compra ERP',
              payer: { email: "cliente@venda.com.br", first_name: "Cliente", last_name: "Loja" }
            })
          })
          const mpJson = await mpRes.json();
          console.log("[PIX-MP] Response:", JSON.stringify(mpJson).slice(0, 500));
          if (!mpJson.id) return jsonOk({ error: mpJson.message || JSON.stringify(mpJson.cause || mpJson) });

          return jsonOk({
            txId: String(mpJson.id),
            qrCodePayload: mpJson.point_of_interaction?.transaction_data?.qr_code,
            qrCodeImage: mpJson.point_of_interaction?.transaction_data?.qr_code_base64
              ? "data:image/jpeg;base64," + mpJson.point_of_interaction.transaction_data.qr_code_base64
              : null
          })
        }

        if (gateway === 'asaas') {
          if (!asaas_token) return jsonOk({ error: "Token do ASAAS não configurado." });

          // Try production URL first, then sandbox
          const urls = [
            "https://api.asaas.com/api/v3",
            "https://sandbox.asaas.com/api/v3"
          ];

          let baseUrl = '';
          let customerId = '';

          for (const url of urls) {
            console.log(`[PIX-ASAAS] Trying base URL: ${url}`);
            const testRes = await fetch(`${url}/customers?limit=1`, {
              headers: { 'access_token': asaas_token }
            });
            const testJson = await testRes.json();
            console.log(`[PIX-ASAAS] Test response (${testRes.status}):`, JSON.stringify(testJson).slice(0, 300));

            if (testRes.status === 200 && testJson?.data !== undefined) {
              baseUrl = url;
              break;
            }
          }

          if (!baseUrl) {
            return jsonOk({ error: "Não foi possível conectar ao ASAAS. Verifique se a API Key está correta." });
          }

          console.log(`[PIX-ASAAS] Using base URL: ${baseUrl}`);

          // 1. Search for existing generic customer or create one
          const searchRes = await fetch(`${baseUrl}/customers?name=Cliente ERP Avulso&limit=1`, {
            headers: { 'access_token': asaas_token }
          });
          const searchJson = await searchRes.json();
          console.log("[PIX-ASAAS] Customer search:", JSON.stringify(searchJson).slice(0, 300));

          if (searchJson?.data?.length > 0) {
            customerId = searchJson.data[0].id;
          } else {
            // Create generic customer (without CPF to avoid validation issues)
            const createCus = await fetch(`${baseUrl}/customers`, {
              method: "POST",
              headers: { 'access_token': asaas_token, 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: "Cliente ERP Avulso" })
            })
            const cusJson = await createCus.json();
            console.log("[PIX-ASAAS] Customer create:", JSON.stringify(cusJson).slice(0, 300));
            if (!cusJson.id) {
              const errMsg = cusJson.errors?.[0]?.description || JSON.stringify(cusJson);
              return jsonOk({ error: `Erro ao criar cliente ASAAS: ${errMsg}` });
            }
            customerId = cusJson.id;
          }

          // 2. Create PIX Charge
          const dateDue = new Date();
          dateDue.setDate(dateDue.getDate() + 1);
          const chargeBody = {
            customer: customerId,
            billingType: 'PIX',
            value: Number(amount),
            dueDate: dateDue.toISOString().split('T')[0],
            description: description || 'Compra ERP'
          };
          console.log("[PIX-ASAAS] Creating charge:", JSON.stringify(chargeBody));

          const chargeRes = await fetch(`${baseUrl}/payments`, {
            method: "POST",
            headers: { 'access_token': asaas_token, 'Content-Type': 'application/json' },
            body: JSON.stringify(chargeBody)
          })
          const chargeJson = await chargeRes.json();
          console.log("[PIX-ASAAS] Charge response:", JSON.stringify(chargeJson).slice(0, 500));

          if (!chargeJson.id) {
            const errMsg = chargeJson.errors?.[0]?.description || JSON.stringify(chargeJson);
            return jsonOk({ error: `Erro ao criar cobrança ASAAS: ${errMsg}` });
          }
          const txId = chargeJson.id;

          // 3. Get QR Code (may need a small delay for ASAAS to generate)
          await new Promise(r => setTimeout(r, 1500));

          const qrRes = await fetch(`${baseUrl}/payments/${txId}/pixQrCode`, {
            headers: { 'access_token': asaas_token }
          })
          const qrJson = await qrRes.json();
          console.log("[PIX-ASAAS] QR response:", JSON.stringify(qrJson).slice(0, 500));

          if (!qrJson.payload && !qrJson.encodedImage) {
            return jsonOk({ error: `QR Code ainda não disponível. Tente novamente em alguns segundos. (Status: ${JSON.stringify(qrJson)})` });
          }

          return jsonOk({
            txId: txId,
            qrCodePayload: qrJson.payload,
            qrCodeImage: qrJson.encodedImage ? "data:image/png;base64," + qrJson.encodedImage : null
          })
        }

        return jsonOk({ error: `Gateway '${gateway}' não suportado.` });
      }

      case 'check_pix_status': {
        const { gateway, txId, asaas_token, mp_token } = payload;
        if (gateway === 'mercadopago') {
          const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${txId}`, {
            headers: { 'Authorization': `Bearer ${mp_token}` }
          })
          const mpJson = await mpRes.json();
          const isPaid = mpJson.status === 'approved';
          return jsonOk({ isPaid, rawStatus: mpJson.status })
        }

        if (gateway === 'asaas') {
          // Try both URLs
          const urls = ["https://api.asaas.com/api/v3", "https://sandbox.asaas.com/api/v3"];
          for (const url of urls) {
            const asaasRes = await fetch(`${url}/payments/${txId}`, {
              headers: { 'access_token': asaas_token }
            })
            if (asaasRes.status === 200) {
              const asaasJson = await asaasRes.json();
              const isPaid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(asaasJson.status);
              return jsonOk({ isPaid, rawStatus: asaasJson.status })
            }
          }
          return jsonOk({ isPaid: false, rawStatus: 'UNKNOWN' })
        }
        return jsonOk({ error: 'Gateway desconhecido para check_pix_status' });
      }

      default:
        return jsonOk({ error: 'Ação desconhecida para pix-gateway' })
    }
  } catch (e: any) {
    console.error("[PIX-GATEWAY] Unhandled error:", e);
    // IMPORTANT: Return 200 so supabase.functions.invoke doesn't throw generic error
    // The actual error message is in the JSON body
    return jsonOk({ error: e.message || 'Erro interno no gateway PIX' })
  }
})

function jsonOk(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
  })
}
