"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  PlayCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Send,
  Server,
  Radio,
  Globe,
  Loader2,
  Copy,
  Download,
  Terminal,
  RefreshCw,
  Layers,
  ArrowRight,
  Shield,
  Zap,
  Tag,
  FileText,
  HelpCircle,
  ChevronRight,
  Maximize2,
} from "lucide-react";

export default function RoamingTestSuitePage() {
  const { user, isLoading } = useAuth();

  // Test environment selection
  const [targetType, setTargetType] = useState<"local" | "saved" | "custom">("local");
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>("");
  const [customUrl, setCustomUrl] = useState<string>("");
  const [customToken, setCustomToken] = useState<string>("");

  // Role toggle: 'emsp' (Test as eMSP evaluating CPO) vs 'cpo' (Test as CPO evaluating eMSP)
  const [activeRole, setActiveRole] = useState<"emsp" | "cpo">("emsp");

  // Custom execution parameters
  const [testTokenUid, setTestTokenUid] = useState("NL-CPMS-TEST-01");
  const [testLocationId, setTestLocationId] = useState("1");
  const [testEvseUid, setTestEvseUid] = useState("1");
  const [testConnectorId, setTestConnectorId] = useState("1");
  const [testSessionId, setTestSessionId] = useState(`TX-${Date.now()}`);

  // Test execution state
  const [catalog, setCatalog] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentTestName, setCurrentTestName] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any | null>(null);
  const [testHistory, setTestHistory] = useState<any[]>([]);

  // Scenario execution state
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [scenarioResult, setScenarioResult] = useState<any | null>(null);

  // Inspector tab
  const [inspectorTab, setInspectorTab] = useState<"response" | "request" | "assertions">("response");

  useEffect(() => {
    fetchCatalog();
    fetchSavedEndpoints();
  }, []);

  const fetchCatalog = async () => {
    try {
      const res = await api.get("/roaming/test-suite/catalog");
      if (res.data?.success) {
        setCatalog(res.data.data);
      }
    } catch (err: any) {
      toast.error("Failed to load test catalog: " + (err.message || ""));
    }
  };

  const fetchSavedEndpoints = async () => {
    try {
      const [ocpiRes, oicpRes] = await Promise.allSettled([
        api.get("/ocpi/endpoints"),
        api.get("/oicp/endpoints"),
      ]);
      const list: any[] = [];
      if (ocpiRes.status === "fulfilled" && ocpiRes.value.data) {
        const data = Array.isArray(ocpiRes.value.data) ? ocpiRes.value.data : ocpiRes.value.data.data || [];
        list.push(...data.map((item: any) => ({ ...item, protocolType: "OCPI" })));
      }
      if (oicpRes.status === "fulfilled" && oicpRes.value.data) {
        const data = Array.isArray(oicpRes.value.data) ? oicpRes.value.data : oicpRes.value.data.data || [];
        list.push(...data.map((item: any) => ({ ...item, protocolType: "OICP" })));
      }
      setEndpoints(list);
      if (list.length > 0) {
        setSelectedEndpointId(String(list[0].id));
      }
    } catch (err) {
      console.error("Failed to fetch endpoints", err);
    }
  };

  const getEffectiveTargetUrl = (testId: string) => {
    if (targetType === "custom" && customUrl) {
      return customUrl.replace(/\/+$/, "");
    }
    if (targetType === "saved") {
      const ep = endpoints.find((e) => String(e.id) === selectedEndpointId);
      if (ep?.url) return ep.url.replace(/\/+$/, "");
    }
    return undefined; // Uses default / local URL
  };

  const getEffectiveToken = () => {
    if (targetType === "custom" && customToken) {
      return customToken;
    }
    if (targetType === "saved") {
      const ep = endpoints.find((e) => String(e.id) === selectedEndpointId);
      if (ep?.token) return ep.token;
    }
    return "TEST_ROAMING_SUITE_TOKEN";
  };

  const handleRunSingleTest = async (testId: string) => {
    setIsExecuting(true);
    setCurrentTestName(testId);
    setScenarioResult(null);

    const targetUrl = getEffectiveTargetUrl(testId);
    const token = getEffectiveToken();

    const params: any = {
      url: targetUrl,
      token,
      tokenUid: testTokenUid,
      locationId: testLocationId,
      evseUid: testEvseUid,
      connectorId: testConnectorId,
      sessionId: testSessionId,
      stationId: testLocationId,
      chargerId: testLocationId,
    };

    try {
      const res = await api.post("/roaming/test-suite/run-test", { testId, params });
      if (res.data?.success) {
        const result = res.data.data;
        setLastResult(result);
        setTestHistory((prev) => [result, ...prev]);

        if (result.passed) {
          toast.success(`✓ Passed: ${result.name} (${result.latencyMs}ms)`);
        } else {
          toast.error(`✗ Failed: ${result.name} (Status ${result.statusCode})`);
        }
      } else {
        toast.error("Test failed to execute: " + (res.data?.message || ""));
      }
    } catch (err: any) {
      toast.error("Execution error: " + (err.response?.data?.message || err.message));
    } finally {
      setIsExecuting(false);
      setCurrentTestName(null);
    }
  };

  const handleRunScenario = async (scenarioId: string) => {
    setIsExecuting(true);
    setActiveScenarioId(scenarioId);
    setLastResult(null);

    const targetUrl = getEffectiveTargetUrl(scenarioId);
    const token = getEffectiveToken();

    const params: any = {
      url: targetUrl,
      token,
      tokenUid: testTokenUid,
      locationId: testLocationId,
      evseUid: testEvseUid,
      connectorId: testConnectorId,
      sessionId: testSessionId,
    };

    try {
      const res = await api.post("/roaming/test-suite/run-scenario", { scenarioId, params });
      if (res.data?.success) {
        const scenario = res.data.data;
        setScenarioResult(scenario);
        if (scenario.results?.length > 0) {
          setLastResult(scenario.results[scenario.results.length - 1]);
        }
        if (scenario.passed) {
          toast.success(`🎉 All ${scenario.totalTests} tests in '${scenario.name}' PASSED!`);
        } else {
          toast.warning(`Scenario finished: ${scenario.passedTests}/${scenario.totalTests} passed.`);
        }
      }
    } catch (err: any) {
      toast.error("Scenario error: " + (err.response?.data?.message || err.message));
    } finally {
      setIsExecuting(false);
      setActiveScenarioId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.info("Copied to clipboard");
  };

  const downloadReportJson = () => {
    const data = {
      exportTimestamp: new Date().toISOString(),
      targetEnvironment: targetType,
      role: activeRole,
      lastResult,
      scenarioResult,
      testHistory,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roaming-test-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Test report downloaded.");
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
          <Loader2 className="size-8 border-2 border-[#54a8c7] rounded-full animate-spin" />
          <span className="text-xs">Loading Roaming Test Suite...</span>
        </div>
      </AppShell>
    );
  }

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-center">
          <Shield className="size-12 text-destructive/60" />
          <h2 className="text-2xl font-bold tracking-tight">Access Restricted</h2>
          <p className="text-xs text-muted-foreground max-w-sm">
            Administrator permissions are required to access the Roaming Test Suite and Mock Sandbox.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Breadcrumb & Navigation Back */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/settings" className="hover:text-foreground transition-colors">Settings</Link>
            <span>/</span>
            <Link href="/roaming" className="hover:text-foreground transition-colors">Roaming</Link>
            <span>/</span>
            <span className="text-foreground font-semibold">Test CPO & eMSP Suite</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadReportJson} className="rounded-xl text-xs">
              <Download className="size-3.5 mr-1.5" /> Export Test Report
            </Button>
            <Button asChild variant="secondary" size="sm" className="rounded-xl text-xs font-semibold">
              <Link href="/roaming">
                Back to Roaming Settings
              </Link>
            </Button>
          </div>
        </div>

        {/* Page Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-gradient-to-br from-[#54a8c7]/25 to-[#3f78e0]/25 text-[#54a8c7] flex items-center justify-center shadow-inner">
              <PlayCircle className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground flex items-center gap-2">
                Test CPO & eMSP Roaming Suite
                <Badge variant="outline" className="text-xs bg-[#54a8c7]/15 border-[#54a8c7]/40 text-[#54a8c7]">
                  OCPI 2.2.1 • OICP 2.3
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Dual-role interactive laboratory to certify and validate CPO endpoints and eMSP clearinghouse integration.
              </p>
            </div>
          </div>
        </div>

        {/* Target Environment Config Card */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Server className="size-4 text-[#54a8c7]" /> Target Environment & Credentials
            </CardTitle>
            <CardDescription className="text-xs">
              Select whether you want to test against the local CPMS sandbox, a saved roaming partner from your database, or a custom external URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setTargetType("local")}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  targetType === "local"
                    ? "border-[#54a8c7] bg-[#54a8c7]/10 ring-1 ring-[#54a8c7]"
                    : "border-border/70 hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-foreground">Local CPMS Sandbox</span>
                  <Badge variant="soft-success" className="text-[9px]">Internal</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Loopback self-test against local CPO & Mock eMSP routes. Zero setup required.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTargetType("saved")}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  targetType === "saved"
                    ? "border-[#54a8c7] bg-[#54a8c7]/10 ring-1 ring-[#54a8c7]"
                    : "border-border/70 hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-foreground">Saved Roaming Partner</span>
                  <Badge variant="outline" className="text-[9px]">DB ({endpoints.length})</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Test against a registered OCPI or Hubject OICP endpoint configured in your CPMS.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTargetType("custom")}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  targetType === "custom"
                    ? "border-[#54a8c7] bg-[#54a8c7]/10 ring-1 ring-[#54a8c7]"
                    : "border-border/70 hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-foreground">Custom External URL</span>
                  <Badge variant="outline" className="text-[9px]">Staging / Live</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Test third-party CPO or eMSP staging servers with custom API key / Bearer token.
                </p>
              </button>
            </div>

            {targetType === "saved" && (
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-semibold">Select Configured Partner Endpoint</Label>
                {endpoints.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No saved endpoints found. Add an endpoint in the Roaming page first.
                  </p>
                ) : (
                  <Select value={selectedEndpointId} onValueChange={setSelectedEndpointId}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Choose an endpoint" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {endpoints.map((ep) => (
                        <SelectItem key={ep.id} value={String(ep.id)}>
                          <span className="font-bold">{ep.name}</span>{" "}
                          <span className="text-xs text-muted-foreground">({ep.protocolType} • {ep.url})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {targetType === "custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Target Endpoint Base URL</Label>
                  <Input
                    placeholder="https://api.partner.com/ocpi/2.2.1"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    className="font-mono text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Authorization Token / API Key</Label>
                  <Input
                    type="password"
                    placeholder="Token xxxxxxxx or Bearer eyJhbGci..."
                    value={customToken}
                    onChange={(e) => setCustomToken(e.target.value)}
                    className="font-mono text-xs rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Test Payload Variables */}
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Test Execution Variables
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Token UID (RFID / eMAID)</Label>
                  <Input
                    value={testTokenUid}
                    onChange={(e) => setTestTokenUid(e.target.value)}
                    className="h-8 text-xs font-mono rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Location ID</Label>
                  <Input
                    value={testLocationId}
                    onChange={(e) => setTestLocationId(e.target.value)}
                    className="h-8 text-xs font-mono rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">EVSE UID</Label>
                  <Input
                    value={testEvseUid}
                    onChange={(e) => setTestEvseUid(e.target.value)}
                    className="h-8 text-xs font-mono rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Connector ID</Label>
                  <Input
                    value={testConnectorId}
                    onChange={(e) => setTestConnectorId(e.target.value)}
                    className="h-8 text-xs font-mono rounded-lg"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dual Role Selector Tabs */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Main Action Column */}
          <div className="w-full md:w-7/12 space-y-4">
            <Tabs value={activeRole} onValueChange={(val: any) => setActiveRole(val)}>
              <TabsList className="w-full grid grid-cols-3 mb-4 rounded-xl p-1 bg-muted/40">
                <TabsTrigger value="emsp" className="rounded-lg text-xs font-bold">
                  Test as eMSP (Test CPO)
                </TabsTrigger>
                <TabsTrigger value="cpo" className="rounded-lg text-xs font-bold">
                  Test as CPO (Test eMSP)
                </TabsTrigger>
                <TabsTrigger value="scenarios" className="rounded-lg text-xs font-bold">
                  Automated Scenarios
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: TEST AS eMSP (EVALUATING CPO) */}
              <TabsContent value="emsp" className="space-y-3 mt-0">
                <div className="p-3 rounded-xl bg-[#54a8c7]/10 border border-[#54a8c7]/30 text-xs text-muted-foreground flex items-center gap-2 mb-3">
                  <Globe className="size-4 text-[#54a8c7] shrink-0" />
                  <span>
                    <strong>eMSP Mode:</strong> You act as an e-Mobility Service Provider sending queries & commands to the CPO.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      id: "ocpi_emsp_get_locations",
                      name: "1. Pull Locations Catalog",
                      protocol: "OCPI 2.2.1",
                      method: "GET /locations",
                      desc: "Validates EVSE list, geocoordinates, status, and connector power attributes.",
                    },
                    {
                      id: "ocpi_emsp_get_tariffs",
                      name: "2. Pull Tariffs Matrix",
                      protocol: "OCPI 2.2.1",
                      method: "GET /tariffs",
                      desc: "Inspects price components (kWh, hourly, idle fees, currency, VAT).",
                    },
                    {
                      id: "ocpi_emsp_authorize_token",
                      name: "3. Authorize Token at CPO",
                      protocol: "OCPI 2.2.1",
                      method: "POST /tokens/{uid}/authorize",
                      desc: "Tests real-time authorization against CPO whitelist.",
                    },
                    {
                      id: "ocpi_emsp_remote_start",
                      name: "4. Trigger Remote Start",
                      protocol: "OCPI 2.2.1",
                      method: "POST /commands/START_SESSION",
                      desc: "Sends START_SESSION command and validates ACCEPTED response.",
                    },
                    {
                      id: "ocpi_emsp_get_sessions",
                      name: "5. Fetch Active Sessions",
                      protocol: "OCPI 2.2.1",
                      method: "GET /sessions",
                      desc: "Inspects active session telemetry, consumed kWh, and duration.",
                    },
                    {
                      id: "ocpi_emsp_remote_stop",
                      name: "6. Trigger Remote Stop",
                      protocol: "OCPI 2.2.1",
                      method: "POST /commands/STOP_SESSION",
                      desc: "Halts charging session and verifies stop acknowledgment.",
                    },
                    {
                      id: "ocpi_emsp_get_cdrs",
                      name: "7. Fetch & Verify CDRs",
                      protocol: "OCPI 2.2.1",
                      method: "GET /cdrs",
                      desc: "Pulls completed CDRs and verifies financial reconciliation.",
                    },
                    {
                      id: "oicp_emsp_authorize_start",
                      name: "8. Hubject AuthorizeStart",
                      protocol: "OICP 2.3",
                      method: "POST /authorize-start",
                      desc: "Tests driver RFID authorization against Hubject clearinghouse.",
                    },
                  ].map((test) => (
                    <Card key={test.id} className="border-border/70 hover:border-[#54a8c7]/50 transition-all flex flex-col justify-between">
                      <CardHeader className="p-3.5 pb-2">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-mono text-[10px] text-[#54a8c7] font-semibold">{test.method}</span>
                          <Badge variant="outline" className="text-[9px]">{test.protocol}</Badge>
                        </div>
                        <CardTitle className="text-xs font-bold text-foreground">{test.name}</CardTitle>
                        <CardDescription className="text-[11px] leading-tight">{test.desc}</CardDescription>
                      </CardHeader>
                      <CardFooter className="p-3.5 pt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs font-bold rounded-xl border-border/80 hover:bg-[#54a8c7]/15 hover:text-[#54a8c7]"
                          disabled={isExecuting}
                          onClick={() => handleRunSingleTest(test.id)}
                        >
                          {isExecuting && currentTestName === test.id ? (
                            <>
                              <Loader2 className="size-3 mr-1.5 animate-spin" />
                              Running...
                            </>
                          ) : (
                            <>
                              <PlayCircle className="size-3 mr-1.5" />
                              Execute Test
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* TAB 2: TEST AS CPO (EVALUATING eMSP) */}
              <TabsContent value="cpo" className="space-y-3 mt-0">
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs text-muted-foreground flex items-center gap-2 mb-3">
                  <Radio className="size-4 text-purple-400 shrink-0" />
                  <span>
                    <strong>CPO Mode:</strong> You simulate charge point events sent towards an eMSP partner or built-in mock eMSP.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      id: "ocpi_cpo_authorize_token",
                      name: "1. Query eMSP Token Whitelist",
                      protocol: "OCPI 2.2.1",
                      method: "POST /tokens/{uid}/authorize",
                      desc: "Simulate a charger asking eMSP if a driver tag is authorized.",
                    },
                    {
                      id: "ocpi_cpo_dispatch_cdr",
                      name: "2. Dispatch CDR to eMSP",
                      protocol: "OCPI 2.2.1",
                      method: "POST /cdrs",
                      desc: "Sends full OCPI 2.2.1 CDR to eMSP receiver and checks for 200/201 response.",
                    },
                    {
                      id: "ocpi_cpo_command_callback",
                      name: "3. Async Command Callback",
                      protocol: "OCPI 2.2.1",
                      method: "POST {response_url}",
                      desc: "Dispatches async command result (ACCEPTED / REJECTED) to eMSP.",
                    },
                    {
                      id: "oicp_cpo_push_evse_data",
                      name: "4. Hubject Push EVSE Data",
                      protocol: "OICP 2.3",
                      method: "eRoamingPushEvseData",
                      desc: "Pushes static station and connector attributes to Hubject clearinghouse.",
                    },
                    {
                      id: "oicp_cpo_push_evse_status",
                      name: "5. Hubject Broadcast Status",
                      protocol: "OICP 2.3",
                      method: "eRoamingPushEvseStatus",
                      desc: "Broadcasts live EVSE availability/occupied status to Hubject.",
                    },
                  ].map((test) => (
                    <Card key={test.id} className="border-border/70 hover:border-purple-500/50 transition-all flex flex-col justify-between">
                      <CardHeader className="p-3.5 pb-2">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-mono text-[10px] text-purple-400 font-semibold">{test.method}</span>
                          <Badge variant="outline" className="text-[9px]">{test.protocol}</Badge>
                        </div>
                        <CardTitle className="text-xs font-bold text-foreground">{test.name}</CardTitle>
                        <CardDescription className="text-[11px] leading-tight">{test.desc}</CardDescription>
                      </CardHeader>
                      <CardFooter className="p-3.5 pt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs font-bold rounded-xl border-border/80 hover:bg-purple-500/15 hover:text-purple-400"
                          disabled={isExecuting}
                          onClick={() => handleRunSingleTest(test.id)}
                        >
                          {isExecuting && currentTestName === test.id ? (
                            <>
                              <Loader2 className="size-3 mr-1.5 animate-spin" />
                              Running...
                            </>
                          ) : (
                            <>
                              <PlayCircle className="size-3 mr-1.5" />
                              Execute Test
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* TAB 3: AUTOMATED SCENARIOS */}
              <TabsContent value="scenarios" className="space-y-4 mt-0">
                <div className="space-y-3">
                  {[
                    {
                      id: "ocpi_full_cycle",
                      name: "OCPI 2.2.1 Full Charging Lifecycle Suite",
                      protocol: "OCPI 2.2.1",
                      steps: "7 Steps",
                      desc: "Complete lifecycle test: Catalog Discovery → Token Auth → RemoteStart → Active Session → RemoteStop → CDR Verification.",
                      badgeColor: "text-[#54a8c7] border-[#54a8c7]/30 bg-[#54a8c7]/10",
                    },
                    {
                      id: "ocpi_catalog_discovery",
                      name: "OCPI 2.2.1 Discovery & Tariffs Compliance",
                      protocol: "OCPI 2.2.1",
                      steps: "3 Steps",
                      desc: "Verifies CPO locations, EVSE connectors, pricing matrices, and currency formats.",
                      badgeColor: "text-[#fab758] border-[#fab758]/30 bg-[#fab758]/10",
                    },
                    {
                      id: "oicp_core_suite",
                      name: "Hubject OICP 2.3 Clearinghouse Core Suite",
                      protocol: "OICP 2.3",
                      steps: "3 Steps",
                      desc: "Tests Hubject eRoamingPushEvseData master catalog, dynamic EVSE status broadcasting, and real-time driver RFID authorization.",
                      badgeColor: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                    },
                    {
                      id: "cpo_to_emsp_suite",
                      name: "CPO-to-eMSP Event & Settlement Suite",
                      protocol: "OCPI 2.2.1",
                      steps: "3 Steps",
                      desc: "Validates outbound events from CPO to eMSP: token whitelist validation, CDR dispatch, and async command callbacks.",
                      badgeColor: "text-purple-400 border-purple-500/30 bg-purple-500/10",
                    },
                  ].map((scenario) => (
                    <Card key={scenario.id} className="border-border/70 hover:border-[#54a8c7]/50 transition-all">
                      <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] ${scenario.badgeColor}`}>
                              {scenario.protocol}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">{scenario.steps}</Badge>
                          </div>
                          <h3 className="text-sm font-bold text-foreground">{scenario.name}</h3>
                          <p className="text-xs text-muted-foreground max-w-lg">{scenario.desc}</p>
                        </div>
                        <Button
                          className="rounded-xl font-bold bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white shrink-0"
                          disabled={isExecuting}
                          onClick={() => handleRunScenario(scenario.id)}
                        >
                          {isExecuting && activeScenarioId === scenario.id ? (
                            <>
                              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                              Running Suite...
                            </>
                          ) : (
                            <>
                              <PlayCircle className="size-3.5 mr-1.5" />
                              Run Suite
                            </>
                          )}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Scenario Run Result Scorecard */}
                {scenarioResult && (
                  <Card className="border-border/80 bg-card overflow-hidden">
                    <CardHeader className="p-4 border-b border-border/50 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm font-bold flex items-center gap-2">
                            {scenarioResult.passed ? (
                              <CheckCircle2 className="size-4 text-emerald-400" />
                            ) : (
                              <XCircle className="size-4 text-red-400" />
                            )}
                            Scenario: {scenarioResult.name}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Execution finished in {scenarioResult.durationMs}ms ({scenarioResult.passedTests} passed, {scenarioResult.failedTests} failed)
                          </CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            scenarioResult.passed
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : "bg-red-500/15 text-red-400 border-red-500/30"
                          }
                        >
                          {scenarioResult.passed ? "ALL TESTS PASSED" : "FAILED ASSERTIONS"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border/50">
                        {scenarioResult.results?.map((step: any, idx: number) => (
                          <div
                            key={idx}
                            onClick={() => setLastResult(step)}
                            className="p-3 px-4 flex items-center justify-between hover:bg-muted/30 cursor-pointer transition-colors text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              {step.passed ? (
                                <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                              ) : (
                                <XCircle className="size-3.5 text-red-400 shrink-0" />
                              )}
                              <span className="font-semibold text-foreground">{step.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-[11px] text-muted-foreground">{step.latencyMs}ms</span>
                              <Badge variant="outline" className="text-[10px]">
                                HTTP {step.statusCode}
                              </Badge>
                              <ChevronRight className="size-3.5 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Live HTTP Inspector Column */}
          <div className="w-full md:w-5/12 space-y-4">
            <Card className="border-border/80 shadow-xs h-full flex flex-col">
              <CardHeader className="p-4 border-b border-border/50 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Terminal className="size-4 text-[#54a8c7]" /> Live Protocol Inspector
                  </CardTitle>
                  {lastResult && (
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          lastResult.passed
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]"
                            : "bg-red-500/15 text-red-400 border-red-500/30 text-[10px]"
                        }
                      >
                        {lastResult.passed ? "PASSED" : "FAILED"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {lastResult.latencyMs}ms
                      </Badge>
                    </div>
                  )}
                </div>
                <CardDescription className="text-xs truncate">
                  {lastResult ? lastResult.name : "Run any test or scenario to inspect HTTP payloads."}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 flex-1 flex flex-col space-y-3">
                {lastResult ? (
                  <>
                    {/* Status Pill */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#54a8c7]">{lastResult.request?.method || "GET"}</span>
                        <span className="font-mono text-muted-foreground truncate max-w-[200px]">
                          {lastResult.request?.url}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          lastResult.statusCode >= 200 && lastResult.statusCode < 300
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-mono text-[10px]"
                            : "bg-red-500/15 text-red-400 border-red-500/30 font-mono text-[10px]"
                        }
                      >
                        HTTP {lastResult.statusCode}
                      </Badge>
                    </div>

                    {/* Inspector Tabs */}
                    <Tabs value={inspectorTab} onValueChange={(val: any) => setInspectorTab(val)} className="flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <TabsList className="h-7 p-0.5 bg-muted/40 rounded-lg">
                          <TabsTrigger value="response" className="text-[11px] h-6 px-2.5 rounded-md">Response Body</TabsTrigger>
                          <TabsTrigger value="request" className="text-[11px] h-6 px-2.5 rounded-md">Request</TabsTrigger>
                          <TabsTrigger value="assertions" className="text-[11px] h-6 px-2.5 rounded-md">
                            Assertions ({lastResult.assertions?.length || 0})
                          </TabsTrigger>
                        </TabsList>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => copyToClipboard(JSON.stringify(lastResult, null, 2))}
                        >
                          <Copy className="size-3 mr-1" /> Copy
                        </Button>
                      </div>

                      <TabsContent value="response" className="flex-1 mt-0">
                        <div className="relative rounded-xl border border-border/70 bg-[#171a1f] p-3 text-[11px] font-mono text-[#aab0bc] max-h-[380px] overflow-auto scrollbar-thin">
                          <pre>{JSON.stringify(lastResult.response?.body, null, 2)}</pre>
                        </div>
                      </TabsContent>

                      <TabsContent value="request" className="flex-1 mt-0">
                        <div className="relative rounded-xl border border-border/70 bg-[#171a1f] p-3 text-[11px] font-mono text-[#aab0bc] max-h-[380px] overflow-auto scrollbar-thin">
                          <div className="text-muted-foreground mb-1">// Method: {lastResult.request?.method}</div>
                          <div className="text-muted-foreground mb-2">// URL: {lastResult.request?.url}</div>
                          <pre>{JSON.stringify(lastResult.request?.body || {}, null, 2)}</pre>
                        </div>
                      </TabsContent>

                      <TabsContent value="assertions" className="flex-1 mt-0 space-y-2">
                        <div className="rounded-xl border border-border/70 divide-y divide-border/50 overflow-hidden">
                          {lastResult.assertions?.map((a: any, idx: number) => (
                            <div key={idx} className="p-2.5 px-3 flex items-start justify-between gap-2 text-xs">
                              <div className="flex items-start gap-2">
                                {a.passed ? (
                                  <CheckCircle2 className="size-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                ) : (
                                  <XCircle className="size-3.5 text-red-400 mt-0.5 shrink-0" />
                                )}
                                <div>
                                  <span className="font-medium text-foreground">{a.name}</span>
                                  {a.actual !== undefined && (
                                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                      Actual: {String(a.actual)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className={a.passed ? "text-[9px] text-emerald-400 border-emerald-500/30" : "text-[9px] text-red-400 border-red-500/30"}
                              >
                                {a.passed ? "Pass" : "Fail"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-border/60 rounded-xl text-muted-foreground">
                    <PlayCircle className="size-8 text-muted-foreground/40 mb-2" />
                    <p className="text-xs font-semibold">No Active Test Output</p>
                    <p className="text-[11px] max-w-xs mt-1">
                      Choose an action on the left to trigger real-time OCPI/OICP requests and inspect raw HTTP telemetry.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
