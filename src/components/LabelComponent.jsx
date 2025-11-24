import React from 'react';
import Barcode from 'react-barcode';

// Componente para renderizar uma única etiqueta
// O layout é simples: Nome, Preço e Código de Barras
const LabelComponent = React.forwardRef(({ product }, ref) => {
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
        width: '50mm', // Largura típica de etiqueta térmica (50mm)
        height: '30mm', // Altura típica de etiqueta térmica (30mm)
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

      {/* Código de Barras */}
      {product.barcode ? (
        <Barcode
          value={product.barcode}
          format="CODE128" // Formato comum para códigos de barras
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
