import React, { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, ShoppingCart, Minus, Trash2, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCashier } from "@/context/CashierContext";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function CashierProducts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const searchRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { cart, addToCart, updateQuantity, removeFromCart, calculateTotal } = useCashier();
  const [showNewProductDialog, setShowNewProductDialog] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: "",
    barcode: "",
    price: "",
    cost: "",
    stock: "",
    category: "",
  });
  // Animação de entrada do Caixa (do dashboard até o botão da direita)
  const [showFooterAnimation, setShowFooterAnimation] = useState(false);
  const [highlightRight, setHighlightRight] = useState(false);
  const [shouldAutoProceed, setShouldAutoProceed] = useState(false);
  const [showConfirmRemoveCartItem, setShowConfirmRemoveCartItem] = useState(false);
  const [confirmRemoveCartItemId, setConfirmRemoveCartItemId] = useState(null);
  useEffect(() => {
    const animate = sessionStorage.getItem('animateCashierEntry') === 'true';
    if (animate) {
      setShouldAutoProceed(true);
      setShowFooterAnimation(true);
      setTimeout(() => setHighlightRight(true), 50);
      setTimeout(() => {
        setShowFooterAnimation(false);
        setHighlightRight(false);
        // Após a animação chegar ao lado direito, procede automaticamente para pagamento
        setTimeout(() => {
          if (shouldAutoProceed) {
            sessionStorage.setItem('animateCashierPaymentEntry', 'true');
            navigate('/cashier/payment');
          }
        }, 150);
      }, 900);
      sessionStorage.removeItem('animateCashierEntry');
    }
  }, []);

  // Atalho: Enter navega para a tela de pagamento
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prossiga somente com Ctrl/Cmd + Enter para evitar navegação após escanear
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        navigate('/cashier/payment');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
    initialData: [],
  });

  const createProductMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["products"]);
      setShowNewProductDialog(false);
      setNewProductForm({ name: "", barcode: "", price: "", cost: "", stock: "", category: "" });
    },
  });

  const handleSearchProducts = (value) => {
    setSearchTerm(value);
    const productByBarcode = products.find((p) => p.barcode === value);
    if (productByBarcode) {
      addToCart(productByBarcode);
      setSearchTerm("");
      searchRef.current?.focus();
    }
  };

  const [searchFocused, setSearchFocused] = useState(false);
  const isSearching = (searchFocused || (searchTerm && searchTerm.trim().length > 0));

  const filteredProducts = products
    .filter((p) => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 pb-32 lg:pb-4 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-3 gap-4 min-h-[calc(100vh-112px-64px)]">
          <div className="lg:col-span-2 space-y-4">
            <Card className="shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] border-0 rounded-2xl bg-white">
              <CardHeader className="bg-gray-100 border-b border-gray-200 rounded-t-2xl p-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-gray-900 text-base">
                    <ShoppingCart className="w-5 h-5 text-slate-700" />
                    Produtos
                  </CardTitle>
                  <Button onClick={() => setShowNewProductDialog(true)} className="rounded-xl bg-slate-700 hover:bg-slate-800">
                    <Plus className="w-4 h-4 mr-2" /> Novo Produto
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="mb-4">
                  <Input
                    ref={searchRef}
                    value={searchTerm}
                    onChange={(e) => handleSearchProducts(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleSearchProducts(searchTerm);
                      }
                    }}
                    placeholder="Buscar por nome ou código de barras..."
                    className="w-full rounded-xl border-gray-200"
                  />
                </div>

                {/* Removido toolbar com botão Novo Produto abaixo da barra de pesquisa */}

                <div className="max-h-80 overflow-y-auto divide-y divide-gray-200">
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_120px] gap-6 px-3 sm:px-8 py-3 text-[11px] font-semibold text-gray-500 tracking-wide border-b border-gray-200">
                      <div>PRODUTO</div>
                      <div>CATEGORIA</div>
                      <div>CÓDIGO</div>
                      <div className="text-right">PREÇO</div>

                    </div>
                    <div className="divide-y divide-gray-100">
                      {filteredProducts.map((product) => (
                        <React.Fragment key={product.id}>
                          {/* Desktop layout */}
                          <button
                            className="hidden lg:grid grid-cols-[2fr_1fr_1fr_120px] gap-6 items-center w-full text-left px-3 sm:px-8 py-3 hover:bg-gray-50/70"
                            onClick={() => addToCart(product)}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {(product.image_url || product.imageUrl) ? (
                                <img
                                  src={product.image_url || product.imageUrl}
                                  alt={product.name}
                                  className="w-8 h-8 rounded-md object-cover"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <Package className="w-5 h-5 text-indigo-600 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-sm text-gray-900 truncate">{product.name}</p>
                                <p className="text-xs text-gray-500 truncate">{product.description || ''}</p>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 truncate">{product.category || '-'}</div>
                            <div className="text-xs text-gray-500 font-mono truncate">{product.barcode || '-'}</div>
                            <div className="text-right tabular-nums">
                              {product.promo_price && Number(product.promo_price) < Number(product.price) ? (
                                <div className="flex flex-col items-end">
                                  <p className="text-[11px] line-through text-gray-500">R$ {Number(product.price).toFixed(2)}</p>
                                  <p className="font-semibold text-green-600 text-sm">R$ {Number(product.promo_price).toFixed(2)}</p>
                                </div>
                              ) : (
                                <p className="font-semibold text-green-600 text-sm">R$ {Number(product.price).toFixed(2)}</p>
                              )}
                            </div>

                          </button>
                          {/* Mobile compact layout */}
                          <button
                            className="lg:hidden w-full text-left px-3 py-2 hover:bg-gray-50/70"
                            onClick={() => addToCart(product)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {(product.image_url || product.imageUrl) ? (
                                <img
                                  src={product.image_url || product.imageUrl}
                                  alt={product.name}
                                  className="w-8 h-8 rounded-md object-cover"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <Package className="w-5 h-5 text-indigo-600 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm text-gray-900 truncate">{product.name}</p>
                                <div className="text-[11px] text-gray-500 truncate">{product.category || '-'} • {product.barcode || '-'}</div>
                              </div>
                              <div className="text-right">
                                {product.promo_price && Number(product.promo_price) < Number(product.price) ? (
                                  <div className="text-right">
                                    <div className="text-[11px] line-through text-gray-500">R$ {Number(product.price).toFixed(2)}</div>
                                    <div className="text-xs font-semibold text-green-600">R$ {Number(product.promo_price).toFixed(2)}</div>
                                  </div>
                                ) : (
                                  <div className="text-xs font-semibold text-green-600">R$ {Number(product.price).toFixed(2)}</div>
                                )}

                              </div>
                            </div>
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col h-full space-y-4">
            <Card className="shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] border-0 rounded-2xl bg-white flex-1 flex flex-col">
              <CardHeader className="bg-gray-100 border-b border-gray-200 rounded-t-2xl p-4">
                <CardTitle className="flex items-center gap-2 text-gray-900 text-base">
                  Carrinho ({cart.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex flex-col flex-1">
                {cart.length === 0 ? (
                  <p className="text-center text-gray-400 py-6 text-sm">Carrinho vazio</p>
                ) : (
                  <div className="space-y-2 flex-1 overflow-y-auto mb-3">
                    {cart.map((item) => (
                      <div key={item.product_id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{item.product_name}</p>
                          {(() => {
                            const base = products.find(p => p.id === item.product_id)
                            const orig = base?.price
                            const cur = item.unit_price
                            if (orig && cur < orig) {
                              return (
                                <div className="text-right">
                                  <span className="text-[11px] line-through text-gray-500 mr-1">R$ {Number(orig).toFixed(2)}</span>
                                  <span className="text-xs font-semibold text-green-600">R$ {Number(cur).toFixed(2)}</span>
                                </div>
                              )
                            }
                            return <p className="text-xs text-gray-500">R$ {Number(cur).toFixed(2)}</p>
                          })()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => updateQuantity(item.product_id, -1)}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-6 text-center font-semibold text-sm">{item.quantity}</span>
                          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => { setConfirmRemoveCartItemId(item.product_id); setShowConfirmRemoveCartItem(true); }}>
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium">
                  <span>Total</span>
                  <span>R$ {calculateTotal().toFixed(2)}</span>
                </div>
                <div className="mt-3">

                </div>
              </CardContent>
            </Card>

            {/* Desktop-only bottom action under cart card */}
            <div className="hidden lg:block">
              <Button onClick={() => navigate('/cashier/payment')} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700" aria-label="Prosseguir para pagamento">
                Prosseguir para pagamento
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* New Product Dialog */}
      <Dialog open={showNewProductDialog} onOpenChange={setShowNewProductDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-3xl lg:max-w-4xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Novo Produto</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const generateEAN13 = () => {
                const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
                const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
                const check = (10 - (sum % 10)) % 10;
                return [...digits, check].join('');
              };
              const payload = {
                name: newProductForm.name,
                barcode: newProductForm.barcode || generateEAN13(),
                price: parseFloat(newProductForm.price) || 0,
                cost: parseFloat(newProductForm.cost) || 0,
                stock: parseInt(newProductForm.stock || 0, 10),
                category: newProductForm.category || undefined,
              };
              createProductMutation.mutate(payload);
            }}
            className="space-y-3"
          >
            <div>
              <Label className="text-sm text-gray-700">Nome</Label>
              <Input
                value={newProductForm.name}
                onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                placeholder="Produto X"
                className="rounded-xl border-gray-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm text-gray-700">Preço</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newProductForm.price}
                  onChange={(e) => setNewProductForm({ ...newProductForm, price: e.target.value })}
                  placeholder="0.00"
                  className="rounded-xl border-gray-200"
                />
              </div>
              <div>
                <Label className="text-sm text-gray-700">Custo</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newProductForm.cost}
                  onChange={(e) => setNewProductForm({ ...newProductForm, cost: e.target.value })}
                  placeholder="0.00"
                  className="rounded-xl border-gray-200"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm text-gray-700">Estoque</Label>
                <Input
                  type="number"
                  value={newProductForm.stock}
                  onChange={(e) => setNewProductForm({ ...newProductForm, stock: e.target.value })}
                  placeholder="0"
                  className="rounded-xl border-gray-200"
                />
              </div>
              <div>
                <Label className="text-sm text-gray-700">Código de barras</Label>
                <Input
                  value={newProductForm.barcode}
                  onChange={(e) => setNewProductForm({ ...newProductForm, barcode: e.target.value })}
                  placeholder="000000000"
                  className="rounded-xl border-gray-200"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm text-gray-700">Categoria</Label>
              <Input
                value={newProductForm.category}
                onChange={(e) => setNewProductForm({ ...newProductForm, category: e.target.value })}
                placeholder="Categoria"
                className="rounded-xl border-gray-200"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowNewProductDialog(false)} className="flex-1 rounded-xl">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl">
                Criar Produto
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showConfirmRemoveCartItem}
        onOpenChange={setShowConfirmRemoveCartItem}
        title="Remover item do carrinho"
        description="Deseja remover este item do carrinho?"
        confirmText="Remover"
        cancelText="Cancelar"
        destructive
        onConfirm={() => {
          if (confirmRemoveCartItemId != null) {
            removeFromCart(confirmRemoveCartItemId);
          }
        }}
      />

      {/* Bottom action bar (separate button below cart card) */}
      <div className="fixed left-0 right-0 bottom-[72px] z-20 px-4 lg:hidden">
        <div className="max-w-7xl mx-auto">
          <Button onClick={() => navigate('/cashier/payment')} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700" aria-label="Prosseguir para pagamento">
            Prosseguir para pagamento
          </Button>
        </div>
      </div>



    </div>
  );
}
