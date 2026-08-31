'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import { toast } from 'sonner';
import {
  Cpu,
  Plus,
  Trash2,
  Download,
  RefreshCw,
  Search,
  Upload,
  HardDrive,
  CheckCircle2,
  FileCode,
  Layers,
  ChevronRight,
  Loader2,
  Shield,
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
import Link from 'next/link';

interface FirmwareFile {
  id: number;
  name: string;
  version: string;
  manufacturer: string | null;
  model: string | null;
  chargerId: number | null;
  filename: string;
  fileUrl: string;
  fileSize: number;
  checksum: string | null;
  releaseNotes: string | null;
  createdAt: string;
}

export default function SettingsFirmwarePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [firmwareFiles, setFirmwareFiles] = useState<FirmwareFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Upload Form State
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchFirmware = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/firmware', { params });
      setFirmwareFiles(res.data?.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to load firmware repository');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && (user?.role === 'admin' || user?.role === 'superadmin')) {
      fetchFirmware();
    }
  }, [authLoading, user]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a firmware binary file to upload');
      return;
    }
    if (!name || !version) {
      toast.error('Firmware name and version are required');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', name);
      formData.append('version', version);
      if (manufacturer) formData.append('manufacturer', manufacturer);
      if (model) formData.append('model', model);
      if (releaseNotes) formData.append('releaseNotes', releaseNotes);

      const res = await api.post('/firmware', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success(res.data?.message || 'Firmware binary uploaded successfully');
      setIsUploadModalOpen(false);
      setName('');
      setVersion('');
      setManufacturer('');
      setModel('');
      setReleaseNotes('');
      setSelectedFile(null);
      fetchFirmware();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number, fwName: string) => {
    if (!confirm(`Are you sure you want to delete firmware "${fwName}"?`)) return;
    try {
      await api.delete(`/firmware/${id}`);
      toast.success('Firmware deleted successfully');
      fetchFirmware();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to delete firmware');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalBytes = firmwareFiles.reduce((acc, f) => acc + (f.fileSize || 0), 0);
  const uniqueModels = new Set(firmwareFiles.map(f => f.model).filter(Boolean)).size;

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-[#54a8c7]" />
          <span className="text-xs">Loading firmware repository...</span>
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
            <p className="text-sm text-muted-foreground">You do not have permission to manage firmware repositories.</p>
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
          <span className="text-foreground font-medium">Firmware Management</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5 font-heading">
              <div className="size-9 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              Firmware Repository & Distribution
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload, organize, and dispatch firmware binaries (.bin, .hex, .tar) for specific charging hardware models.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchFirmware}
              disabled={loading}
              className="border-border text-foreground hover:bg-muted/50 text-xs h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-[#54a8c7] hover:bg-[#4596b4] text-white font-bold shadow-md shadow-[#54a8c7]/20 text-xs h-9"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Upload Firmware Binary
            </Button>
          </div>
        </div>

        {/* Metrics Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3.5">
            <div className="size-10 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium">Uploaded Firmware Files</div>
              <div className="text-2xl font-bold text-foreground font-heading">{firmwareFiles.length}</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3.5">
            <div className="size-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium">Hardware Models Covered</div>
              <div className="text-2xl font-bold text-foreground font-heading">{uniqueModels}</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3.5">
            <div className="size-10 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium">Repository Storage Used</div>
              <div className="text-2xl font-bold text-foreground font-heading">{formatBytes(totalBytes)}</div>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchFirmware()}
              placeholder="Search by name, model, vendor, or version..."
              className="pl-9 bg-background border-border text-foreground text-xs h-9"
            />
          </div>
        </div>

        {/* Firmware Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase border-b border-border font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Firmware / Release</th>
                  <th className="px-5 py-3.5">Target Model</th>
                  <th className="px-5 py-3.5">Manufacturer</th>
                  <th className="px-5 py-3.5">Size</th>
                  <th className="px-5 py-3.5">SHA-256 Checksum</th>
                  <th className="px-5 py-3.5">Uploaded</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {firmwareFiles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground text-xs">
                      <Cpu className="size-8 mx-auto mb-2 opacity-40 text-[#54a8c7]" />
                      No firmware files uploaded yet. Click &quot;Upload Firmware Binary&quot; to add your first version.
                    </td>
                  </tr>
                ) : (
                  firmwareFiles.map((fw) => (
                    <tr key={fw.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-foreground text-sm font-heading flex items-center gap-2">
                          {fw.name}
                          <Badge variant="outline" className="font-mono text-[11px] text-[#54a8c7] border-[#54a8c7]/30">
                            v{fw.version}
                          </Badge>
                        </div>
                        {fw.releaseNotes && (
                          <div className="text-xs text-muted-foreground mt-0.5 max-w-sm truncate">
                            {fw.releaseNotes}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-foreground">
                        {fw.model ? (
                          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs">
                            {fw.model}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground italic">Universal</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-foreground font-medium">
                        {fw.manufacturer || <span className="text-muted-foreground italic">Any</span>}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                        {formatBytes(fw.fileSize)}
                      </td>
                      <td className="px-5 py-4 font-mono text-[11px] text-muted-foreground">
                        {fw.checksum ? (
                          <span className="truncate block max-w-[140px]" title={fw.checksum}>
                            {fw.checksum.slice(0, 16)}...
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">
                        {new Date(fw.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="text-muted-foreground hover:text-foreground text-xs h-8"
                          >
                            <a href={fw.fileUrl} download={fw.filename}>
                              <Download className="w-3.5 h-3.5 mr-1" />
                              Download
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(fw.id, fw.name)}
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

        {/* Upload Modal */}
        <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
          <DialogContent className="sm:max-w-lg p-0 flex flex-col overflow-hidden bg-card text-card-foreground border-border">
            <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border/40">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground font-heading">
                <Upload className="w-5 h-5 text-[#54a8c7]" />
                Upload Charger Firmware Binary
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Upload firmware image (.bin, .hex, .zip, .tar.gz) and map it to hardware vendor models.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleUploadSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Firmware Binary File *</Label>
                  <Input
                    type="file"
                    required
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                        if (!name) {
                          setName(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                        }
                      }
                    }}
                    className="bg-background border-border text-foreground text-xs h-9 cursor-pointer"
                  />
                  {selectedFile && (
                    <div className="text-[11px] text-muted-foreground font-mono">
                      Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Release / Name *</Label>
                    <Input
                      required
                      placeholder="e.g. Alfen Eve Pro Production"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-background border-border text-foreground text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Version Number *</Label>
                    <Input
                      required
                      placeholder="e.g. 5.12.3-release"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      className="font-mono bg-background border-border text-foreground text-xs h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Target Model (Optional)</Label>
                    <Input
                      placeholder="e.g. Eve Single Pro / Terra 54"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="bg-background border-border text-foreground text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Manufacturer (Optional)</Label>
                    <Input
                      placeholder="e.g. Alfen / ABB / Schneider"
                      value={manufacturer}
                      onChange={(e) => setManufacturer(e.target.value)}
                      className="bg-background border-border text-foreground text-xs h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Release Notes & Changelog</Label>
                  <Textarea
                    placeholder="e.g. Fixes ISO 15118 TLS handshake timeout and updates active energy meter scaling."
                    value={releaseNotes}
                    onChange={(e) => setReleaseNotes(e.target.value)}
                    rows={3}
                    className="bg-background border-border text-foreground text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="px-6 py-4 shrink-0 border-t border-border bg-muted/20 flex flex-row items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={uploading}
                  className="border-border text-foreground hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={uploading}
                  className="bg-[#54a8c7] hover:bg-[#4596b4] text-white font-bold"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Uploading Binary...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-1.5" />
                      Save & Publish Firmware
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
