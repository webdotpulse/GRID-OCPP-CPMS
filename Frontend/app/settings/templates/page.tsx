"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Code,
  Copy,
  Check,
  Languages,
  Sparkles,
  ArrowLeft,
} from "lucide-react";

interface MailTemplate {
  id?: number;
  name: string;
  type: string;
  language: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

const TEMPLATE_TYPES = [
  { id: "admin_welcome", label: "Admin Welcome", desc: "Sent when an admin creates a new user account" },
  { id: "registration", label: "Self-Registration", desc: "Sent upon driver/user sign-up" },
  { id: "verification", label: "Email Verification", desc: "Contains email activation token link" },
  { id: "password_reset", label: "Password Reset", desc: "Contains 1-hour secure password reset link" },
  { id: "2fa_login", label: "2FA Login Code", desc: "Contains 6-digit one-time login authentication code" },
  { id: "2fa_setup", label: "2FA Setup Code", desc: "Contains 2FA enablement confirmation code" },
  { id: "invoice", label: "Invoice PDF Notification", desc: "Sent with monthly charging session VAT invoice" },
];

const AVAILABLE_VARIABLES = [
  { tag: "{{name}}", label: "User Name", desc: "Recipient full name" },
  { tag: "{{userEmail}}", label: "Email", desc: "Recipient email address" },
  { tag: "{{loginUrl}}", label: "Login URL", desc: "Direct dashboard URL" },
  { tag: "{{verificationUrl}}", label: "Verify URL", desc: "Email activation link" },
  { tag: "{{resetUrl}}", label: "Reset URL", desc: "Password reset link" },
  { tag: "{{twoFactorCode}}", label: "2FA Code", desc: "6-digit numeric OTP" },
  { tag: "{{password}}", label: "Temp Password", desc: "Generated initial password" },
  { tag: "{{invoiceNumber}}", label: "Invoice #", desc: "Fiscal invoice number" },
  { tag: "{{totalAmount}}", label: "Total Amount", desc: "Total price formatted" },
  { tag: "{{currency}}", label: "Currency", desc: "EUR, USD, etc." },
  { tag: "{{dueDate}}", label: "Due Date", desc: "Payment due date" },
];

export default function MailTemplatesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<MailTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
        router.push("/dashboard");
      } else {
        fetchTemplates();
      }
    }
  }, [user, authLoading, router]);

  const fetchTemplates = async () => {
    try {
      const response = await api.get("/mail/templates");
      const data = response.data?.data || response.data;
      if (Array.isArray(data)) {
        setTemplates(data);
      }
    } catch (error) {
      toast.error("Failed to load mail templates");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: MailTemplate) => {
    setEditingTemplate({ ...template });
    setActiveTab("edit");
  };

  const handleCreate = () => {
    setEditingTemplate({
      name: "New Template",
      type: "admin_welcome",
      language: "en",
      subject: "Welcome to OCPP CPMS",
      bodyHtml: "<h2>Hello {{name}},</h2><p>Welcome to our network.</p>",
      bodyText: "Hello {{name}},\nWelcome to our network.",
    });
    setActiveTab("edit");
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this mail template?")) {
      try {
        await api.delete(`/mail/templates/${id}`);
        toast.success("Template deleted successfully");
        fetchTemplates();
      } catch (error) {
        toast.error("Failed to delete template");
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    try {
      if (editingTemplate.id) {
        await api.put(`/mail/templates/${editingTemplate.id}`, editingTemplate);
        toast.success("Mail template updated");
      } else {
        await api.post("/mail/templates", editingTemplate);
        toast.success("Mail template created");
      }
      setEditingTemplate(null);
      fetchTemplates();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to save template");
    }
  };

  const copyVariable = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    toast.success(`Copied ${tag}`);
    setTimeout(() => setCopiedTag(null), 1500);
  };

  const getLanguageFlag = (lang: string) => {
    switch (lang.toLowerCase()) {
      case "en": return "🇬🇧 English";
      case "nl": return "🇳🇱 Nederlands";
      case "fr": return "🇫🇷 Français";
      default: return lang.toUpperCase();
    }
  };

  const renderPreviewHtml = (htmlContent: string) => {
    // Replace sample placeholder variables for realistic preview
    let preview = htmlContent || "<p class='text-muted-foreground italic'>No HTML content</p>";
    preview = preview
      .replace(/{{name}}/g, "Jane Doe")
      .replace(/{{userEmail}}/g, "jane.doe@example.com")
      .replace(/{{loginUrl}}/g, "https://cpms.example.com/login")
      .replace(/{{verificationUrl}}/g, "https://cpms.example.com/verify-email?token=sample123")
      .replace(/{{resetUrl}}/g, "https://cpms.example.com/reset-password?token=sample123")
      .replace(/{{twoFactorCode}}/g, "849201")
      .replace(/{{password}}/g, "TempPass2026!")
      .replace(/{{invoiceNumber}}/g, "INV-2026-0801")
      .replace(/{{totalAmount}}/g, "48.50")
      .replace(/{{currency}}/g, "EUR")
      .replace(/{{dueDate}}/g, "2026-09-15");
    return preview;
  };

  const filteredTemplates = templates.filter((t) => {
    if (langFilter === "all") return true;
    return t.language.toLowerCase() === langFilter.toLowerCase();
  });

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppShell>
    );
  }

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return null;
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Mail Templates & Notifications</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Customize responsive HTML and plain text email notifications in English, Dutch, and French.
            </p>
          </div>

          {!editingTemplate && (
            <Button onClick={handleCreate} className="gap-2 rounded-xl">
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          )}
        </div>

        {/* Template Form / Editor */}
        {editingTemplate ? (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingTemplate(null)}
                  className="rounded-xl"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {editingTemplate.id ? "Edit Mail Template" : "Create New Mail Template"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Type: <code className="text-primary font-bold">{editingTemplate.type}</code> • Language:{" "}
                    <code className="text-foreground">{editingTemplate.language}</code>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={activeTab === "edit" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab("edit")}
                  className="rounded-xl gap-1.5"
                >
                  <Code className="h-3.5 w-3.5" />
                  Source Code
                </Button>
                <Button
                  type="button"
                  variant={activeTab === "preview" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab("preview")}
                  className="rounded-xl gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Live Preview
                </Button>
              </div>
            </div>

            {/* Variable Placeholders Cheat Sheet */}
            <div className="bg-muted/40 p-4 rounded-xl border border-border/60 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Available Template Variables (Click to Copy):
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {AVAILABLE_VARIABLES.map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => copyVariable(v.tag)}
                    className="inline-flex items-center gap-1 text-xs bg-card hover:bg-muted border border-border px-2.5 py-1 rounded-lg transition-colors group"
                    title={v.desc}
                  >
                    <code className="text-primary font-semibold">{v.tag}</code>
                    <span className="text-[10px] text-muted-foreground">({v.label})</span>
                    {copiedTag === v.tag ? (
                      <Check className="h-3 w-3 text-emerald-500 ml-0.5" />
                    ) : (
                      <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 ml-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="tpl-name" className="text-xs font-semibold">Template Display Name</Label>
                  <Input
                    id="tpl-name"
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="tpl-type" className="text-xs font-semibold">Template Type Key</Label>
                  <select
                    id="tpl-type"
                    value={editingTemplate.type}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, type: e.target.value })}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    required
                  >
                    {TEMPLATE_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label} ({t.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="tpl-lang" className="text-xs font-semibold">Language</Label>
                  <select
                    id="tpl-lang"
                    value={editingTemplate.language}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, language: e.target.value })}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    required
                  >
                    <option value="en">🇬🇧 English (en)</option>
                    <option value="nl">🇳🇱 Nederlands (nl)</option>
                    <option value="fr">🇫🇷 Français (fr)</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="tpl-subject" className="text-xs font-semibold">Email Subject Line</Label>
                <Input
                  id="tpl-subject"
                  value={editingTemplate.subject}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>

              {activeTab === "edit" ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="tpl-html" className="text-xs font-semibold flex items-center justify-between">
                      <span>HTML Email Body (Full HTML structure with inline styles)</span>
                      <span className="text-[11px] text-muted-foreground font-normal">Supports full HTML + CSS</span>
                    </Label>
                    <Textarea
                      id="tpl-html"
                      rows={14}
                      value={editingTemplate.bodyHtml}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, bodyHtml: e.target.value })}
                      className="mt-1 font-mono text-xs leading-relaxed"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="tpl-text" className="text-xs font-semibold">Plain Text Body Fallback</Label>
                    <Textarea
                      id="tpl-text"
                      rows={6}
                      value={editingTemplate.bodyText}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, bodyText: e.target.value })}
                      className="mt-1 font-mono text-xs leading-relaxed"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-4">
                  <div className="bg-card p-3 rounded-lg border border-border text-sm">
                    <span className="font-semibold text-muted-foreground">Subject: </span>
                    <span className="font-bold text-foreground">
                      {editingTemplate.subject.replace(/{{name}}/g, "Jane Doe").replace(/{{invoiceNumber}}/g, "INV-2026-0801")}
                    </span>
                  </div>

                  <div className="border border-border rounded-xl bg-white p-4 overflow-auto max-h-[600px] shadow-xs">
                    <div
                      dangerouslySetInnerHTML={{ __html: renderPreviewHtml(editingTemplate.bodyHtml) }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <Button type="submit" className="rounded-xl px-6">
                  Save Template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingTemplate(null)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Template List View */
          <div className="space-y-4">
            {/* Filter Tabs */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground uppercase">Filter Language:</span>
                {["all", "en", "nl", "fr"].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLangFilter(lang)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      langFilter === lang
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {lang === "all" ? "All Languages" : getLanguageFlag(lang)}
                  </button>
                ))}
              </div>

              <span className="text-xs text-muted-foreground">
                Showing <strong>{filteredTemplates.length}</strong> templates
              </span>
            </div>

            {/* Templates Table / Grid */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Template Name</th>
                      <th className="py-3 px-4 font-semibold">Type Key</th>
                      <th className="py-3 px-4 font-semibold">Language</th>
                      <th className="py-3 px-4 font-semibold">Subject Line</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTemplates.map((tpl) => (
                      <tr key={tpl.id || `${tpl.type}-${tpl.language}`} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          {tpl.name}
                        </td>
                        <td className="py-3.5 px-4">
                          <code className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">
                            {tpl.type}
                          </code>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant="outline" className="text-xs font-medium">
                            {getLanguageFlag(tpl.language)}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground max-w-xs truncate">
                          {tpl.subject}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(tpl)}
                            className="rounded-lg h-8 gap-1"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-primary" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => tpl.id && handleDelete(tpl.id)}
                            className="rounded-lg h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredTemplates.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground">
                          No mail templates found for the selected filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
