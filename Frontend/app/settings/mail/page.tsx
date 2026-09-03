"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Mail, ArrowLeft, Server } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const mailConfigSchema = z.object({
  host: z.string().min(1, "SMTP host is required"),
  port: z.string().min(1, "Port is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  fromAddress: z.string().email("Invalid email address").min(1, "From address is required"),
  isActive: z.boolean(),
});

type MailConfigValues = z.infer<typeof mailConfigSchema>;

export default function MailSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<MailConfigValues>({
    resolver: zodResolver(mailConfigSchema),
    defaultValues: {
      host: "",
      port: "587",
      username: "",
      password: "",
      fromAddress: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "superadmin") {
      router.push("/settings");
      return;
    }

    const fetchConfig = async () => {
      try {
        const res = await api.get("/settings/mail");
        if (res.data !== undefined && res.data) {
          form.reset({
            ...res.data,
            port: String(res.data.port),
          });
        }
      } catch (error) {
        console.error("Failed to fetch mail config:", error);
        toast.error("Failed to load mail configuration");
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchConfig();
    }
  }, [user, router, form]);

  const onSubmit = async (data: z.infer<typeof mailConfigSchema>) => {
    setIsSaving(true);
    try {
      const payload = {
        ...data,
        port: parseInt(data.port, 10),
      };

      const res = await api.put("/settings/mail", payload);

      if (res.data !== undefined) {
        toast.success("Mail configuration saved successfully");
      } else {
        toast.error("Failed to save mail configuration");
      }
    } catch (error) {
      console.error("Error saving mail config:", error);
      toast.error("An error occurred while saving configuration");
    } finally {
      setIsSaving(false);
    }
  };

  if (!user || isLoading) {
    return (
      <AppShell>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mail Settings</h1>
            <p className="text-muted-foreground">
              Configure SMTP server details for outgoing system emails.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              SMTP Server Details
            </CardTitle>
            <CardDescription>
              Provide the SMTP host, port, and authentication credentials.
            </CardDescription>
          </CardHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="host">SMTP Host</Label>
                  <Input
                    id="host"
                    placeholder="e.g. smtp.gmail.com"
                    {...form.register("host")}
                  />
                  {form.formState.errors.host && (
                    <p className="text-sm text-destructive">{form.formState.errors.host.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    placeholder="e.g. 587 or 465"
                    {...form.register("port")}
                  />
                  {form.formState.errors.port && (
                    <p className="text-sm text-destructive">{form.formState.errors.port.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="e.g. no-reply@example.com"
                    {...form.register("username")}
                  />
                  {form.formState.errors.username && (
                    <p className="text-sm text-destructive">{form.formState.errors.username.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    {...form.register("password")}
                  />
                  {form.formState.errors.password && (
                    <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="fromAddress" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" /> From Address
                </Label>
                <Input
                  id="fromAddress"
                  placeholder="e.g. PulseCharge <no-reply@pulsecharge.com>"
                  {...form.register("fromAddress")}
                />
                {form.formState.errors.fromAddress && (
                  <p className="text-sm text-destructive">{form.formState.errors.fromAddress.message}</p>
                )}
              </div>

              <div className="flex items-center space-x-2 pt-4">
                <Switch
                  id="isActive"
                  checked={form.watch("isActive")}
                  onCheckedChange={(checked) => form.setValue("isActive", checked)}
                />
                <Label htmlFor="isActive" className="cursor-pointer">Enable Mail Service</Label>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
