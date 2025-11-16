import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Plus, Edit, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function Inventory() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    barcode: "",
    price: "",
    cost: "",
    stock: "",
    category: "",
  });
  const [showConfirmDeleteProduct, setShowConfirmDeleteProduct] = useState(false);
  const [confirmDeleteProductId, setConfirmDeleteProductId] = useState(null);

  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date'),
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
      handleCloseDialog();
    },
    onError: (err) => {
      console.error('Erro ao criar produto:', err);
      alert(err?.message || 'Falha ao criar produto');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
      handleCloseDialog();
    },
    onError: (err) => {
      console.error('Erro ao atualizar produto:', err);
      alert(err?.message || 'Falha ao atualizar produto');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
    },
    onError: (err) => {
      console.error('Erro ao excluir produto:', err);
      alert(err?.message || 'Falha ao excluir produto');
    }
  });

  const handleOpenDialog = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name || "",
        barcode: product.barcode || "",
        price: product.price || "",
        cost: product.cost || "",
        stock: product.stock || "",
        category: product.category || "",
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        barcode: "",
        price: "",
        cost: "",
        stock: "",
        category: "",
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingProduct(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      price: parseFloat(formData.price),
      cost: parseFloat(formData.cost || 0),
      stock: parseInt(formData.stock || 0),
    };

    try {
      if (editingProduct) {
        await updateMutation.mutateAsync({ id: editingProduct.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
    } catch (err) {
      console.error('Falha no envio do formulário de produto:', err);
      alert(err?.message || 'Erro ao salvar produto');
    }
  };

  const [search, setSearch] = useState("");

  const filteredProducts = products.filter(p =>
    (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Estoque</h1>
            <p className="text-gray-500 mt-1">Gerencie seus produtos</p>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="bg-blue-600 hover:bg-blue-700 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Produto
          </Button>
        </div>

        <div className="mb-6">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, código de barras ou categoria"
            className="rounded-xl border-gray-300"
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)]">
          <div className="grid grid-cols-[2fr_1fr_1fr_120px_100px_140px] gap-6 px-6 sm:px-8 py-3 text-[11px] font-normal text-[#707887] tracking-wide border-b border-gray-200">
            <div>PRODUTO</div>
            <div>CÓDIGO</div>
            <div>CATEGORIA</div>
            <div className="text-right">PREÇO</div>
            <div className="text-right">ESTOQUE</div>
            <div className="flex items-center justify-end">AÇÕES</div>
          </div>
          <div className="divide-y divide-gray-100">
            {filteredProducts.map((product) => (
              <div key={product.id} className="grid grid-cols-[2fr_1fr_1fr_120px_100px_140px] gap-6 items-center px-6 sm:px-8 py-3 hover:bg-gray-50/70">
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-5 h-5 text-indigo-600" />
                  <p className="font-medium text-sm text-gray-900 truncate">{product.name}</p>
                </div>
                <div className="text-xs text-gray-500 font-mono truncate">{product.barcode || '-'}</div>
                <div className="text-xs text-gray-500 truncate">{product.category || '-'}</div>
                <div className="text-right tabular-nums">
                  <p className="font-semibold text-green-600 text-sm">R$ {product.price?.toFixed(2)}</p>
                </div>
                <div className="text-right tabular-nums">
                  <p className={`font-semibold text-sm ${
                    (product.stock || 0) > 10 ? 'text-green-600' :
                    (product.stock || 0) > 0 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>{product.stock || 0}</p>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleOpenDialog(product)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => { setConfirmDeleteProductId(product.id); setShowConfirmDeleteProduct(true); }}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm text-gray-700">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="rounded-xl border-gray-200"
                />
              </div>
              <div>
                <Label htmlFor="barcode" className="text-sm text-gray-700">Código de Barras</Label>
                <Input
                  id="barcode"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="Digite ou escaneie"
                  className="rounded-xl border-gray-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price" className="text-sm text-gray-700">Preço de Venda *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    className="rounded-xl border-gray-200"
                  />
                </div>
                <div>
                  <Label htmlFor="cost" className="text-sm text-gray-700">Custo</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    className="rounded-xl border-gray-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stock" className="text-sm text-gray-700">Estoque</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="rounded-xl border-gray-200"
                  />
                </div>
                <div>
                  <Label htmlFor="category" className="text-sm text-gray-700">Categoria</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="rounded-xl border-gray-200"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog} className="flex-1 rounded-xl">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl">
                  {editingProduct ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={showConfirmDeleteProduct}
          onOpenChange={setShowConfirmDeleteProduct}
          title="Excluir produto"
          description="Tem certeza que deseja excluir este produto?"
          confirmText="Excluir"
          cancelText="Cancelar"
          destructive
          onConfirm={() => {
            if (confirmDeleteProductId != null) {
              deleteMutation.mutate(confirmDeleteProductId);
            }
          }}
        />
      </div>
    </div>
  );
}