import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface InvestigateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chargerId: number;
  connectorId: number;
}

export function InvestigateDialog({ open, onOpenChange, chargerId, connectorId }: InvestigateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<{ title: string; desc: string; type: 'error' | 'warning' | 'success' }[]>([]);

  useEffect(() => {
    if (open) {
      runAnalysis();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chargerId, connectorId]);

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

      const issues = [];

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

      if (issues.length === 0) {
          issues.push({
             title: "No Issues Found",
             desc: "Configuration and logs look correct. The charger might be in a suspended state or the session just started.",
             type: "success"
          });
      }

      setAnalysis(issues as any);
    } catch {
       setAnalysis([{ title: "Error", desc: "Failed to run analysis", type: "error" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
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
                <div key={i} className={`p-3 rounded-md border flex gap-3 ${item.type === 'error' ? 'bg-red-50/50 border-red-200' : item.type === 'warning' ? 'bg-yellow-50/50 border-yellow-200' : 'bg-green-50/50 border-green-200'}`}>
                  {item.type === 'error' ? <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" /> : item.type === 'warning' ? <Info className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />}
                  <div>
                     <h4 className={`text-sm font-medium ${item.type === 'error' ? 'text-red-800' : item.type === 'warning' ? 'text-yellow-800' : 'text-green-800'}`}>{item.title}</h4>
                     <p className={`text-xs mt-1 ${item.type === 'error' ? 'text-red-600' : item.type === 'warning' ? 'text-yellow-700' : 'text-green-600'}`}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
