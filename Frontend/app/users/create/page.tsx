"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ChevronLeft, UserPlus, Shield, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function CreateUserPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [userType, setUserType] = useState("private");
  const [companyId, setCompanyId] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [language, setLanguage] = useState("en");
  const [companies, setCompanies] = useState<{ id: number; name: string; clientNumber?: string }[]>([]);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await api.get("/companies");
        setCompanies(response.data?.data || response.data || []);
      } catch (error) {
        console.error("Failed to fetch companies:", error);
      }
    };
    fetchCompanies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Email and password are required");

    setIsLoading(true);
    try {
      await api.post("/users", {
        name,
        email,
        password,
        role,
        userType,
        companyId: userType === "employee" || userType === "company" ? (companyId ? parseInt(companyId, 10) : null) : null,
        phone,
        address,
        language,
      });
      toast.success("User account created successfully");
      router.push("/users");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to create user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/users">
            <Button variant="ghost" size="icon-sm" className="rounded-xl">
              <ChevronLeft className="size-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
              Create New User
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Register a new platform user, corporate fleet driver, or system operator.
            </p>
          </div>
        </div>

        <Card className="rounded-2xl border border-border/70 bg-card shadow-sm">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <UserPlus className="size-5 text-[#54a8c7]" /> Account Profile & Credentials
            </CardTitle>
            <CardDescription className="text-xs">
              Fill in credentials, assign system access tier, and map corporate client organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Full Name</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Alexander de Jong"
                    value={name}
                    onChange={(e: any) => setName(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Email Address *</Label>
                  <Input
                    type="email"
                    placeholder="alexander@example.com"
                    value={email}
                    onChange={(e: any) => setEmail(e.target.value)}
                    required
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Password *</Label>
                  <Input
                    type="password"
                    placeholder="Enter initial password..."
                    value={password}
                    onChange={(e: any) => setPassword(e.target.value)}
                    required
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Preferred Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
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
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Shield className="size-3.5 text-purple-400" /> System Role
                  </Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue />
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
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-[#3f78e0]" /> Account Classification
                  </Label>
                  <Select value={userType} onValueChange={setUserType}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private EV Driver</SelectItem>
                      <SelectItem value="employee">Corporate Fleet Employee</SelectItem>
                      <SelectItem value="company">Corporate Account Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(userType === "employee" || userType === "company") && (
                <div className="space-y-1.5 p-3.5 bg-muted/40 rounded-xl border border-border/60">
                  <Label className="text-xs font-semibold text-foreground">Map to Corporate Client</Label>
                  <Select value={companyId} onValueChange={setCompanyId}>
                    <SelectTrigger className="h-10 rounded-xl bg-card">
                      <SelectValue placeholder="Select a corporate client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name} {company.clientNumber ? `(${company.clientNumber})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Associating this user will automatically group their charging sessions under the client's fleet
                    ledger and invoicing profile.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Phone Number</Label>
                  <Input
                    type="tel"
                    placeholder="+31 6 12345678"
                    value={phone}
                    onChange={(e: any) => setPhone(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Address</Label>
                  <Input
                    placeholder="Street, City, Postal Code"
                    value={address}
                    onChange={(e: any) => setAddress(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                <Button variant="outline" type="button" onClick={() => router.back()} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="rounded-xl bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white font-semibold shadow-md shadow-[#54a8c7]/20"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
