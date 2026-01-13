import React from 'react';
import Barcode from 'react-barcode';

// Componente para renderizar uma única etiqueta
// O layout é simples: Nome, Preço e Código de Barras
const LabelComponent = React.forwardRef(({ product, settings, width = '50mm', height = '30mm', parcelas = 0, typeLabel = 'UNIDADE', showPrice = true, showBarcode = true, showNumbers = true }, ref) => {
  const hasPromo = product.promo_price && Number(product.promo_price) > 0 && Number(product.promo_price) < Number(product.price);
  const finalPriceValue = hasPromo ? Number(product.promo_price) : Number(product.price || 0);

  const formattedFinalPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(finalPriceValue);

  const formattedOriginalPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(product.price || 0));

  return (
    <div
      ref={ref}
      className="border border-gray-300 bg-white"
      style={{
        width,
        height,
        padding: '4mm',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        textAlign: 'center',
        fontSize: '8px',
        overflow: 'hidden',
        pageBreakAfter: 'always',
      }}
    >

      {/* Meio: Nome e Preços */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '2mm', marginBottom: '1mm' }}>
        <div style={{ textAlign: 'left', maxWidth: '60%' }}>
          <div style={{ fontWeight: 'bold', fontSize: '9px', lineHeight: '1.2' }}>
            {(product.name || 'PRODUTO').toUpperCase()}
          </div>
          {product.category && (
            <div style={{ fontSize: '7px', color: '#666', marginTop: '1px' }}>
              {product.category.toUpperCase()}
            </div>
          )}
        </div>

        {showPrice && (
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {hasPromo && (
              <div style={{ fontSize: '8px', color: '#999', textDecoration: 'line-through', lineHeight: '1' }}>
                {formattedOriginalPrice}
              </div>
            )}
            <div style={{ fontSize: '13px', fontWeight: '800', lineHeight: '1', color: '#000' }}>
              {formattedFinalPrice}
            </div>
            {parcelas > 1 && (() => {
              const perInstallment = finalPriceValue / parcelas
              const formattedInstallment = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(perInstallment)
              return <div style={{ fontSize: '8px', fontWeight: '500', marginTop: '1px' }}>{parcelas}x {formattedInstallment}</div>
            })()}
          </div>
        )}
      </div>

      {/* Logo Centralizada (baixo do nome e categoria) */}
      {settings?.logo_url && (
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '1mm' }}>
          <img
            src={settings.logo_url}
            alt="Logo"
            style={{ height: '20px', maxWidth: '80%', objectFit: 'contain' }}
          />
        </div>
      )}

      {/* Código de Barras */}
      {showBarcode && (
        product.barcode ? (
          <Barcode
            value={product.barcode}
            format="CODE128"
            width={0.8}
            height={18}
            displayValue={showNumbers}
            fontSize={7}
            textMargin={0}
            margin={0}
            marginTop={1}
            renderer="svg"
          />
        ) : (
          <div style={{ color: 'red', fontSize: '7px', fontWeight: 'bold' }}>SEM CÓDIGO</div>
        )
      )}
    </div>
  );
});

export default LabelComponent;
