import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, payload } = await req.json();

    switch (action) {
      case 'create_pix': {
        const { gateway, amount, asaas_token, mp_token, description } = payload;
        if (!gateway || gateway === 'none') {
          return new Response(JSON.stringify({ error: 'Gateway invalido' }), { status: 400, headers: corsHeaders });
        }

        if (gateway === 'mercadopago') {
          if (!mp_token) throw new Error("Token do Mercado Pago não configurado.");
          const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${mp_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transaction_amount: Number(amount),
              payment_method_id: 'pix',
              description: description || 'Compra ERP',
              payer: {
                email: "cliente@venda.com.br",
                first_name: "Cliente",
                last_name: "Loja"
              }
            })
          })
          const mpJson = await mpRes.json();
          if (!mpJson.id) throw new Error(mpJson.message || 'Erro ao gerar PIX no Mercado Pago');

          return new Response(JSON.stringify({
            txId: mpJson.id,
            qrCodePayload: mpJson.point_of_interaction?.transaction_data?.qr_code,
            qrCodeImage: "data:image/jpeg;base64," + mpJson.point_of_interaction?.transaction_data?.qr_code_base64
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (gateway === 'asaas') {
          if (!asaas_token) throw new Error("Token do ASAAS não configurado.");
          // 1. Get/Create Generic Customer for cash sales
          const searchRes = await fetch("https://api.asaas.com/v3/customers?cpfCnpj=00000000000", {
            headers: { 'access_token': asaas_token }
          });
          const searchJson = await searchRes.json();
          let customerId = '';
          if (searchJson?.data?.length > 0) {
            customerId = searchJson.data[0].id;
          } else {
            const createCus = await fetch("https://api.asaas.com/v3/customers", {
              method: "POST",
              headers: { 'access_token': asaas_token, 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: "Cliente ERP Avulso", cpfCnpj: "00000000000" })
            })
            const cusJson = await createCus.json();
            if (!cusJson.id) throw new Error(cusJson.errors?.[0]?.description || 'Erro ao criar cliente no ASAAS')
            customerId = cusJson.id;
          }

          // 2. Create Charge
          const dateDue = new Date();
          dateDue.setDate(dateDue.getDate() + 1);
          const chargeRes = await fetch("https://api.asaas.com/v3/payments", {
            method: "POST",
            headers: { 'access_token': asaas_token, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer: customerId,
              billingType: 'PIX',
              value: Number(amount),
              dueDate: dateDue.toISOString().split('T')[0],
              description: description || 'Compra ERP'
            })
          })
          const chargeJson = await chargeRes.json();
          if (!chargeJson.id) throw new Error(chargeJson.errors?.[0]?.description || 'Erro ao criar cobranca ASAAS');
          const txId = chargeJson.id;

          // 3. Get QR Code
          const qrRes = await fetch(`https://api.asaas.com/v3/payments/${txId}/pixQrCode`, {
            headers: { 'access_token': asaas_token }
          })
          const qrJson = await qrRes.json();
          if (!qrJson.payload) throw new Error('Falha ao extrair carga do QR ASAAS');

          return new Response(JSON.stringify({
            txId: txId,
            qrCodePayload: qrJson.payload,
            qrCodeImage: "data:image/png;base64," + qrJson.encodedImage
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        break;
      }

      case 'check_pix_status': {
        const { gateway, txId, asaas_token, mp_token } = payload;
        if (gateway === 'mercadopago') {
          const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${txId}`, {
            headers: { 'Authorization': `Bearer ${mp_token}` }
          })
          const mpJson = await mpRes.json();
          const isPaid = mpJson.status === 'approved';
          return new Response(JSON.stringify({ isPaid, rawStatus: mpJson.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (gateway === 'asaas') {
          const asaasRes = await fetch(`https://api.asaas.com/v3/payments/${txId}`, {
            headers: { 'access_token': asaas_token }
          })
          const asaasJson = await asaasRes.json();
          const isPaid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(asaasJson.status);
          return new Response(JSON.stringify({ isPaid, rawStatus: asaasJson.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Acao JWT desconhecida para PIX' }), { status: 400, headers: corsHeaders })
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})
