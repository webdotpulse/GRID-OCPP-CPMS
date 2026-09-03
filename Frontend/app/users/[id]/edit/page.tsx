"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Loader2, Shield, Building2, User } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";

export default function EditUserPage() {
  const router = useRouter();
  const { id } = useParams();
  const { user: currentUser } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [companies, setCompanies] = useState<{ id: number; name: string; clientNumber?: string }[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "user",
    userType: "private",
    companyName: "",
    companyId: "",
    address: "",
    phone: "",
    taxNumber: "",
    language: "en",
    emailVerified: false,
  });

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await api.get("/companies");
        const list = Array.isArray(res.data) ? res.data : (res.data?.companies || res.data?.data || []);
        setCompanies(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("Failed to fetch companies:", err);
      }
    };
    fetchCompanies();
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get(`/users/${id}`);
        const u = response.data?.data || response.data;
        if (u) {
          setFormData({
            name: u.name || "",
            email: u.email || "",
            role: u.role || "user",
            userType: u.userType || "private",
            companyName: u.companyName || "",
            companyId: u.companyId ? u.companyId.toString() : "",
            address: u.address || "",
            phone: u.phone || "",
            taxNumber: u.taxNumber || "",
            language: u.language || "en",
            emailVerified: u.emailVerified || false,
          });
        }
      } catch (error) {
        logger.error("Failed to fetch user", error);
        toast.error("Failed to load user details");
        router.push("/users");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchUser();
  }, [id, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      ...formData,
      companyId:
        formData.userType === "employee" || formData.userType === "company"
          ? formData.companyId
            ? parseInt(formData.companyId, 10)
            : null
          : null,
    };

    try {
      await api.put(`/users/${id}`, payload);
      toast.success("User account updated successfully");
      router.push("/users");
    } catch (error: any) {
      logger.error("Failed to update user", error);
      toast.error(error.response?.data?.error || "Failed to update user");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-3">
          <Link href="/users">
            <Button variant="ghost" size="icon-sm" className="rounded-xl">
              <ChevronLeft className="size-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
              Edit User Account
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Update user details, access permissions, and corporate client association.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="size-8 animate-spin text-[#54a8c7]" />
          </div>
        ) : (
          <Card className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <form onSubmit={handleSubmit}>
              <CardHeader className="border-b border-border/60 pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <User className="size-5 text-[#54a8c7]" /> Account Profile & Settings
                </CardTitle>
                <CardDescription className="text-xs">
                  Manage profile details, system roles, and multi-tenant assignment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-semibold">
                      Full Name
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleChange}
                      className="h-10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold">
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      className="h-10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="language" className="text-xs font-semibold">
                      Language
                    </Label>
                    <Select
                      value={formData.language}
                      onValueChange={(val) => handleSelectChange("language", val)}
                    >
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="nl">Nederlands (Dutch)</SelectItem>
                        <SelectItem value="fr">Français (French)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
                  <div className="space-y-1.5">
                    <Label htmlFor="role" className="text-xs font-semibold flex items-center gap-1.5">
                      <Shield className="size-3.5 text-purple-400" /> System Role
                    </Label>
                    <Select
                      value={formData.role}
                      onValueChange={(val) => handleSelectChange("role", val)}
                    >
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {currentUser?.role === "superadmin" && (
                          <SelectItem value="superadmin">Super Administrator (Global)</SelectItem>
                        )}
                        <SelectItem value="admin">Platform / CPO Admin</SelectItem>
                        <SelectItem value="operator">Operations & Technician</SelectItem>
                        <SelectItem value="client_admin">Corporate Client / Fleet Admin</SelectItem>
                        <SelectItem value="user">EV Driver / Standard User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="userType" className="text-xs font-semibold flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-[#3f78e0]" /> Account Classification
                    </Label>
                    <Select
                      value={formData.userType}
                      onValueChange={(val) => handleSelectChange("userType", val)}
                    >
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Private EV Driver</SelectItem>
                        <SelectItem value="employee">Corporate Fleet Employee</SelectItem>
                        <SelectItem value="company">Corporate Account Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(formData.userType === "employee" || formData.userType === "company") && (
                  <div className="space-y-1.5 p-3.5 bg-muted/40 rounded-xl border border-border/60">
                    <Label htmlFor="companyId" className="text-xs font-semibold text-foreground">
                      Map to Corporate Client
                    </Label>
                    <Select
                      value={formData.companyId}
                      onValueChange={(val) => handleSelectChange("companyId", val)}
                    >
                      <SelectTrigger className="h-10 rounded-xl bg-card">
                        <SelectValue placeholder="Select a corporate client..." />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.name} {c.clientNumber ? `(${c.clientNumber})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <Label htmlFor="address" className="text-xs font-semibold">
                    Address
                  </Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="h-10 rounded-xl"
                  />
                </div>

                {currentUser?.role === "superadmin" && (
                  <div className="p-3.5 bg-card rounded-xl border border-border/60 flex items-center justify-between">
                    <div>
                      <Label htmlFor="emailVerified" className="text-xs font-semibold text-foreground">
                        Email Verification Status
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Manually toggle verified status for this account.
                      </p>
                    </div>
                    <Switch
                      id="emailVerified"
                      checked={formData.emailVerified}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, emailVerified: checked }))
                      }
                    />
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t border-border/60 pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.push("/users")} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white font-semibold"
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
