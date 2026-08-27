"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import {
  Invoice,
  InvoiceStats,
  InvoicePagination,
  getInvoices,
  getInvoice,
  downloadInvoicePdf,
  generateInvoices,
  sendInvoiceEmail,
  updateInvoiceStatus,
} from "@/lib/invoices";
import {
  SepaMandate,
  getMandates,
  createOrUpdateMandate,
  deleteMandate,
  exportDirectDebitXml,
  validateIbanBic,
} from "@/lib/sepa";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Download,
  Mail,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  Search,
  Receipt,
  Euro,
  Building2,
  Calendar,
  AlertCircle,
  Eye,
  Check,
  Zap,
  CreditCard,
  ShieldCheck,
  Trash2,
  FileCode2,
} from "lucide-react";
import { toast } from "sonner";

export default function InvoicesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<InvoiceStats>({
    totalSubtotal: 0,
    totalVat: 0,
    totalAmount: 0,
  });
  const [pagination, setPagination] = useState<InvoicePagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());

  // Detail Modal state
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Generate Invoices Dialog state
  const [isGenerateOpen, setIsGenerateOpen] = useState<boolean>(false);
  const [generateMonth, setGenerateMonth] = useState<string>((new Date().getMonth() + 1).toString());
  const [generateYear, setGenerateYear] = useState<string>(new Date().getFullYear().toString());
  const [generating, setGenerating] = useState<boolean>(false);

  // SEPA Direct Debit Export Dialog state
  const [isSepaExportOpen, setIsSepaExportOpen] = useState<boolean>(false);
  const [sepaMonth, setSepaMonth] = useState<string>((new Date().getMonth() + 1).toString());
  const [sepaYear, setSepaYear] = useState<string>(new Date().getFullYear().toString());
  const [sepaScheme, setSepaScheme] = useState<"CORE" | "B2B">("CORE");
  const [sepaSeqType, setSepaSeqType] = useState<"FRST" | "RCUR">("RCUR");
  const [sepaDate, setSepaDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [exportingSepa, setExportingSepa] = useState<boolean>(false);

  // SEPA Mandates Modal state
  const [isMandatesOpen, setIsMandatesOpen] = useState<boolean>(false);
  const [mandates, setMandates] = useState<SepaMandate[]>([]);
  const [loadingMandates, setLoadingMandates] = useState<boolean>(false);

  // New Mandate Form state
  const [isNewMandateOpen, setIsNewMandateOpen] = useState<boolean>(false);
  const [mandateDebtorName, setMandateDebtorName] = useState<string>("");
  const [mandateIban, setMandateIban] = useState<string>("");
  const [mandateBic, setMandateBic] = useState<string>("");
  const [mandateScheme, setMandateScheme] = useState<"CORE" | "B2B">("CORE");
  const [savingMandate, setSavingMandate] = useState<boolean>(false);

  // Action loading states
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [emailingId, setEmailingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, yearFilter, pagination.page]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await getInvoices({
        status: statusFilter,
        year: yearFilter ? Number(yearFilter) : undefined,
        search: searchQuery || undefined,
        page: pagination.page,
        limit: pagination.limit,
      });

      setInvoices(res.invoices);
      setPagination(res.pagination);
      setStats(res.stats);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  const fetchMandates = async () => {
    setLoadingMandates(true);
    try {
      const data = await getMandates();
      setMandates(data);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load SEPA mandates");
    } finally {
      setLoadingMandates(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchInvoices();
  };

  const handleDownload = async (invoice: Invoice) => {
    setDownloadingId(invoice.id);
    try {
      await downloadInvoicePdf(invoice.id, invoice.invoiceNumber);
      toast.success(`Invoice ${invoice.invoiceNumber} downloaded`);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to download PDF invoice");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleEmail = async (invoice: Invoice) => {
    setEmailingId(invoice.id);
    try {
      const res = await sendInvoiceEmail(invoice.id);
      toast.success(res.message || `Invoice ${invoice.invoiceNumber} emailed successfully`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to email invoice");
    } finally {
      setEmailingId(null);
    }
  };

  const handleMarkAsPaid = async (invoice: Invoice) => {
    setUpdatingId(invoice.id);
    try {
      const updated = await updateInvoiceStatus(invoice.id, "paid");
      toast.success(`Invoice ${invoice.invoiceNumber} marked as paid`);
      setInvoices((prev) => prev.map((inv) => (inv.id === invoice.id ? { ...inv, status: "paid", paidAt: updated.paidAt } : inv)));
      if (selectedInvoice && selectedInvoice.id === invoice.id) {
        setSelectedInvoice({ ...selectedInvoice, status: "paid", paidAt: updated.paidAt });
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to update invoice status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleViewDetails = async (invoice: Invoice) => {
    setDetailLoading(true);
    setIsDetailOpen(true);
    try {
      const fullInvoice = await getInvoice(invoice.id);
      setSelectedInvoice(fullInvoice);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load invoice details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleGenerateInvoices = async () => {
    setGenerating(true);
    try {
      const result = await generateInvoices({
        year: Number(generateYear),
        month: Number(generateMonth),
      });

      toast.success(result.message || `Generated invoices for ${generateMonth}/${generateYear}`);
      setIsGenerateOpen(false);
      fetchInvoices();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to generate monthly invoices");
    } finally {
      setGenerating(false);
    }
  };

  const handleExportSepa = async () => {
    setExportingSepa(true);
    try {
      await exportDirectDebitXml({
        year: Number(sepaYear),
        month: Number(sepaMonth),
        mandateType: sepaScheme,
        sequenceType: sepaSeqType,
        collectionDate: sepaDate,
      });

      toast.success("SEPA Direct Debit pain.008 XML batch exported successfully");
      setIsSepaExportOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to generate SEPA Direct Debit batch");
    } finally {
      setExportingSepa(false);
    }
  };

  const handleCreateMandate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMandate(true);
    try {
      // Validate locally first
      const validation = await validateIbanBic(mandateIban, mandateBic || undefined);
      if (!validation.ibanValid) {
        toast.error(validation.ibanError || "Invalid IBAN checksum");
        setSavingMandate(false);
        return;
      }
      if (mandateBic && !validation.bicValid) {
        toast.error(validation.bicError || "Invalid BIC format");
        setSavingMandate(false);
        return;
      }

      await createOrUpdateMandate({
        debtorName: mandateDebtorName,
        iban: mandateIban,
        bic: mandateBic || null,
        mandateType: mandateScheme,
      });

      toast.success("SEPA Direct Debit Mandate registered successfully");
      setIsNewMandateOpen(false);
      setMandateDebtorName("");
      setMandateIban("");
      setMandateBic("");
      fetchMandates();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to register mandate");
    } finally {
      setSavingMandate(false);
    }
  };

  const handleDeleteMandate = async (id: number) => {
    try {
      await deleteMandate(id);
      toast.success("Mandate deleted");
      setMandates((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete mandate");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Paid</Badge>;
      case "issued":
        return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Issued</Badge>;
      case "void":
        return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">Void</Badge>;
      case "draft":
      default:
        return <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/30">Draft</Badge>;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-gradient-to-br from-[#54a8c7] to-[#3f78e0] flex items-center justify-center shadow-md shadow-[#54a8c7]/20">
                <Receipt className="size-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Invoicing & Billing</h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Automated monthly billing engine with EU VAT compliance, vector PDF invoices, and ISO 20022 SEPA Direct Debit collections.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchInvoices}
              disabled={loading}
              className="bg-white/5 border-white/10 hover:bg-white/10 text-slate-200"
            >
              <RefreshCw className={`size-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchMandates();
                setIsMandatesOpen(true);
              }}
              className="bg-white/5 border-white/10 hover:bg-white/10 text-slate-200"
            >
              <CreditCard className="size-4 mr-1.5 text-[#54a8c7]" />
              SEPA Mandates
            </Button>

            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSepaExportOpen(true)}
                  className="bg-white/5 border-white/10 hover:bg-white/10 text-slate-200"
                >
                  <FileCode2 className="size-4 mr-1.5 text-emerald-400" />
                  SEPA Direct Debit (pain.008)
                </Button>

                <Button
                  size="sm"
                  onClick={() => setIsGenerateOpen(true)}
                  className="bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] hover:from-[#4596b4] hover:to-[#3568c8] text-white shadow-md shadow-[#54a8c7]/20"
                >
                  <PlusCircle className="size-4 mr-1.5" />
                  Generate Invoices
                </Button>
              </>
            )}
          </div>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#1e2228]/80 border-white/10 shadow-lg backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Invoiced
              </CardTitle>
              <Euro className="size-4 text-[#54a8c7]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                €{(stats?.totalAmount || 0).toFixed(2)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Gross billing volume (incl. VAT)</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1e2228]/80 border-white/10 shadow-lg backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Net Energy Revenue
              </CardTitle>
              <Zap className="size-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">
                €{(stats?.totalSubtotal || 0).toFixed(2)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Net charging revenue (excl. VAT)</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1e2228]/80 border-white/10 shadow-lg backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                VAT Collected
              </CardTitle>
              <Receipt className="size-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-400">
                €{(stats?.totalVat || 0).toFixed(2)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Multi-tax EU fiscal liability</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1e2228]/80 border-white/10 shadow-lg backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Invoices Processed
              </CardTitle>
              <FileText className="size-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {pagination?.total || 0}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {(invoices || []).filter((i) => i.status === "paid").length} paid in current view
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Toolbar */}
        <Card className="bg-[#1e2228]/60 border-white/10 p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                placeholder="Search by invoice #, customer name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-9"
              />
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPagination(p => ({ ...p, page: 1 })); }}>
                <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-[#1e2228] border-white/10 text-white">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>

              <Select value={yearFilter} onValueChange={(val) => { setYearFilter(val); setPagination(p => ({ ...p, page: 1 })); }}>
                <SelectTrigger className="w-28 bg-white/5 border-white/10 text-white h-9">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="bg-[#1e2228] border-white/10 text-white">
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Invoices Data Table */}
        <Card className="bg-[#1e2228]/80 border-white/10 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Invoices Registry</h2>
              <Badge variant="outline" className="border-white/10 text-slate-400">
                {pagination.total} records
              </Badge>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-300 font-semibold">Invoice Number</TableHead>
                  <TableHead className="text-slate-300 font-semibold">Recipient / Company</TableHead>
                  <TableHead className="text-slate-300 font-semibold">Issue Date</TableHead>
                  <TableHead className="text-slate-300 font-semibold">Due Date</TableHead>
                  <TableHead className="text-slate-300 font-semibold text-right">Subtotal</TableHead>
                  <TableHead className="text-slate-300 font-semibold text-right">VAT</TableHead>
                  <TableHead className="text-slate-300 font-semibold text-right">Total Amount</TableHead>
                  <TableHead className="text-slate-300 font-semibold text-center">Status</TableHead>
                  <TableHead className="text-slate-300 font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                      <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-[#54a8c7]" />
                      Loading invoice records...
                    </TableCell>
                  </TableRow>
                ) : invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                      <FileText className="size-8 mx-auto mb-2 text-slate-500 opacity-50" />
                      No invoices found matching current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((inv) => (
                    <TableRow key={inv.id} className="border-white/5 hover:bg-white/[0.03] transition-colors">
                      <TableCell className="font-mono text-sm font-semibold text-[#54a8c7]">
                        <button
                          onClick={() => handleViewDetails(inv)}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          <FileText className="size-3.5" />
                          {inv.invoiceNumber}
                        </button>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-white flex items-center gap-1">
                            {inv.recipientName || "Valued Customer"}
                            {inv.company && (
                              <Building2 className="size-3 text-slate-400 inline" />
                            )}
                          </span>
                          <span className="text-xs text-slate-400">{inv.recipientEmail || "—"}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-slate-300">
                        {new Date(inv.createdAt).toISOString().split("T")[0]}
                      </TableCell>

                      <TableCell className="text-xs text-slate-300">
                        {new Date(inv.dueDate).toISOString().split("T")[0]}
                      </TableCell>

                      <TableCell className="text-right text-sm text-slate-300">
                        €{inv.subtotal.toFixed(2)}
                      </TableCell>

                      <TableCell className="text-right text-sm text-slate-300">
                        <span className="text-xs text-slate-400 mr-1">({inv.vatRate}%)</span>
                        €{inv.vatAmount.toFixed(2)}
                      </TableCell>

                      <TableCell className="text-right text-sm font-bold text-white">
                        €{inv.totalAmount.toFixed(2)}
                      </TableCell>

                      <TableCell className="text-center">
                        {getStatusBadge(inv.status)}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View Details"
                            onClick={() => handleViewDetails(inv)}
                            className="size-8 text-slate-400 hover:text-white hover:bg-white/10"
                          >
                            <Eye className="size-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            title="Download PDF"
                            disabled={downloadingId === inv.id}
                            onClick={() => handleDownload(inv)}
                            className="size-8 text-[#54a8c7] hover:text-[#54a8c7] hover:bg-[#54a8c7]/10"
                          >
                            {downloadingId === inv.id ? (
                              <RefreshCw className="size-4 animate-spin" />
                            ) : (
                              <Download className="size-4" />
                            )}
                          </Button>

                          {isAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Email PDF Invoice"
                                disabled={emailingId === inv.id}
                                onClick={() => handleEmail(inv)}
                                className="size-8 text-slate-400 hover:text-white hover:bg-white/10"
                              >
                                {emailingId === inv.id ? (
                                  <RefreshCw className="size-4 animate-spin" />
                                ) : (
                                  <Mail className="size-4" />
                                )}
                              </Button>

                              {inv.status !== "paid" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Mark as Paid"
                                  disabled={updatingId === inv.id}
                                  onClick={() => handleMarkAsPaid(inv)}
                                  className="size-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                >
                                  {updatingId === inv.id ? (
                                    <RefreshCw className="size-4 animate-spin" />
                                  ) : (
                                    <Check className="size-4" />
                                  )}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  className="bg-white/5 border-white/10 text-xs text-white"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  className="bg-white/5 border-white/10 text-xs text-white"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Invoice Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-3xl bg-[#1e2228] border-white/10 text-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <FileText className="size-5 text-[#54a8c7]" />
                    Invoice {selectedInvoice?.invoiceNumber}
                  </DialogTitle>
                  <DialogDescription className="text-slate-400 text-xs mt-0.5">
                    Issued on {selectedInvoice && new Date(selectedInvoice.createdAt).toLocaleDateString()} • Due {selectedInvoice && new Date(selectedInvoice.dueDate).toLocaleDateString()}
                  </DialogDescription>
                </div>
                {selectedInvoice && getStatusBadge(selectedInvoice.status)}
              </div>
            </DialogHeader>

            {detailLoading ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-[#54a8c7]" />
                Loading detailed breakdown...
              </div>
            ) : selectedInvoice ? (
              <div className="space-y-6 py-2">
                {/* Meta Boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 space-y-1 text-xs">
                    <p className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Customer / Bill-To</p>
                    <p className="text-sm font-bold text-white">{selectedInvoice.recipientName || "Customer"}</p>
                    <p className="text-slate-400">{selectedInvoice.recipientEmail || "No email"}</p>
                    {selectedInvoice.billingAddress && <p className="text-slate-400">{selectedInvoice.billingAddress}</p>}
                    {selectedInvoice.taxNumber && <p className="text-slate-400">VAT/Tax: {selectedInvoice.taxNumber}</p>}
                  </div>

                  <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 space-y-1 text-xs">
                    <p className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Payment & Settlement</p>
                    <p className="text-slate-300">Currency: <strong className="text-white">{selectedInvoice.currency}</strong></p>
                    <p className="text-slate-300">VAT Rate: <strong className="text-white">{selectedInvoice.vatRate}%</strong></p>
                    {selectedInvoice.paidAt && (
                      <p className="text-emerald-400">
                        Paid on: {new Date(selectedInvoice.paidAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Itemized Table */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Itemized Charging Sessions & Fees
                  </h3>
                  <div className="rounded-lg border border-white/10 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-white/5">
                        <TableRow className="border-white/10">
                          <TableHead className="text-xs text-slate-300">Description</TableHead>
                          <TableHead className="text-xs text-slate-300 text-right">Quantity (kWh)</TableHead>
                          <TableHead className="text-xs text-slate-300 text-right">Rate (€)</TableHead>
                          <TableHead className="text-xs text-slate-300 text-right">VAT %</TableHead>
                          <TableHead className="text-xs text-slate-300 text-right">Total (€)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                          selectedInvoice.items.map((item) => (
                            <TableRow key={item.id} className="border-white/5 text-xs">
                              <TableCell className="font-medium text-slate-200">{item.description}</TableCell>
                              <TableCell className="text-right text-slate-300">{item.quantity.toFixed(2)}</TableCell>
                              <TableCell className="text-right text-slate-300">€{item.unitPrice.toFixed(4)}</TableCell>
                              <TableCell className="text-right text-slate-300">{item.vatRate.toFixed(0)}%</TableCell>
                              <TableCell className="text-right font-semibold text-white">€{item.amount.toFixed(2)}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4 text-slate-400">
                              No itemized lines available.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Totals Summary */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-1.5 p-3 rounded-lg bg-white/5 border border-white/10 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal (excl. VAT):</span>
                      <span className="text-white">€{selectedInvoice.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>VAT ({selectedInvoice.vatRate}%):</span>
                      <span className="text-white">€{selectedInvoice.vatAmount.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-white/10 pt-1.5 flex justify-between font-bold text-sm">
                      <span className="text-white">Total Amount:</span>
                      <span className="text-[#54a8c7]">€{selectedInvoice.totalAmount.toFixed(2)} {selectedInvoice.currency}</span>
                    </div>
                  </div>
                </div>

                {/* Notes Notice */}
                {selectedInvoice.notes && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{selectedInvoice.notes}</span>
                  </div>
                )}
              </div>
            ) : null}

            <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-white/10 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailOpen(false)}
                className="bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                Close
              </Button>

              {selectedInvoice && (
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={emailingId === selectedInvoice.id}
                        onClick={() => handleEmail(selectedInvoice)}
                        className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                      >
                        <Mail className="size-4 mr-1.5" />
                        Email PDF
                      </Button>

                      {selectedInvoice.status !== "paid" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingId === selectedInvoice.id}
                          onClick={() => handleMarkAsPaid(selectedInvoice)}
                          className="bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                        >
                          <Check className="size-4 mr-1.5" />
                          Mark Paid
                        </Button>
                      )}
                    </>
                  )}

                  <Button
                    size="sm"
                    disabled={downloadingId === selectedInvoice.id}
                    onClick={() => handleDownload(selectedInvoice)}
                    className="bg-[#54a8c7] hover:bg-[#4596b4] text-white"
                  >
                    <Download className="size-4 mr-1.5" />
                    Download PDF
                  </Button>
                </div>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Generate Invoices Dialog */}
        <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
          <DialogContent className="max-w-md bg-[#1e2228] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <PlusCircle className="size-5 text-[#54a8c7]" />
                Generate Monthly Invoices
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Process unbilled completed transactions for a specific month and create fiscal invoice documents.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Billing Month</label>
                  <Select value={generateMonth} onValueChange={setGenerateMonth}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e2228] border-white/10 text-white">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={m.toString()}>
                          {new Date(2026, m - 1).toLocaleString("default", { month: "long" })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Billing Year</label>
                  <Select value={generateYear} onValueChange={setGenerateYear}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e2228] border-white/10 text-white">
                      <SelectItem value="2026">2026</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
                <p className="font-semibold mb-1 flex items-center gap-1">
                  <AlertCircle className="size-3.5" />
                  Automated Billing Information
                </p>
                <p className="text-slate-400">
                  Transactions with status <em>completed</em> that have not yet been assigned to an invoice will be bundled per Company or User. Fiscal invoice numbers and VAT breakdowns will be generated automatically.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsGenerateOpen(false)}
                className="bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={generating}
                onClick={handleGenerateInvoices}
                className="bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] hover:from-[#4596b4] hover:to-[#3568c8] text-white"
              >
                {generating ? (
                  <>
                    <RefreshCw className="size-4 mr-1.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="size-4 mr-1.5" />
                    Run Billing Cycle
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* SEPA Direct Debit Export Dialog */}
        <Dialog open={isSepaExportOpen} onOpenChange={setIsSepaExportOpen}>
          <DialogContent className="max-w-md bg-[#1e2228] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <FileCode2 className="size-5 text-emerald-400" />
                Export SEPA Direct Debit XML
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Generate an ISO 20022 pain.008.001.02 XML direct debit file for bank collection.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Target Month</label>
                  <Select value={sepaMonth} onValueChange={setSepaMonth}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e2228] border-white/10 text-white">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={m.toString()}>
                          {new Date(2026, m - 1).toLocaleString("default", { month: "long" })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Target Year</label>
                  <Select value={sepaYear} onValueChange={setSepaYear}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e2228] border-white/10 text-white">
                      <SelectItem value="2026">2026</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Mandate Scheme</label>
                  <Select value={sepaScheme} onValueChange={(val: any) => setSepaScheme(val)}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e2228] border-white/10 text-white">
                      <SelectItem value="CORE">CORE (Standard / B2C)</SelectItem>
                      <SelectItem value="B2B">B2B (Business-to-Business)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Sequence Type</label>
                  <Select value={sepaSeqType} onValueChange={(val: any) => setSepaSeqType(val)}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e2228] border-white/10 text-white">
                      <SelectItem value="RCUR">RCUR (Recurring)</SelectItem>
                      <SelectItem value="FRST">FRST (First Collection)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Requested Collection Date</label>
                <Input
                  type="date"
                  value={sepaDate}
                  onChange={(e) => setSepaDate(e.target.value)}
                  className="bg-white/5 border-white/10 text-white h-9"
                />
              </div>

              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                <p className="font-semibold mb-1 flex items-center gap-1">
                  <ShieldCheck className="size-3.5" />
                  Banking Protocol Validation
                </p>
                <p className="text-slate-400">
                  Outputs valid XML conforming to ISO 20022 pain.008.001.02 with XML entity escaping and CDATA protection. Unpaid invoices linked to active SEPA mandates will be included.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSepaExportOpen(false)}
                className="bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={exportingSepa}
                onClick={handleExportSepa}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {exportingSepa ? (
                  <>
                    <RefreshCw className="size-4 mr-1.5 animate-spin" />
                    Exporting XML...
                  </>
                ) : (
                  <>
                    <Download className="size-4 mr-1.5" />
                    Download pain.008 XML
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* SEPA Mandates Registry Modal */}
        <Dialog open={isMandatesOpen} onOpenChange={setIsMandatesOpen}>
          <DialogContent className="max-w-3xl bg-[#1e2228] border-white/10 text-white max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <CreditCard className="size-5 text-[#54a8c7]" />
                    SEPA Direct Debit Mandates
                  </DialogTitle>
                  <DialogDescription className="text-slate-400 text-xs mt-0.5">
                    Manage European direct debit mandates for automatic invoice collections.
                  </DialogDescription>
                </div>

                <Button
                  size="sm"
                  onClick={() => setIsNewMandateOpen(true)}
                  className="bg-[#54a8c7] hover:bg-[#4596b4] text-white"
                >
                  <PlusCircle className="size-4 mr-1.5" />
                  New Mandate
                </Button>
              </div>
            </DialogHeader>

            <div className="py-2">
              {loadingMandates ? (
                <div className="py-8 text-center text-slate-400">
                  <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-[#54a8c7]" />
                  Loading SEPA mandates...
                </div>
              ) : mandates.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <CreditCard className="size-8 mx-auto mb-2 text-slate-500 opacity-50" />
                  No SEPA mandates registered yet.
                </div>
              ) : (
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-white/5">
                      <TableRow className="border-white/10">
                        <TableHead className="text-xs text-slate-300">Mandate Ref</TableHead>
                        <TableHead className="text-xs text-slate-300">Debtor Name</TableHead>
                        <TableHead className="text-xs text-slate-300">IBAN</TableHead>
                        <TableHead className="text-xs text-slate-300">Scheme</TableHead>
                        <TableHead className="text-xs text-slate-300">Signed Date</TableHead>
                        <TableHead className="text-xs text-slate-300 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mandates.map((m) => (
                        <TableRow key={m.id} className="border-white/5 text-xs">
                          <TableCell className="font-mono font-semibold text-[#54a8c7]">
                            {m.mandateRef}
                          </TableCell>
                          <TableCell className="font-medium text-white">{m.debtorName}</TableCell>
                          <TableCell className="font-mono text-slate-300">{m.iban}</TableCell>
                          <TableCell>
                            <Badge className={m.mandateType === "B2B" ? "bg-purple-500/15 text-purple-400" : "bg-blue-500/15 text-blue-400"}>
                              {m.mandateType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-400">
                            {new Date(m.signatureDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteMandate(m.id)}
                              className="size-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMandatesOpen(false)}
                className="bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Mandate Dialog */}
        <Dialog open={isNewMandateOpen} onOpenChange={setIsNewMandateOpen}>
          <DialogContent className="max-w-md bg-[#1e2228] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <PlusCircle className="size-5 text-[#54a8c7]" />
                Register SEPA Mandate
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Authorizes direct debit collections from the customer bank account.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateMandate} className="space-y-4 py-2 text-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Debtor / Account Holder Name *</label>
                <Input
                  required
                  placeholder="e.g. Acme Fleet B.V."
                  value={mandateDebtorName}
                  onChange={(e) => setMandateDebtorName(e.target.value)}
                  className="bg-white/5 border-white/10 text-white h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">IBAN *</label>
                <Input
                  required
                  placeholder="e.g. NL91ABNA0417164300"
                  value={mandateIban}
                  onChange={(e) => setMandateIban(e.target.value.toUpperCase())}
                  className="font-mono bg-white/5 border-white/10 text-white h-9"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">BIC / SWIFT (Optional)</label>
                  <Input
                    placeholder="e.g. ABNANL2A"
                    value={mandateBic}
                    onChange={(e) => setMandateBic(e.target.value.toUpperCase())}
                    className="font-mono bg-white/5 border-white/10 text-white h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Mandate Scheme</label>
                  <Select value={mandateScheme} onValueChange={(val: any) => setMandateScheme(val)}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e2228] border-white/10 text-white">
                      <SelectItem value="CORE">CORE (Standard)</SelectItem>
                      <SelectItem value="B2B">B2B (Enterprise)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewMandateOpen(false)}
                  className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingMandate}
                  className="bg-[#54a8c7] hover:bg-[#4596b4] text-white"
                >
                  {savingMandate ? "Saving..." : "Save Mandate"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
