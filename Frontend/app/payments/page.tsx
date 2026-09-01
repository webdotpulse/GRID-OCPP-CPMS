"use client";

import { useEffect, useState, Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { useSearchParams } from "next/navigation";
import { Loader2, CreditCard, WalletCards, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

function PaymentsContent() {
  const [amount, setAmount] = useState<string>("15.00");
  const [transactionId, setTransactionId] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<"stripe" | "mollie">("stripe");
  const [loading, setLoading] = useState<boolean>(false);
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get("success") === "true";
  const isCanceled = searchParams.get("canceled") === "true";

  useEffect(() => {
    if (isSuccess) {
      toast.success("Payment completed successfully!");
    } else if (isCanceled) {
      toast.info("Payment was canceled.");
    }
    // Generate a test transaction ID on load
    setTransactionId(uuidv4());
  }, [isSuccess, isCanceled]);

  const initiatePayment = async () => {
    try {
      setLoading(true);
      const res = await api.post("/payments/intent", {
        amount: parseFloat(amount),
        currency: "EUR",
        transactionId: transactionId,
        provider: selectedProvider,
      });

      const checkoutUrl = res.data?.checkoutUrl || res.data?.data?.checkoutUrl;
      if (checkoutUrl) {
        // Redirect to hosted checkout page
        window.location.href = checkoutUrl;
      } else {
        toast.error(res.data?.message || "Failed to initialize payment");
        setLoading(false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to initialize payment");
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/80 shadow-lg">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Ad-Hoc Session Checkout</CardTitle>
          <Badge variant="outline" className="text-xs">
            Walk-in Driver Portal
          </Badge>
        </div>
        <CardDescription>
          Select your preferred payment processor to settle EV charging session fees instantly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isSuccess && (
          <div className="rounded-lg border border-[#45c4a0]/30 bg-[#45c4a0]/10 p-3 flex items-center gap-2.5 text-xs text-[#45c4a0]">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>Charging session payment was verified and processed successfully!</span>
          </div>
        )}

        {/* Provider Selection */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Select Payment Gateway</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedProvider("stripe")}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                selectedProvider === "stripe"
                  ? "border-[#635BFF] bg-[#635BFF]/10 text-foreground ring-1 ring-[#635BFF]"
                  : "border-border/70 hover:border-border hover:bg-muted/40 text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <CreditCard className="size-4 text-[#635BFF]" />
                <span className="font-semibold text-sm text-foreground">Stripe</span>
              </div>
              <span className="text-[11px] leading-tight text-muted-foreground">
                Cards, Apple Pay, Google Pay, Digital Wallets
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedProvider("mollie")}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                selectedProvider === "mollie"
                  ? "border-[#fab758] bg-[#fab758]/10 text-foreground ring-1 ring-[#fab758]"
                  : "border-border/70 hover:border-border hover:bg-muted/40 text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <WalletCards className="size-4 text-[#fab758]" />
                <span className="font-semibold text-sm text-foreground">Mollie</span>
              </div>
              <span className="text-[11px] leading-tight text-muted-foreground">
                iDEAL, Bancontact, EPS, SEPA Direct Debit
              </span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-xs font-semibold">Amount (EUR)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-base font-semibold"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="txId" className="text-xs font-semibold">Transaction Reference</Label>
            <Input
              id="txId"
              type="text"
              value={transactionId}
              readOnly
              className="bg-muted font-mono text-xs text-muted-foreground"
            />
          </div>

          <Button
            onClick={initiatePayment}
            disabled={loading}
            className={`w-full gap-2 text-white font-medium ${
              selectedProvider === "stripe"
                ? "bg-[#635BFF] hover:bg-[#635BFF]/90"
                : "bg-[#fab758] hover:bg-[#fab758]/90 text-black font-semibold"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Connecting to {selectedProvider === "stripe" ? "Stripe" : "Mollie"}...
              </>
            ) : (
              <>
                Proceed to {selectedProvider === "stripe" ? "Stripe Checkout" : "Mollie Checkout"}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
      <CardFooter className="border-t border-border/50 pt-3 pb-3 flex items-center justify-center text-xs text-muted-foreground gap-1.5">
        <ShieldCheck className="size-3.5 text-[#45c4a0]" />
        <span>256-bit encrypted checkout session • Hosted & PCI-DSS compliant</span>
      </CardFooter>
    </Card>
  );
}

export default function PaymentsPage() {
  return (
    <div className="container py-10 max-w-lg mx-auto">
      <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading checkout...</div>}>
        <PaymentsContent />
      </Suspense>
    </div>
  );
}
