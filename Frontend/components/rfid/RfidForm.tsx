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
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { EntitySelectInput, EntityUser, EntityCompany } from "@/components/ui/EntitySelectInput";

const rfidSchema = z.object({
  rfid_tag: z.string().min(4, "RFID Tag ID is required"),
  external_id: z.string().optional(),
  name: z.string().optional(),
  type: z.string().min(1),
  cardScope: z.string().optional(),
  active: z.boolean(),
  owner_id: z.number().optional(),
  ownerType: z.string().optional(),
  ownerCompanyId: z.number().optional().nullable(),
  holderType: z.string().optional().nullable(),
  holderUserId: z.number().optional().nullable(),
  holderCompanyId: z.number().optional().nullable(),
  transactionPayerType: z.string().optional().nullable(),
  transactionPayerUserId: z.number().optional().nullable(),
  transactionPayerCompanyId: z.number().optional().nullable(),
});

type RfidFormValues = z.infer<typeof rfidSchema>;

export function RfidForm({ initialData }: { initialData?: any }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [usersList, setUsersList] = useState<EntityUser[]>([]);
  const [companiesList, setCompaniesList] = useState<EntityCompany[]>([]);
  const { user } = useAuth();

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<RfidFormValues>({
    resolver: zodResolver(rfidSchema),
    defaultValues: initialData ? {
      ...initialData,
      cardScope: initialData?.cardScope || "Roaming",
      name: initialData?.name || "",
      owner_id: initialData?.owner_id,
      ownerType: initialData?.ownerType || (initialData?.ownerCompanyId ? "company" : "user"),
      ownerCompanyId: initialData?.ownerCompanyId ?? null,
      holderType: initialData?.holderType || (initialData?.holderCompanyId ? "company" : "user"),
      holderUserId: initialData?.holderUserId ?? null,
      holderCompanyId: initialData?.holderCompanyId ?? null,
      transactionPayerType: initialData?.transactionPayerType || (initialData?.transactionPayerCompanyId ? "company" : "user"),
      transactionPayerUserId: initialData?.transactionPayerUserId ?? null,
      transactionPayerCompanyId: initialData?.transactionPayerCompanyId ?? null,
    } : {
      name: "",
      type: "postpaid",
      cardScope: "Roaming",
      active: true,
      owner_id: user?.id,
      ownerType: "user",
      ownerCompanyId: null,
      holderType: "user",
      holderUserId: user?.id,
      holderCompanyId: null,
      transactionPayerType: "user",
      transactionPayerUserId: null,
      transactionPayerCompanyId: null,
    },
  });

  const active = watch('active');
  const type = watch('type');

  useEffect(() => {
    api.get('/companies').then(res => {
      const list = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      setCompaniesList(list);
    }).catch(err => logger.error(err));

    if (user?.role === 'admin' || user?.role === 'superadmin') {
      api.get('/users').then(res => {
        const list = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
        setUsersList(list);
      }).catch(err => logger.error(err));
    } else if (user) {
      setUsersList([{ id: user.id, email: user.email, name: user.name || user.email, role: user.role }]);
    }
  }, [user]);

  const onSubmit = async (data: RfidFormValues) => {
    setIsLoading(true);
    try {
      const selectedHolderType = watch("holderType") || initialData?.holderType || "user";
      const selectedHolderUserId = watch("holderUserId") ?? initialData?.holderUserId ?? null;
      const selectedHolderCompanyId = watch("holderCompanyId") ?? initialData?.holderCompanyId ?? null;

      let derivedName = data.name;
      if (!derivedName || derivedName.trim() === "") {
        if (selectedHolderType === "company" && selectedHolderCompanyId) {
          const c = companiesList.find(x => x.id === selectedHolderCompanyId);
          if (c) derivedName = c.name;
        } else if (selectedHolderUserId) {
          const u = usersList.find(x => x.id === selectedHolderUserId);
          if (u) derivedName = u.name || u.email;
        }
      }

      const payload = {
        rfid_tag: data.rfid_tag,
        external_id: data.external_id || undefined,
        name: derivedName || "Unassigned",
        type: data.type,
        cardScope: data.cardScope,
        active: data.active,
        owner_id: data.owner_id || initialData?.owner_id || user?.id,
        ownerType: watch("ownerType") || initialData?.ownerType || "user",
        ownerCompanyId: watch("ownerCompanyId") ?? initialData?.ownerCompanyId ?? null,
        holderType: selectedHolderType,
        holderUserId: selectedHolderUserId,
        holderCompanyId: selectedHolderCompanyId,
        transactionPayerType: watch("transactionPayerType") ?? initialData?.transactionPayerType ?? null,
        transactionPayerUserId: watch("transactionPayerUserId") ?? initialData?.transactionPayerUserId ?? null,
        transactionPayerCompanyId: watch("transactionPayerCompanyId") ?? initialData?.transactionPayerCompanyId ?? null,
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

          {/* Connected Entities Section */}
          <div className="space-y-4 border-t pt-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Connected Entities</h3>
              <p className="text-xs text-muted-foreground">
                Designate the cardholder, asset owner, and charging transaction settlement payer (individuals or companies).
              </p>
            </div>

            <div className="space-y-3">
              {/* 1. The Holder */}
              <EntitySelectInput
                id="rfid_holder_entity"
                label="The Holder"
                description="The individual driver or company authorized to use this RFID credential."
                entityType={(watch("holderType") as "user" | "company") || "user"}
                onEntityTypeChange={(type) => setValue("holderType", type)}
                selectedUserId={watch("holderUserId") ?? initialData?.holderUserId}
                onUserChange={(userId) => {
                  setValue("holderUserId", userId);
                  if (userId) {
                    const u = usersList.find(x => x.id === userId);
                    if (u) {
                      setValue('name', u.name || u.email);
                    }
                  } else {
                    setValue('name', '');
                  }
                }}
                selectedCompanyId={watch("holderCompanyId") ?? initialData?.holderCompanyId}
                onCompanyChange={(companyId) => {
                  setValue("holderCompanyId", companyId);
                  if (companyId) {
                    const c = companiesList.find(x => x.id === companyId);
                    if (c) {
                      setValue('name', c.name);
                    }
                  } else {
                    setValue('name', '');
                  }
                }}
                usersList={usersList}
                companiesList={companiesList}
                allowUnassigned={true}
                unassignedLabel="Unassigned (No driver or company assigned)"
              />

              {/* 2. The Owner */}
              <EntitySelectInput
                id="rfid_owner_entity"
                label="The Owner"
                description="The legal owner and manager of this RFID card asset (can also be a company)."
                entityType={(watch("ownerType") as "user" | "company") || "user"}
                onEntityTypeChange={(type) => {
                  setValue("ownerType", type);
                  if (type === "user" && !watch("owner_id")) {
                    setValue("owner_id", user?.id);
                  }
                }}
                selectedUserId={watch("owner_id") ?? initialData?.owner_id ?? user?.id}
                onUserChange={(userId) => setValue("owner_id", userId || user?.id || 1)}
                selectedCompanyId={watch("ownerCompanyId") ?? initialData?.ownerCompanyId}
                onCompanyChange={(companyId) => setValue("ownerCompanyId", companyId)}
                usersList={usersList}
                companiesList={companiesList}
              />

              {/* 3. The Payer of the Transactions */}
              <EntitySelectInput
                id="rfid_transaction_payer_entity"
                label="The Payer of the Transactions"
                description="The party invoiced for charging sessions started with this card (can also be a company)."
                entityType={(watch("transactionPayerType") as "user" | "company") || "user"}
                onEntityTypeChange={(type) => setValue("transactionPayerType", type)}
                selectedUserId={watch("transactionPayerUserId") ?? initialData?.transactionPayerUserId}
                onUserChange={(userId) => setValue("transactionPayerUserId", userId)}
                selectedCompanyId={watch("transactionPayerCompanyId") ?? initialData?.transactionPayerCompanyId}
                onCompanyChange={(companyId) => setValue("transactionPayerCompanyId", companyId)}
                usersList={usersList}
                companiesList={companiesList}
                allowUnassigned={true}
                unassignedLabel="Not assigned (Inherit owner)"
              />
            </div>
          </div>
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

