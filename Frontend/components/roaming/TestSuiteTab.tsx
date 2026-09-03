"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import {
  PlayCircle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Server,
  Radio,
  Globe,
  Loader2,
  Layers,
  ChevronRight,
} from "lucide-react";

export function TestSuiteTab() {
  const [catalog, setCatalog] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [recentResults, setRecentResults] = useState<any[]>([]);

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const res = await api.get("/roaming/test-suite/catalog");
      if (res.data?.success) {
        setCatalog(res.data.data);
      }
    } catch (err: any) {
      toast.error("Failed to load test suite catalog: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleRunQuickTest = async (testId: string) => {
    try {
      setRunningTestId(testId);
      const res = await api.post("/roaming/test-suite/run-test", { testId });
      if (res.data?.success) {
        const result = res.data.data;
        setRecentResults((prev) => [result, ...prev.slice(0, 4)]);
        if (result.passed) {
          toast.success(`Test '${result.name}' PASSED in ${result.latencyMs}ms`);
        } else {
          toast.error(`Test '${result.name}' FAILED with status ${result.statusCode}`);
        }
      }
    } catch (err: any) {
      toast.error("Test execution failed: " + (err.message || ""));
    } finally {
      setRunningTestId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <Card className="border-[#54a8c7]/30 bg-gradient-to-br from-[#54a8c7]/10 via-card to-card overflow-hidden relative">
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-[#54a8c7]/40 bg-[#54a8c7]/20 text-[#54a8c7] text-xs font-semibold">
                Dual-Role Roaming Validator
              </Badge>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                OCPI 2.2.1 & OICP 2.3
              </Badge>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-heading text-foreground">
              OCPI & OICP Roaming Test Suite
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Validate protocol compatibility in dual-role mode: evaluate CPO responses as an eMSP (pull locations, tariffs, sessions, send remote start/stop) or evaluate eMSP partners as a CPO (token auth, CDR dispatch, Hubject clearinghouse push).
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button asChild className="bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white font-bold rounded-xl shadow-md shadow-[#54a8c7]/25">
              <Link href="/roaming/test-suite" className="flex items-center gap-2">
                <PlayCircle className="size-4" />
                Launch Full Test Lab
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick Run Test Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            id: "ocpi_emsp_get_locations",
            name: "CPO Locations & EVSEs",
            desc: "Validate GET /locations catalog, EVSE coordinates, and connector list.",
            role: "Test as eMSP",
            protocol: "OCPI 2.2.1",
            color: "text-[#54a8c7] border-[#54a8c7]/30 bg-[#54a8c7]/10",
          },
          {
            id: "ocpi_emsp_get_tariffs",
            name: "CPO Tariffs Matrix",
            desc: "Validate GET /tariffs energy rate components, currency, and VAT specifications.",
            role: "Test as eMSP",
            protocol: "OCPI 2.2.1",
            color: "text-[#fab758] border-[#fab758]/30 bg-[#fab758]/10",
          },
          {
            id: "ocpi_emsp_authorize_token",
            name: "Token Authorization",
            desc: "Query CPO token authorization endpoint and check whitelist response.",
            role: "Test as eMSP",
            protocol: "OCPI 2.2.1",
            color: "text-[#45c4a0] border-[#45c4a0]/30 bg-[#45c4a0]/10",
          },
          {
            id: "ocpi_cpo_authorize_token",
            name: "eMSP Driver Validation",
            desc: "Simulate CPO querying eMSP partner endpoint for card validity.",
            role: "Test as CPO",
            protocol: "OCPI 2.2.1",
            color: "text-[#8b5cf6] border-[#8b5cf6]/30 bg-[#8b5cf6]/10",
          },
          {
            id: "ocpi_cpo_dispatch_cdr",
            name: "eMSP CDR Reception",
            desc: "Simulate CPO dispatching completed session CDR to eMSP receiver.",
            role: "Test as CPO",
            protocol: "OCPI 2.2.1",
            color: "text-[#3f78e0] border-[#3f78e0]/30 bg-[#3f78e0]/10",
          },
          {
            id: "oicp_emsp_authorize_start",
            name: "Hubject AuthorizeStart",
            desc: "Simulate driver RFID validation against Hubject eRoamingAuthorizeStart.",
            role: "Test as eMSP",
            protocol: "OICP 2.3",
            color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
          },
        ].map((test) => (
          <Card key={test.id} className="border-border/70 bg-card hover:border-[#54a8c7]/50 transition-all flex flex-col justify-between">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <Badge variant="outline" className={`text-[10px] ${test.color}`}>
                  {test.protocol} • {test.role}
                </Badge>
              </div>
              <CardTitle className="text-sm font-bold">{test.name}</CardTitle>
              <CardDescription className="text-xs">{test.desc}</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl font-semibold border-border/80 hover:bg-[#54a8c7]/10 hover:text-[#54a8c7]"
                disabled={runningTestId === test.id}
                onClick={() => handleRunQuickTest(test.id)}
              >
                {runningTestId === test.id ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <PlayCircle className="size-3.5 mr-1.5" />
                    Run Quick Test
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Quick Test Results */}
      {recentResults.length > 0 && (
        <Card>
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" /> Recent Test Executions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Assertions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentResults.map((res, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-semibold text-xs text-foreground">{res.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{res.role}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            res.passed
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]"
                              : "bg-red-500/15 text-red-400 border-red-500/30 text-[10px]"
                          }
                        >
                          {res.passed ? `PASSED (${res.statusCode})` : `FAILED (${res.statusCode})`}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{res.latencyMs}ms</TableCell>
                      <TableCell className="text-xs">
                        {res.assertions?.filter((a: any) => a.passed).length} / {res.assertions?.length} passed
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Automated Certification Suites Banner */}
      <Card className="border-border/70 bg-muted/20">
        <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="size-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
              <Layers className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">
                Automated End-to-End Certification Suites
              </h3>
              <p className="text-xs text-muted-foreground">
                Run automated test pipelines: Full Lifecycle (Authorize → Start → Active Session → Stop → CDR), Catalog Discovery, or Hubject OICP 2.3.
              </p>
            </div>
          </div>
          <Button asChild variant="secondary" className="rounded-xl shrink-0 font-bold">
            <Link href="/roaming/test-suite?tab=scenarios">
              View Scenarios →
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
