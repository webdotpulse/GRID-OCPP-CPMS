"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Globe, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const chargerSchema = z.object({
  name: z.string().min(2, "Charger name is required"),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  serial_number: z.string().optional(),
  power_capacity: z.number().positive(),
  firmware_version: z.string().optional(),
  service_contacts: z.string(),
  charging_station_id: z.number().positive("Must assign a station"),
  isPublic: z.boolean().optional(),
  thirdPartyBackendUrl: z.union([z.string().url("Must be a valid URL"), z.literal("")]).optional().nullable(),
  isStraightThroughProxy: z.boolean().optional(),
  tariffId: z.number().optional(),
  productId: z.number().optional().nullable(),
  owner_id: z.number().optional(),
  chargeGroupId: z.number().optional().nullable(),
  quirkProfileId: z.number().optional().nullable(),
  isPredictiveBalancingEnabled: z.boolean().optional(),
  localSolarKwp: z.number().nonnegative().optional().nullable(),
});

type ChargerFormValues = z.infer<typeof chargerSchema>;

export function ChargerForm({ initialData }: { initialData?: any }) {
  const router = useRouter();
  const [stations, setStations] = useState<any[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [chargeGroups, setChargeGroups] = useState<any[]>([]);
  const [quirkProfiles, setQuirkProfiles] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const nameParam = searchParams.get('name');

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<ChargerFormValues>({
    resolver: zodResolver(chargerSchema),
    defaultValues: initialData ? {
      ...initialData,
      isPublic: initialData?.isPublic ?? false,
      thirdPartyBackendUrl: initialData?.thirdPartyBackendUrl || undefined,
      isStraightThroughProxy: initialData?.isStraightThroughProxy || false,
      tariffId: initialData?.tariffs?.[0]?.tariff_id || undefined,
      productId: initialData?.productId || undefined,
      chargeGroupId: initialData?.chargeGroupId || undefined,
      quirkProfileId: initialData?.quirkProfileId || undefined,
      isPredictiveBalancingEnabled: initialData?.isPredictiveBalancingEnabled || false,
      localSolarKwp: initialData?.localSolarKwp || undefined,
    } : {
      name: nameParam || '',
      isPublic: false,
      thirdPartyBackendUrl: undefined,
      isStraightThroughProxy: false,
      tariffId: undefined,
      productId: undefined,
      chargeGroupId: undefined,
      quirkProfileId: undefined,
      isPredictiveBalancingEnabled: false,
      localSolarKwp: undefined,
    },
  });

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const promises: Promise<any>[] = [
          api.get('/stations'),
          api.get('/tariffs'),
          api.get('/charge-groups'),
          api.get('/quirk-profiles'),
          api.get('/products?isActive=true'),
        ];

        if (user?.role === 'admin' || user?.role === 'superadmin') {
          promises.push(api.get('/users'));
        }

        const results = await Promise.all(promises);
        setStations(Array.isArray(results[0].data?.data) ? results[0].data.data : (Array.isArray(results[0].data) ? results[0].data : []));
        setTariffs(Array.isArray(results[1].data?.data) ? results[1].data.data : (Array.isArray(results[1].data) ? results[1].data : []));
        setChargeGroups(Array.isArray(results[2].data?.data) ? results[2].data.data : (Array.isArray(results[2].data) ? results[2].data : []));
        setQuirkProfiles(Array.isArray(results[3].data?.data) ? results[3].data.data : (Array.isArray(results[3].data) ? results[3].data : []));
        setProducts(Array.isArray(results[4].data?.data) ? results[4].data.data : (Array.isArray(results[4].data) ? results[4].data : []));

        if (results[5]) {
          setUsersList(Array.isArray(results[5].data?.data) ? results[5].data.data : (Array.isArray(results[5].data) ? results[5].data : []));
        }
      } catch (error) {
        logger.error("Failed to fetch initial data", error);
      }
    };
    if (user) fetchStations();
  }, [user]);

  const stationId = watch('charging_station_id');

  const onSubmit = async (data: ChargerFormValues) => {
    setIsLoading(true);
    try {
      const payload = {
        ...data,
        owner_id: data.owner_id || initialData?.owner_id || user?.id,
      };

      if (initialData) {
        await api.put(`/chargers/${initialData.charger_id}`, payload);
      } else {
        await api.post('/chargers', payload);
      }
      router.push('/chargers');
      router.refresh();
    } catch (error: any) {
      logger.error("Failed to save charger", error);
      alert(error.response?.data?.error || "Failed to save charger.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl shadow-sm">
      <CardHeader className="border-b pb-4">
        <CardTitle>{initialData ? 'Edit Charger' : 'Register New Charger'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Charger Identity (OCPP ID)</Label>
              <Input id="name" {...register('name')} placeholder="e.g. Front Parking Charger" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="charging_station_id">Assign to Station</Label>
              <Select 
                value={stationId ? stationId.toString() : ''} 
                onValueChange={(val) => {
                  const num = parseInt(val);
                  setValue('charging_station_id', isNaN(num) ? undefined as any : num);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a station" />
                </SelectTrigger>
                <SelectContent>
                  {stations.map(station => (
                    <SelectItem key={station.id || station.station_id} value={(station.id || station.station_id)?.toString() || ''}>
                      {station.station_name || station.name || `Station #${station.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.charging_station_id && <p className="text-sm text-destructive">{errors.charging_station_id.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input id="manufacturer" {...register('manufacturer')} />
              {errors.manufacturer && <p className="text-sm text-destructive">{errors.manufacturer.message}</p>}
            </div>
             <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input id="model" {...register('model')} />
              {errors.model && <p className="text-sm text-destructive">{errors.model.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serial_number">Serial Number</Label>
              <Input id="serial_number" {...register('serial_number')} />
              {errors.serial_number && <p className="text-sm text-destructive">{errors.serial_number.message}</p>}
            </div>
             <div className="space-y-2">
              <Label htmlFor="firmware_version">Firmware Version</Label>
              <Input id="firmware_version" {...register('firmware_version')} />
              {errors.firmware_version && <p className="text-sm text-destructive">{errors.firmware_version.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="power_capacity">Power Capacity (kW)</Label>
              <Input id="power_capacity" type="number" step="any" {...register('power_capacity', { valueAsNumber: true })} />
              {errors.power_capacity && <p className="text-sm text-destructive">{errors.power_capacity.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="thirdPartyBackendUrl">Third-Party Backend URL (Optional)</Label>
              <Input id="thirdPartyBackendUrl" {...register('thirdPartyBackendUrl')} placeholder="wss://example.com/ocpp" />
              <p className="text-[11px] text-muted-foreground">
                Proxy upstream endpoint. Quirk profiles with Card ID mappings will translate solar mode tags before forwarding.
              </p>
              {errors.thirdPartyBackendUrl && <p className="text-sm text-destructive">{errors.thirdPartyBackendUrl.message}</p>}
            </div>
          </div>

          {/* Charger Access Mode: Public vs Private */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-base font-semibold">Access & Visibility Mode</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div 
                onClick={() => setValue('isPublic', false)}
                className={`cursor-pointer rounded-xl border p-4 transition-all flex flex-col justify-between ${
                  !watch('isPublic') 
                    ? 'border-amber-500/60 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/30' 
                    : 'border-border/60 bg-muted/20 hover:border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center">
                      <Lock className="size-4" />
                    </div>
                    <span className="font-semibold text-sm">Private Charger</span>
                  </div>
                  {!watch('isPublic') && (
                    <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider bg-amber-500/15 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Restricted access. Only accepts own owned RFID cards and connected charge group members.
                </p>
              </div>

              <div 
                onClick={() => setValue('isPublic', true)}
                className={`cursor-pointer rounded-xl border p-4 transition-all flex flex-col justify-between ${
                  watch('isPublic') 
                    ? 'border-[#54a8c7]/60 bg-[#54a8c7]/10 shadow-xs ring-1 ring-[#54a8c7]/30' 
                    : 'border-border/60 bg-muted/20 hover:border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-[#54a8c7]/20 text-[#54a8c7] flex items-center justify-center">
                      <Globe className="size-4" />
                    </div>
                    <span className="font-semibold text-sm">Public Charger</span>
                  </div>
                  {watch('isPublic') && (
                    <span className="text-[11px] font-bold text-[#54a8c7] uppercase tracking-wider bg-[#54a8c7]/15 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Open network access. Accepts all roaming RFID cards and public charging drivers.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/10">
            <div className="space-y-0.5 pr-4">
              <Label className="text-sm font-medium">Straight-Through Authorization Mode</Label>
              <p className="text-[12px] text-muted-foreground">
                When active with a Third-Party Backend, user authorization rights (who can charge) are entirely managed by the third-party backend. Local load management, phase balancing, and smart telemetry continue to function locally.
              </p>
            </div>
            <Switch
              checked={watch('isStraightThroughProxy')}
              onCheckedChange={(checked) => setValue('isStraightThroughProxy', checked)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="chargeGroupId">Assign Charge group</Label>
              <Select
                value={watch('chargeGroupId')?.toString() || 'none'}
                onValueChange={(val) => setValue('chargeGroupId', val === 'none' ? null : parseInt(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a charge group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Charge group</SelectItem>
                  {chargeGroups.map(group => (
                    <SelectItem key={group.id} value={group.id ? group.id.toString() : ''}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quirkProfileId">Hardware Quirk Profile</Label>
              <Select
                value={watch('quirkProfileId')?.toString() || 'none'}
                onValueChange={(val) => setValue('quirkProfileId', val === 'none' ? null : parseInt(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a quirk profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Standard / No Quirks</SelectItem>
                  {quirkProfiles.map(profile => (
                    <SelectItem key={profile.id} value={profile.id ? profile.id.toString() : ''}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Handles brand-specific anomalies, solar mode card ID translation, and meter start overrides.
              </p>
            </div>

              <div className="space-y-2">
              <Label htmlFor="tariffId">Assigned Tariff Plan</Label>
              <Select 
                value={watch('tariffId')?.toString() || 'none'} 
                onValueChange={(val) => setValue('tariffId', val === 'none' ? undefined : parseInt(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a tariff plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Tariff Plan</SelectItem>
                  {tariffs.map(tariff => {
                    const tId = tariff.tariff_id || tariff.id;
                    const tName = tariff.tariff_name || tariff.name || `Tariff #${tId}`;
                    const energy = tariff.electricity_rate ?? tariff.energyFee ?? 0;
                    const conn = tariff.charge ?? tariff.connectionFee ?? 0;
                    return (
                      <SelectItem key={tId} value={tId ? tId.toString() : ''}>
                        {tName} (€{conn} + €{energy}/kWh)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="productId">Platform Subscription Product</Label>
              <Select 
                value={watch('productId')?.toString() || 'none'} 
                onValueChange={(val) => setValue('productId', val === 'none' ? null : parseInt(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a subscription product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Attached Product</SelectItem>
                  {products.map(prod => (
                    <SelectItem key={prod.id} value={prod.id.toString()}>
                      {prod.name} (€{prod.price.toFixed(2)} excl. VAT / {prod.paymentFrequency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Recurring software licensing and platform usage fee attached to this charger for monthly invoicing.
              </p>
            </div>

            {(user?.role === 'admin' || user?.role === 'superadmin') && (
              <div className="space-y-2">
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
                      <SelectItem key={u.id} value={u.id ? u.id.toString() : ''}>
                        {u.email} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Select the user who will manage this charger.</p>
              </div>
            )}


          <div className="grid grid-cols-1 gap-4 border-t pt-4">
            <h3 className="text-lg font-medium">Premium Features</h3>

            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Predictive Load Balancing</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically adjust charging speeds based on local solar forecasts and day-ahead EPEX prices. Requires location coordinates.
                </p>
              </div>
              <Switch
                checked={watch('isPredictiveBalancingEnabled')}
                onCheckedChange={(checked) => setValue('isPredictiveBalancingEnabled', checked)}
              />
            </div>

            {watch('isPredictiveBalancingEnabled') && (
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4 p-4 border rounded-lg bg-muted/20">
                <div className="space-y-2">
                  <Label htmlFor="localSolarKwp">Local Solar Capacity (kWp)</Label>
                  <Input id="localSolarKwp" type="number" step="any" {...register('localSolarKwp', { valueAsNumber: true })} placeholder="e.g. 10.5" />
                  {errors.localSolarKwp && <p className="text-sm text-destructive">{errors.localSolarKwp.message}</p>}
                </div>
              </div>
            )}
          </div>

            <div className="space-y-2">
              <Label htmlFor="service_contacts">Service Contacts</Label>
              <Input id="service_contacts" {...register('service_contacts')} />
              {errors.service_contacts && <p className="text-sm text-destructive">{errors.service_contacts.message}</p>}
            </div>
          </div>

          {Object.keys(errors).length > 0 && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
              <strong>Please fix the following errors:</strong>
              <ul className="list-disc list-inside mt-1">
                {Object.entries(errors).map(([key, error]: [string, any]) => (
                  <li key={key}>{key}: {error.message}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-between">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isLoading}>
             {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
             {initialData ? 'Update Charger' : 'Register Charger'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

