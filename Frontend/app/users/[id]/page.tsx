"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  Edit,
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  Shield,
  CreditCard,
  BatteryCharging,
  CheckCircle2,
  XCircle,
  Key,
  Calendar,
  Globe,
  Loader2,
} from "lucide-react";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

interface UserDetail {
  id: number;
  name: string | null;
  email: string;
  role: string;
  userType: string;
  companyName: string | null;
  companyId: number | null;
  company?: {
    id: number;
    name: string;
    clientNumber?: string;
    status: string;
    contactName?: string;
    contactEmail?: string;
  } | null;
  address: string | null;
  phone: string | null;
  taxNumber: string | null;
  language: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorMethod: string | null;
  createdAt: string;
  rfidUsers?: Array<{
    rfid_user_id: number;
    rfid_tag: string;
    idTag?: string;
    name: string;
    email?: string;
    active: boolean;
    status?: string;
    type?: string;
    createdAt: string;
  }>;
  vehicleEnergyProfile?: {
    id: number;
    batteryCapacityKwh?: number;
    batteryCapacity?: number;
    minDischargeSocPercent?: number;
    minSocThreshold?: number;
  } | null;
  chargingStations?: Array<{
    id: number;
    station_name: string;
    city: string;
    status: string;
  }>;
}

export default function UserDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [userData, setUserData] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        setIsLoading(true);
        const res = await api.get(`/users/${id}`);
        const data = res.data?.data || res.data;
        if (data) {
          setUserData(data);
        }
      } catch (error: any) {
        logger.error("Failed to fetch user details", error);
        toast.error("Failed to load user profile");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchUserDetails();
    }
  }, [id]);

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "superadmin":
        return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30";
      case "admin":
        return "bg-[#54a8c7]/15 text-[#54a8c7] border-[#54a8c7]/30";
      case "operator":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "client_admin":
        return "bg-[#3f78e0]/15 text-[#3f78e0] border-[#3f78e0]/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Loader2 className="size-8 animate-spin text-[#54a8c7]" />
          <p className="text-sm text-muted-foreground">Loading user profile...</p>
        </div>
      </AppShell>
    );
  }

  if (!userData) {
    return (
      <AppShell>
        <div className="max-w-xl mx-auto text-center py-16 space-y-4">
          <div className="size-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <XCircle className="size-6" />
          </div>
          <h2 className="text-xl font-bold text-foreground">User Not Found</h2>
          <p className="text-sm text-muted-foreground">
            The requested user account does not exist or you do not have permission to view it.
          </p>
          <Link href="/users">
            <Button variant="outline" className="rounded-xl mt-2">
              <ChevronLeft className="size-4 mr-1.5" /> Back to Users
            </Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/users">
              <Button variant="ghost" size="icon-sm" className="rounded-xl">
                <ChevronLeft className="size-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
                  {userData.name || userData.email}
                </h1>
                <Badge className={`text-xs font-semibold uppercase tracking-wider ${getRoleBadgeVariant(userData.role)}`}>
                  {userData.role}
                </Badge>
                {userData.emailVerified ? (
                  <Badge variant="soft-success" className="gap-1 text-[11px]">
                    <CheckCircle2 className="size-3" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="soft-secondary" className="gap-1 text-[11px]">
                    Unverified
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                User ID #{userData.id} • Registered {new Date(userData.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {(currentUser?.role === "admin" || currentUser?.role === "superadmin") && (
            <div className="flex items-center gap-2">
              <Link href={`/users/${userData.id}/edit`}>
                <Button className="rounded-xl bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white shadow-md shadow-[#54a8c7]/20">
                  <Edit className="size-4 mr-1.5" /> Edit Profile
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Primary Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main User Profile Card */}
          <Card className="md:col-span-2 rounded-2xl border border-border/70 bg-card shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <User className="size-4 text-[#54a8c7]" /> Account & Contact Details
              </CardTitle>
              <CardDescription className="text-xs">
                Personal details, contact info, and language preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
                  <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                    <Mail className="size-3.5" /> Email Address
                  </span>
                  <p className="text-sm font-semibold text-foreground mt-1 break-all">
                    {userData.email}
                  </p>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
                  <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                    <Phone className="size-3.5" /> Phone Number
                  </span>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    {userData.phone || "—"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
                  <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                    <Building2 className="size-3.5" /> Account Classification
                  </span>
                  <p className="text-sm font-semibold text-foreground mt-1 capitalize">
                    {userData.userType} EV Account
                  </p>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
                  <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                    <Globe className="size-3.5" /> Preferred Language
                  </span>
                  <p className="text-sm font-semibold text-foreground mt-1 uppercase">
                    {userData.language || "EN"}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
                <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                  <MapPin className="size-3.5" /> Physical Address
                </span>
                <p className="text-sm font-medium text-foreground mt-1">
                  {userData.address || "No address on file"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Security & Organization Panel */}
          <div className="space-y-6">
            {/* Corporate Affiliation */}
            <Card className="rounded-2xl border border-border/70 bg-card shadow-xs">
              <CardHeader className="border-b border-border/60 pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Building2 className="size-4 text-[#3f78e0]" /> Corporate Client
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {userData.company ? (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-foreground">{userData.company.name}</p>
                    {userData.company.clientNumber && (
                      <p className="text-xs text-muted-foreground font-mono">
                        Client #{userData.company.clientNumber}
                      </p>
                    )}
                    <Badge variant="soft-primary" className="text-[10px]">
                      {userData.company.status.toUpperCase()}
                    </Badge>
                  </div>
                ) : userData.companyName ? (
                  <p className="text-sm font-medium text-foreground">{userData.companyName}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Private / Independent Driver</p>
                )}
              </CardContent>
            </Card>

            {/* Security Profile */}
            <Card className="rounded-2xl border border-border/70 bg-card shadow-xs">
              <CardHeader className="border-b border-border/60 pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Shield className="size-4 text-purple-400" /> Security & 2FA
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Two-Factor Auth</span>
                  <Badge variant={userData.twoFactorEnabled ? "soft-success" : "soft-secondary"} className="text-[10px]">
                    {userData.twoFactorEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                {userData.twoFactorMethod && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">2FA Method</span>
                    <span className="font-semibold text-foreground uppercase">{userData.twoFactorMethod}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Assigned RFID Cards */}
        <Card className="rounded-2xl border border-border/70 bg-card shadow-xs">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <CreditCard className="size-4 text-[#54a8c7]" /> Assigned RFID Badges & Tokens
                </CardTitle>
                <CardDescription className="text-xs">
                  Physical and digital RFID identifiers authorized for this user.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {userData.rfidUsers?.length || 0} Badges
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {!userData.rfidUsers || userData.rfidUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                <Key className="size-6 mx-auto mb-2 opacity-40" />
                No RFID badges mapped to this account.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {userData.rfidUsers.map((rfid) => (
                  <div
                    key={rfid.rfid_user_id}
                    className="p-3.5 rounded-xl border border-border/60 bg-muted/30 flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-mono text-sm font-bold text-foreground">
                        {rfid.idTag || rfid.rfid_tag}
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">{rfid.name || "RFID Card"}</p>
                    </div>
                    <Badge
                      className={`text-[10px] ${
                        rfid.active || rfid.status === "Active"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-500 border-rose-500/30"
                      }`}
                    >
                      {rfid.active || rfid.status === "Active" ? "Active" : "Blocked"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vehicle Energy Profile (V2G / Smart Charging) */}
        {userData.vehicleEnergyProfile && (
          <Card className="rounded-2xl border border-border/70 bg-card shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BatteryCharging className="size-4 text-emerald-500" /> Vehicle Energy Profile (V2G)
              </CardTitle>
              <CardDescription className="text-xs">
                Configured EV battery capacity and smart grid minimum reserve thresholds.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
                <span className="text-[11px] text-muted-foreground font-medium">Battery Pack Capacity</span>
                <p className="text-xl font-mono font-bold text-foreground mt-1">
                  {userData.vehicleEnergyProfile.batteryCapacityKwh ??
                    userData.vehicleEnergyProfile.batteryCapacity ??
                    "—"}{" "}
                  <span className="text-xs text-muted-foreground font-normal">kWh</span>
                </p>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
                <span className="text-[11px] text-muted-foreground font-medium">Minimum Reserve SoC</span>
                <p className="text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {userData.vehicleEnergyProfile.minDischargeSocPercent ??
                    userData.vehicleEnergyProfile.minSocThreshold ??
                    "—"}
                  %
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
