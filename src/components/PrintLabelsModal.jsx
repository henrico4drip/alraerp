import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, X } from 'lucide-react';
import LabelComponent from './LabelComponent';
import { useReactToPrint } from 'react-to-print';

// Componente para a modal de impressão de etiquetas
export default function PrintLabelsModal({ products, open, onOpenChange }) {
  const printRef = useRef();
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [sheetType, setSheetType] = useState('58mm'); // '58mm' | '88mm' | 'A4'
  const [margins, setMargins] = useState({ top: 5, right: 5, bottom: 5, left: 5 }); // mm
  const [parcelas, setParcelas] = useState(0);
  const [typeLabel, setTypeLabel] = useState('UNIDADE');
  const [showPrice, setShowPrice] = useState(true)
  const [showBarcode, setShowBarcode] = useState(true)
  const [showNumbers, setShowNumbers] = useState(true)
  const [labelSize, setLabelSize] = useState({ w: 70, h: 42.42 })
  const [query, setQuery] = useState('')

  // Resetar estados ao abrir/fechar
  React.useEffect(() => {
    if (open) {
      setSelectedProducts(products.map(p => p.id));
      const initialQuantities = products.reduce((acc, p) => ({ ...acc, [p.id]: 1 }), {});
      setQuantities(initialQuantities);
    } else {
      setSelectedProducts([]);
      setQuantities({});
    }
  }, [open, products]);

  const handleToggleProduct = (productId) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleQuantityChange = (productId, value) => {
    const quantity = Math.max(1, parseInt(value) || 1);
    setQuantities(prev => ({ ...prev, [productId]: quantity }));
  };

  // Prepara a lista final de etiquetas a serem impressas
  const labelsToPrint = products
    .filter(p => selectedProducts.includes(p.id))
    .flatMap(product => {
      const count = quantities[product.id] || 1;
      return Array.from({ length: count }, (_, i) => ({ ...product, __labelCopy: i }));
    });

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Etiquetas de Produtos',
    pageStyle: `@page { size: auto; margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; }`,
    removeAfterPrint: false,
    copyStyles: true,
  });

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Imprimir Etiquetas
          </DialogTitle>
          <DialogDescription>
            Selecione os produtos e a quantidade de etiquetas para impressão.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Coluna de Seleção de Produtos */}
          <div className="space-y-3 max-h-96 overflow-y-auto p-2 border rounded-xl">
            <h3 className="font-semibold text-sm sticky top-0 bg-white p-1 border-b">Produtos</h3>
            <div className="sticky top-8 bg-white pb-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, código ou categoria"
                className="rounded-xl h-8"
              />
            </div>
            {(products.filter(p =>
              (p.name || '').toLowerCase().includes(query.toLowerCase()) ||
              (p.barcode || '').toLowerCase().includes(query.toLowerCase()) ||
              (p.category || '').toLowerCase().includes(query.toLowerCase())
            )).map((product) => (
              <div key={product.id} className="flex items-center justify-between p-2 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(product.id)}
                    onChange={() => handleToggleProduct(product.id)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <Label className="text-sm font-medium">{product.name}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`qty-${product.id}`} className="text-xs text-gray-500">Qtd:</Label>
                  <Input
                    id={`qty-${product.id}`}
                    type="number"
                    min="1"
                    value={quantities[product.id] || 1}
                    onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                    className="w-16 h-8 text-center rounded-lg"
                    disabled={!selectedProducts.includes(product.id)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Coluna de Pré-visualização e Ação */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Tipo de folha</Label>
                <select className="w-full border rounded-xl h-9" value={sheetType} onChange={(e) => setSheetType(e.target.value)}>
                  <option value="58mm">58mm térmica</option>
                  <option value="88mm">88mm térmica</option>
                  <option value="A4">A4 (laser/jato)</option>
                </select>
              </div>
              <div>
                <Label className="text-sm">Parcelas na etiqueta</Label>
                <Input type="number" min="0" value={parcelas} onChange={(e) => setParcelas(parseInt(e.target.value || 0))} className="rounded-xl h-9" />
              </div>
            </div>
            <div>
              <Label className="text-sm">Tipo na etiqueta (ex.: UNIDADE)</Label>
              <Input type="text" value={typeLabel} onChange={(e) => setTypeLabel(e.target.value)} className="rounded-xl h-9" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> Preço</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showBarcode} onChange={(e) => setShowBarcode(e.target.checked)} /> Código de barras</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} /> Números</label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <Label className="text-xs">Margem superior (mm)</Label>
                <Input type="number" value={margins.top} onChange={(e) => setMargins({ ...margins, top: parseFloat(e.target.value || 0) })} className="rounded-xl h-9" />
              </div>
              <div>
                <Label className="text-xs">Margem direita (mm)</Label>
                <Input type="number" value={margins.right} onChange={(e) => setMargins({ ...margins, right: parseFloat(e.target.value || 0) })} className="rounded-xl h-9" />
              </div>
              <div>
                <Label className="text-xs">Margem inferior (mm)</Label>
                <Input type="number" value={margins.bottom} onChange={(e) => setMargins({ ...margins, bottom: parseFloat(e.target.value || 0) })} className="rounded-xl h-9" />
              </div>
              <div>
                <Label className="text-xs">Margem esquerda (mm)</Label>
                <Input type="number" value={margins.left} onChange={(e) => setMargins({ ...margins, left: parseFloat(e.target.value || 0) })} className="rounded-xl h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Largura etiqueta (mm)</Label>
                <Input type="number" value={labelSize.w} onChange={(e) => setLabelSize({ ...labelSize, w: parseFloat(e.target.value || 0) })} className="rounded-xl h-9" />
              </div>
              <div>
                <Label className="text-sm">Altura etiqueta (mm)</Label>
                <Input type="number" value={labelSize.h} onChange={(e) => setLabelSize({ ...labelSize, h: parseFloat(e.target.value || 0) })} className="rounded-xl h-9" />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">Pré-visualização ({labelsToPrint.length} etiquetas)</h3>
              <Button
                onClick={handlePrint}
                disabled={labelsToPrint.length === 0}
                className="bg-green-600 hover:bg-green-700 rounded-xl"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            </div>

            {/* Área de Pré-visualização (escondida na tela, mas usada para impressão) */}
            <div className="border p-2 rounded-xl bg-gray-100 max-h-96 overflow-y-auto">
              <div className="flex flex-wrap justify-center" style={{ display: 'flex', gap: `${Math.max(1, margins.left/5)}mm` }}>
                {labelsToPrint.slice(0, 10).map((product, index) => {
                  const sizeMap = sheetType === '58mm' ? { w: '58mm', h: '40mm' } : sheetType === '88mm' ? { w: '88mm', h: '50mm' } : { w: `${labelSize.w}mm`, h: `${labelSize.h}mm` };
                  return (
                    <LabelComponent key={index} product={product} width={sizeMap.w} height={sizeMap.h} parcelas={parcelas} typeLabel={typeLabel} showPrice={showPrice} showBarcode={showBarcode} showNumbers={showNumbers} />
                  )
                })}
                {labelsToPrint.length > 10 && (
                    <div className="text-center text-gray-500 text-sm p-4 w-full">
                        ... e mais {labelsToPrint.length - 10} etiquetas.
                    </div>
                )}
              </div>
            </div>

            {/* Área de impressão rendida fora do Dialog */}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    {/* Offscreen print container to ensure react-to-print captures content */}
    <div style={{ position: 'absolute', left: '-10000px', top: '-10000px' }}>
      <div ref={printRef} className="flex flex-wrap" style={{ gap: `${Math.max(1, margins.left/5)}mm` }}>
        {labelsToPrint.map((product, index) => {
          const sizeMap = sheetType === '58mm' ? { w: '58mm', h: '40mm' } : sheetType === '88mm' ? { w: '88mm', h: '50mm' } : { w: `${labelSize.w}mm`, h: `${labelSize.h}mm` };
          return (
            <LabelComponent key={index} product={product} width={sizeMap.w} height={sizeMap.h} parcelas={parcelas} typeLabel={typeLabel} showPrice={showPrice} showBarcode={showBarcode} showNumbers={showNumbers} />
          )
        })}
      </div>
    </div>
    </>
  );
}
