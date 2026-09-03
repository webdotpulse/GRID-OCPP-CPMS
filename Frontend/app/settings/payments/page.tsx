"use client";

import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Loader2,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  ShieldCheck,
  Zap,
  Globe,
  WalletCards,
  ArrowRight,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

export default function PaymentsSettingsPage() {
  const { user } = useAuth();

  // Mollie State
  const [mollieApiKey, setMollieApiKey] = useState("");
  const [mollieProfileId, setMollieProfileId] = useState("");
  const [mollieTestMode, setMollieTestMode] = useState(true);
  const [mollieHasApiKey, setMollieHasApiKey] = useState(false);
  const [isSavingMollie, setIsSavingMollie] = useState(false);

  // Stripe State
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");
  const [stripeTestMode, setStripeTestMode] = useState(true);
  const [stripeHasSecretKey, setStripeHasSecretKey] = useState(false);
  const [stripeHasWebhookSecret, setStripeHasWebhookSecret] = useState(false);
  const [isSavingStripe, setIsSavingStripe] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "admin" && user?.role !== "superadmin") return;

    const fetchConfigs = async () => {
      try {
        const [mollieRes, stripeRes] = await Promise.allSettled([
          api.get("/settings/payments/mollie"),
          api.get("/settings/payments/stripe"),
        ]);

        if (mollieRes.status === "fulfilled" && mollieRes.value?.data) {
          const m = mollieRes.value.data.data || mollieRes.value.data;
          if (m && typeof m === "object") {
            setMollieHasApiKey(!!m.hasApiKey || !!m.apiKey);
            setMollieProfileId(m.profileId || "");
            setMollieTestMode(m.testMode ?? true);
          }
        }

        if (stripeRes.status === "fulfilled" && stripeRes.value?.data) {
          const s = stripeRes.value.data.data || stripeRes.value.data;
          if (s && typeof s === "object") {
            setStripeHasSecretKey(!!s.hasSecretKey || !!s.secretKey);
            setStripePublishableKey(s.publishableKey || "");
            setStripeHasWebhookSecret(!!s.hasWebhookSecret || !!s.webhookSecret);
            setStripeTestMode(s.testMode ?? true);
          }
        }
      } catch (error) {
        console.error("Failed to fetch payment gateway configs:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfigs();
  }, [user]);

  const handleSaveMollie = async () => {
    setIsSavingMollie(true);
    try {
      await api.post("/settings/payments/mollie", {
        apiKey: mollieApiKey,
        profileId: mollieProfileId,
        testMode: mollieTestMode,
      });
      toast.success("Mollie configuration updated successfully");
      if (mollieApiKey) setMollieHasApiKey(true);
      setMollieApiKey("");
    } catch (error) {
      console.error("Failed to update Mollie config:", error);
      toast.error("Failed to update Mollie configuration");
    } finally {
      setIsSavingMollie(false);
    }
  };

  const handleSaveStripe = async () => {
    setIsSavingStripe(true);
    try {
      await api.post("/settings/payments/stripe", {
        secretKey: stripeSecretKey,
        publishableKey: stripePublishableKey,
        webhookSecret: stripeWebhookSecret,
        testMode: stripeTestMode,
      });
      toast.success("Stripe configuration updated successfully");
      if (stripeSecretKey) setStripeHasSecretKey(true);
      if (stripeWebhookSecret) setStripeHasWebhookSecret(true);
      setStripeSecretKey("");
      setStripeWebhookSecret("");
    } catch (error) {
      console.error("Failed to update Stripe config:", error);
      toast.error("Failed to update Stripe configuration");
    } finally {
      setIsSavingStripe(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
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

  const backendUrl = typeof window !== "undefined" ? window.location.origin : "https://cpms.mobilitypulse.com";
  const mollieWebhookUrl = `${backendUrl}/api/payments/webhook`;
  const stripeWebhookUrl = `${backendUrl}/api/payments/webhook/stripe`;

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Payment Gateways</h1>
              <Badge variant="outline" className="border-[#54a8c7]/40 text-[#54a8c7] bg-[#54a8c7]/10 text-xs">
                Multi-Gateway Active
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure Stripe and Mollie processing engines for ad-hoc driver checkouts, Apple Pay, Google Pay, and iDEAL.
            </p>
          </div>
          <Link href="/payments">
            <Button variant="outline" size="sm" className="gap-1.5 border-border/80">
              <ExternalLink className="size-4 text-muted-foreground" />
              Test Public Checkout
            </Button>
          </Link>
        </div>

        {/* Gateway Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Stripe Status Card */}
          <div className="rounded-xl border border-border/80 bg-card/60 p-4.5 backdrop-blur-sm relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-[#635BFF]/15 border border-[#635BFF]/30 flex items-center justify-center text-[#635BFF] font-bold text-lg">
                  S
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">Stripe Gateway</h3>
                    {stripeHasSecretKey ? (
                      <Badge className="bg-[#45c4a0]/15 text-[#45c4a0] border-[#45c4a0]/30 hover:bg-[#45c4a0]/20 text-[11px]">
                        <CheckCircle2 className="size-3 mr-1" />
                        {stripeTestMode ? "Sandbox Ready" : "Live Active"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[11px]">
                        Not Configured
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Credit Cards, Apple Pay, Google Pay, Global Wallets
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Publishable Key:</span>
              <span className="font-mono text-foreground font-medium">
                {stripePublishableKey ? `${stripePublishableKey.substring(0, 14)}...` : "—"}
              </span>
            </div>
          </div>

          {/* Mollie Status Card */}
          <div className="rounded-xl border border-border/80 bg-card/60 p-4.5 backdrop-blur-sm relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-[#fab758]/15 border border-[#fab758]/30 flex items-center justify-center text-[#fab758] font-bold text-lg">
                  M
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">Mollie Gateway</h3>
                    {mollieHasApiKey ? (
                      <Badge className="bg-[#45c4a0]/15 text-[#45c4a0] border-[#45c4a0]/30 hover:bg-[#45c4a0]/20 text-[11px]">
                        <CheckCircle2 className="size-3 mr-1" />
                        {mollieTestMode ? "Sandbox Ready" : "Live Active"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[11px]">
                        Not Configured
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    iDEAL, Bancontact, EPS, European Direct Debit
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Profile ID:</span>
              <span className="font-mono text-foreground font-medium">{mollieProfileId || "—"}</span>
            </div>
          </div>
        </div>

        {/* Configuration Tabs */}
        <Tabs defaultValue="stripe" className="w-full">
          <TabsList className="grid grid-cols-2 max-w-md bg-muted/60 p-1">
            <TabsTrigger value="stripe" className="gap-2 data-[state=active]:bg-background">
              <CreditCard className="size-4 text-[#635BFF]" />
              <span>Stripe Gateway</span>
            </TabsTrigger>
            <TabsTrigger value="mollie" className="gap-2 data-[state=active]:bg-background">
              <WalletCards className="size-4 text-[#fab758]" />
              <span>Mollie Gateway</span>
            </TabsTrigger>
          </TabsList>

          {/* STRIPE TAB CONTENT */}
          <TabsContent value="stripe" className="mt-4 space-y-4">
            <Card className="border-border/80 bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-[#635BFF]/15 flex items-center justify-center text-[#635BFF]">
                      <CreditCard className="size-4.5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Stripe Configuration</CardTitle>
                      <CardDescription>
                        Direct credit card settlement and global digital wallet payments.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    PCI-DSS Level 1 Hosted
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center space-x-2 py-4">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Loading Stripe settings...</span>
                  </div>
                ) : (
                  <>
                    {stripeHasSecretKey && !stripeSecretKey && (
                      <Alert className="bg-[#45c4a0]/10 border-[#45c4a0]/30 py-2.5">
                        <ShieldCheck className="size-4 text-[#45c4a0]" />
                        <AlertDescription className="text-xs text-[#45c4a0] font-medium">
                          Stripe API credentials are saved and encrypted. Entering a new secret key below will overwrite it.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="stripePublishableKey" className="text-xs font-semibold">
                          Publishable Key <span className="text-muted-foreground font-normal">(Client-Side)</span>
                        </Label>
                        <Input
                          id="stripePublishableKey"
                          placeholder="pk_live_... or pk_test_..."
                          value={stripePublishableKey}
                          onChange={(e) => setStripePublishableKey(e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stripeSecretKey" className="text-xs font-semibold">
                          Secret API Key <span className="text-red-400 font-normal">*</span>
                        </Label>
                        <Input
                          id="stripeSecretKey"
                          type="password"
                          placeholder={stripeHasSecretKey ? "••••••••••••••••••••••••" : "sk_live_... or sk_test_..."}
                          value={stripeSecretKey}
                          onChange={(e) => setStripeSecretKey(e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stripeWebhookSecret" className="text-xs font-semibold">
                        Webhook Signing Secret <span className="text-muted-foreground font-normal">(Optional, for signature validation)</span>
                      </Label>
                      <Input
                        id="stripeWebhookSecret"
                        type="password"
                        placeholder={stripeHasWebhookSecret ? "••••••••••••••••••••••••" : "whsec_..."}
                        value={stripeWebhookSecret}
                        onChange={(e) => setStripeWebhookSecret(e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>

                    {/* Webhook URL Endpoint Box */}
                    <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Zap className="size-3.5 text-[#54a8c7]" />
                          Stripe Webhook Listener Endpoint
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => copyToClipboard(stripeWebhookUrl, "Stripe Webhook URL")}
                        >
                          <Copy className="size-3" />
                          Copy URL
                        </Button>
                      </div>
                      <p className="font-mono text-[11px] bg-background/80 px-2.5 py-1.5 rounded border border-border/50 text-muted-foreground select-all">
                        {stripeWebhookUrl}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Add this URL to your Stripe Dashboard Webhooks to listen for <code className="text-foreground">checkout.session.completed</code> and <code className="text-foreground">payment_intent.succeeded</code>.
                      </p>
                    </div>

                    {/* Test Mode Switch */}
                    <div className="flex items-center justify-between border rounded-lg p-4 bg-muted/20">
                      <div className="space-y-0.5">
                        <Label htmlFor="stripeTestMode" className="text-sm font-semibold">
                          Sandbox / Test Mode
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Use test credentials (<code className="text-foreground">sk_test_...</code>) and sandbox card tokens without real bank settlement.
                        </p>
                      </div>
                      <Switch
                        id="stripeTestMode"
                        checked={stripeTestMode}
                        onCheckedChange={setStripeTestMode}
                      />
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter className="flex items-center justify-between border-t border-border/50 pt-4">
                <p className="text-xs text-muted-foreground">
                  Supports Apple Pay, Google Pay, 3D Secure 2, and global currencies.
                </p>
                <Button
                  onClick={handleSaveStripe}
                  disabled={isLoading || isSavingStripe || (!stripeHasSecretKey && !stripeSecretKey)}
                  className="bg-[#635BFF] hover:bg-[#635BFF]/90 text-white gap-2"
                >
                  {isSavingStripe && <Loader2 className="size-4 animate-spin" />}
                  Save Stripe Configuration
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* MOLLIE TAB CONTENT */}
          <TabsContent value="mollie" className="mt-4 space-y-4">
            <Card className="border-border/80 bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-[#fab758]/15 flex items-center justify-center text-[#fab758]">
                      <WalletCards className="size-4.5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Mollie Configuration</CardTitle>
                      <CardDescription>
                        Benelux and European payment processing for iDEAL, Bancontact, and SEPA.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    European Banking API
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center space-x-2 py-4">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Loading Mollie settings...</span>
                  </div>
                ) : (
                  <>
                    {mollieHasApiKey && !mollieApiKey && (
                      <Alert className="bg-[#45c4a0]/10 border-[#45c4a0]/30 py-2.5">
                        <ShieldCheck className="size-4 text-[#45c4a0]" />
                        <AlertDescription className="text-xs text-[#45c4a0] font-medium">
                          Mollie API Key is active. Entering a new key below will overwrite it.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="mollieApiKey" className="text-xs font-semibold">
                          Mollie API Key <span className="text-red-400 font-normal">*</span>
                        </Label>
                        <Input
                          id="mollieApiKey"
                          type="password"
                          placeholder={mollieHasApiKey ? "••••••••••••••••••••••••" : "live_... or test_..."}
                          value={mollieApiKey}
                          onChange={(e) => setMollieApiKey(e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="mollieProfileId" className="text-xs font-semibold">
                          Profile ID <span className="text-muted-foreground font-normal">(Optional)</span>
                        </Label>
                        <Input
                          id="mollieProfileId"
                          placeholder="pfl_..."
                          value={mollieProfileId}
                          onChange={(e) => setMollieProfileId(e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>

                    {/* Webhook URL Endpoint Box */}
                    <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Zap className="size-3.5 text-[#54a8c7]" />
                          Mollie Webhook Callback Endpoint
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => copyToClipboard(mollieWebhookUrl, "Mollie Webhook URL")}
                        >
                          <Copy className="size-3" />
                          Copy URL
                        </Button>
                      </div>
                      <p className="font-mono text-[11px] bg-background/80 px-2.5 py-1.5 rounded border border-border/50 text-muted-foreground select-all">
                        {mollieWebhookUrl}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Automatically provided to Mollie API when initiating payment sessions for instant status callbacks.
                      </p>
                    </div>

                    {/* Test Mode Switch */}
                    <div className="flex items-center justify-between border rounded-lg p-4 bg-muted/20">
                      <div className="space-y-0.5">
                        <Label htmlFor="mollieTestMode" className="text-sm font-semibold">
                          Test Mode
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Use Mollie sandbox environment with test keys (<code className="text-foreground">test_...</code>).
                        </p>
                      </div>
                      <Switch
                        id="mollieTestMode"
                        checked={mollieTestMode}
                        onCheckedChange={setMollieTestMode}
                      />
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter className="flex items-center justify-between border-t border-border/50 pt-4">
                <p className="text-xs text-muted-foreground">
                  Supports iDEAL 2.0, Bancontact, EPS, KBC/CBC, and Belfius.
                </p>
                <Button
                  onClick={handleSaveMollie}
                  disabled={isLoading || isSavingMollie || (!mollieHasApiKey && !mollieApiKey)}
                  className="bg-[#fab758] hover:bg-[#fab758]/90 text-black font-medium gap-2"
                >
                  {isSavingMollie && <Loader2 className="size-4 animate-spin" />}
                  Save Mollie Configuration
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
