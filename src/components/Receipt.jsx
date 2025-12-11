import React from "react";

export default function Receipt({ sale, settings }) {
  if (!sale) return null;

  const items = Array.isArray(sale.items) ? sale.items : [];
  const itemsTotal = items.reduce((s, it) => s + (it.total_price || (it.unit_price || 0) * (it.quantity || 0)), 0);
  const discount = Number(sale.discount_amount || 0);
  const cashbackUsed = Number(sale.cashback_used || 0);
  const finalTotal = Number((sale.total_amount || itemsTotal) - discount - cashbackUsed);
  const payments = Array.isArray(sale.payments) ? sale.payments : [];
  const cashbackPercent = Number(settings?.cashback_percentage || 0);
  const cashbackEarned = Number(sale.cashback_earned ?? ((sale.total_amount || itemsTotal) * cashbackPercent / 100));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 text-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold">COMPROVANTE</span>
        {/* Espaço reservado para ações de UI externas (tamanho/fechar) se necessário */}
      </div>

      {/* Logo topo */}
      {settings?.logo_url ? (
        <img
          src={settings.logo_url}
          alt="Logo"
          className="h-14 mx-auto object-contain mb-2"
        />
      ) : (
        <div className="text-center mb-2 font-semibold">{(settings?.erp_name || "Minha Loja").toUpperCase()}</div>
      )}

      {/* Identificação */}
      <div className="text-xs leading-relaxed font-mono">
        <div className="mb-1">{settings?.erp_name || "Minha Loja"}</div>
        <div className="mb-1">Venda Nº: {sale.sale_number || "-"}</div>
        <div className="mb-2">{new Date(sale.sale_date).toLocaleString()} • NAO FISCAL</div>
        <div className="border-t border-gray-200 my-2" />
        <div className="grid grid-cols-3 text-[11px] font-semibold">
          <div>PRODUTO</div>
          <div className="text-right">QUANT</div>
          <div className="text-right">TOTAL</div>
        </div>
        <div className="border-t border-dotted border-gray-300 my-1" />
        {/* Itens */}
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx}>
              <div className="text-[12px]">{item.name || item.product_name || item.product_id}</div>
              <div className="text-[12px] text-gray-700 flex justify-between">
                <span>
                  {Number(item.quantity || 0)} x {Number(item.unit_price || 0).toFixed(2)}/UN
                </span>
                <span className="font-medium">=
                  {" "}R$ {Number(item.total_price || (item.unit_price || 0) * (item.quantity || 0)).toFixed(2)}
                </span>
              </div>
              <div className="border-t border-dotted border-gray-300 my-1" />
            </div>
          ))}
        </div>

        {/* Totais */}
        <div className="mt-2 space-y-1">
          <div className="flex justify-between">
            <span>TOTAL (ITENS)</span>
            <span>R$ {Number(itemsTotal).toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between">
              <span>DESCONTO</span>
              <span>- R$ {discount.toFixed(2)}</span>
            </div>
          )}
          {cashbackUsed > 0 && (
            <div className="flex justify-between">
              <span>CASHBACK USADO</span>
              <span>- R$ {cashbackUsed.toFixed(2)}</span>
            </div>
          )}
          {cashbackEarned > 0 && (
            <div className="flex justify-between">
              <span>CASHBACK GANHO</span>
              <span className="text-emerald-700 font-medium">+ R$ {cashbackEarned.toFixed(2)}</span>
            </div>
          )}
          <div className="border-t border-gray-200 my-1" />
          <div className="flex justify-between font-semibold">
            <span>VALOR FINAL</span>
            <span>R$ {finalTotal.toFixed(2)}</span>
          </div>
          {payments.length > 0 && (
            <div className="mt-1">
              {payments.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span>{p.method}{(p.installments || 1) > 1 ? ` ${p.installments}x` : ''}:</span>
                  <span>R$ {Number(p.amount || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="border-t border-gray-200 mt-2 pt-2 text-[11px] text-center">
          Obrigado pela preferência!
        </div>
      </div>
    </div>
  );
}
