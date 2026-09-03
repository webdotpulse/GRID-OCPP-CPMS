"use client";

import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function TariffsSettingsPage() {
  const { user } = useAuth();
  const [entsoeKey, setEntsoeKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin" && user?.role !== "superadmin") return;

    const fetchKeys = async () => {
      try {
        const response = await api.get("/settings/tariffs/entsoe-key");
        if ((response.data !== undefined && response.data !== null)) {
          setHasKey(response.data.hasKey);
          setEntsoeKey(response.data.key);
        }
      } catch (error) {
        console.error("Failed to fetch API key:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchKeys();
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.post("/settings/tariffs/entsoe-key", { key: entsoeKey });
      toast.success("ENTSO-E API Key updated successfully");
      setHasKey(true);
    } catch (error) {
      console.error("Failed to update API key:", error);
      toast.error("Failed to update API key");
    } finally {
      setIsSaving(false);
    }
  };

  if (user?.role !== "admin" && user?.role !== "superadmin") {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Tariffs Configuration</h1>
        <p className="text-muted-foreground">
          Configure API keys and settings for dynamic tariffs (e.g. EPEX Spot, ENTSO-E).
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <CardTitle>ENTSO-E API Integration</CardTitle>
            </div>
            <CardDescription>
              Provide your ENTSO-E RESTful API Security Token to fetch day-ahead pricing data for dynamic tariffs.
              This token will be used by the backend to fetch prices for supported regions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading settings...</span>
              </div>
            ) : (
              <>
                {hasKey && !entsoeKey && (
                  <Alert className="bg-muted">
                    <AlertDescription>
                      An API key is currently saved. Entering a new key below will overwrite it.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="entsoe-key">Security Token (API Key)</Label>
                  <Input
                    id="entsoe-key"
                    type="password"
                    placeholder="Enter ENTSO-E API Key"
                    value={entsoeKey}
                    onChange={(e) => setEntsoeKey(e.target.value)}
                  />
                  <div className="text-xs text-muted-foreground space-y-1 mt-2 bg-muted p-3 rounded-md">
                    <p className="font-semibold text-foreground">How to obtain a security token:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Register an account on the <a href="https://transparency.entsoe.eu/" target="_blank" rel="noreferrer" className="text-primary hover:underline">ENTSO-E Transparency Platform</a>.</li>
                      <li>Send an email to <a href="mailto:transparency@entsoe.eu" className="text-primary hover:underline">transparency@entsoe.eu</a> with "Restful API access" in the subject line.</li>
                      <li>Indicate your registered email address in the email body.</li>
                      <li>Once access is granted, generate your Security Token in your account settings under "Web API Security Token".</li>
                    </ol>
                  </div>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave} disabled={isLoading || isSaving || !entsoeKey}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save API Key
            </Button>
          </CardFooter>
        </Card>
      </div>
      </div>
    </AppShell>
  );
}
