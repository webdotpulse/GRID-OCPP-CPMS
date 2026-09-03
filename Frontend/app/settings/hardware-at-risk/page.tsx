"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";

interface HardwareAtRiskSettings {
  isEnabled: boolean;
  offlineThresholdMinutes: number;
  criticalErrorCodeLimit: number;
  autoHealAttemptLimit: number;
  notifyAdminEmail: boolean;
  adminEmailAddress: string | null;
}

export default function HardwareAtRiskPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [settings, setSettings] = useState<HardwareAtRiskSettings>({
    isEnabled: false,
    offlineThresholdMinutes: 60,
    criticalErrorCodeLimit: 5,
    autoHealAttemptLimit: 3,
    notifyAdminEmail: false,
    adminEmailAddress: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get("/settings/hardware-at-risk");
      setSettings(response.data);
    } catch (error) {
      toast.error("Failed to load Hardware at Risk settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/settings/hardware-at-risk", settings);
      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (user?.role !== "admin" && user?.role !== "superadmin") {
    return (
      <AppShell>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Unauthorized</h1>
          <p>You do not have permission to view this page.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Hardware at Risk</h1>
          <p className="text-muted-foreground">
            Configure monitoring and alerting thresholds for detecting unhealthy chargers.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-500" />
              <CardTitle>Monitoring Rules</CardTitle>
            </div>
            <CardDescription>
              Define the conditions under which a charger is flagged as &quot;At Risk&quot;.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Enable Monitoring</Label>
                <p className="text-sm text-muted-foreground">
                  Activate background jobs to evaluate charger health against thresholds.
                </p>
              </div>
              <Switch
                checked={settings.isEnabled}
                onCheckedChange={(checked) => setSettings({ ...settings, isEnabled: checked })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Offline Threshold (Minutes)</Label>
                <Input
                  type="number"
                  min="1"
                  value={settings.offlineThresholdMinutes}
                  onChange={(e) => setSettings({ ...settings, offlineThresholdMinutes: parseInt(e.target.value) || 0 })}
                  disabled={!settings.isEnabled}
                />
                <p className="text-xs text-muted-foreground">
                  Flag chargers if no heartbeat is received within this duration.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Consecutive Error Limit</Label>
                <Input
                  type="number"
                  min="1"
                  value={settings.criticalErrorCodeLimit}
                  onChange={(e) => setSettings({ ...settings, criticalErrorCodeLimit: parseInt(e.target.value) || 0 })}
                  disabled={!settings.isEnabled}
                />
                <p className="text-xs text-muted-foreground">
                  Flag chargers that report &apos;Faulted&apos; status this many times in a row.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Configure how administrators are alerted when hardware is flagged.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Send an email alert to the specified administrator when a charger becomes at risk.
                </p>
              </div>
              <Switch
                checked={settings.notifyAdminEmail}
                onCheckedChange={(checked) => setSettings({ ...settings, notifyAdminEmail: checked })}
                disabled={!settings.isEnabled}
              />
            </div>

            {settings.notifyAdminEmail && (
              <div className="space-y-2">
                <Label>Admin Email Address</Label>
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={settings.adminEmailAddress || ""}
                  onChange={(e) => setSettings({ ...settings, adminEmailAddress: e.target.value })}
                  disabled={!settings.isEnabled}
                />
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </div>
    </AppShell>
  );
}
