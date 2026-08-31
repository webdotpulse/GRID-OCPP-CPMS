"use client";

import React, { useEffect, useState } from "react";
import {
  User,
  Bell,
  LogOut,
  ChevronRight,
  Shield,
  HelpCircle,
  KeyRound,
  Mail,
  Phone,
  Building,
  MapPin,
  CheckCircle2,
  Loader2,
  Lock,
  Smartphone,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  QrCode,
  ShieldCheck,
  LifeBuoy
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ModalType = "account" | "notifications" | "security" | "help" | null;

interface NotificationSettings {
  chargingStarted: boolean;
  chargingCompleted: boolean;
  faultAlerts: boolean;
  emailReceipts: boolean;
  spotPriceAlerts: boolean;
}

export default function MobileSettings() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [profileData, setProfileData] = useState<any>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Account Form State
  const [accountForm, setAccountForm] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    address: "",
  });
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // Notification State
  const [notifications, setNotifications] = useState<NotificationSettings>({
    chargingStarted: true,
    chargingCompleted: true,
    faultAlerts: true,
    emailReceipts: true,
    spotPriceAlerts: false,
  });

  // Security / 2FA State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [is2FASetupOpen, setIs2FASetupOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [is2FALoading, setIs2FALoading] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState<{ phone: string; email: string; name: string } | null>(null);
  const [walletPasses, setWalletPasses] = useState<any[]>([]);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);

  const fetchProfile = async () => {
    try {
      const response = await api.get("/auth/me");
      const data = response.data?.data || response.data;
      if (data) {
        setProfileData(data);
        setAccountForm({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          companyName: data.companyName || "",
          address: data.address || "",
        });
        setTwoFactorEnabled(data.twoFactorEnabled || false);
      }
    } catch (error) {
      logger.error("Failed to fetch user profile", error);
    }
  };

  const fetchWalletPasses = async () => {
    try {
      const res = await api.get("/rfid/my-passes");
      setWalletPasses(res.data?.data || []);
    } catch (e) {
      logger.warn("Could not fetch wallet passes", e);
    }
  };

  const fetchEmergencyContact = async () => {
    try {
      const response = await api.get("/auth/emergency-contact");
      const data = response.data?.data || response.data;
      if (data) {
        setEmergencyContact(data);
      }
    } catch (error) {
      logger.error("Failed to fetch emergency contact", error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchEmergencyContact();
      fetchWalletPasses();
    }
    // Check Web Push Notification status
    if (typeof window !== "undefined" && "Notification" in window) {
      setIsPushSubscribed(Notification.permission === "granted");
    }
    // Load notification preferences from localStorage
    try {
      const savedNotifs = localStorage.getItem("cpms_mobile_notifications");
      if (savedNotifs) {
        setNotifications(JSON.parse(savedNotifs));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [user]);

  const handleToggleWebPush = async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
      toast.error("Web Push is not supported in this browser");
      return;
    }

    setIsPushLoading(true);
    try {
      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Push notification permission was denied");
          setIsPushSubscribed(false);
          setIsPushLoading(false);
          return;
        }
      }

      const reg = await navigator.serviceWorker.ready;
      const keyRes = await api.get("/push/vapid-public-key");
      const vapidPublicKey = keyRes.data?.data?.publicKey;

      if (!vapidPublicKey) {
        toast.error("Failed to retrieve server VAPID key");
        setIsPushLoading(false);
        return;
      }

      // Convert VAPID base64 to Uint8Array
      const padding = "=".repeat((4 - (vapidPublicKey.length % 4)) % 4);
      const base64 = (vapidPublicKey + padding).replace(/\-/g, "+").replace(/_/g, "/");
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray,
      });

      await api.post("/push/subscribe", subscription.toJSON());
      setIsPushSubscribed(true);
      toast.success("Web Push Notifications enabled! You'll receive alerts for 80% SoC, charging complete & idle fees.");
    } catch (err: any) {
      logger.error("Failed to enable Web Push", err);
      toast.error(err.message || "Failed to subscribe to Web Push");
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Save Account Profile
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setIsSavingAccount(true);
    try {
      await api.put("/auth/me", accountForm);
      toast.success("Account profile updated successfully!");
      fetchProfile();
      setActiveModal(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || "Failed to update profile");
    } finally {
      setIsSavingAccount(false);
    }
  };

  // Change Password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.currentPassword) {
      toast.error("Current password is required");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setIsSavingPassword(true);
    try {
      await api.put("/auth/password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success("Password changed successfully!");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowPasswordSection(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || "Failed to change password");
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Save Notifications
  const handleToggleNotification = (key: keyof NotificationSettings) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    try {
      localStorage.setItem("cpms_mobile_notifications", JSON.stringify(updated));
    } catch {
      // Ignore
    }
    toast.success("Notification preferences updated");
  };

  // 2FA Setup
  const handleStart2FASetup = async () => {
    setIs2FALoading(true);
    try {
      const res = await api.get("/auth/2fa/generate");
      const data = res.data?.data || res.data;
      setQrCodeUrl(data.qrCodeUrl || null);
      setSetupSecret(data.secret || null);
      setIs2FASetupOpen(true);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to initiate 2FA setup");
    } finally {
      setIs2FALoading(false);
    }
  };

  const handleConfirm2FA = async () => {
    if (!setupCode || setupCode.length !== 6) {
      toast.error("Please enter the 6-digit verification code");
      return;
    }

    setIs2FALoading(true);
    try {
      await api.post("/auth/2fa/enable", {
        method: "authenticator",
        secret: setupSecret,
        code: setupCode,
      });
      setTwoFactorEnabled(true);
      setIs2FASetupOpen(false);
      setSetupCode("");
      toast.success("Two-Factor Authentication is now enabled!");
      fetchProfile();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Invalid verification code. Please try again.");
    } finally {
      setIs2FALoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm("Are you sure you want to disable Two-Factor Authentication?")) return;
    setIs2FALoading(true);
    try {
      await api.post("/auth/2fa/disable");
      setTwoFactorEnabled(false);
      setIs2FASetupOpen(false);
      toast.success("Two-Factor Authentication disabled");
      fetchProfile();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to disable 2FA");
    } finally {
      setIs2FALoading(false);
    }
  };

  const settingsGroups = [
    {
      title: "Preferences",
      items: [
        {
          id: "account" as ModalType,
          label: "Account Settings",
          subtitle: "Profile info & password",
          icon: User,
          color: "text-blue-500",
          bg: "bg-blue-50",
          action: () => setActiveModal("account"),
        },
        {
          id: "notifications" as ModalType,
          label: "Notifications",
          subtitle: "Push alerts & email receipts",
          icon: Bell,
          color: "text-purple-500",
          bg: "bg-purple-50",
          action: () => setActiveModal("notifications"),
        },
        {
          id: "security" as ModalType,
          label: "Privacy & Security",
          subtitle: "2FA, sessions & credentials",
          icon: Shield,
          color: "text-emerald-500",
          bg: "bg-emerald-50",
          action: () => setActiveModal("security"),
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          id: "help" as ModalType,
          label: "Help Center",
          subtitle: "Guides, FAQs & support hotline",
          icon: HelpCircle,
          color: "text-amber-500",
          bg: "bg-amber-50",
          action: () => setActiveModal("help"),
        },
      ],
    },
  ];

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto pb-24">
      {/* Profile Header */}
      <section className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl ring-4 ring-blue-50">
            {profileData?.name?.charAt(0) || user?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-lg leading-tight">
              {profileData?.name || user?.name || "User"}
            </h2>
            <p className="text-xs text-gray-500">{profileData?.email || user?.email}</p>
            <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-800 capitalize">
              {profileData?.role || user?.role || "User"}
            </div>
          </div>
        </div>

        <button
          onClick={() => setActiveModal("account")}
          className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
        >
          Edit
        </button>
      </section>

      {/* Admin Desktop Console Switcher */}
      {isAdmin && (
        <section className="bg-gradient-to-r from-[#1e2228] to-[#2a303c] text-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#54a8c7]">
              Admin Portal
            </span>
            <h3 className="font-bold text-sm">Desktop Admin Console</h3>
            <p className="text-[11px] text-gray-300">
              Manage stations, tariffs, load balancing & roaming
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="bg-[#54a8c7] hover:bg-[#3f78e0] text-white font-semibold text-xs rounded-xl shadow-xs"
          >
            Open <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </Button>
        </section>
      )}

      {/* Digital Wallet & NFC Passes Section */}
      <section className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center font-bold text-sm">
              📲
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Mobile Wallet & NFC Passes</h3>
              <p className="text-[11px] text-gray-500">Tap phone to authorize at charger</p>
            </div>
          </div>
        </div>

        {walletPasses.length === 0 ? (
          <div className="text-center py-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-xs text-gray-500">No active RFID passes registered to your account.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {walletPasses.map((pass) => (
              <div key={pass.rfid_user_id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-gray-900 block">{pass.name}</span>
                  <span className="text-[10px] font-mono text-gray-500">{pass.rfid_tag}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(pass.appleWalletUrl, "_blank")}
                    className="h-8 text-[11px] font-semibold rounded-lg bg-black text-white hover:bg-gray-800 hover:text-white border-0"
                  >
                    🍏 Apple Wallet
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(pass.googleWalletUrl, "_blank")}
                    className="h-8 text-[11px] font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white border-0"
                  >
                    💳 Google Wallet
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Web Push Milestone Notifications */}
      <section className="bg-gradient-to-br from-purple-50 to-blue-50/50 p-4 rounded-2xl border border-purple-100/80 flex items-center justify-between">
        <div className="space-y-0.5 pr-3">
          <div className="flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-purple-600" />
            <h3 className="font-bold text-xs text-gray-900">Push Milestone Alerts</h3>
          </div>
          <p className="text-[11px] text-gray-600">
            80% SoC reached, charging complete & idle fee alerts
          </p>
        </div>
        <Button
          size="sm"
          disabled={isPushLoading}
          onClick={handleToggleWebPush}
          className={`h-8 text-xs font-semibold rounded-xl ${
            isPushSubscribed ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-purple-600 hover:bg-purple-700 text-white"
          }`}
        >
          {isPushLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          {isPushSubscribed ? "Active ✓" : "Enable Push"}
        </Button>
      </section>

      {/* Settings Groups */}
      {settingsGroups.map((group, groupIdx) => (
        <section key={groupIdx}>
          <h2 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider pl-1">
            {group.title}
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {group.items.map((item, itemIdx) => {
              const Icon = item.icon;
              return (
                <button
                  key={itemIdx}
                  onClick={item.action}
                  className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50/80 transition-colors active:bg-gray-100 text-left"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.bg}`}>
                      <Icon className={`w-4.5 h-4.5 ${item.color}`} />
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900 text-sm block">
                        {item.label}
                      </span>
                      <span className="text-[11px] text-gray-400 block">
                        {item.subtitle}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {/* Sign Out Button */}
      <section className="pt-2">
        <button
          onClick={handleLogout}
          className="w-full bg-white rounded-2xl shadow-sm border border-red-100 p-3.5 flex items-center justify-center space-x-2 text-red-600 hover:bg-red-50/50 active:bg-red-100 transition-colors"
        >
          <LogOut className="w-4.5 h-4.5" />
          <span className="font-semibold text-sm">Sign Out</span>
        </button>
      </section>

      <div className="text-center pt-4 pb-2">
        <p className="text-[11px] text-gray-400 font-medium">OCPP-CPMS Mobile v1.0.0</p>
        <p className="text-[10px] text-gray-300">Connected to GRID-OCPP-CPMS Network</p>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: ACCOUNT SETTINGS */}
      {/* ======================================================== */}
      <Dialog open={activeModal === "account"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <User className="w-5 h-5 text-blue-500" /> Account Settings
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update your profile details and security credentials.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAccount} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="acc-name" className="text-xs font-semibold">
                Full Name
              </Label>
              <Input
                id="acc-name"
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                placeholder="Enter your name"
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="acc-email" className="text-xs font-semibold">
                Email Address
              </Label>
              <Input
                id="acc-email"
                value={accountForm.email}
                disabled
                className="h-10 text-sm bg-gray-50 text-gray-500"
              />
              <p className="text-[10px] text-gray-400">Email is linked to your account identity</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="acc-phone" className="text-xs font-semibold">
                Phone Number
              </Label>
              <Input
                id="acc-phone"
                value={accountForm.phone}
                onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })}
                placeholder="+31 6 12345678"
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="acc-company" className="text-xs font-semibold">
                Company Name (Optional)
              </Label>
              <Input
                id="acc-company"
                value={accountForm.companyName}
                onChange={(e) => setAccountForm({ ...accountForm, companyName: e.target.value })}
                placeholder="Company Ltd."
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="acc-address" className="text-xs font-semibold">
                Billing Address (Optional)
              </Label>
              <Input
                id="acc-address"
                value={accountForm.address}
                onChange={(e) => setAccountForm({ ...accountForm, address: e.target.value })}
                placeholder="Street name, City"
                className="h-10 text-sm"
              />
            </div>

            <Button
              type="submit"
              disabled={isSavingAccount}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 font-semibold text-sm rounded-xl mt-2"
            >
              {isSavingAccount ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Profile Changes
            </Button>
          </form>

          {/* Change Password Collapsible Section */}
          <div className="pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="w-full flex items-center justify-between text-xs font-semibold text-gray-700 py-1.5 hover:text-blue-600 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-blue-500" /> Change Password
              </span>
              <span className="text-[11px] text-blue-600">
                {showPasswordSection ? "Hide" : "Expand"}
              </span>
            </button>

            {showPasswordSection && (
              <form onSubmit={handleSavePassword} className="space-y-3 pt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Current Password</Label>
                  <Input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                    }
                    className="h-9 text-sm"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">New Password</Label>
                  <Input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                    }
                    className="h-9 text-sm"
                    placeholder="Min. 6 characters"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Confirm New Password</Label>
                  <Input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                    }
                    className="h-9 text-sm"
                    placeholder="Repeat new password"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSavingPassword}
                  variant="outline"
                  className="w-full h-9 text-xs font-semibold rounded-xl"
                >
                  {isSavingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Update Password
                </Button>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* MODAL 2: NOTIFICATIONS */}
      {/* ======================================================== */}
      <Dialog open={activeModal === "notifications"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-500" /> Notifications
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure real-time push alerts and charging event notices.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 divide-y divide-gray-100">
            {/* Push Alerts */}
            <div className="space-y-3 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Charging Status Alerts
              </span>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-medium text-gray-800">Session Started</Label>
                  <p className="text-[11px] text-gray-400">
                    Notify when vehicle is connected and energy flows
                  </p>
                </div>
                <Switch
                  checked={notifications.chargingStarted}
                  onCheckedChange={() => handleToggleNotification("chargingStarted")}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-medium text-gray-800">Session Completed</Label>
                  <p className="text-[11px] text-gray-400">
                    Notify when target SoC is reached or session ends
                  </p>
                </div>
                <Switch
                  checked={notifications.chargingCompleted}
                  onCheckedChange={() => handleToggleNotification("chargingCompleted")}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-medium text-gray-800">Charger Interruption / Faults</Label>
                  <p className="text-[11px] text-gray-400">
                    Immediate alert if charging halts unexpectedly
                  </p>
                </div>
                <Switch
                  checked={notifications.faultAlerts}
                  onCheckedChange={() => handleToggleNotification("faultAlerts")}
                />
              </div>
            </div>

            {/* Email & Financial */}
            <div className="space-y-3 pt-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Billing & Tariff Alerts
              </span>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-medium text-gray-800">Email Invoices & Receipts</Label>
                  <p className="text-[11px] text-gray-400">
                    Receive PDF receipts after every ad-hoc or roaming session
                  </p>
                </div>
                <Switch
                  checked={notifications.emailReceipts}
                  onCheckedChange={() => handleToggleNotification("emailReceipts")}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-medium text-gray-800">EPEX Spot Price Drop Alerts</Label>
                  <p className="text-[11px] text-gray-400">
                    Notify during negative or ultra-low electricity spot rates
                  </p>
                </div>
                <Switch
                  checked={notifications.spotPriceAlerts}
                  onCheckedChange={() => handleToggleNotification("spotPriceAlerts")}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              onClick={() => setActiveModal(null)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm rounded-xl h-10"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* MODAL 3: PRIVACY & SECURITY */}
      {/* ======================================================== */}
      <Dialog open={activeModal === "security"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" /> Privacy & Security
            </DialogTitle>
            <DialogDescription className="text-xs">
              Manage two-factor authentication and account security.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 2FA Card */}
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-gray-900">Two-Factor Authentication</h4>
                    <p className="text-[10px] text-gray-500">Authenticator App (TOTP)</p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    twoFactorEnabled
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {twoFactorEnabled ? "Active" : "Disabled"}
                </span>
              </div>

              <p className="text-xs text-gray-600">
                Protect your account by requiring a 6-digit TOTP code from Google Authenticator or 1Password upon sign-in.
              </p>

              {twoFactorEnabled ? (
                <Button
                  onClick={handleDisable2FA}
                  disabled={is2FALoading}
                  variant="destructive"
                  size="sm"
                  className="w-full text-xs rounded-xl h-9 font-semibold"
                >
                  {is2FALoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Disable 2FA
                </Button>
              ) : (
                <Button
                  onClick={handleStart2FASetup}
                  disabled={is2FALoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl h-9 font-semibold"
                >
                  {is2FALoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Set Up Authenticator App
                </Button>
              )}
            </div>

            {/* 2FA Setup Flow */}
            {is2FASetupOpen && (
              <div className="border border-emerald-200 bg-emerald-50/40 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-emerald-600" /> Scan QR Code
                </h4>
                <p className="text-[11px] text-gray-600">
                  Open your Authenticator app (Google Authenticator, Authy, Apple Keychain) and scan this QR code:
                </p>

                {qrCodeUrl && (
                  <div className="flex justify-center p-2 bg-white rounded-xl border border-gray-200 w-fit mx-auto shadow-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCodeUrl} alt="2FA QR Code" className="w-40 h-40" />
                  </div>
                )}

                {setupSecret && (
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500">Manual Setup Key:</p>
                    <code className="text-xs font-mono font-bold bg-white px-2 py-1 rounded border border-gray-200 text-emerald-800 select-all block mt-0.5">
                      {setupSecret}
                    </code>
                  </div>
                )}

                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-semibold">Enter 6-Digit Code</Label>
                  <Input
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="h-10 text-center tracking-widest text-lg font-mono bg-white"
                    maxLength={6}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={() => setIs2FASetupOpen(false)}
                    variant="outline"
                    size="sm"
                    className="w-1/2 text-xs rounded-xl h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirm2FA}
                    disabled={is2FALoading || setupCode.length !== 6}
                    className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl h-9 font-semibold"
                  >
                    {is2FALoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    Verify & Activate
                  </Button>
                </div>
              </div>
            )}

            {/* Session Security Details */}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Security & Data Integrity
              </span>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl">
                  <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>OCPP 1.6/2.0.1 mTLS & TLS 1.3 encrypted WebSocket connection</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Automated audit ledger logging active on user identity</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* MODAL 4: HELP CENTER */}
      {/* ======================================================== */}
      <Dialog open={activeModal === "help"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-amber-500" /> Help Center & Support
            </DialogTitle>
            <DialogDescription className="text-xs">
              Frequently asked questions, driver guides, and operator assistance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 divide-y divide-gray-100">
            {/* Quick FAQ */}
            <div className="space-y-3 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Driver FAQ
              </span>

              <div className="bg-gray-50 p-3 rounded-xl space-y-1">
                <h5 className="font-bold text-xs text-gray-900">
                  How do I initiate a charging session?
                </h5>
                <p className="text-[11px] text-gray-600">
                  Plug your vehicle connector into the EVSE, scan the QR code on the charger or find it on the Map tab, and tap <strong>Start Charging</strong>.
                </p>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl space-y-1">
                <h5 className="font-bold text-xs text-gray-900">
                  Why won&apos;t the charging cable unlock?
                </h5>
                <p className="text-[11px] text-gray-600">
                  First ensure you have stopped the transaction in the app. If still locked, tap <strong>Remote Unlock</strong> on the Charger detail page or contact CPO hotline.
                </p>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl space-y-1">
                <h5 className="font-bold text-xs text-gray-900">
                  Where can I download monthly VAT invoices?
                </h5>
                <p className="text-[11px] text-gray-600">
                  Transaction receipts are emailed to your registered address. Full company invoices can also be viewed on the web dashboard under Invoices.
                </p>
              </div>
            </div>

              {/* Support Contacts */}
              <div className="space-y-3 pt-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Contact CPO Support
                </span>

                <a
                  href={`mailto:${emergencyContact?.email || "support@thechargegrid.com"}`}
                  className="flex items-center justify-between p-3 bg-blue-50/60 hover:bg-blue-50 border border-blue-100 rounded-xl text-blue-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-4 h-4" />
                    <div className="text-left">
                      <span className="text-xs font-bold block">Email Customer Support</span>
                      <span className="text-[10px] text-blue-600/80">{emergencyContact?.email || "support@thechargegrid.com"}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-blue-500" />
                </a>

                <a
                  href={`tel:${(emergencyContact?.phone || "+31 20 555 0199").replace(/[^0-9+]/g, '')}`}
                  className="flex items-center justify-between p-3 bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4" />
                    <div className="text-left">
                      <span className="text-xs font-bold block">24/7 Charging Emergency Hotline</span>
                      <span className="text-[10px] text-emerald-600/80">{emergencyContact?.phone || "+31 20 555 0199"}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-500" />
                </a>
              </div>
            </div>

          <DialogFooter className="pt-2">
            <Button
              onClick={() => setActiveModal(null)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm rounded-xl h-10"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
