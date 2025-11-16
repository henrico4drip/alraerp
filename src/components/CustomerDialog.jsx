import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function CustomerDialog({ open, onOpenChange, customer, onSaved, title }) {
  const [formData, setFormData] = useState({ name: "", phone: "", cpf: "", email: "" });

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || "",
        phone: customer.phone || "",
        cpf: customer.cpf || "",
        email: customer.email || "",
      });
    } else {
      setFormData({ name: "", phone: "", cpf: "", email: "" });
    }
  }, [customer, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (customer) {
        await base44.entities.Customer.update(customer.id, formData);
      } else {
        await base44.entities.Customer.create(formData);
      }
      if (onSaved) onSaved(formData);
      if (onOpenChange) onOpenChange(false);
    } catch (err) {
      alert(err?.message || "Falha ao salvar cliente");
    }
  };

  const handleCancel = () => {
    if (onOpenChange) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[800px] lg:w-[1000px] max-w-none rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title || (customer ? "Editar Cliente" : "Novo Cliente")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label htmlFor="phone" className="text-sm text-gray-700">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 00000-0000"
                className="rounded-xl border-gray-200"
              />
            </div>
            <div>
              <Label htmlFor="cpf" className="text-sm text-gray-700">CPF</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                placeholder="000.000.000-00"
                className="rounded-xl border-gray-200"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-sm text-gray-700">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="cliente@email.com"
                className="rounded-xl border-gray-200"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel} className="flex-1 rounded-xl">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-pink-600 hover:bg-pink-700 rounded-xl">
              {customer ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}