'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import { toast } from 'sonner';
import {
  Package,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Building,
  UserCheck,
  Globe,
  Wallet,
  Zap,
  ChevronRight,
  Loader2,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';

interface SubscriptionProduct {
  id: number;
  name: string;
  description: string | null;
  category: 'private' | 'business' | 'public';
  price: number; // fee excl. VAT
  currency: string;
  paymentFrequency: 'monthly' | 'quarterly' | 'yearly';
  vatRate: number;
  isActive: boolean;
  createdAt: string;
  _count?: {
    chargers: number;
  };
}

export default function SettingsProductsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SubscriptionProduct | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'private' | 'business' | 'public'>('public');
  const [price, setPrice] = useState('15.00');
  const [paymentFrequency, setPaymentFrequency] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [vatRate, setVatRate] = useState('21.0');
  const [isActive, setIsActive] = useState(true);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search.trim()) params.search = search.trim();
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (activeFilter !== 'all') params.isActive = activeFilter;

      const res = await api.get('/products', { params });
      setProducts(res.data?.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to load subscription products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && (user?.role === 'admin' || user?.role === 'superadmin')) {
      fetchProducts();
    }
  }, [authLoading, user, categoryFilter, activeFilter]);

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setName('');
    setDescription('');
    setCategory('public');
    setPrice('15.00');
    setPaymentFrequency('monthly');
    setVatRate('21.0');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: SubscriptionProduct) => {
    setEditingProduct(product);
    setName(product.name);
    setDescription(product.description || '');
    setCategory(product.category);
    setPrice(String(product.price));
    setPaymentFrequency(product.paymentFrequency);
    setVatRate(String(product.vatRate));
    setIsActive(product.isActive);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || isNaN(Number(price))) {
      toast.error('Product name and valid price excl. VAT are required');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        category,
        price: Number(price),
        currency: 'EUR',
        paymentFrequency,
        vatRate: Number(vatRate) || 21.0,
        isActive,
      };

      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        toast.success(`Product "${payload.name}" updated successfully`);
      } else {
        await api.post('/products', payload);
        toast.success(`Subscription product "${payload.name}" created successfully`);
      }

      setIsModalOpen(false);
      fetchProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, prodName: string) => {
    if (!confirm(`Are you sure you want to delete product "${prodName}"? Chargers using this product will be unassigned.`)) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success('Product deleted successfully');
      fetchProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to delete product');
    }
  };

  const getCategoryBadge = (cat: string) => {
    if (cat === 'private') {
      return (
        <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs">
          <UserCheck className="w-3 h-3 mr-1" />
          Private / Home
        </Badge>
      );
    }
    if (cat === 'business') {
      return (
        <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 text-xs">
          <Building className="w-3 h-3 mr-1" />
          Business / Fleet
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
        <Globe className="w-3 h-3 mr-1" />
        Public CPO
      </Badge>
    );
  };

  const totalAttachedChargers = products.reduce((acc, p) => acc + (p._count?.chargers || 0), 0);
  const activeProductsCount = products.filter(p => p.isActive).length;

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-[#54a8c7]" />
          <span className="text-xs">Loading products...</span>
        </div>
      </AppShell>
    );
  }

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Unauthorized Access</h2>
            <p className="text-sm text-muted-foreground">You do not have permission to manage subscription products.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-300">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/settings" className="hover:text-foreground transition-colors">
            Settings
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">Charger Subscription Products</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5 font-heading">
              <div className="size-9 rounded-xl bg-[#fab758]/15 text-[#fab758] flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              Charger Subscription Products & Licensing
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Define platform usage fees, recurring software subscriptions, and invoicing rules attached to physical chargers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchProducts}
              disabled={loading}
              className="border-border text-foreground hover:bg-muted/50 text-xs h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleOpenCreate}
              className="bg-[#54a8c7] hover:bg-[#4596b4] text-white font-bold shadow-md shadow-[#54a8c7]/20 text-xs h-9"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Subscription Product
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3.5">
            <div className="size-10 rounded-xl bg-[#fab758]/15 text-[#fab758] flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium">Active Subscription Tiers</div>
              <div className="text-2xl font-bold text-foreground font-heading">
                {activeProductsCount} <span className="text-xs font-normal text-muted-foreground">/ {products.length} total</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3.5">
            <div className="size-10 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium">Attached Active Chargers</div>
              <div className="text-2xl font-bold text-foreground font-heading">{totalAttachedChargers}</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3.5">
            <div className="size-10 rounded-xl bg-[#45c4a0]/15 text-[#45c4a0] flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium">Pricing Standard</div>
              <div className="text-2xl font-bold text-foreground font-heading">Excl. VAT (21%)</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
              placeholder="Search by product name or invoice description..."
              className="pl-9 bg-background border-border text-foreground text-xs h-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px] bg-background border-border text-foreground text-xs h-9">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>

            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="w-[120px] bg-background border-border text-foreground text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="true">Active Only</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Products Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase border-b border-border font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Product Name & Invoice Line</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Fee (Excl. VAT)</th>
                  <th className="px-5 py-3.5">Billing Frequency</th>
                  <th className="px-5 py-3.5">Attached Chargers</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground text-xs">
                      <Package className="size-8 mx-auto mb-2 opacity-40 text-[#fab758]" />
                      No subscription products configured. Click &quot;New Subscription Product&quot; to create one.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-foreground text-sm font-heading">
                          {p.name}
                        </div>
                        {p.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 max-w-sm truncate flex items-center gap-1">
                            <Receipt className="w-3 h-3 shrink-0 text-muted-foreground" />
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {getCategoryBadge(p.category)}
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-sm text-foreground">
                        €{p.price.toFixed(2)} <span className="text-[11px] font-normal text-muted-foreground">excl. VAT</span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs capitalize text-foreground">
                        {p.paymentFrequency}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-foreground">
                        <Badge variant="outline" className="text-xs border-border">
                          {p._count?.chargers || 0} charger{p._count?.chargers === 1 ? '' : 's'}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Badge className={p.isActive ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground"}>
                          {p.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(p)}
                            className="text-muted-foreground hover:text-foreground text-xs h-8"
                          >
                            <Edit className="w-3.5 h-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(p.id, p.name)}
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 text-xs h-8"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create / Edit Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden bg-card text-card-foreground border-border">
            <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border/40">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground font-heading">
                <Package className="w-5 h-5 text-[#fab758]" />
                {editingProduct ? 'Edit Subscription Product' : 'Create Subscription Product'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Recurring software license and platform invoicing fee attached to hardware.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4 text-sm">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Product Name *</Label>
                  <Input
                    required
                    placeholder="e.g. Standard CPO Platform License"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-background border-border text-foreground text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Description for Invoice Line Item</Label>
                  <Textarea
                    placeholder="e.g. Monthly CPMS Cloud Platform & Automated Billing Fee"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="bg-background border-border text-foreground text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    This text will appear verbatim as the itemized description on monthly invoices.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Category *</Label>
                    <Select value={category} onValueChange={(val: any) => setCategory(val)}>
                      <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public (Commercial CPO)</SelectItem>
                        <SelectItem value="business">Business (Corporate Fleet)</SelectItem>
                        <SelectItem value="private">Private (Home / Residential)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Payment Frequency *</Label>
                    <Select value={paymentFrequency} onValueChange={(val: any) => setPaymentFrequency(val)}>
                      <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Recurring Fee (Excl. VAT) *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">€</span>
                      <Input
                        required
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="15.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="pl-7 font-mono bg-background border-border text-foreground text-xs h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">VAT Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={vatRate}
                      onChange={(e) => setVatRate(e.target.value)}
                      className="font-mono bg-background border-border text-foreground text-xs h-9"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="size-4 rounded border-border text-[#54a8c7] focus:ring-[#54a8c7] cursor-pointer"
                  />
                  <Label htmlFor="isActive" className="text-xs font-medium text-foreground cursor-pointer">
                    Active (Available to attach to chargers and bill on invoices)
                  </Label>
                </div>
              </div>

              <DialogFooter className="px-6 py-4 shrink-0 border-t border-border bg-muted/20 flex flex-row items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="border-border text-foreground hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-[#fab758] hover:bg-[#e5a243] text-zinc-950 font-bold"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Saving Product...
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4 mr-1.5" />
                      {editingProduct ? 'Save Changes' : 'Create Product'}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
