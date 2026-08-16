"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("Verifying your email address...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token. Please check the link from your email.");
      return;
    }

    const verify = async () => {
      try {
        const response = await api.post("/auth/verify-email", { token });
        setStatus("success");
        setMessage(response.data?.message || "Your email has been successfully verified! You can now log in.");
      } catch (err: any) {
        setStatus("error");
        setMessage(err.response?.data?.error || "Failed to verify email. The link may have expired or is invalid.");
      }
    };

    verify();
  }, [token]);

  return (
    <Card className="w-full max-w-md shadow-sm">
      <CardHeader className="space-y-1 border-b pb-4 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">Email Verification</CardTitle>
        <CardDescription>
          Open-Source OCPP Charge Point Management System
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-8 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Verified!</h3>
            <p className="text-sm text-muted-foreground mb-6">{message}</p>
            <Button asChild className="w-full">
              <Link href="/login">Continue to Sign In</Link>
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 text-destructive mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Verification Failed</h3>
            <p className="text-sm text-muted-foreground mb-6">{message}</p>
            <div className="flex flex-col gap-2 w-full">
              <Button asChild variant="default" className="w-full">
                <Link href="/login">Go to Login</Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
      <Suspense fallback={
        <Card className="w-full max-w-md shadow-sm p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </Card>
      }>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
