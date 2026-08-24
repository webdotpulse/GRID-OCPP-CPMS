"use client";

import { logger } from "@/lib/logger";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Loader2, User, KeyRound, ShieldAlert, ShieldCheck, Settings, WalletCards, Mail, Globe, Activity, Tv, Sparkles, Shield } from "lucide-react";
import Image from "next/image";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  userType: z.enum(["private", "company", "employee"]),
  companyName: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  taxNumber: z.string().optional().nullable(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, "Current password required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  // 2FA states
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<string | null>(null);
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [setupMethod, setSetupMethod] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [is2FALoading, setIs2FALoading] = useState(false);
  const [mailConfig, setMailConfig] = useState<{ fromAddress: string; isActive: boolean } | null>(null);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
      userType: "private",
      companyName: "",
      address: "",
      phone: "",
      taxNumber: "",
    }
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema)
  });

  useEffect(() => {
    if (user) {
      api.get(`/auth/me`)
        .then(res => {
          const fetchedUser = res.data || res.data;

          profileForm.reset({
            name: fetchedUser.name || user.name || "",
            email: fetchedUser.email || user.email,
            userType: fetchedUser.userType || user.userType || "private",
            companyName: fetchedUser.companyName || user.companyName || "",
            address: fetchedUser.address || user.address || "",
            phone: fetchedUser.phone || user.phone || "",
            taxNumber: fetchedUser.taxNumber || user.taxNumber || "",
          });

          if (fetchedUser?.createdAt) {
            setCreatedAt(fetchedUser.createdAt);
          }
          setTwoFactorEnabled(fetchedUser?.twoFactorEnabled || false);
          setTwoFactorMethod(fetchedUser?.twoFactorMethod || null);
        })
        .catch(err => {
          logger.error("Failed to fetch full user profile for settings", err);
          profileForm.reset({
            name: user.name || "",
            email: user.email,
            userType: user.userType || "private",
            companyName: user.companyName || "",
            address: user.address || "",
            phone: user.phone || "",
            taxNumber: user.taxNumber || "",
          });
        });
    }
  }, [user, profileForm]);

  const onProfileSubmit = async (data: ProfileValues) => {
    setIsSavingProfile(true);
    try {
      await api.put('/auth/me', data);
      toast.success("Profile updated successfully!");
    } catch (error) {
      logger.error("Failed to update profile", error);
      toast.error("Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordValues) => {
    setIsSavingPassword(true);
    try {
      await api.put('/auth/password', data);
      toast.success("Password updated successfully!");
      passwordForm.reset();
    } catch (error) {
      logger.error("Failed to update password", error);
      toast.error("Failed to update password.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const start2FASetup = async (method: string) => {
    setSetupMethod(method);
    setIs2FALoading(true);
    try {
      if (method === 'authenticator') {
        const res = await api.get('/auth/2fa/generate');
        setQrCodeUrl(res.data.qrCodeUrl || res.data?.qrCodeUrl);
        setSetupSecret(res.data.secret || res.data?.secret);
      } else if (method === 'email') {
        await api.post('/auth/2fa/send-email-code');
        toast.success('Setup code sent to your email.');
      }
      setIsSettingUp2FA(true);
    } catch (error) {
      logger.error('Failed to start 2FA setup', error);
      toast.error('Failed to start 2FA setup.');
      setSetupMethod(null);
    } finally {
      setIs2FALoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      const fetchMailConfig = async () => {
        try {
          const res = await api.get('/settings/mail');
          if (res.data !== undefined && res.data) {
            setMailConfig(res.data);
          }
        } catch (err) {
          console.error("Failed to fetch mail config:", err);
        }
      };
      fetchMailConfig();
    }
  }, [user]);

  const confirm2FASetup = async () => {
    setIs2FALoading(true);
    try {
      await api.post('/auth/2fa/enable', {
        method: setupMethod,
        secret: setupSecret,
        code: setupCode
      });
      setTwoFactorEnabled(true);
      setTwoFactorMethod(setupMethod);
      setIsSettingUp2FA(false);
      setSetupCode("");
      toast.success('Two-factor authentication enabled successfully!');
    } catch (error: any) {
      logger.error('Failed to enable 2FA', error);
      toast.error(error.response?.data?.error || 'Failed to verify code.');
    } finally {
      setIs2FALoading(false);
    }
  };

  const disable2FA = async () => {
    setIs2FALoading(true);
    try {
      await api.post('/auth/2fa/disable');
      setTwoFactorEnabled(false);
      setTwoFactorMethod(null);
      setIsSettingUp2FA(false);
      toast.success('Two-factor authentication disabled.');
    } catch (error) {
      logger.error('Failed to disable 2FA', error);
      toast.error('Failed to disable 2FA.');
    } finally {
      setIs2FALoading(false);
    }
  };

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
          <div className="size-8 border-2 border-[#54a8c7] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs">Loading profile settings...</span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center">
              <Settings className="size-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
              Account Settings & Preferences
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage your personal profile, security authentication, and global system configurations.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profile Settings */}
          <Card className="card-border-top-primary">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="size-5 text-[#54a8c7]" /> Public Profile
              </CardTitle>
              <CardDescription>
                Update your account details and contact information.
              </CardDescription>
            </CardHeader>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold">Full Name</Label>
                  <Input id="name" {...profileForm.register('name')} />
                  {profileForm.formState.errors.name && (
                    <p className="text-xs text-destructive">{profileForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold">Email Address</Label>
                  <Input id="email" type="email" {...profileForm.register('email')} />
                  {profileForm.formState.errors.email && (
                    <p className="text-xs text-destructive">{profileForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="userType" className="text-xs font-semibold">User Type</Label>
                  <Select
                    value={profileForm.watch('userType')}
                    onValueChange={(val: any) => profileForm.setValue('userType', val)}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select user type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="private">Private Individual</SelectItem>
                      <SelectItem value="company">Enterprise Company</SelectItem>
                      <SelectItem value="employee">Corporate Employee</SelectItem>
                    </SelectContent>
                  </Select>
                  {profileForm.formState.errors.userType && (
                    <p className="text-xs text-destructive">{profileForm.formState.errors.userType.message}</p>
                  )}
                </div>

                {profileForm.watch('userType') !== 'private' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="companyName" className="text-xs font-semibold">Company Name</Label>
                      <Input id="companyName" {...profileForm.register('companyName')} />
                      {profileForm.formState.errors.companyName && (
                        <p className="text-xs text-destructive">{profileForm.formState.errors.companyName.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="taxNumber" className="text-xs font-semibold">Tax / VAT Number</Label>
                      <Input id="taxNumber" {...profileForm.register('taxNumber')} />
                      {profileForm.formState.errors.taxNumber && (
                        <p className="text-xs text-destructive">{profileForm.formState.errors.taxNumber.message}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold">Phone Number</Label>
                  <Input id="phone" type="tel" placeholder="+32 ..." {...profileForm.register('phone')} />
                  {profileForm.formState.errors.phone && (
                    <p className="text-xs text-destructive">{profileForm.formState.errors.phone.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="address" className="text-xs font-semibold">Address</Label>
                  <Input id="address" {...profileForm.register('address')} />
                  {profileForm.formState.errors.address && (
                    <p className="text-xs text-destructive">{profileForm.formState.errors.address.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">System Role</Label>
                    <Input value={user?.role === 'superadmin' ? 'Super Administrator' : user?.role === 'admin' ? 'Administrator' : 'Standard User'} readOnly className="bg-muted/50 text-muted-foreground font-semibold" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Member Since</Label>
                    <Input value={createdAt ? new Date(createdAt).toLocaleDateString() : 'Active'} readOnly className="bg-muted/50 text-muted-foreground font-semibold" />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-border/50 pt-4 px-6 flex justify-end">
                <Button type="submit" className="rounded-xl bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white font-bold" disabled={isSavingProfile}>
                  {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Profile Changes
                </Button>
              </CardFooter>
            </form>
          </Card>

          <div className="space-y-8">
            {/* Security Settings */}
            <Card>
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <KeyRound className="size-5 text-[#fab758]" /> Account Password
                </CardTitle>
                <CardDescription>
                  Update your authentication password to ensure system security.
                </CardDescription>
              </CardHeader>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="currentPassword" className="text-xs font-semibold">Current Password</Label>
                    <Input id="currentPassword" type="password" placeholder="••••••••" {...passwordForm.register('currentPassword')} />
                    {passwordForm.formState.errors.currentPassword && (
                      <p className="text-xs text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword" className="text-xs font-semibold">New Password</Label>
                    <Input id="newPassword" type="password" placeholder="••••••••" {...passwordForm.register('newPassword')} />
                    {passwordForm.formState.errors.newPassword && (
                      <p className="text-xs text-destructive">{passwordForm.formState.errors.newPassword.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs font-semibold">Confirm New Password</Label>
                    <Input id="confirmPassword" type="password" placeholder="••••••••" {...passwordForm.register('confirmPassword')} />
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="text-xs text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border/50 pt-4 px-6 flex justify-end">
                  <Button type="submit" variant="destructive" className="rounded-xl font-semibold" disabled={isSavingPassword}>
                    {isSavingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password
                  </Button>
                </CardFooter>
              </form>
            </Card>

            {/* 2FA Settings */}
            <Card>
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {twoFactorEnabled ? <ShieldCheck className="size-5 text-emerald-500" /> : <ShieldAlert className="size-5 text-amber-500" />}
                  Two-Factor Authentication
                </CardTitle>
                <CardDescription>
                  Protect your operator session with multi-factor verification.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {!twoFactorEnabled && !isSettingUp2FA && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Select your preferred 2FA authentication method:</p>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" className="rounded-xl" onClick={() => start2FASetup('authenticator')} disabled={is2FALoading}>
                        {is2FALoading && setupMethod === 'authenticator' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Authenticator App (TOTP)
                      </Button>
                      <Button variant="outline" className="rounded-xl" onClick={() => start2FASetup('email')} disabled={is2FALoading}>
                        {is2FALoading && setupMethod === 'email' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Email Verification Code
                      </Button>
                    </div>
                  </div>
                )}

                {isSettingUp2FA && (
                  <div className="space-y-4">
                    {setupMethod === 'authenticator' && qrCodeUrl && (
                      <div className="flex flex-col items-center gap-2 p-4 border rounded-2xl bg-white shadow-xs">
                        <p className="text-xs text-gray-800 font-bold">Scan QR code in Google Authenticator or 1Password</p>
                        <Image src={qrCodeUrl} alt="2FA QR Code" width={180} height={180} />
                      </div>
                    )}
                    {setupMethod === 'email' && (
                      <Alert className="rounded-xl">
                        <AlertDescription className="text-xs">We sent a 6-digit confirmation code to your email.</AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="setupCode" className="text-xs font-semibold">Verification Code</Label>
                      <Input
                        id="setupCode"
                        value={setupCode}
                        onChange={(e) => setSetupCode(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        className="font-mono text-center tracking-widest text-base"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={confirm2FASetup} disabled={is2FALoading || setupCode.length < 6} className="rounded-xl bg-[#54a8c7] text-white">
                        {is2FALoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Verify & Enable
                      </Button>
                      <Button variant="ghost" onClick={() => { setIsSettingUp2FA(false); setSetupMethod(null); }} disabled={is2FALoading} className="rounded-xl">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {twoFactorEnabled && (
                  <div className="space-y-3">
                    <Badge variant="soft-success" className="text-xs font-semibold py-1 px-3">
                      2FA Active via {twoFactorMethod === 'authenticator' ? 'Authenticator App' : 'Email'}
                    </Badge>
                    <div>
                      <Button variant="destructive" size="sm" onClick={disable2FA} disabled={is2FALoading} className="rounded-xl">
                        {is2FALoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Disable 2FA Protection
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Admin Global Settings Tiles */}
          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <Card className="lg:col-span-2 shadow-sandbox">
              <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="size-5 text-[#54a8c7]" /> Enterprise Integrations & Subsystems
                </CardTitle>
                <CardDescription>
                  Configure protocol parameters, pricing feeds, payment processors, and connected gateways.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { title: 'Dynamic Tariffs', desc: 'EPEX Spot day-ahead electricity prices (ENTSO-E, EnergyZero).', link: '/settings/tariffs', icon: WalletCards, color: 'text-[#fab758] bg-[#fab758]/15' },
                    { title: 'Mail Templates', desc: 'Custom HTML email layouts for receipts & password resets.', link: '/settings/templates', icon: Mail, color: 'text-[#54a8c7] bg-[#54a8c7]/15' },
                    { title: 'SMTP Mail Server', desc: 'Outgoing mail server credentials and sender delivery rules.', link: '/settings/mail', icon: Mail, color: 'text-[#3f78e0] bg-[#3f78e0]/15' },
                    { title: 'Roaming (OCPI & OICP)', desc: 'Interoperability hubs, Hubject OICP and e-clearing.net OCPI.', link: '/roaming', icon: Globe, color: 'text-[#45c4a0] bg-[#45c4a0]/15' },
                    { title: 'Config Profiles', desc: 'Standardized OCPP 1.6/2.0.1 key-value parameter templates.', link: '/config-profiles', icon: Settings, color: 'text-[#747ed1] bg-[#747ed1]/15' },
                    { title: 'Quirk Profiles', desc: 'Hardware-specific compatibility fixes for non-compliant chargers.', link: '/quirk-profiles', icon: ShieldAlert, color: 'text-[#e2626b] bg-[#e2626b]/15' },
                    { title: 'Ad Manager', desc: 'Promotional multimedia campaigns for charger LCD screens.', link: '/settings/ad-manager', icon: Tv, color: 'text-[#54a8c7] bg-[#54a8c7]/15' },
                    { title: 'EMS Gateways', desc: 'Real-time telemetry feeds for solar PV, inverters, and BESS storage.', link: '/ems-gateways', icon: Activity, color: 'text-[#45c4a0] bg-[#45c4a0]/15' },
                    { title: 'Mollie Payments', desc: 'Direct credit card and iDEAL settlement integration.', link: '/settings/payments', icon: WalletCards, color: 'text-[#fab758] bg-[#fab758]/15' },
                  ].map((tile) => {
                    const Icon = tile.icon;
                    return (
                      <Link key={tile.title} href={tile.link} className="group block">
                        <div className="h-full rounded-2xl border border-border/70 bg-card p-4.5 hover:border-[#54a8c7]/50 hover:shadow-md transition-all flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2.5 mb-2">
                              <div className={`size-8 rounded-xl flex items-center justify-center ${tile.color}`}>
                                <Icon className="size-4" />
                              </div>
                              <h3 className="font-bold text-sm text-foreground group-hover:text-[#54a8c7] transition-colors">
                                {tile.title}
                              </h3>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {tile.desc}
                            </p>
                          </div>
                          <div className="mt-3 text-[11px] font-bold text-[#54a8c7] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            Configure Subsystem →
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
