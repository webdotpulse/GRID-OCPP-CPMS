import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Info, CheckCircle2, Sparkles, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { getUnifiedVendorErrorInfo, UnifiedVendorErrorInfo } from "@/lib/vendorErrorCodes";

interface InvestigateIssue {
  title: string;
  desc: string;
  type: 'error' | 'warning' | 'success';
  vendorInfo?: UnifiedVendorErrorInfo;
  raedianInfo?: any;
}

interface InvestigateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chargerId: number;
  connectorId: number;
}

export function InvestigateDialog({ open, onOpenChange, chargerId, connectorId }: InvestigateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [healing, setHealing] = useState(false);
  const [analysis, setAnalysis] = useState<InvestigateIssue[]>([]);

  useEffect(() => {
    if (open) {
      runAnalysis();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chargerId, connectorId]);

  const handleAutoHeal = async () => {
    try {
      setHealing(true);

      // Check if a multi-vendor error was identified (Alfen, Easee, Zaptec, Peblar, Raedian)
      const vendorIssue = analysis.find(item => item.vendorInfo || item.raedianInfo);
      if (vendorIssue) {
        const vInfo = vendorIssue.vendorInfo;
        const vendorName = vInfo?.vendor || (vendorIssue.raedianInfo ? "Raedian" : "Generic");
        const vendorCode = vInfo?.code || vendorIssue.raedianInfo?.code;

        try {
          const analyzeRes = await api.post("/auto-heal-playbooks/analyze", {
            chargerId,
            vendor: vendorName,
            vendorErrorCode: vendorCode,
          });

          if (analyzeRes.data?.matchedPlaybook?.id) {
            await api.post(`/auto-heal-playbooks/${analyzeRes.data.matchedPlaybook.id}/execute`, {
              chargerId,
              connectorId,
              triggerReason: `Investigate Dialog Auto-Heal: [${vendorName} ${vendorCode}] ${vInfo?.name || ""}`,
            });
            toast.success(`Dispatched ${analyzeRes.data.matchedPlaybook.name}! Executing recovery sequence...`);
            setTimeout(() => {
              runAnalysis();
            }, 2500);
            return;
          }
        } catch {
          // fallback to telemetry playbook if vendor search fails
        }
      }

      // Check if there is an active telemetry configuration playbook
      const playbooksRes = await api.get("/auto-heal-playbooks");
      const playbooks = Array.isArray(playbooksRes.data) ? playbooksRes.data : [];
      const telemetryPlaybook = playbooks.find((p: any) =>
        p.isActive && (
          p.name.includes("MeterValues Telemetry") ||
          p.name.includes("Missing MeterValueSampleInterval") ||
          p.errorCodePattern?.includes("MeterValueSampleInterval")
        )
      );

      if (telemetryPlaybook) {
        await api.post(`/auto-heal-playbooks/${telemetryPlaybook.id}/execute`, {
          chargerId,
          connectorId,
          triggerReason: "Investigate Dialog One-Click Auto-Heal",
        });
        toast.success(`Dispatched ${telemetryPlaybook.name}! Executing recovery sequence...`);
      } else {
        // Fallback: manually update configuration if playbook is not yet seeded
        await api.post(`/chargers/${chargerId}/config`, {
          key: "MeterValueSampleInterval",
          value: "60"
        });
        await api.post(`/chargers/${chargerId}/config`, {
          key: "MeterValuesSampledData",
          value: "Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage,SoC"
        });
        toast.success("Applied recommended MeterValues telemetry configurations!");
      }

      // Re-run analysis after short cooldown
      setTimeout(() => {
        runAnalysis();
      }, 2500);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to execute auto-heal playbook");
    } finally {
      setHealing(false);
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    setAnalysis([]);
    try {
      // Fetch recent logs
      const logsRes = await api.get(`/chargers/${chargerId}/logs`);
      const logs = Array.isArray(logsRes.data) ? logsRes.data : [];

      // Fetch charger configs to check MeterValuesSampledData and MeterValueSampleInterval
      let configs: any[] = [];
      try {
        const confRes = await api.get(`/chargers/${chargerId}/config`);
        configs = Array.isArray(confRes.data) ? confRes.data : [];
      } catch {
         // ignore config errors
      }

      const issues: InvestigateIssue[] = [];

      const meterValuesSampleInterval = configs.find(c => c.key === "MeterValueSampleInterval")?.value;
      const meterValuesSampledData = configs.find(c => c.key === "MeterValuesSampledData")?.value;

      if (!meterValuesSampleInterval || parseInt(meterValuesSampleInterval) === 0) {
         issues.push({
            title: "Missing MeterValueSampleInterval",
            desc: "The charger configuration 'MeterValueSampleInterval' is missing or set to 0. This means the charger will not send periodic MeterValues. Please set this to 60 (seconds) in the Configuration panel.",
            type: "error"
         });
      } else {
         issues.push({
            title: "MeterValueSampleInterval Configured",
            desc: `MeterValueSampleInterval is set to ${meterValuesSampleInterval}.`,
            type: "success"
         });
      }

      if (!meterValuesSampledData || !meterValuesSampledData.includes("Power.Active.Import") || !meterValuesSampledData.includes("Energy.Active.Import.Register")) {
         issues.push({
            title: "Missing MeterValuesSampledData Keys",
            desc: "The 'MeterValuesSampledData' configuration does not include 'Power.Active.Import' or 'Energy.Active.Import.Register'. The charger will not send Power and Energy data. Please update the configuration.",
            type: "error"
         });
      } else {
          issues.push({
             title: "MeterValuesSampledData Configured",
             desc: "Required keys are present in MeterValuesSampledData.",
             type: "success"
          });
      }

      // Analyze Logs
      const recentLogs = [...logs].reverse().slice(0, 100);
      let foundMeterValues = false;
      let foundPower = false;
      let foundEnergy = false;

      for (const log of recentLogs) {
         try {
             const parsed = typeof log.message === 'string' ? JSON.parse(log.message) : log.message;
             if (Array.isArray(parsed) && parsed[0] === 2 && parsed[2] === "MeterValues") {
                 foundMeterValues = true;
                 const payload = parsed[3];
                 if (payload && payload.connectorId === connectorId || payload.evseId === connectorId) {
                     const meterValueArr = Array.isArray(payload.meterValue) ? payload.meterValue : [];
                     for (const mv of meterValueArr) {
                         const sampledValueArr = Array.isArray(mv.sampledValue) ? mv.sampledValue : [];
                         for (const sv of sampledValueArr) {
                             const measurand = sv.measurand || "Energy.Active.Import.Register";
                             if (measurand === "Power.Active.Import" || measurand === "Power") foundPower = true;
                             if (measurand === "Energy.Active.Import.Register" || measurand === "Energy") foundEnergy = true;
                         }
                     }
                 }
             }
         } catch {
            // ignore
         }
      }

      if (!foundMeterValues) {
          issues.push({
             title: "No MeterValues in Recent Logs",
             desc: "Looking at the last 100 WebSocket logs, the charger has not sent any 'MeterValues' messages. This might be due to configuration, or the charging session hasn't actually started drawing power.",
             type: "warning"
          });
      } else {
          if (!foundPower) {
             issues.push({
                title: "Missing Power in MeterValues",
                desc: "MeterValues are being received, but 'Power.Active.Import' is not among the measurands.",
                type: "warning"
             });
          }
          if (!foundEnergy) {
             issues.push({
                title: "Missing Energy in MeterValues",
                desc: "MeterValues are being received, but 'Energy.Active.Import.Register' is not among the measurands.",
                type: "warning"
             });
          }
      }

      // Check for Multi-Vendor Error Codes in recent logs or status notifications (Alfen, Easee, Zaptec, Peblar, Raedian)
      let foundVendorError: UnifiedVendorErrorInfo | null = null;
      for (const log of recentLogs) {
        try {
          const parsed = typeof log.message === "string" ? JSON.parse(log.message) : log.message;
          const msgStr = typeof log.message === "string" ? log.message : JSON.stringify(log.message);

          if (Array.isArray(parsed) && parsed[0] === 2 && parsed[2] === "StatusNotification") {
            const payload = parsed[3];
            const vInfo = getUnifiedVendorErrorInfo(payload?.vendorId, payload?.vendorErrorCode || payload?.errorCode, payload?.info);
            if (vInfo && !vInfo.isHealthy) {
              foundVendorError = vInfo;
              break;
            }
          }
          const vText = getUnifiedVendorErrorInfo(undefined, undefined, msgStr);
          if (vText && !vText.isHealthy) {
            foundVendorError = vText;
            break;
          }
        } catch {
          // ignore
        }
      }

      if (foundVendorError) {
        issues.unshift({
          title: `${foundVendorError.vendor} Diagnostic: [${foundVendorError.code}] ${foundVendorError.name}`,
          desc: `Reason: ${foundVendorError.description} | Action: ${foundVendorError.action}`,
          type: foundVendorError.severity === "CRITICAL" || foundVendorError.severity === "HIGH" ? "error" : "warning",
          vendorInfo: foundVendorError,
        });
      }

      if (issues.length === 0) {
        issues.push({
          title: "All Checks Passed",
          desc: "No configuration anomalies, missing measurands, or vendor fault codes detected.",
          type: "success",
        });
      }

      setAnalysis(issues);
    } catch {
      toast.error("Failed to run diagnostics analysis");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Charging Session Analysis</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">Analyzing configurations and logs...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analysis.map((item, i) => (
                <div key={i} className={`p-3.5 rounded-xl border flex gap-3 ${item.vendorInfo ? 'bg-orange-50/60 dark:bg-orange-950/20 border-orange-300 dark:border-orange-800' : item.type === 'error' ? 'bg-red-50/50 border-red-200' : item.type === 'warning' ? 'bg-yellow-50/50 border-yellow-200' : 'bg-green-50/50 border-green-200'}`}>
                  {item.vendorInfo ? (
                    <ShieldAlert className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                  ) : item.type === 'error' ? (
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  ) : item.type === 'warning' ? (
                    <Info className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  )}
                  <div className="space-y-1">
                     <div className="flex items-center gap-2 flex-wrap">
                       <h4 className={`text-sm font-medium ${item.vendorInfo ? 'text-orange-900 dark:text-orange-200 font-bold' : item.type === 'error' ? 'text-red-800' : item.type === 'warning' ? 'text-yellow-800' : 'text-green-800'}`}>{item.title}</h4>
                       {item.vendorInfo && (
                         <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-orange-200 dark:bg-orange-800 text-orange-900 dark:text-orange-100">
                           {item.vendorInfo.vendor} {item.vendorInfo.code}
                         </span>
                       )}
                     </div>
                     <p className={`text-xs leading-relaxed ${item.vendorInfo ? 'text-orange-800 dark:text-orange-300' : item.type === 'error' ? 'text-red-600' : item.type === 'warning' ? 'text-yellow-700' : 'text-green-600'}`}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
          {analysis.some(item =>
            item.vendorInfo ||
            item.raedianInfo ||
            item.title.includes("MeterValue") ||
            item.title.includes("Missing Power") ||
            item.title.includes("Missing Energy")
          ) ? (
            <Button
              onClick={handleAutoHeal}
              disabled={healing || loading}
              className="bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] text-white hover:opacity-90 shadow-sm"
              size="sm"
            >
              {healing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Auto-Healing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Auto-Heal with Playbook
                </>
              )}
            </Button>
          ) : <div />}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
