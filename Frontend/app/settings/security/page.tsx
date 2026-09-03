'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import { toast } from 'sonner';
import {
  ShieldCheck,
  Key,
  FileCheck2,
  Lock,
  Download,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Layers,
  Cpu,
  Loader2,
  ChevronRight,
  BookOpen,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';

interface CaInfo {
  certificatePem: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  certificateHashData: {
    issuerNameHash: string;
    issuerKeyHash: string;
    serialNumber: string;
  };
}

interface InstalledCertificate {
  id: number;
  chargerId: number;
  certificateType: string;
  certificatePem: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  status: string;
  createdAt: string;
  charger?: { charger_id: number; name: string; model: string | null };
}

interface CertificateRequest {
  id: number;
  chargerId: number;
  csrPem: string;
  certificateType: string;
  status: string;
  createdAt: string;
  signedCertificate?: string | null;
  charger?: { charger_id: number; name: string; model: string | null };
}

export default function SecurityPkiPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [caData, setCaData] = useState<{ rootCa: CaInfo; subCa: CaInfo } | null>(null);
  const [installedCertificates, setInstalledCertificates] = useState<InstalledCertificate[]>([]);
  const [pendingRequests, setPendingRequests] = useState<CertificateRequest[]>([]);
  const [chargers, setChargers] = useState<any[]>([]);

  // Install Modal State
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [selectedChargerId, setSelectedChargerId] = useState('');
  const [certificateType, setCertificateType] = useState('ChargeStationCertificate');
  const [certificatePem, setCertificatePem] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      const [caRes, certsRes, chargersRes] = await Promise.all([
        api.get('/security/ca'),
        api.get('/security/certificates'),
        api.get('/chargers'),
      ]);

      const ca = caRes.data?.data || caRes.data;
      if (ca) {
        setCaData(ca);
      }
      const certs = certsRes.data?.data || certsRes.data;
      if (certs) {
        setInstalledCertificates(certs.installedCertificates || []);
        setPendingRequests(certs.pendingRequests || []);
      }
      const chargersList = Array.isArray(chargersRes.data)
        ? chargersRes.data
        : (chargersRes.data?.chargers || chargersRes.data?.data || []);
      setChargers(chargersList);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to load security & PKI data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && (user?.role === 'admin' || user?.role === 'superadmin')) {
      fetchSecurityData();
    }
  }, [authLoading, user]);

  const handleDownloadPem = (pem: string, filename: string) => {
    const blob = new Blob([pem], { type: 'application/x-pem-file' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSignCsr = async (requestId: number) => {
    try {
      const res = await api.post('/security/certificates/sign', { requestId });
      toast.success('X.509 certificate issued with V2G Sub-CA signature and recorded in installed certificates.');
      fetchSecurityData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Signing Failed');
    }
  };

  const handleInstallCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChargerId || !certificatePem) {
      toast.error('Please select a charger and enter PEM certificate content');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/security/certificates/install', {
        chargerId: Number(selectedChargerId),
        certificateType,
        certificatePem,
      });

      toast.success(`Certificate successfully pushed to charger #${selectedChargerId} via InstallCertificate RPC`);
      setIsInstallModalOpen(false);
      setSelectedChargerId('');
      setCertificatePem('');
      fetchSecurityData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Installation Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCertificate = async (id: number) => {
    try {
      const res = await api.post('/security/certificates/delete', { id });
      toast.success('DeleteCertificate RPC dispatched and certificate removed from database.');
      fetchSecurityData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Deletion Failed');
    }
  };

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-[#3f78e0]" />
          <span className="text-xs">Loading PKI security profiles...</span>
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
            <p className="text-sm text-muted-foreground">You do not have permission to view PKI security profiles.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/settings" className="hover:text-foreground transition-colors">
            Settings
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">Security & PKI</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5 font-heading">
              <div className="size-9 rounded-xl bg-[#45c4a0]/15 text-[#45c4a0] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              Security Profiles & PKI Automation
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage OCPP 1.6 Security Profiles (SP1/SP2/SP3), ISO 15118 Plug & Charge Root CAs, and automated certificate lifecycle
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSecurityData}
              disabled={loading}
              className="border-border text-foreground hover:bg-muted/50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setIsInstallModalOpen(true)}
              className="bg-[#3f78e0] hover:bg-[#3364be] text-white shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-4 h-4 mr-2" />
              Install Certificate
            </Button>
          </div>
        </div>

        {/* Security Profile Badges & Status Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-muted text-muted-foreground border border-border">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground text-sm">Security Profile 1</h3>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">Legacy</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Unsecured WebSocket over plain HTTP/WS (Basic Auth / No TLS).</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-[#3f78e0] border border-blue-500/20">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground text-sm">Security Profile 2 (TLS)</h3>
                <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px]">Standard</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">TLS 1.3 Server Certificate encryption with Basic Auth credentials.</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground text-sm">Security Profile 3 (mTLS)</h3>
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">High Security</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Mutual TLS (mTLS) client certificate verification & ISO 15118 PKI.</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="ca" className="space-y-4">
          <TabsList className="bg-muted/50 border border-border p-1">
            <TabsTrigger value="ca" className="text-xs">
              <Key className="w-3.5 h-3.5 mr-1.5" />
              Certificate Authorities (Root & Sub CA)
            </TabsTrigger>
            <TabsTrigger value="installed" className="text-xs">
              <FileCheck2 className="w-3.5 h-3.5 mr-1.5" />
              Installed Certificates ({installedCertificates.length})
            </TabsTrigger>
            <TabsTrigger value="csr" className="text-xs">
              <FileCode className="w-3.5 h-3.5 mr-1.5" />
              CSR Signing Queue ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="docs" className="text-xs">
              <BookOpen className="w-3.5 h-3.5 mr-1.5 text-[#3f78e0]" />
              Security Documentation & Architecture Guide
            </TabsTrigger>
          </TabsList>

          {/* CA Tab */}
          <TabsContent value="ca" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Root CA */}
              <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Key className="w-5 h-5 text-[#45c4a0]" />
                    <div>
                      <h3 className="font-bold text-foreground text-base font-heading">V2G Root CA</h3>
                      <p className="text-xs text-muted-foreground">Self-signed Trust Anchor (RSA 2048 / SHA-256)</p>
                    </div>
                  </div>
                  {caData?.rootCa && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPem(caData.rootCa.certificatePem, 'v2g-root-ca.pem')}
                      className="text-xs border-border"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Download PEM
                    </Button>
                  )}
                </div>

                {caData?.rootCa ? (
                  <div className="space-y-2 text-xs">
                    <div className="bg-muted/40 p-3 rounded-lg border border-border space-y-1.5 font-mono">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Serial Number:</span>
                        <span className="text-foreground">{caData.rootCa.serialNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valid Until:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{new Date(caData.rootCa.validTo).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Issuer Name Hash:</span>
                        <span className="text-foreground truncate max-w-[200px]">{caData.rootCa.certificateHashData.issuerNameHash}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Issuer Key Hash:</span>
                        <span className="text-foreground truncate max-w-[200px]">{caData.rootCa.certificateHashData.issuerKeyHash}</span>
                      </div>
                    </div>

                    <div className="bg-muted/60 dark:bg-zinc-950 p-3 rounded-lg border border-border overflow-x-auto max-h-[140px]">
                      <pre className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">
                        {caData.rootCa.certificatePem}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground py-6 text-center">Root CA certificate not initialized.</div>
                )}
              </div>

              {/* Sub-CA */}
              <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-5 h-5 text-[#54a8c7]" />
                    <div>
                      <h3 className="font-bold text-foreground text-base font-heading">V2G Intermediate Sub-CA</h3>
                      <p className="text-xs text-muted-foreground">Intermediate Signer for Leaf Certificates (RSA 2048 / SHA-256)</p>
                    </div>
                  </div>
                  {caData?.subCa && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPem(caData.subCa.certificatePem, 'v2g-sub-ca.pem')}
                      className="text-xs border-border"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Download PEM
                    </Button>
                  )}
                </div>

                {caData?.subCa ? (
                  <div className="space-y-2 text-xs">
                    <div className="bg-muted/40 p-3 rounded-lg border border-border space-y-1.5 font-mono">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Serial Number:</span>
                        <span className="text-foreground">{caData.subCa.serialNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valid Until:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{new Date(caData.subCa.validTo).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Issuer Name Hash:</span>
                        <span className="text-foreground truncate max-w-[200px]">{caData.subCa.certificateHashData.issuerNameHash}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Issuer Key Hash:</span>
                        <span className="text-foreground truncate max-w-[200px]">{caData.subCa.certificateHashData.issuerKeyHash}</span>
                      </div>
                    </div>

                    <div className="bg-muted/60 dark:bg-zinc-950 p-3 rounded-lg border border-border overflow-x-auto max-h-[140px]">
                      <pre className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">
                        {caData.subCa.certificatePem}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground py-6 text-center">Sub-CA certificate not initialized.</div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Installed Tab */}
          <TabsContent value="installed" className="space-y-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground uppercase border-b border-border">
                    <tr>
                      <th className="px-5 py-3.5">Charge Point</th>
                      <th className="px-5 py-3.5">Type</th>
                      <th className="px-5 py-3.5">Serial Number</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Valid Until</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {installedCertificates.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground text-xs">
                          No leaf certificates installed yet. Click &quot;Install Certificate&quot; to push one to a charger.
                        </td>
                      </tr>
                    ) : (
                      installedCertificates.map((cert) => (
                        <tr key={cert.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-4 font-medium text-foreground">
                            {cert.charger?.name || `Charger #${cert.chargerId}`}
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-foreground">
                            {cert.certificateType}
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                            {cert.serialNumber}
                          </td>
                          <td className="px-5 py-4">
                            <Badge className={cert.status === 'Installed' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}>
                              {cert.status}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            {new Date(cert.validTo).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadPem(cert.certificatePem, `cert-${cert.chargerId}-${cert.id}.pem`)}
                              className="text-muted-foreground hover:text-foreground text-xs h-8"
                            >
                              <Download className="w-3.5 h-3.5 mr-1" />
                              PEM
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* CSR Tab */}
          <TabsContent value="csr" className="space-y-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground uppercase border-b border-border">
                    <tr>
                      <th className="px-5 py-3.5">Charge Point</th>
                      <th className="px-5 py-3.5">Certificate Type</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Requested At</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pendingRequests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground text-xs">
                          No pending Certificate Signing Requests in queue.
                        </td>
                      </tr>
                    ) : (
                      pendingRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-4 font-medium text-foreground">
                            {req.charger?.name || `Charger #${req.chargerId}`}
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-foreground">
                            {req.certificateType}
                          </td>
                          <td className="px-5 py-4">
                            <Badge className={req.status === 'Signed' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}>
                              {req.status}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            {new Date(req.createdAt).toLocaleString()}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {req.status === 'Pending' && (
                              <Button
                                size="sm"
                                onClick={() => handleSignCsr(req.id)}
                                className="bg-[#3f78e0] hover:bg-[#3364be] text-white text-xs h-8"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                                Sign & Issue
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Documentation & Architecture Guide Tab */}
          <TabsContent value="docs" className="space-y-6">
            {/* Overview Hero Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-teal-500/10 border border-border space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-xl bg-[#3f78e0]/20 text-[#3f78e0] flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground font-heading">
                    Enterprise OCPP & ISO 15118 PKI Security Architecture
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Complete end-to-end reference guide on Security Profiles, Mutual TLS (mTLS), Certificate Signing Requests (CSR), and ISO 15118 Plug & Charge trust chains.
                  </p>
                </div>
              </div>
            </div>

            {/* Step-by-Step PKI Workflow Cards */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-foreground font-heading flex items-center gap-2">
                <Workflow className="w-4 h-4 text-[#54a8c7]" />
                How It Works: 5-Step PKI Provisioning & Lifecycle Workflow
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Step 1 */}
                <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-[#3f78e0]/15 text-[#3f78e0] font-mono text-[10px]">STEP 1</Badge>
                      <Key className="w-4 h-4 text-[#3f78e0]" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground font-heading">Trust Anchor Distribution</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Download the <strong>Root CA</strong> and <strong>Sub-CA</strong> PEM certificates from this dashboard. These trust anchors are pre-flashed or pushed to the charge point hardware during commissioning.
                    </p>
                  </div>
                  <div className="bg-muted/40 p-2.5 rounded-lg border border-border text-[11px] font-mono text-muted-foreground">
                    Payload: CSMSRootCertificate / V2GRootCertificate
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 font-mono text-[10px]">STEP 2</Badge>
                      <FileCode className="w-4 h-4 text-purple-500" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground font-heading">CSR Generation & Submission</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      The charging station generates an asymmetric key pair inside its internal TPM/Secure Element and transmits a Certificate Signing Request via the OCPP <code className="text-primary font-mono text-[11px]">SignCertificate</code> message.
                    </p>
                  </div>
                  <div className="bg-muted/40 p-2.5 rounded-lg border border-border text-[11px] font-mono text-muted-foreground">
                    Action: [2, &quot;msg-1&quot;, &quot;SignCertificate&quot;, &#123; csr: &quot;...&quot; &#125;]
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono text-[10px]">STEP 3</Badge>
                      <FileCheck2 className="w-4 h-4 text-amber-500" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground font-heading">Sub-CA Validation & Signing</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      The CPMS validates the charge point identity against its registration whitelist. The intermediate Sub-CA cryptographically signs the CSR and returns the leaf certificate via <code className="text-primary font-mono text-[11px]">CertificateSigned</code>.
                    </p>
                  </div>
                  <div className="bg-muted/40 p-2.5 rounded-lg border border-border text-[11px] font-mono text-muted-foreground">
                    Action: CertificateSigned (Type: ChargeStationCertificate)
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">STEP 4</Badge>
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground font-heading">Mutual TLS (mTLS) Handshake</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Under <strong>Security Profile 3</strong>, the charger presents its signed client certificate during the TLS 1.3 handshake. The CPMS validates the certificate against the Sub-CA before establishing the WebSocket stream.
                    </p>
                  </div>
                  <div className="bg-muted/40 p-2.5 rounded-lg border border-border text-[11px] font-mono text-muted-foreground">
                    Protocol: TLS 1.3 with Client Cert Authentication
                  </div>
                </div>

                {/* Step 5 */}
                <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-mono text-[10px]">STEP 5</Badge>
                      <RefreshCw className="w-4 h-4 text-cyan-500" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground font-heading">Automated Certificate Rollover</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      30 days prior to certificate expiration, the charger triggers automatic renewal, or the CPMS sends <code className="text-primary font-mono text-[11px]">InstallCertificate</code> to replace leaf credentials without downtime.
                    </p>
                  </div>
                  <div className="bg-muted/40 p-2.5 rounded-lg border border-border text-[11px] font-mono text-muted-foreground">
                    Status: Zero-downtime automatic rotation
                  </div>
                </div>

                {/* Step 6: Direct Injection */}
                <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 font-mono text-[10px]">MANUAL OVERRIDE</Badge>
                      <Plus className="w-4 h-4 text-blue-500" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground font-heading">Manual Certificate Installation</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      For offline or legacy chargers that do not support automated CSR generation, click <strong>"Install Certificate"</strong> above to paste a pre-signed PEM and directly push it to the charge point slot.
                    </p>
                  </div>
                  <div className="bg-muted/40 p-2.5 rounded-lg border border-border text-[11px] font-mono text-muted-foreground">
                    Trigger: InstallCertificate (OCPP RPC)
                  </div>
                </div>
              </div>
            </div>

            {/* Security Profile Comparison Matrix */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-foreground font-heading flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#fab758]" />
                OCPP Security Profiles Comparison Matrix
              </h3>

              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground uppercase border-b border-border">
                    <tr>
                      <th className="px-5 py-3.5">Profile</th>
                      <th className="px-5 py-3.5">Transport</th>
                      <th className="px-5 py-3.5">Authentication</th>
                      <th className="px-5 py-3.5">Encryption</th>
                      <th className="px-5 py-3.5">ISO 15118 Compatible</th>
                      <th className="px-5 py-3.5">Recommended For</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    <tr className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4 font-bold text-foreground">
                        <Badge variant="outline" className="text-muted-foreground">Profile 1 (SP1)</Badge>
                      </td>
                      <td className="px-5 py-4 font-mono">Unencrypted (ws://)</td>
                      <td className="px-5 py-4">HTTP Basic Authentication</td>
                      <td className="px-5 py-4 text-rose-600 dark:text-rose-400 font-semibold">None (Cleartext)</td>
                      <td className="px-5 py-4 text-rose-600 dark:text-rose-400">❌ No</td>
                      <td className="px-5 py-4 text-muted-foreground">Local development & legacy test environments only</td>
                    </tr>
                    <tr className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4 font-bold text-foreground">
                        <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30">Profile 2 (SP2)</Badge>
                      </td>
                      <td className="px-5 py-4 font-mono">Encrypted (wss://)</td>
                      <td className="px-5 py-4">HTTP Basic Auth (Charger ID + Password)</td>
                      <td className="px-5 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">TLS 1.2 / TLS 1.3</td>
                      <td className="px-5 py-4 text-amber-600 dark:text-amber-400">⚠️ Partial</td>
                      <td className="px-5 py-4 text-muted-foreground">Public commercial charging stations without client certs</td>
                    </tr>
                    <tr className="hover:bg-muted/30 transition-colors bg-emerald-500/5">
                      <td className="px-5 py-4 font-bold text-foreground">
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Profile 3 (SP3)</Badge>
                      </td>
                      <td className="px-5 py-4 font-mono">Encrypted (wss://)</td>
                      <td className="px-5 py-4 font-bold text-emerald-600 dark:text-emerald-400">Mutual TLS (mTLS) Client Leaf Certificate</td>
                      <td className="px-5 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">TLS 1.3 (ECDHE-RSA / ECDHE-ECDSA)</td>
                      <td className="px-5 py-4 text-emerald-600 dark:text-emerald-400 font-bold">✅ Yes (Full Plug & Charge)</td>
                      <td className="px-5 py-4 text-foreground font-semibold">Enterprise fleets, High-Power DC chargers, V2G grids</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Troubleshooting & Best Practices */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-3">
                <h4 className="font-bold text-foreground text-sm font-heading flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  PKI Best Practices
                </h4>
                <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
                  <li><strong>NTP Clock Synchronization:</strong> Ensure all chargers run network time protocol (NTP) to prevent false certificate validity rejections.</li>
                  <li><strong>Secure Key Storage:</strong> Leaf private keys must never leave the charger TPM or secure storage element.</li>
                  <li><strong>Sub-CA Isolation:</strong> Keep the Root CA offline in cold storage; only use the Sub-CA for daily automated signing.</li>
                  <li><strong>Automated Renewal:</strong> Set charger renewal threshold to 30 days before expiration to prevent unexpected lockouts.</li>
                </ul>
              </div>

              <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-3">
                <h4 className="font-bold text-foreground text-sm font-heading flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Common Troubleshooting Scenarios
                </h4>
                <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
                  <li><strong>Handshake Failure (Unknown CA):</strong> Verify the charger has the latest Sub-CA and Root CA installed in its trust store.</li>
                  <li><strong>CSR Rejected:</strong> Ensure the Common Name (CN) in the CSR subject matches the hardware ChargePointId exactly.</li>
                  <li><strong>Expired Leaf Cert:</strong> Use the "Install Certificate" button to push an updated certificate manually.</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Install Certificate Modal */}
        <Dialog open={isInstallModalOpen} onOpenChange={setIsInstallModalOpen}>
          <DialogContent className="sm:max-w-[540px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="w-5 h-5 text-[#3f78e0]" />
                Install Certificate on Charger
              </DialogTitle>
              <DialogDescription>
                Pushes an OCPP <code className="text-primary font-mono text-xs">InstallCertificate</code> payload directly to the charger hardware.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleInstallCertificate} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Select Charge Point</Label>
                <Select value={selectedChargerId} onValueChange={setSelectedChargerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a charger..." />
                  </SelectTrigger>
                  <SelectContent>
                    {chargers.map((ch) => (
                      <SelectItem key={ch.charger_id} value={String(ch.charger_id)}>
                        {ch.name} (#{ch.charger_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Certificate Type</Label>
                <Select value={certificateType} onValueChange={setCertificateType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ChargeStationCertificate">ChargeStationCertificate (Leaf)</SelectItem>
                    <SelectItem value="CSMSRootCertificate">CSMSRootCertificate (Server CA)</SelectItem>
                    <SelectItem value="V2GRootCertificate">V2GRootCertificate (Plug & Charge Root CA)</SelectItem>
                    <SelectItem value="MORootCertificate">MORootCertificate (Mobility Operator Root CA)</SelectItem>
                    <SelectItem value="ManufacturerRootCertificate">ManufacturerRootCertificate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Certificate Content (PEM)</Label>
                <Textarea
                  value={certificatePem}
                  onChange={(e) => setCertificatePem(e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  rows={6}
                  className="font-mono text-xs text-emerald-700 dark:text-emerald-400 focus-visible:ring-[#3f78e0]"
                  required
                />
              </div>

              <DialogFooter className="pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInstallModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#3f78e0] hover:bg-[#3364be] text-white"
                >
                  {submitting ? 'Installing...' : 'Dispatch InstallCertificate'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
