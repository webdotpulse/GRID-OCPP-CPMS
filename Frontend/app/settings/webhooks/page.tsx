'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import { toast } from 'sonner';
import {
  Webhook,
  Send,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Search,
  Key,
  Layers,
  Copy,
  ExternalLink,
  Clock,
  Activity,
  Check,
  RotateCw,
  FileCode,
  ShieldCheck,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';

interface WebhookSubscription {
  id: number;
  name: string;
  targetUrl: string;
  secret: string;
  events: string[];
  isActive: boolean;
  customHeaders?: Record<string, string> | null;
  failureCount: number;
  lastTriggeredAt?: string | null;
  lastStatusCode?: number | null;
  createdAt: string;
  company?: { id: number; name: string } | null;
  _count?: { deliveries: number };
  deliveries?: WebhookDelivery[];
}

interface WebhookDelivery {
  id: number;
  subscriptionId: number;
  event: string;
  payload: any;
  requestHeaders?: any;
  responseCode?: number | null;
  responseBody?: string | null;
  responseDurationMs?: number | null;
  status: string;
  attempts: number;
  error?: string | null;
  createdAt: string;
  deliveredAt?: string | null;
}

interface EventTopicDefinition {
  topic: string;
  name: string;
  category: string;
  description: string;
  samplePayload: Record<string, any>;
}

export default function WebhooksManagementPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [eventCatalog, setEventCatalog] = useState<EventTopicDefinition[]>([]);
  const [selectedSubForDeliveries, setSelectedSubForDeliveries] = useState<WebhookSubscription | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [activeTab, setActiveTab] = useState('subscriptions');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubId, setEditingSubId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [customHeadersJson, setCustomHeadersJson] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delivery Detail Modal
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDelivery | null>(null);
  const [testingPingId, setTestingPingId] = useState<number | null>(null);
  const [retryingDeliveryId, setRetryingDeliveryId] = useState<number | null>(null);

  const fetchWebhooksData = async () => {
    try {
      setLoading(true);
      const [webhooksRes, eventsRes] = await Promise.all([
        api.get('/webhooks'),
        api.get('/webhooks/events'),
      ]);

      const subs = webhooksRes.data?.data || webhooksRes.data || [];
      setSubscriptions(subs);

      const events = eventsRes.data?.data || eventsRes.data || [];
      setEventCatalog(events);

      if (subs.length > 0 && !selectedSubForDeliveries) {
        setSelectedSubForDeliveries(subs[0]);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveries = async (subId: number) => {
    try {
      setLoadingDeliveries(true);
      const res = await api.get(`/webhooks/${subId}/deliveries?limit=50`);
      const list = res.data?.data || res.data || [];
      setDeliveries(list);
    } catch (error: any) {
      toast.error('Failed to load webhook delivery history');
    } finally {
      setLoadingDeliveries(false);
    }
  };

  useEffect(() => {
    if (!authLoading && (user?.role === 'admin' || user?.role === 'superadmin')) {
      fetchWebhooksData();
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (selectedSubForDeliveries?.id) {
      fetchDeliveries(selectedSubForDeliveries.id);
    }
  }, [selectedSubForDeliveries]);

  const handleOpenCreateModal = () => {
    setEditingSubId(null);
    setName('');
    setTargetUrl('');
    setSecret(`whsec_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`);
    setSelectedEvents(['transaction.started', 'transaction.stopped', 'connector.faulted']);
    setIsActive(true);
    setCustomHeadersJson('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sub: WebhookSubscription) => {
    setEditingSubId(sub.id);
    setName(sub.name);
    setTargetUrl(sub.targetUrl);
    setSecret(sub.secret);
    setSelectedEvents(sub.events || []);
    setIsActive(sub.isActive);
    setCustomHeadersJson(sub.customHeaders ? JSON.stringify(sub.customHeaders, null, 2) : '');
    setIsModalOpen(true);
  };

  const handleToggleEvent = (topic: string) => {
    setSelectedEvents((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const handleSelectAllEvents = () => {
    if (selectedEvents.length === eventCatalog.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(eventCatalog.map((e) => e.topic));
    }
  };

  const handleSaveWebhook = async () => {
    if (!name.trim() || !targetUrl.trim()) {
      toast.error('Name and Target URL are required');
      return;
    }

    let parsedHeaders = undefined;
    if (customHeadersJson.trim()) {
      try {
        parsedHeaders = JSON.parse(customHeadersJson.trim());
      } catch {
        toast.error('Custom headers must be valid JSON');
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        name: name.trim(),
        targetUrl: targetUrl.trim(),
        secret: secret.trim(),
        events: selectedEvents.length > 0 ? selectedEvents : ['*'],
        isActive,
        customHeaders: parsedHeaders,
      };

      if (editingSubId) {
        await api.put(`/webhooks/${editingSubId}`, payload);
        toast.success(`Webhook "${name}" updated successfully`);
      } else {
        await api.post('/webhooks', payload);
        toast.success(`Webhook "${name}" registered successfully`);
      }

      setIsModalOpen(false);
      fetchWebhooksData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to save webhook');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWebhook = async (sub: WebhookSubscription) => {
    if (!confirm(`Are you sure you want to delete webhook "${sub.name}"?`)) return;

    try {
      await api.delete(`/webhooks/${sub.id}`);
      toast.success(`Webhook "${sub.name}" deleted successfully`);
      fetchWebhooksData();
      if (selectedSubForDeliveries?.id === sub.id) {
        setSelectedSubForDeliveries(null);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to delete webhook');
    }
  };

  const handleTestPing = async (subId: number) => {
    try {
      setTestingPingId(subId);
      const res = await api.post(`/webhooks/${subId}/test`);
      const msg = res.data?.message || 'Test ping executed';
      toast.success(msg);
      fetchWebhooksData();
      if (selectedSubForDeliveries?.id === subId) {
        fetchDeliveries(subId);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Test ping failed');
    } finally {
      setTestingPingId(null);
    }
  };

  const handleRotateSecret = async (subId: number) => {
    if (!confirm('Rotate HMAC secret? External services will need the new secret to verify signatures.')) return;

    try {
      const res = await api.post(`/webhooks/${subId}/rotate-secret`);
      toast.success(res.data?.message || 'HMAC Secret rotated');
      fetchWebhooksData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to rotate secret');
    }
  };

  const handleRetryDelivery = async (deliveryId: number) => {
    try {
      setRetryingDeliveryId(deliveryId);
      const res = await api.post(`/webhooks/deliveries/${deliveryId}/retry`);
      toast.success(res.data?.message || 'Delivery retry finished');
      if (selectedSubForDeliveries) {
        fetchDeliveries(selectedSubForDeliveries.id);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to retry delivery');
    } finally {
      setRetryingDeliveryId(null);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const filteredSubscriptions = subscriptions.filter((s) => {
    return (
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.targetUrl.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const totalSubs = subscriptions.length;
  const activeSubs = subscriptions.filter((s) => s.isActive).length;
  const totalDeliveriesCount = subscriptions.reduce((sum, s) => sum + (s._count?.deliveries || 0), 0);

  const getStatusBadge = (code?: number | null, status?: string) => {
    if (status === 'Success' || (code && code >= 200 && code < 300)) {
      return (
        <Badge className="bg-[#45c4a0]/15 text-[#45c4a0] border-[#45c4a0]/30 font-mono text-[11px]">
          {code || '200 OK'}
        </Badge>
      );
    }
    if (status === 'Pending') {
      return (
        <Badge variant="outline" className="text-muted-foreground font-mono text-[11px]">
          Pending
        </Badge>
      );
    }
    return (
      <Badge className="bg-[#e2626b]/15 text-[#e2626b] border-[#e2626b]/30 font-mono text-[11px]">
        {code ? `HTTP ${code}` : 'Failed'}
      </Badge>
    );
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Link href="/settings" className="hover:text-foreground transition-colors">
                Settings
              </Link>
              <ChevronRight className="size-3" />
              <span className="text-foreground font-medium">Outbound Webhooks</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Webhook className="size-6 text-[#54a8c7]" />
              Outbound Webhook Subscriptions
            </h1>
            <p className="text-sm text-muted-foreground">
              Stream real-time CPMS events (transactions, faults, billing) directly into ERP, SCADA, and CRM systems.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchWebhooksData}
              className="gap-2 border-border/60 hover:bg-muted/50"
            >
              <RefreshCw className="size-4 text-[#54a8c7]" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleOpenCreateModal}
              className="gap-2 bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] text-white hover:opacity-90 shadow-md shadow-[#54a8c7]/20"
            >
              <Plus className="size-4" />
              Register Webhook
            </Button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/60 backdrop-blur border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#54a8c7]/15 flex items-center justify-center text-[#54a8c7]">
                <Webhook className="size-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Endpoints</p>
                <p className="text-xl font-bold text-foreground">{totalSubs}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#45c4a0]/15 flex items-center justify-center text-[#45c4a0]">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active Endpoints</p>
                <p className="text-xl font-bold text-foreground">{activeSubs}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#3f78e0]/15 flex items-center justify-center text-[#3f78e0]">
                <Activity className="size-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Dispatched Deliveries</p>
                <p className="text-xl font-bold text-foreground">{totalDeliveriesCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#fab758]/15 flex items-center justify-center text-[#fab758]">
                <Layers className="size-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Supported Topics</p>
                <p className="text-xl font-bold text-foreground">{eventCatalog.length} Events</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Endpoints vs Deliveries vs Catalog */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/40 border border-border/40">
            <TabsTrigger value="subscriptions" className="gap-2">
              <Webhook className="size-4 text-[#54a8c7]" />
              Endpoints ({subscriptions.length})
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="gap-2">
              <Send className="size-4 text-[#3f78e0]" />
              Delivery Trace Logs
            </TabsTrigger>
            <TabsTrigger value="catalog" className="gap-2">
              <FileCode className="size-4 text-[#fab758]" />
              Event Catalog & Schemas
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Subscriptions List */}
          <TabsContent value="subscriptions" className="space-y-4">
            <div className="relative w-full sm:w-80">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search endpoints or URLs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card/60 border-border/40"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-8 animate-spin text-[#54a8c7]" />
              </div>
            ) : filteredSubscriptions.length === 0 ? (
              <Card className="bg-card/40 border-dashed border-border/60 py-12 text-center">
                <CardContent className="space-y-3">
                  <div className="size-12 rounded-full bg-[#54a8c7]/10 flex items-center justify-center mx-auto text-[#54a8c7]">
                    <Webhook className="size-6" />
                  </div>
                  <p className="text-base font-semibold text-foreground">No webhook endpoints registered</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Configure your first outbound webhook endpoint to stream real-time charging telemetry directly into your applications.
                  </p>
                  <Button size="sm" onClick={handleOpenCreateModal} className="bg-[#54a8c7] text-white">
                    <Plus className="size-4 mr-1.5" />
                    Register Webhook
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredSubscriptions.map((sub) => (
                  <Card
                    key={sub.id}
                    className="bg-card/60 backdrop-blur border-border/40 hover:border-border/80 transition-all"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`size-3 rounded-full ${
                              sub.isActive ? 'bg-[#45c4a0] shadow-sm shadow-[#45c4a0]/50' : 'bg-muted-foreground'
                            }`}
                          />
                          <div>
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                              {sub.name}
                              {sub.company && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {sub.company.name}
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="text-xs font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <span className="truncate max-w-md">{sub.targetUrl}</span>
                              <button
                                onClick={() => handleCopy(sub.targetUrl, 'URL')}
                                className="text-muted-foreground hover:text-foreground"
                                title="Copy Target URL"
                              >
                                <Copy className="size-3" />
                              </button>
                            </CardDescription>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {getStatusBadge(sub.lastStatusCode)}
                          <Badge variant="outline" className="text-xs">
                            {sub._count?.deliveries || 0} deliveries
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 pb-4">
                      {/* Subscribed Events Pills */}
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Subscribed Topics ({sub.events?.length || 0})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(sub.events || []).map((ev) => (
                            <span
                              key={ev}
                              className="inline-flex items-center text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#54a8c7]/10 text-[#54a8c7] border border-[#54a8c7]/20"
                            >
                              {ev}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Secret preview */}
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30 border border-border/30 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <Key className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground shrink-0">HMAC Secret:</span>
                          <span className="font-mono text-foreground/80 truncate">
                            {sub.secret.slice(0, 12)}••••••••••••••••
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(sub.secret, 'Secret')}
                            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="size-3 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRotateSecret(sub.id)}
                            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            <RotateCw className="size-3 mr-1" />
                            Rotate
                          </Button>
                        </div>
                      </div>

                      {/* Card Action Controls */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/30 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5" />
                          <span>
                            Last fired:{' '}
                            {sub.lastTriggeredAt
                              ? new Date(sub.lastTriggeredAt).toLocaleString()
                              : 'Never triggered'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={testingPingId === sub.id}
                            onClick={() => handleTestPing(sub.id)}
                            className="h-7 text-xs gap-1.5 border-border/60 hover:bg-muted/50"
                          >
                            {testingPingId === sub.id ? (
                              <Loader2 className="size-3 animate-spin text-[#54a8c7]" />
                            ) : (
                              <Send className="size-3 text-[#54a8c7]" />
                            )}
                            Test Ping
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSubForDeliveries(sub);
                              setActiveTab('deliveries');
                            }}
                            className="h-7 text-xs gap-1.5 border-border/60 hover:bg-muted/50"
                          >
                            <Eye className="size-3 text-[#3f78e0]" />
                            View Logs
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditModal(sub)}
                            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <Edit2 className="size-3" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteWebhook(sub)}
                            className="h-7 text-xs gap-1.5 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: Delivery Logs */}
          <TabsContent value="deliveries" className="space-y-4">
            {subscriptions.length > 0 && (
              <div className="flex items-center gap-3">
                <Label className="text-xs">Filter by Subscription:</Label>
                <div className="flex flex-wrap gap-1.5">
                  {subscriptions.map((sub) => (
                    <Button
                      key={sub.id}
                      variant={selectedSubForDeliveries?.id === sub.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedSubForDeliveries(sub)}
                      className={`h-7 text-xs ${
                        selectedSubForDeliveries?.id === sub.id
                          ? 'bg-[#54a8c7] text-white hover:bg-[#54a8c7]/90'
                          : 'border-border/60'
                      }`}
                    >
                      {sub.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {loadingDeliveries ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-8 animate-spin text-[#3f78e0]" />
              </div>
            ) : deliveries.length === 0 ? (
              <Card className="bg-card/40 border-dashed border-border/60 py-12 text-center">
                <p className="text-sm text-muted-foreground">No deliveries recorded for this subscription yet.</p>
              </Card>
            ) : (
              <div className="rounded-xl border border-border/40 overflow-hidden bg-card/60 backdrop-blur">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border/40 text-muted-foreground uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="p-3">Status</th>
                        <th className="p-3">Event Topic</th>
                        <th className="p-3">Latency</th>
                        <th className="p-3">Attempts</th>
                        <th className="p-3">Timestamp</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {deliveries.map((del) => (
                        <tr key={del.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            {getStatusBadge(del.responseCode, del.status)}
                          </td>
                          <td className="p-3 font-mono text-[#54a8c7] font-semibold">
                            {del.event}
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">
                            {del.responseDurationMs !== null && del.responseDurationMs !== undefined
                              ? `${del.responseDurationMs} ms`
                              : '-'}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {del.attempts}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {new Date(del.createdAt).toLocaleString()}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedDelivery(del)}
                                className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                              >
                                <Eye className="size-3" />
                                Inspect
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={retryingDeliveryId === del.id}
                                onClick={() => handleRetryDelivery(del.id)}
                                className="h-6 text-[11px] gap-1 text-[#3f78e0] hover:bg-[#3f78e0]/10"
                              >
                                {retryingDeliveryId === del.id ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <RotateCw className="size-3" />
                                )}
                                Retry
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: Event Catalog */}
          <TabsContent value="catalog" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eventCatalog.map((ev) => (
                <Card key={ev.topic} className="bg-card/60 backdrop-blur border-border/40">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm font-bold text-foreground">
                          {ev.name}
                        </CardTitle>
                        <CardDescription className="font-mono text-xs text-[#54a8c7] mt-0.5">
                          {ev.topic}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {ev.category}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2.5 text-xs pb-4">
                    <p className="text-muted-foreground">{ev.description}</p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Sample Payload:</span>
                        <button
                          onClick={() => handleCopy(JSON.stringify(ev.samplePayload, null, 2), 'Payload')}
                          className="hover:text-foreground flex items-center gap-1"
                        >
                          <Copy className="size-3" />
                          Copy JSON
                        </button>
                      </div>
                      <pre className="p-2.5 rounded-lg bg-black/40 border border-white/10 font-mono text-[11px] text-[#45c4a0] overflow-x-auto max-h-36">
                        {JSON.stringify(ev.samplePayload, null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal: Register / Edit Webhook */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden bg-card text-card-foreground border-border">
            <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border/40">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold font-heading">
                <Webhook className="size-5 text-[#54a8c7]" />
                {editingSubId ? 'Edit Webhook Endpoint' : 'Register Outbound Webhook'}
              </DialogTitle>
              <DialogDescription>
                Provide destination URL and select which real-time event topics should trigger HTTP POST deliveries.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Endpoint Name *</Label>
                <Input
                  placeholder="e.g. Enterprise SAP ERP Invoicing Feed"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Destination URL (HTTP POST) *</Label>
                <Input
                  placeholder="https://api.yourdomain.com/webhooks/ocpp"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="font-mono text-xs bg-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">HMAC-SHA256 Signing Secret</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    className="font-mono text-xs bg-background border-border"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSecret(
                        `whsec_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
                      )
                    }
                    className="h-9 px-3 text-xs border-border"
                  >
                    Generate
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Payloads are signed with this secret in the <code className="text-[#54a8c7] font-semibold">X-CPMS-Signature-256</code> header.
                </p>
              </div>

              {/* Event Topics Selection */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold font-heading">
                    Subscribed Event Topics ({selectedEvents.length} selected)
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllEvents}
                    className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {selectedEvents.length === eventCatalog.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {eventCatalog.map((ev) => {
                    const isChecked = selectedEvents.includes(ev.topic);
                    return (
                      <div
                        key={ev.topic}
                        onClick={() => handleToggleEvent(ev.topic)}
                        className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer select-none transition-all ${
                          isChecked
                            ? 'bg-[#54a8c7]/15 border-[#54a8c7]/50 text-foreground'
                            : 'bg-muted/20 border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <div
                          className={`size-3.5 rounded mt-0.5 flex items-center justify-center border transition-colors ${
                            isChecked ? 'bg-[#54a8c7] border-[#54a8c7] text-white' : 'border-muted-foreground/40'
                          }`}
                        >
                          {isChecked && <Check className="size-2.5 stroke-[3]" />}
                        </div>
                        <div>
                          <p className="text-xs font-semibold leading-none text-foreground">{ev.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{ev.topic}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Headers */}
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <Label className="text-xs font-semibold">Custom Request Headers (Optional JSON)</Label>
                <Textarea
                  placeholder={`{\n  "Authorization": "Bearer enterprise_token_123"\n}`}
                  value={customHeadersJson}
                  onChange={(e) => setCustomHeadersJson(e.target.value)}
                  className="font-mono text-xs bg-background border-border"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label className="text-xs font-semibold">Active Subscription Status</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>

            <DialogFooter className="px-6 py-4 shrink-0 border-t border-border bg-muted/20 flex flex-row items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveWebhook}
                disabled={submitting}
                className="bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white gap-2 font-bold"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {editingSubId ? 'Save Changes' : 'Register Webhook'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Delivery Inspector */}
        <Dialog open={Boolean(selectedDelivery)} onOpenChange={(open) => !open && setSelectedDelivery(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden bg-card text-card-foreground border-border">
            <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border/40">
              <DialogTitle className="flex items-center gap-2 font-heading">
                <Send className="size-5 text-[#3f78e0]" />
                Webhook Delivery #{selectedDelivery?.id}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">
                Event: {selectedDelivery?.event} • Status:{' '}
                {selectedDelivery?.status} (HTTP {selectedDelivery?.responseCode || '-'})
              </DialogDescription>
            </DialogHeader>

            {selectedDelivery && (
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs">
                {selectedDelivery.error && (
                  <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>{selectedDelivery.error}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Dispatched JSON Payload:</span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(selectedDelivery.payload, null, 2), 'Payload')}
                      className="hover:text-foreground flex items-center gap-1 text-xs"
                    >
                      <Copy className="size-3" />
                      Copy JSON
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-muted/50 dark:bg-black/40 border border-border font-mono text-[11px] text-[#54a8c7] overflow-x-auto max-h-56">
                    {JSON.stringify(selectedDelivery.payload, null, 2)}
                  </pre>
                </div>

                {selectedDelivery.responseBody && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Server Response Body:</span>
                    </div>
                    <pre className="p-3 rounded-lg bg-muted/50 dark:bg-black/40 border border-border font-mono text-[11px] text-foreground/80 overflow-x-auto max-h-36">
                      {selectedDelivery.responseBody}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="px-6 py-4 shrink-0 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={() => setSelectedDelivery(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
