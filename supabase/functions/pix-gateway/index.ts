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

      case 'create_carne': {
        const { asaas_token, customer_name, customer_cpf, amount, installments, first_due_days, description, billing_type } = payload;
        if (!asaas_token) return jsonOk({ error: "Token do ASAAS não configurado." });

        // Detect base URL
        const urls = ["https://api.asaas.com/v3", "https://sandbox.asaas.com/api/v3"];
        let baseUrl = '';
        for (const url of urls) {
          const { status, data: testJson } = await safeFetchJson(`${url}/customers?limit=1`, {
            headers: { 'access_token': asaas_token }
          });
          if (status === 200 && testJson?.data !== undefined) { baseUrl = url; break; }
        }
        if (!baseUrl) return jsonOk({ error: "Não foi possível conectar ao ASAAS." });

        // Find or create customer
        let customerId = '';
        const cpfClean = (customer_cpf || '').replace(/\D/g, '');
        const nameClean = (customer_name || '').trim();

        console.log(`[CARNE-ASAAS] Identifying customer. Name: "${nameClean}", CPF: "${cpfClean}"`);

        if (cpfClean && cpfClean.length >= 11) {
          console.log(`[CARNE-ASAAS] Searching by CPF: ${cpfClean}`);
          const { data: searchJson } = await safeFetchJson(`${baseUrl}/customers?cpfCnpj=${cpfClean}&limit=1`, {
            headers: { 'access_token': asaas_token }
          });
          if (searchJson?.data?.length > 0) {
            customerId = searchJson.data[0].id;
            console.log(`[CARNE-ASAAS] Found by CPF: ${customerId} (${searchJson.data[0].name})`);
          }
        }

        if (!customerId && nameClean && nameClean.length > 2 && nameClean.toLowerCase() !== 'null') {
          console.log(`[CARNE-ASAAS] Searching by Name: "${nameClean}"`);
          const { data: searchByName } = await safeFetchJson(`${baseUrl}/customers?name=${encodeURIComponent(nameClean)}&limit=5`, {
            headers: { 'access_token': asaas_token }
          });
          if (searchByName?.data?.length > 0) {
            // Try to find a better match in the first 5 results
            const matches = searchByName.data.filter((c: any) =>
              c.name.toLowerCase().includes(nameClean.toLowerCase()) ||
              nameClean.toLowerCase().includes(c.name.toLowerCase())
            );

            if (matches.length > 0) {
              customerId = matches[0].id;
              console.log(`[CARNE-ASAAS] Match found in results: ${customerId} ("${matches[0].name}")`);
            } else {
              console.log(`[CARNE-ASAAS] Search returned results but none matched "${nameClean}" sufficiently.`);
            }
          }
        }

        if (!customerId) {
          console.log(`[CARNE-ASAAS] Customer not found. Creating new: "${nameClean || 'Cliente ERP'}"`);
          // Create customer
          const cusBody: any = { name: nameClean || 'Cliente ERP' };
          if (cpfClean && cpfClean.length >= 11) cusBody.cpfCnpj = cpfClean;
          const { data: cusJson, rawText: cusRaw } = await safeFetchJson(`${baseUrl}/customers`, {
            method: "POST",
            headers: { 'access_token': asaas_token, 'Content-Type': 'application/json' },
            body: JSON.stringify(cusBody)
          });
          if (!cusJson?.id) {
            console.error(`[CARNE-ASAAS] Failed to create customer:`, cusRaw);
            return jsonOk({ error: `Erro ao criar cliente ASAAS: ${cusJson?.errors?.[0]?.description || 'Erro operacional no ASAAS'}` });
          }
          customerId = cusJson.id;
          console.log(`[CARNE-ASAAS] Created new customer: ${customerId}`);
        }

        console.log(`[CARNE-ASAAS] Final Customer ID: ${customerId}. Amount: ${amount}, Installments: ${installments}`);

        // Create installment payment
        const installmentCount = Number(installments || 1);
        const totalAmount = Number(amount);
        const perInstallment = Number((totalAmount / installmentCount).toFixed(2));
        const firstDueDays = Number(first_due_days || 30);

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + firstDueDays);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        const chargeBody: any = {
          customer: customerId,
          billingType: billing_type || 'PIX',
          value: totalAmount,
          dueDate: dueDateStr,
          description: description || 'Carnê ERP',
          interest: { value: 0 },
          fine: { value: 0 },
        };

        if (installmentCount > 1) {
          chargeBody.installmentCount = installmentCount;
          chargeBody.installmentValue = perInstallment;
          console.log(`[CARNE-ASAAS] Multiple installments: ${installmentCount}x of ${perInstallment}`);
        } else {
          console.log(`[CARNE-ASAAS] Single payment: ${totalAmount}`);
        }

        console.log("[CARNE-ASAAS] Creating charge with body:", JSON.stringify(chargeBody));

        const { data: chargeJson, rawText: chargeRaw, status: chargeStatus } = await safeFetchJson(`${baseUrl}/payments`, {
          method: "POST",
          headers: { 'access_token': asaas_token, 'Content-Type': 'application/json' },
          body: JSON.stringify(chargeBody)
        });
        console.log("[CARNE-ASAAS] Response status:", chargeStatus, "Body summary:", chargeRaw.slice(0, 500));

        if (!chargeJson?.id && !chargeJson?.installment) {
          const errMsg = chargeJson?.errors?.[0]?.description || chargeRaw.slice(0, 200);
          console.error(`[CARNE-ASAAS] ASAAS error: ${errMsg}`);
          return jsonOk({ error: `Erro no ASAAS: ${errMsg}` });
        }

        return jsonOk({
          success: true,
          installmentId: chargeJson.installment || null,
          firstPaymentId: chargeJson.id || (chargeJson.payments && chargeJson.payments[0]?.id),
          installmentCount,
          perInstallment,
          dueDate: dueDateStr,
          customerAsaasId: customerId
        });
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
          // For static QR codes, txId is the QR code ID (e.g. "4493471700000609423626ASA")
          // When paid, ASAAS creates a payment with pixQrCodeId matching this ID
          const urls = ["https://api.asaas.com/v3", "https://sandbox.asaas.com/api/v3"];
          for (const url of urls) {
            const { status, data: listJson } = await safeFetchJson(
              `${url}/payments?pixQrCodeId=${encodeURIComponent(txId)}&limit=1`, {
              headers: { 'access_token': asaas_token }
            });
            if (status === 200 && listJson?.data?.length > 0) {
              const payment = listJson.data[0];
              const isPaid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(payment.status);
              console.log(`[PIX-ASAAS] Check status for QR ${txId}: ${payment.status} (isPaid: ${isPaid})`);
              return jsonOk({ isPaid, rawStatus: payment.status });
            }
          }
          // No payment found yet for this QR code
          return jsonOk({ isPaid: false, rawStatus: 'PENDING' });
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
