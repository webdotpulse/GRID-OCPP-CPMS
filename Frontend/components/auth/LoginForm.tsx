"use client";
import { logger } from "@/lib/logger";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<string | null>(null);
  const [partialToken, setPartialToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  // Email verification state
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);
    setUnverifiedEmail(null);
    setResendStatus(null);
    try {
      const response = await api.post('/auth/login', data);
      const resData = response.data?.data || response.data;

      if (resData.requires2FA) {
        setRequires2FA(true);
        setTwoFactorMethod(resData.method);
        setPartialToken(resData.partialToken);
      } else {
        const { token, user } = resData;
        login(token, user);
      }
    } catch (err: any) {
      logger.error('Login error', err);
      const errorMsg = err.response?.data?.error || 'Invalid email or password';
      setError(errorMsg);
      if (err.response?.data?.requiresVerification || errorMsg.toLowerCase().includes('verification required')) {
        setUnverifiedEmail(err.response?.data?.email || data.email);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onResendVerification = async () => {
    const targetEmail = unverifiedEmail || getValues('email');
    if (!targetEmail) return;
    setIsResending(true);
    try {
      await api.post('/auth/resend-verification', { email: targetEmail });
      setResendStatus('Verification link has been resent. Please check your inbox.');
    } catch (err: any) {
      setResendStatus(err.response?.data?.error || 'Failed to resend verification link.');
    } finally {
      setIsResending(false);
    }
  };

  const onVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/verify-2fa-login', { partialToken, code: twoFactorCode });
      const resData = response.data?.data || response.data;
      const { token, user } = resData;
      login(token, user);
    } catch (err: any) {
      logger.error('2FA Verification error', err);
      setError(err.response?.data?.error || 'Invalid 2FA code');
    } finally {
      setIsLoading(false);
    }
  };

  if (requires2FA) {
    return (
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-1 border-b pb-4">
          <CardTitle className="text-2xl font-bold tracking-tight">Two-Factor Authentication</CardTitle>
          <CardDescription>
            {twoFactorMethod === 'email'
              ? "We've sent a code to your email. Please enter it below."
              : "Please enter the code from your Authenticator app."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={onVerify2FA}>
          <CardContent className="space-y-5 pt-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="123456"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                maxLength={6}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t pt-4">
            <Button type="submit" className="w-full" disabled={isLoading || twoFactorCode.length < 6}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRequires2FA(false)} className="w-full">
              Back to Login
            </Button>
          </CardFooter>
        </form>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-2xl border-border/80 bg-card/95 backdrop-blur-md rounded-3xl overflow-hidden card-border-top-primary">
      <CardHeader className="space-y-1.5 pb-2 pt-6 px-6">
        <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Sign In</CardTitle>
        <CardDescription>
          Enter your credentials to access the central CPMS console
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-2 px-6">
          {error && (
            <Alert variant="destructive" className="rounded-xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-2">
                <span>{error}</span>
                {unverifiedEmail && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start mt-1 text-xs rounded-lg"
                    onClick={onResendVerification}
                    disabled={isResending}
                  >
                    {isResending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                    Resend Verification Email
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          {resendStatus && (
            <Alert variant="default" className="rounded-xl border-green-500 bg-green-50/10 text-green-700 dark:text-green-300">
              <AlertDescription>{resendStatus}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-foreground">Email Address</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="operator@thechargegrid.com" 
              {...register('email')}
              className={`rounded-xl ${errors.email ? 'border-destructive' : ''}`}
            />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground">Password</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline font-semibold">
                Forgot password?
              </Link>
            </div>
            <Input 
              id="password" 
              type="password" 
              placeholder="••••••••"
              {...register('password')}
              className={`rounded-xl ${errors.password ? 'border-destructive' : ''}`}
            />
            {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-2 pb-6 px-6 border-0">
          <Button type="submit" className="w-full rounded-xl bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white font-bold h-10 shadow-md shadow-[#54a8c7]/20" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign In to CPMS
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary hover:underline font-semibold">
              Create Account
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

