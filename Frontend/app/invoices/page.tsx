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
  deleteInvoice,
  resetInvoiceNumbering,
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
  RotateCcw,
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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteInvoice, setConfirmDeleteInvoice] = useState<Invoice | null>(null);

  // Reset Invoice Numbering state
  const [isResetNumberingOpen, setIsResetNumberingOpen] = useState<boolean>(false);
  const [resetStartSequence, setResetStartSequence] = useState<string>("1");
  const [resetRenumberExisting, setResetRenumberExisting] = useState<boolean>(true);
  const [resetYear, setResetYear] = useState<string>("all");
  const [resetMonth, setResetMonth] = useState<string>("all");
  const [resettingNumbering, setResettingNumbering] = useState<boolean>(false);

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

  const handleDeleteInvoice = async () => {
    if (!confirmDeleteInvoice) return;
    const inv = confirmDeleteInvoice;
    setDeletingId(inv.id);
    try {
      const res = await deleteInvoice(inv.id);
      toast.success(res.message || `Invoice ${inv.invoiceNumber} deleted`);
      setConfirmDeleteInvoice(null);
      if (selectedInvoice && selectedInvoice.id === inv.id) {
        setIsDetailOpen(false);
        setSelectedInvoice(null);
      }
      fetchInvoices();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to delete invoice");
    } finally {
      setDeletingId(null);
    }
  };

  const handleResetNumbering = async () => {
    setResettingNumbering(true);
    try {
      const res = await resetInvoiceNumbering({
        startSequence: Number(resetStartSequence) || 1,
        renumberExisting: resetRenumberExisting,
        year: resetYear !== "all" ? Number(resetYear) : undefined,
        month: resetMonth !== "all" ? Number(resetMonth) : undefined,
      });

      toast.success(res.message || "Invoice numbering reset successfully");
      setIsResetNumberingOpen(false);
      fetchInvoices();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to reset invoice numbering");
    } finally {
      setResettingNumbering(false);
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
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-gradient-to-br from-[#54a8c7] to-[#3f78e0] flex items-center justify-center shadow-md shadow-[#54a8c7]/20">
                <Receipt className="size-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Invoicing & Billing</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Automated monthly billing engine with EU VAT compliance, vector PDF invoices, and ISO 20022 SEPA Direct Debit collections.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchInvoices}
              disabled={loading}
              className="border-border/70 hover:bg-muted text-foreground"
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
              className="border-border/70 hover:bg-muted text-foreground"
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
                  className="border-border/70 hover:bg-muted text-foreground"
                >
                  <FileCode2 className="size-4 mr-1.5 text-emerald-500 dark:text-emerald-400" />
                  SEPA Direct Debit (pain.008)
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsResetNumberingOpen(true)}
                  className="border-border/70 hover:bg-muted text-foreground"
                >
                  <RotateCcw className="size-4 mr-1.5 text-amber-500" />
                  Reset Numbering
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
          <Card className="bg-card border-border/70 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Invoiced
              </CardTitle>
              <Euro className="size-4 text-[#54a8c7]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                €{(stats?.totalAmount || 0).toFixed(2)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Gross billing volume (incl. VAT)</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/70 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Net Energy Revenue
              </CardTitle>
              <Zap className="size-4 text-emerald-500 dark:text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                €{(stats?.totalSubtotal || 0).toFixed(2)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Net charging revenue (excl. VAT)</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/70 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                VAT Collected
              </CardTitle>
              <Receipt className="size-4 text-amber-500 dark:text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                €{(stats?.totalVat || 0).toFixed(2)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Multi-tax EU fiscal liability</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/70 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Invoices Processed
              </CardTitle>
              <FileText className="size-4 text-blue-500 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {pagination?.total || 0}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {(invoices || []).filter((i) => i.status === "paid").length} paid in current view
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Toolbar */}
        <Card className="bg-card border-border/70 shadow-xs p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice #, customer name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/40 border-border/60 text-foreground placeholder:text-muted-foreground h-9"
              />
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPagination(p => ({ ...p, page: 1 })); }}>
                <SelectTrigger className="w-32 bg-muted/40 border-border/60 text-foreground h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>

              <Select value={yearFilter} onValueChange={(val) => { setYearFilter(val); setPagination(p => ({ ...p, page: 1 })); }}>
                <SelectTrigger className="w-28 bg-muted/40 border-border/60 text-foreground h-9">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Invoices Data Table */}
        <Card className="bg-card border-border/70 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">Invoices Registry</h2>
              <Badge variant="outline" className="border-border/70 text-muted-foreground">
                {pagination.total} records
              </Badge>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border/70 hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-semibold">Invoice Number</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Recipient / Company</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Issue Date</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Due Date</TableHead>
                  <TableHead className="text-muted-foreground font-semibold text-right">Subtotal</TableHead>
                  <TableHead className="text-muted-foreground font-semibold text-right">VAT</TableHead>
                  <TableHead className="text-muted-foreground font-semibold text-right">Total Amount</TableHead>
                  <TableHead className="text-muted-foreground font-semibold text-center">Status</TableHead>
                  <TableHead className="text-muted-foreground font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-[#54a8c7]" />
                      Loading invoice records...
                    </TableCell>
                  </TableRow>
                ) : invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <FileText className="size-8 mx-auto mb-2 opacity-50" />
                      No invoices found matching current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((inv) => (
                    <TableRow key={inv.id} className="border-border/40 hover:bg-muted/40 transition-colors">
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
                          <span className="font-medium text-foreground flex items-center gap-1">
                            {inv.recipientName || "Valued Customer"}
                            {inv.company && (
                              <Building2 className="size-3 text-muted-foreground inline" />
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">{inv.recipientEmail || "—"}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-foreground/80">
                        {new Date(inv.createdAt).toISOString().split("T")[0]}
                      </TableCell>

                      <TableCell className="text-xs text-foreground/80">
                        {new Date(inv.dueDate).toISOString().split("T")[0]}
                      </TableCell>

                      <TableCell className="text-right text-sm text-foreground/90">
                        €{inv.subtotal.toFixed(2)}
                      </TableCell>

                      <TableCell className="text-right text-sm text-foreground/90">
                        <span className="text-xs text-muted-foreground mr-1">({inv.vatRate}%)</span>
                        €{inv.vatAmount.toFixed(2)}
                      </TableCell>

                      <TableCell className="text-right text-sm font-bold text-foreground">
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
                            className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
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
                                className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
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
                                  className="size-8 text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 hover:bg-emerald-500/10"
                                >
                                  {updatingId === inv.id ? (
                                    <RefreshCw className="size-4 animate-spin" />
                                  ) : (
                                    <Check className="size-4" />
                                  )}
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete Invoice"
                                disabled={deletingId === inv.id}
                                onClick={() => setConfirmDeleteInvoice(inv)}
                                className="size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                              >
                                {deletingId === inv.id ? (
                                  <RefreshCw className="size-4 animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                              </Button>
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
            <div className="p-4 border-t border-border/70 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  className="border-border/70 text-xs text-foreground hover:bg-muted"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  className="border-border/70 text-xs text-foreground hover:bg-muted"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Invoice Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="sm:max-w-4xl lg:max-w-5xl w-full max-w-[95vw] bg-card border-border text-foreground max-h-[90vh] overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <FileText className="size-5 text-[#54a8c7]" />
                    Invoice {selectedInvoice?.invoiceNumber}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-xs mt-0.5">
                    Issued on {selectedInvoice && new Date(selectedInvoice.createdAt).toLocaleDateString()} • Due {selectedInvoice && new Date(selectedInvoice.dueDate).toLocaleDateString()}
                  </DialogDescription>
                </div>
                {selectedInvoice && getStatusBadge(selectedInvoice.status)}
              </div>
            </DialogHeader>

            {detailLoading ? (
              <div className="py-12 text-center text-muted-foreground">
                <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-[#54a8c7]" />
                Loading detailed breakdown...
              </div>
            ) : selectedInvoice ? (
              <div className="space-y-6 py-2">
                {/* Meta Boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-lg bg-muted/30 border border-border/60 space-y-1 text-xs">
                    <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Customer / Bill-To</p>
                    <p className="text-sm font-bold text-foreground">{selectedInvoice.recipientName || "Customer"}</p>
                    <p className="text-muted-foreground">{selectedInvoice.recipientEmail || "No email"}</p>
                    {selectedInvoice.billingAddress && <p className="text-muted-foreground">{selectedInvoice.billingAddress}</p>}
                    {selectedInvoice.taxNumber && <p className="text-muted-foreground">VAT/Tax: {selectedInvoice.taxNumber}</p>}
                  </div>

                  <div className="p-3.5 rounded-lg bg-muted/30 border border-border/60 space-y-1 text-xs">
                    <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Payment & Settlement</p>
                    <p className="text-foreground/90">Currency: <strong className="text-foreground">{selectedInvoice.currency}</strong></p>
                    <p className="text-foreground/90">VAT Rate: <strong className="text-foreground">{selectedInvoice.vatRate}%</strong></p>
                    {selectedInvoice.paidAt && (
                      <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        Paid on: {new Date(selectedInvoice.paidAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Itemized Table */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Itemized Charging Sessions & Fees
                  </h3>
                  <div className="rounded-lg border border-border/70 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="border-border/70">
                          <TableHead className="text-xs text-muted-foreground w-auto">Description</TableHead>
                          <TableHead className="text-xs text-muted-foreground text-right w-32">Quantity (kWh)</TableHead>
                          <TableHead className="text-xs text-muted-foreground text-right w-28">Rate (€)</TableHead>
                          <TableHead className="text-xs text-muted-foreground text-right w-20">VAT %</TableHead>
                          <TableHead className="text-xs text-muted-foreground text-right w-28">Total (€)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                          selectedInvoice.items.map((item) => (
                            <TableRow key={item.id} className="border-border/40 text-xs">
                              <TableCell className="font-medium text-foreground whitespace-normal break-words max-w-md">{item.description}</TableCell>
                              <TableCell className="text-right text-muted-foreground whitespace-nowrap">{item.quantity.toFixed(2)}</TableCell>
                              <TableCell className="text-right text-muted-foreground whitespace-nowrap">€{item.unitPrice.toFixed(4)}</TableCell>
                              <TableCell className="text-right text-muted-foreground whitespace-nowrap">{item.vatRate.toFixed(0)}%</TableCell>
                              <TableCell className="text-right font-semibold text-foreground whitespace-nowrap">€{item.amount.toFixed(2)}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
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
                  <div className="w-64 space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border/60 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal (excl. VAT):</span>
                      <span className="text-foreground font-semibold">€{selectedInvoice.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>VAT ({selectedInvoice.vatRate}%):</span>
                      <span className="text-foreground font-semibold">€{selectedInvoice.vatAmount.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-border/60 pt-1.5 flex justify-between font-bold text-sm">
                      <span className="text-foreground">Total Amount:</span>
                      <span className="text-[#54a8c7]">€{selectedInvoice.totalAmount.toFixed(2)} {selectedInvoice.currency}</span>
                    </div>
                  </div>
                </div>

                {/* Notes Notice */}
                {selectedInvoice.notes && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-300 flex items-start gap-2">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{selectedInvoice.notes}</span>
                  </div>
                )}
              </div>
            ) : null}

            <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-border/70 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailOpen(false)}
                className="border-border/70 text-foreground hover:bg-muted"
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
                        disabled={deletingId === selectedInvoice.id}
                        onClick={() => setConfirmDeleteInvoice(selectedInvoice)}
                        className="bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                      >
                        <Trash2 className="size-4 mr-1.5" />
                        Delete
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={emailingId === selectedInvoice.id}
                        onClick={() => handleEmail(selectedInvoice)}
                        className="border-border/70 text-foreground hover:bg-muted"
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
                          className="bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
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

        {/* Confirm Delete Invoice Dialog */}
        <Dialog open={!!confirmDeleteInvoice} onOpenChange={(open) => !open && setConfirmDeleteInvoice(null)}>
          <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertCircle className="size-5" />
                Delete Invoice {confirmDeleteInvoice?.invoiceNumber}?
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs pt-2">
                Are you sure you want to delete invoice <strong className="text-foreground">{confirmDeleteInvoice?.invoiceNumber}</strong>?
              </DialogDescription>
            </DialogHeader>

            <div className="p-3.5 rounded-lg border border-border/70 bg-muted/20 space-y-2 text-xs text-foreground/90">
              <p>
                Any associated completed charging transactions will be unlinked and returned to <strong className="text-emerald-600 dark:text-emerald-400">unbilled status</strong> so they can be re-invoiced in future billing cycles.
              </p>
              {confirmDeleteInvoice && (
                <div className="pt-2 border-t border-border/50 text-muted-foreground space-y-1 text-[11px]">
                  <div>Customer: <span className="text-foreground font-medium">{confirmDeleteInvoice.recipientName || "Customer"}</span></div>
                  <div>Total Amount: <span className="text-foreground font-medium">€{confirmDeleteInvoice.totalAmount.toFixed(2)} {confirmDeleteInvoice.currency}</span></div>
                  <div>Status: <span className="text-foreground font-medium capitalize">{confirmDeleteInvoice.status}</span></div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDeleteInvoice(null)}
                disabled={deletingId !== null}
                className="border-border/70 text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDeleteInvoice}
                disabled={deletingId !== null}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {deletingId !== null ? (
                  <RefreshCw className="size-4 animate-spin mr-1.5" />
                ) : (
                  <Trash2 className="size-4 mr-1.5" />
                )}
                Confirm Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Invoice Numbering Dialog */}
        <Dialog open={isResetNumberingOpen} onOpenChange={setIsResetNumberingOpen}>
          <DialogContent className="sm:max-w-lg bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <RotateCcw className="size-5 text-amber-500" />
                Reset Invoice Numbering
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs pt-1">
                Configure sequential fiscal invoice numbering. You can reset the sequence counter and optionally renumber existing invoices sequentially without gaps.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">
                  Starting Sequence Number
                </label>
                <Input
                  type="number"
                  min="1"
                  value={resetStartSequence}
                  onChange={(e) => setResetStartSequence(e.target.value)}
                  className="border-border/70 text-sm"
                  placeholder="1"
                />
                <p className="text-[11px] text-muted-foreground">
                  The sequence counter will start from this number (e.g. 1 will format as 0001).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">
                    Year Filter
                  </label>
                  <Select value={resetYear} onValueChange={setResetYear}>
                    <SelectTrigger className="border-border/70 text-xs">
                      <SelectValue placeholder="All Years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                      <SelectItem value="2027">2027</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">
                    Month Filter
                  </label>
                  <Select value={resetMonth} onValueChange={setResetMonth}>
                    <SelectTrigger className="border-border/70 text-xs">
                      <SelectValue placeholder="All Months" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Months</SelectItem>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {new Date(2026, i, 1).toLocaleString("default", { month: "long" })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-border/70 bg-muted/20 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resetRenumberExisting}
                    onChange={(e) => setResetRenumberExisting(e.target.checked)}
                    className="mt-0.5 rounded border-border text-[#54a8c7] focus:ring-[#54a8c7]"
                  />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground text-xs">
                      Renumber existing invoices sequentially
                    </span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Orders all existing matching invoices chronologically and assigns contiguous consecutive numbers (e.g. INV-202608-0001, INV-202608-0002...), eliminating any numbering gaps caused by deleted invoices.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsResetNumberingOpen(false)}
                disabled={resettingNumbering}
                className="border-border/70 text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleResetNumbering}
                disabled={resettingNumbering}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {resettingNumbering ? (
                  <RefreshCw className="size-4 animate-spin mr-1.5" />
                ) : (
                  <RotateCcw className="size-4 mr-1.5" />
                )}
                Confirm Reset
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Generate Invoices Dialog */}
        <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
          <DialogContent className="sm:max-w-md max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden bg-card text-card-foreground border-border">
            <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border/40">
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground font-heading">
                <PlusCircle className="size-5 text-[#54a8c7]" />
                Generate Monthly Invoices
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Process unbilled completed transactions for a specific month and create fiscal invoice documents.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Billing Month</label>
                  <Select value={generateMonth} onValueChange={setGenerateMonth}>
                    <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={m.toString()}>
                          {new Date(2026, m - 1).toLocaleString("default", { month: "long" })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Billing Year</label>
                  <Select value={generateYear} onValueChange={setGenerateYear}>
                    <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2026">2026</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="size-3.5" />
                  Automated Billing Information
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Transactions with status <em>completed</em> that have not yet been assigned to an invoice will be bundled per Company or User. Fiscal invoice numbers and VAT breakdowns will be generated automatically.
                </p>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 shrink-0 border-t border-border bg-muted/20 flex flex-row items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsGenerateOpen(false)}
                className="border-border text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={generating}
                onClick={handleGenerateInvoices}
                className="bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] hover:brightness-110 text-white font-bold shadow-md shadow-[#54a8c7]/20"
              >
                {generating ? (
                  <>
                    <RefreshCw className="size-4 mr-1.5 animate-spin" />
                    Generating Invoices...
                  </>
                ) : (
                  <>
                    <PlusCircle className="size-4 mr-1.5" />
                    Create Monthly Invoices
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* SEPA Direct Debit Export Dialog */}
        <Dialog open={isSepaExportOpen} onOpenChange={setIsSepaExportOpen}>
          <DialogContent className="sm:max-w-md max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden bg-card text-card-foreground border-border">
            <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border/40">
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground font-heading">
                <FileCode2 className="size-5 text-emerald-500 dark:text-emerald-400" />
                Export SEPA Direct Debit XML
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Generate an ISO 20022 pain.008.001.02 XML direct debit file for bank collection.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Target Month</label>
                  <Select value={sepaMonth} onValueChange={setSepaMonth}>
                    <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={m.toString()}>
                          {new Date(2026, m - 1).toLocaleString("default", { month: "long" })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Target Year</label>
                  <Select value={sepaYear} onValueChange={setSepaYear}>
                    <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2026">2026</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Mandate Scheme</label>
                  <Select value={sepaScheme} onValueChange={(val: any) => setSepaScheme(val)}>
                    <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CORE">CORE (Standard / B2C)</SelectItem>
                      <SelectItem value="B2B">B2B (Business-to-Business)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Sequence Type</label>
                  <Select value={sepaSeqType} onValueChange={(val: any) => setSepaSeqType(val)}>
                    <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RCUR">RCUR (Recurring)</SelectItem>
                      <SelectItem value="FRST">FRST (First Collection)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Requested Collection Date</label>
                <Input
                  type="date"
                  value={sepaDate}
                  onChange={(e) => setSepaDate(e.target.value)}
                  className="bg-background border-border text-foreground h-9 text-xs"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5" />
                  Banking Protocol Validation
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Outputs valid XML conforming to ISO 20022 pain.008.001.02 with XML entity escaping and CDATA protection. Unpaid invoices linked to active SEPA mandates will be included.
                </p>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 shrink-0 border-t border-border bg-muted/20 flex flex-row items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSepaExportOpen(false)}
                className="border-border text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={exportingSepa}
                onClick={handleExportSepa}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
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
          <DialogContent className="max-w-3xl bg-card border-border text-foreground max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <CreditCard className="size-5 text-[#54a8c7]" />
                    SEPA Direct Debit Mandates
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-xs mt-0.5">
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
                <div className="py-8 text-center text-muted-foreground">
                  <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-[#54a8c7]" />
                  Loading SEPA mandates...
                </div>
              ) : mandates.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CreditCard className="size-8 mx-auto mb-2 opacity-50" />
                  No SEPA mandates registered yet.
                </div>
              ) : (
                <div className="rounded-lg border border-border/70 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-border/70">
                        <TableHead className="text-xs text-muted-foreground">Mandate Ref</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Debtor Name</TableHead>
                        <TableHead className="text-xs text-muted-foreground">IBAN</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Scheme</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Signed Date</TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mandates.map((m) => (
                        <TableRow key={m.id} className="border-border/40 text-xs">
                          <TableCell className="font-mono font-semibold text-[#54a8c7]">
                            {m.mandateRef}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{m.debtorName}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{m.iban}</TableCell>
                          <TableCell>
                            <Badge className={m.mandateType === "B2B" ? "bg-purple-500/15 text-purple-600 dark:text-purple-400" : "bg-blue-500/15 text-blue-600 dark:text-blue-400"}>
                              {m.mandateType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(m.signatureDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteMandate(m.id)}
                              className="size-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
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
                className="border-border/70 text-foreground hover:bg-muted"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Mandate Dialog */}
        <Dialog open={isNewMandateOpen} onOpenChange={setIsNewMandateOpen}>
          <DialogContent className="sm:max-w-md max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden bg-card text-card-foreground border-border">
            <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border/40">
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground font-heading">
                <PlusCircle className="size-5 text-[#54a8c7]" />
                Register SEPA Mandate
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Authorizes direct debit collections from the customer bank account.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateMandate} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4 text-sm">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Debtor / Account Holder Name *</label>
                  <Input
                    required
                    placeholder="e.g. Acme Fleet B.V."
                    value={mandateDebtorName}
                    onChange={(e) => setMandateDebtorName(e.target.value)}
                    className="bg-background border-border text-foreground h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">IBAN *</label>
                  <Input
                    required
                    placeholder="e.g. NL91ABNA0417164300"
                    value={mandateIban}
                    onChange={(e) => setMandateIban(e.target.value.toUpperCase())}
                    className="font-mono bg-background border-border text-foreground h-9 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">BIC / SWIFT (Optional)</label>
                    <Input
                      placeholder="e.g. ABNANL2A"
                      value={mandateBic}
                      onChange={(e) => setMandateBic(e.target.value.toUpperCase())}
                      className="font-mono bg-background border-border text-foreground h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Mandate Scheme</label>
                    <Select value={mandateScheme} onValueChange={(val: any) => setMandateScheme(val)}>
                      <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CORE">CORE (Standard)</SelectItem>
                        <SelectItem value="B2B">B2B (Enterprise)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter className="px-6 py-4 shrink-0 border-t border-border bg-muted/20 flex flex-row items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewMandateOpen(false)}
                  className="border-border text-foreground hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingMandate}
                  className="bg-[#54a8c7] hover:bg-[#4596b4] text-white font-bold"
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
