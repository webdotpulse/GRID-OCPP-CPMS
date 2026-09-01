"use client";
import { logger } from "@/lib/logger";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Globe, Building2 } from "lucide-react";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

const rfidSchema = z.object({
  rfid_tag: z.string().min(4, "RFID Tag ID is required"),
  external_id: z.string().optional(),
  name: z.string().min(2, "Holder name is required"),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  company_name: z.string().optional(),
  address: z.string().optional(),
  type: z.string().min(1),
  cardScope: z.string().optional(),
  active: z.boolean(),
  owner_id: z.number().optional(),
});

type RfidFormValues = z.infer<typeof rfidSchema>;

export function RfidForm({ initialData }: { initialData?: any }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const { user } = useAuth();

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<RfidFormValues>({
    resolver: zodResolver(rfidSchema),
    defaultValues: initialData ? {
      ...initialData,
      cardScope: initialData?.cardScope || "Roaming",
      email: initialData?.email || "",
    } : {
      type: "postpaid",
      cardScope: "Roaming",
      active: true,
      email: "",
    },
  });

  const active = watch('active');
  const type = watch('type');

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      api.get('/users').then(res => {
        const list = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
        setUsersList(list);
      }).catch(err => logger.error(err));
    }
  }, [user]);

  const onSubmit = async (data: RfidFormValues) => {
    setIsLoading(true);
    try {
      const payload = {
        ...data,
        owner_id: data.owner_id || initialData?.owner_id || user?.id,
      };
      if (initialData) {
        await api.put(`/rfid/${initialData.rfid_user_id}`, payload);
      } else {
        await api.post('/rfid', payload);
      }
      router.push('/rfid');
      router.refresh();
    } catch (error: any) {
      logger.error("Failed to save RFID tag", error);
      alert(error.response?.data?.error || "Failed to save RFID tag.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl shadow-sm">
      <CardHeader className="border-b pb-4">
        <CardTitle>{initialData ? 'Edit RFID Tag' : 'Register RFID Tag'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rfid_tag">RFID Tag Hex/ID</Label>
              <Input id="rfid_tag" {...register('rfid_tag')} placeholder="e.g. 1A2B3C4D" disabled={!!initialData} />
              {errors.rfid_tag && <p className="text-sm text-destructive">{errors.rfid_tag.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="external_id">External ID (Optional)</Label>
              <Input id="external_id" {...register('external_id')} placeholder="e.g. Ext-001" />
              {errors.external_id && <p className="text-sm text-destructive">{errors.external_id.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
             <div className="space-y-2">
              <Label htmlFor="name">Holder Full Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address (Optional)</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
             <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <Input id="phone" {...register('phone')} />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name (Optional)</Label>
              <Input id="company_name" {...register('company_name')} />
              {errors.company_name && <p className="text-sm text-destructive">{errors.company_name.message}</p>}
            </div>
             <div className="space-y-2">
              <Label htmlFor="address">Address (Optional)</Label>
              <Input id="address" {...register('address')} />
              {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
            </div>
          </div>

          {/* Card Scope Selection: Roaming vs Local */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-base font-semibold">Card Authorization Scope</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div 
                onClick={() => setValue('cardScope', 'Roaming')}
                className={`cursor-pointer rounded-xl border p-4 transition-all flex flex-col justify-between ${
                  watch('cardScope') !== 'Local' 
                    ? 'border-[#54a8c7]/60 bg-[#54a8c7]/10 shadow-xs ring-1 ring-[#54a8c7]/30' 
                    : 'border-border/60 bg-muted/20 hover:border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-[#54a8c7]/20 text-[#54a8c7] flex items-center justify-center">
                      <Globe className="size-4" />
                    </div>
                    <span className="font-semibold text-sm">Roaming Card</span>
                  </div>
                  {watch('cardScope') !== 'Local' && (
                    <span className="text-[11px] font-bold text-[#54a8c7] uppercase tracking-wider bg-[#54a8c7]/15 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Network-wide access. Can be used on all public chargers across the network and connected charge groups.
                </p>
              </div>

              <div 
                onClick={() => setValue('cardScope', 'Local')}
                className={`cursor-pointer rounded-xl border p-4 transition-all flex flex-col justify-between ${
                  watch('cardScope') === 'Local' 
                    ? 'border-purple-500/60 bg-purple-500/10 shadow-xs ring-1 ring-purple-500/30' 
                    : 'border-border/60 bg-muted/20 hover:border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-purple-500/20 text-purple-500 flex items-center justify-center">
                      <Building2 className="size-4" />
                    </div>
                    <span className="font-semibold text-sm">Local Card</span>
                  </div>
                  {watch('cardScope') === 'Local' && (
                    <span className="text-[11px] font-bold text-purple-500 uppercase tracking-wider bg-purple-500/15 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Restricted access. Only valid on connected charge groups and own chargers (cannot roam on external public stations).
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="type">Account Type</Label>
              <Select value={type} onValueChange={(val) => setValue('type', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="postpaid">Postpaid</SelectItem>
                  <SelectItem value="prepaid">Prepaid</SelectItem>
                  <SelectItem value="free">Free / Admin</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
            </div>
             <div className="flex flex-col justify-center space-y-2">
              <Label htmlFor="active">Authorization Status</Label>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="active" 
                  checked={active} 
                  onCheckedChange={(val) => setValue('active', val)} 
                />
                <Label htmlFor="active">{active ? 'Authorized (Active)' : 'Unauthorized'}</Label>
              </div>
            </div>

            {(user?.role === 'admin' || user?.role === 'superadmin') && (
              <div className="space-y-2 mt-4">
                <Label htmlFor="owner_id">Assign to Client</Label>
                <Select
                  value={watch('owner_id')?.toString() || initialData?.owner_id?.toString() || user.id.toString()}
                  onValueChange={(val) => setValue('owner_id', parseInt(val))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client user" />
                  </SelectTrigger>
                  <SelectContent>
                    {usersList.map(u => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.email} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Select the user who will manage this RFID.</p>
              </div>
            )}
          </div>

        </CardContent>
        <CardFooter className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-between">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isLoading}>
             {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
             {initialData ? 'Update Tag' : 'Register Tag'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

