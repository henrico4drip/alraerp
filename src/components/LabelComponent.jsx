import React from 'react';
import Barcode from 'react-barcode';

// Componente para renderizar uma única etiqueta
// O layout é simples: Nome, Preço e Código de Barras
const LabelComponent = React.forwardRef(({ product, width = '50mm', height = '30mm', parcelas = 0, typeLabel = 'UNIDADE', showPrice = true, showBarcode = true, showNumbers = true }, ref) => {
  // Formatação de preço para Real Brasileiro
  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(product.price || 0);

  return (
    <div
      ref={ref}
      className="p-2 border border-gray-300 bg-white"
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        textAlign: 'center',
        fontSize: '8px',
        overflow: 'hidden',
        pageBreakAfter: 'always', // Garante que cada etiqueta comece em uma nova página de impressão
      }}
    >
      {/* Cabeçalho: nome e preço */}
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '10px', lineHeight: '1.1', maxWidth: '60%', overflow: 'hidden' }}>
            {(product.name || 'PRODUTO SEM NOME').toUpperCase()}
          </div>
          {showPrice && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{formattedPrice}</div>
              {parcelas > 1 && (() => {
                const perInstallment = (product.price || 0) / parcelas
                const formattedInstallment = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(perInstallment)
                return <div style={{ fontSize: '9px' }}>{parcelas}x {formattedInstallment}</div>
              })()}
              <div style={{ fontSize: '8px', color: '#444' }}>{typeLabel}</div>
            </div>
          )}
        </div>
        {/* Linha secundária opcional com categoria/tamanho se existir */}
        {(product.category || product.size) && (
          <div style={{ textAlign: 'left', fontSize: '8px', marginTop: 2 }}>
            {product.category ? `CAT: ${product.category}` : ''} {product.size ? ` • TAM: ${product.size}` : ''}
          </div>
        )}
      </div>


      {/* Código de Barras */}
      {showBarcode && (
        product.barcode ? (
          <Barcode
            value={product.barcode}
            format="CODE128"
            width={1}
            height={20}
            displayValue={showNumbers}
            fontSize={8}
            textMargin={0}
            margin={0}
            marginTop={2}
            renderer="svg"
          />
        ) : (
          <div style={{ color: 'red', fontSize: '8px' }}>Sem Código</div>
        )
      )}
    </div>
  );
});

export default LabelComponent;
