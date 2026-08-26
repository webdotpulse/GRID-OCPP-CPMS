'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
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
  certificateType: string;
  csr: string;
  status: string;
  createdAt: string;
  signedCertificate?: string | null;
  charger?: { charger_id: number; name: string; model: string | null };
}

export default function SecurityPkiPage() {
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
        api.get('/api/security/ca'),
        api.get('/api/security/certificates'),
        api.get('/api/chargers'),
      ]);

      if (caRes.data.success) {
        setCaData(caRes.data.data);
      }
      if (certsRes.data.success) {
        setInstalledCertificates(certsRes.data.data.installedCertificates || []);
        setPendingRequests(certsRes.data.data.pendingRequests || []);
      }
      if (chargersRes.data.success) {
        setChargers(chargersRes.data.data || []);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to load security & PKI data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

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
      const res = await api.post('/api/security/certificates/sign', { requestId });
      if (res.data.success) {
        toast.success('X.509 certificate issued with V2G Sub-CA signature and recorded in installed certificates.');
        fetchSecurityData();
      }
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
      const res = await api.post('/api/security/certificates/install', {
        chargerId: Number(selectedChargerId),
        certificateType,
        certificatePem,
      });

      if (res.data.success) {
        toast.success(`Certificate successfully pushed to charger #${selectedChargerId} via InstallCertificate RPC`);
        setIsInstallModalOpen(false);
        setSelectedChargerId('');
        setCertificatePem('');
        fetchSecurityData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Installation Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCertificate = async (id: number) => {
    try {
      const res = await api.post('/api/security/certificates/delete', { id });
      if (res.data.success) {
        toast.success('DeleteCertificate RPC dispatched and certificate removed from database.');
        fetchSecurityData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Deletion Failed');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-[#45c4a0]" />
            Security Profiles & PKI Automation
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage OCPP 1.6 Security Profiles (SP1/SP2/SP3), ISO 15118 Plug & Charge Root CAs, and automated certificate lifecycle
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSecurityData}
            disabled={loading}
            className="border-zinc-800 bg-[#1e2228] text-zinc-300 hover:text-white hover:bg-zinc-800"
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
        <div className="p-4 rounded-xl bg-[#1e2228] border border-zinc-800/80 shadow-sm flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-sm">Security Profile 1</h3>
              <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-700">Legacy</Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-1">Unsecured WebSocket over plain HTTP/WS (Basic Auth / No TLS).</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#1e2228] border border-zinc-800/80 shadow-sm flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-[#3f78e0] border border-blue-500/20">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-sm">Security Profile 2 (TLS)</h3>
              <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]">Standard</Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-1">TLS 1.3 Server Certificate encryption with Basic Auth credentials.</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#1e2228] border border-zinc-800/80 shadow-sm flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-sm">Security Profile 3 (mTLS)</h3>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">High Security</Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-1">Mutual TLS (mTLS) client certificate verification & ISO 15118 PKI.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ca" className="space-y-4">
        <TabsList className="bg-[#1e2228] border border-zinc-800 p-1">
          <TabsTrigger value="ca" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-xs">
            <Key className="w-3.5 h-3.5 mr-1.5" />
            Certificate Authorities (Root & Sub CA)
          </TabsTrigger>
          <TabsTrigger value="installed" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-xs">
            <FileCheck2 className="w-3.5 h-3.5 mr-1.5" />
            Installed Certificates ({installedCertificates.length})
          </TabsTrigger>
          <TabsTrigger value="csr" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-xs">
            <FileCode className="w-3.5 h-3.5 mr-1.5" />
            CSR Signing Queue ({pendingRequests.length})
          </TabsTrigger>
        </TabsList>

        {/* CA Tab */}
        <TabsContent value="ca" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Root CA */}
            <div className="p-5 rounded-xl bg-[#1e2228] border border-zinc-800/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Key className="w-5 h-5 text-[#45c4a0]" />
                  <div>
                    <h3 className="font-bold text-white text-base">V2G Root CA</h3>
                    <p className="text-xs text-zinc-400">Self-signed Trust Anchor (RSA 2048 / SHA-256)</p>
                  </div>
                </div>
                {caData?.rootCa && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadPem(caData.rootCa.certificatePem, 'v2g-root-ca.pem')}
                    className="border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download PEM
                  </Button>
                )}
              </div>

              {caData?.rootCa ? (
                <div className="space-y-2 text-xs">
                  <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Serial Number:</span>
                      <span className="text-white">{caData.rootCa.serialNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Valid Until:</span>
                      <span className="text-emerald-400">{new Date(caData.rootCa.validTo).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Issuer Name Hash:</span>
                      <span className="text-zinc-400 truncate max-w-[240px]">{caData.rootCa.certificateHashData.issuerNameHash}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-zinc-500 text-xs">Root CA Initializing...</div>
              )}
            </div>

            {/* Sub CA */}
            <div className="p-5 rounded-xl bg-[#1e2228] border border-zinc-800/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Key className="w-5 h-5 text-[#3f78e0]" />
                  <div>
                    <h3 className="font-bold text-white text-base">V2G Sub-CA 1</h3>
                    <p className="text-xs text-zinc-400">Intermediate Signing Authority for Chargers & Vehicles</p>
                  </div>
                </div>
                {caData?.subCa && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadPem(caData.subCa.certificatePem, 'v2g-sub-ca.pem')}
                    className="border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download PEM
                  </Button>
                )}
              </div>

              {caData?.subCa ? (
                <div className="space-y-2 text-xs">
                  <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Serial Number:</span>
                      <span className="text-white">{caData.subCa.serialNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Valid Until:</span>
                      <span className="text-emerald-400">{new Date(caData.subCa.validTo).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Issuer Key Hash:</span>
                      <span className="text-zinc-400 truncate max-w-[240px]">{caData.subCa.certificateHashData.issuerKeyHash}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-zinc-500 text-xs">Sub CA Initializing...</div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Installed Certificates Tab */}
        <TabsContent value="installed">
          <div className="rounded-xl bg-[#1e2228] border border-zinc-800/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-900/70 border-b border-zinc-800/80 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Target Charger</th>
                    <th className="px-5 py-3.5">Certificate Type</th>
                    <th className="px-5 py-3.5">Serial Number</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Valid Until</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {installedCertificates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-zinc-500">
                        <FileCheck2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        No certificates installed on physical chargers yet.
                      </td>
                    </tr>
                  ) : (
                    installedCertificates.map((cert) => (
                      <tr key={cert.id} className="hover:bg-zinc-850/40 transition-colors">
                        <td className="px-5 py-4 font-medium text-white">
                          {cert.charger?.name || `Charger #${cert.chargerId}`}
                        </td>
                        <td className="px-5 py-4">
                          <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">
                            {cert.certificateType}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-zinc-300">
                          {cert.serialNumber}
                        </td>
                        <td className="px-5 py-4">
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
                            {cert.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-xs text-zinc-400">
                          {new Date(cert.validTo).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCertificate(cert.id)}
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs h-8"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Delete
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

        {/* CSR Signing Queue Tab */}
        <TabsContent value="csr">
          <div className="rounded-xl bg-[#1e2228] border border-zinc-800/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-900/70 border-b border-zinc-800/80 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Charger ID</th>
                    <th className="px-5 py-3.5">Certificate Type</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Requested At</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {pendingRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-zinc-500">
                        <FileCode className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        No pending Certificate Signing Requests (CSRs).
                      </td>
                    </tr>
                  ) : (
                    pendingRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-zinc-850/40 transition-colors">
                        <td className="px-5 py-4 font-medium text-white">
                          {req.charger?.name || `Charger #${req.chargerId}`}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-zinc-300">
                          {req.certificateType}
                        </td>
                        <td className="px-5 py-4">
                          <Badge className={req.status === 'Signed' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}>
                            {req.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-xs text-zinc-400">
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
      </Tabs>

      {/* Install Certificate Modal */}
      <Dialog open={isInstallModalOpen} onOpenChange={setIsInstallModalOpen}>
        <DialogContent className="bg-[#1e2228] border-zinc-800 text-white sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-white">
              <ShieldCheck className="w-5 h-5 text-[#3f78e0]" />
              Install Certificate on Charger
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm">
              Pushes an OCPP <code className="text-zinc-300">InstallCertificate</code> payload directly to the charger hardware.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInstallCertificate} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-zinc-300">Select Charge Point</Label>
              <Select value={selectedChargerId} onValueChange={setSelectedChargerId}>
                <SelectTrigger className="bg-zinc-900/80 border-zinc-800 text-white">
                  <SelectValue placeholder="Choose a charger..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1e2228] border-zinc-800 text-white">
                  {chargers.map((ch) => (
                    <SelectItem key={ch.charger_id} value={String(ch.charger_id)}>
                      {ch.name} (#{ch.charger_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-zinc-300">Certificate Type</Label>
              <Select value={certificateType} onValueChange={setCertificateType}>
                <SelectTrigger className="bg-zinc-900/80 border-zinc-800 text-white">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1e2228] border-zinc-800 text-white">
                  <SelectItem value="ChargeStationCertificate">ChargeStationCertificate (Leaf)</SelectItem>
                  <SelectItem value="CSMSRootCertificate">CSMSRootCertificate (Server CA)</SelectItem>
                  <SelectItem value="V2GRootCertificate">V2GRootCertificate (Plug & Charge Root CA)</SelectItem>
                  <SelectItem value="MORootCertificate">MORootCertificate (Mobility Operator Root CA)</SelectItem>
                  <SelectItem value="ManufacturerRootCertificate">ManufacturerRootCertificate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-zinc-300">Certificate Content (PEM)</Label>
              <Textarea
                value={certificatePem}
                onChange={(e) => setCertificatePem(e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                rows={6}
                className="bg-zinc-900/80 border-zinc-800 font-mono text-xs text-emerald-400 focus-visible:ring-[#3f78e0]"
                required
              />
            </div>

            <DialogFooter className="pt-4 border-t border-zinc-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInstallModalOpen(false)}
                className="border-zinc-800 text-zinc-300 hover:bg-zinc-800"
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
  );
}
