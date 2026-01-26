import React from 'react';
import Barcode from 'react-barcode';

// Componente para renderizar uma única etiqueta
// O layout é simples: Logo, Nome, Preço e Código de Barras
const LabelComponent = React.forwardRef(({ product, settings, width = '50mm', height = '30mm', parcelas = 0, typeLabel = 'UNIDADE', showPrice = true, showBarcode = true, showNumbers = true, margins = { top: 2, right: 2, bottom: 2, left: 2 } }, ref) => {
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
      className="bg-white"
      style={{
        width,
        height,
        padding: `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        textAlign: 'center',
        fontSize: '8px',
        pageBreakAfter: 'always',
        border: '1px solid #f0f0f0',
        boxSizing: 'border-box'
      }}
    >
      {/* Cabeçalho: logo, nome e preço */}
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2mm' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '2mm', maxWidth: '65%' }}>
            {settings?.logo_url && (
              <img
                src={settings.logo_url}
                alt="Logo"
                style={{
                  maxWidth: '28px',
                  maxHeight: '28px',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: '4px',
                  flexShrink: 0
                }}
              />
            )}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 'bold', fontSize: '10px', lineHeight: '1.2', display: 'block' }}>
                {(product.name || 'PRODUTO').toUpperCase()}
              </div>
              {product.category && (
                <div style={{ fontSize: '7px', color: '#666', marginTop: '1px' }}>
                  {product.category.toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {showPrice && (
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
              {hasPromo && (
                <div style={{ fontSize: '9px', color: '#999', textDecoration: 'line-through', lineHeight: '1' }}>
                  {formattedOriginalPrice}
                </div>
              )}
              <div style={{ fontSize: '15px', fontWeight: '800', lineHeight: '1.1', color: '#000' }}>
                {formattedFinalPrice}
              </div>
              {parcelas > 1 && (() => {
                const perInstallment = finalPriceValue / parcelas
                const formattedInstallment = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(perInstallment)
                return <div style={{ fontSize: '9px', fontWeight: '500', marginTop: '1px' }}>{parcelas}x {formattedInstallment}</div>
              })()}
              <div style={{ fontSize: '7px', color: '#777', marginTop: '1px' }}>{typeLabel}</div>
            </div>
          )}
        </div>
      </div>


      {/* Código de Barras */}
      {showBarcode && (
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '0 4mm', backgroundColor: 'white' }}>
          {product.barcode ? (
            <Barcode
              value={product.barcode}
              format="CODE128"
              width={1.5}
              height={55}
              displayValue={showNumbers}
              fontSize={10}
              textMargin={2}
              margin={0}
              marginTop={8}
              renderer="svg"
            />
          ) : (
            <div style={{ color: 'red', fontSize: '10px', fontWeight: 'bold' }}>SEM CÓDIGO</div>
          )}
        </div>
      )}
    </div>
  );
});

export default LabelComponent;
