import React from 'react';
import Barcode from 'react-barcode';

// Componente para renderizar uma única etiqueta
// O layout é simples: Nome, Preço e Código de Barras
const LabelComponent = React.forwardRef(({ product, width = '50mm', height = '30mm', parcelas = 0, typeLabel = 'UNIDADE' }, ref) => {
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
      {/* Nome do Produto */}
      <div style={{ fontWeight: 'bold', fontSize: '10px', lineHeight: '1.1', maxHeight: '22px', overflow: 'hidden' }}>
        {product.name || 'PRODUTO SEM NOME'}
      </div>

      {/* Preço */}
      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#000' }}>
        {formattedPrice}
      </div>
      {parcelas > 1 && (() => {
        const perInstallment = (product.price || 0) / parcelas
        const formattedInstallment = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(perInstallment)
        return <div style={{ fontSize: '9px', color: '#333' }}>{parcelas}x {formattedInstallment}</div>
      })()}
      <div style={{ fontSize: '8px', color: '#444' }}>{typeLabel}</div>

      {/* Código de Barras */}
      {product.barcode ? (
        <Barcode
          value={product.barcode}
          format="CODE128"
          width={1}
          height={20}
          displayValue={false} // Não exibe o número abaixo do código, economizando espaço
          margin={0}
          marginTop={2}
          renderer="svg"
        />
      ) : (
        <div style={{ color: 'red', fontSize: '8px' }}>Sem Código</div>
      )}
    </div>
  );
});

export default LabelComponent;
