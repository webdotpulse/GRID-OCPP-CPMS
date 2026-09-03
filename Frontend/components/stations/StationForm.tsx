"use client";
import { logger } from "@/lib/logger";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, MapPin, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect } from "react";
import { toast } from "sonner";

const stationSchema = z.object({
  station_name: z.string().min(2, "Station name is required"),
  street_name: z.string().min(2, "Street name is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().optional(),
  postal_code: z.string().min(2, "Postal code is required"),
  country: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  on_site_person_name: z.string().optional(),
  on_site_contact_details: z.string().optional(),
  emergency_contact: z.string().optional(),
  isGroundPlanEnabled: z.boolean().optional(),
  maxPower: z.number().min(0).optional().nullable(),
  maxAmperage: z.number().min(0).optional().nullable(),
  maxPhaseCurrent: z.number().min(0).optional().nullable(),
  maxPhaseUnbalance: z.number().min(0).optional().nullable(),
  owner_id: z.number().optional(),
  companyId: z.number().optional().nullable(),
});

type StationFormValues = z.infer<typeof stationSchema>;

interface StationFormProps {
  initialData?: StationFormValues & {
    id: number;
    owner_id?: number;
    companyId?: number | null;
    maxAmperage?: number | null;
    maxPhaseCurrent?: number | null;
    maxPhaseUnbalance?: number | null;
  };
}

export function StationForm({ initialData }: StationFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryCompanyId = searchParams?.get('companyId') ? parseInt(searchParams.get('companyId')!, 10) : undefined;

  const [isLoading, setIsLoading] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [companiesList, setCompaniesList] = useState<any[]>([]);
  const [autoSyncAmps, setAutoSyncAmps] = useState(false);
  const { user } = useAuth();

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<StationFormValues>({
    resolver: zodResolver(stationSchema),
    defaultValues: initialData || {
      latitude: 0,
      longitude: 0,
      companyId: queryCompanyId,
      maxPhaseCurrent: 80,
      maxPhaseUnbalance: 16,
    },
  });

  const calculate3PhaseAmps = (kw: number) => {
    if (!kw || kw <= 0) return 0;
    return Math.round(((kw * 1000) / (3 * 230)) * 10) / 10;
  };

  const handleMaxPowerChange = (val: string) => {
    const num = val === "" ? null : parseFloat(val);
    setValue('maxPower', num, { shouldValidate: true });
    if (autoSyncAmps && num && num > 0) {
      const amps = calculate3PhaseAmps(num);
      setValue('maxAmperage', amps, { shouldValidate: true });
      setValue('maxPhaseCurrent', amps, { shouldValidate: true });
      if (!watch('maxPhaseUnbalance')) {
        setValue('maxPhaseUnbalance', 16, { shouldValidate: true });
      }
    }
  };

  const applyAutoCalculatedAmps = () => {
    const p = watch('maxPower');
    if (p && p > 0) {
      const amps = calculate3PhaseAmps(p);
      setValue('maxAmperage', amps, { shouldValidate: true });
      setValue('maxPhaseCurrent', amps, { shouldValidate: true });
      setValue('maxPhaseUnbalance', 16, { shouldValidate: true });
      setAutoSyncAmps(true);
      toast.success(`Calculated 3-phase current: ${amps} A per phase (230V/400V)`);
    } else {
      toast.error('Please enter a valid power capacity in kW first');
    }
  };

  const europeanCountries = [
    { code: "AT", name: "Austria" },
    { code: "BE", name: "Belgium" },
    { code: "BG", name: "Bulgaria" },
    { code: "HR", name: "Croatia" },
    { code: "CY", name: "Cyprus" },
    { code: "CZ", name: "Czech Republic" },
    { code: "DK", name: "Denmark" },
    { code: "EE", name: "Estonia" },
    { code: "FI", name: "Finland" },
    { code: "FR", name: "France" },
    { code: "DE", name: "Germany" },
    { code: "GR", name: "Greece" },
    { code: "HU", name: "Hungary" },
    { code: "IE", name: "Ireland" },
    { code: "IT", name: "Italy" },
    { code: "LV", name: "Latvia" },
    { code: "LT", name: "Lithuania" },
    { code: "LU", name: "Luxembourg" },
    { code: "MT", name: "Malta" },
    { code: "NL", name: "Netherlands" },
    { code: "PL", name: "Poland" },
    { code: "PT", name: "Portugal" },
    { code: "RO", name: "Romania" },
    { code: "SK", name: "Slovakia" },
    { code: "SI", name: "Slovenia" },
    { code: "ES", name: "Spain" },
    { code: "SE", name: "Sweden" },
    { code: "CH", name: "Switzerland" },
    { code: "GB", name: "United Kingdom" }
  ];

  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      api.get('/users').then(res => {
        const list = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
        setUsersList(list);
      }).catch(err => logger.error(err));

      api.get('/companies').then(res => {
        const list = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
        setCompaniesList(list);
      }).catch(err => logger.error(err));
    }
  }, [user]);

  const handleGeocode = async () => {
    const street = watch('street_name');
    const city = watch('city');
    const state = watch('state');
    const postalCode = watch('postal_code');
    const country = watch('country');

    const addressParts = [street, city, state, postalCode, country].filter(Boolean);
    const addressString = addressParts.join(', ');

    if (!addressString) {
      toast.error('Please enter an address first');
      return;
    }

    setIsGeocoding(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressString)}`);
      const data = await response.json();

      if (data && data.length > 0) {
        setValue('latitude', parseFloat(data[0].lat), { shouldValidate: true });
        setValue('longitude', parseFloat(data[0].lon), { shouldValidate: true });
        toast.success('Coordinates found and applied');
      } else {
        toast.error('Coordinates not found for this address');
      }
    } catch (error) {
      logger.error('Geocoding failed', error);
      toast.error('Geocoding service unavailable');
    } finally {
      setIsGeocoding(false);
    }
  };

  const onSubmit = async (data: StationFormValues) => {
    setIsLoading(true);
    try {
      const payload = {
        ...data,
        owner_id: data.owner_id || initialData?.owner_id || user?.id,
        companyId: data.companyId !== undefined ? data.companyId : (initialData?.companyId ?? null),
      };
      if (initialData) {
        await api.put(`/stations/${initialData.id}`, payload);
      } else {
        await api.post('/stations', payload);
      }
      router.push('/stations');
      router.refresh();
    } catch (error) {
      logger.error("Failed to save station", error);
      alert("Failed to save station. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl shadow-sm">
      <CardHeader className="border-b pb-4">
        <CardTitle>{initialData ? 'Edit Location' : 'Create New Location'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="station_name">Location Name</Label>
            <Input id="station_name" {...register('station_name')} />
            {errors.station_name && <p className="text-sm text-destructive">{errors.station_name.message}</p>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="street_name">Street Address</Label>
              <Input id="street_name" {...register('street_name')} />
              {errors.street_name && <p className="text-sm text-destructive">{errors.street_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register('city')} />
              {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="state">State/Province</Label>
              <Input id="state" {...register('state')} />
              {errors.state && <p className="text-sm text-destructive">{errors.state.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal_code">Postal Code</Label>
              <Input id="postal_code" {...register('postal_code')} />
              {errors.postal_code && <p className="text-sm text-destructive">{errors.postal_code.message}</p>}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Select
              value={watch('country')}
              onValueChange={(val) => setValue('country', val, { shouldValidate: true })}
            >
              <SelectTrigger id="country">
                <SelectValue placeholder="Select a country" />
              </SelectTrigger>
              <SelectContent>
                {europeanCountries.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.country && <p className="text-sm text-destructive">{errors.country.message}</p>}
          </div>

          <div className="flex flex-col gap-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Coordinates</Label>
              <Button type="button" variant="secondary" size="sm" onClick={handleGeocode} disabled={isGeocoding}>
                {isGeocoding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                Auto-calculate from Address
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude" className="text-xs text-muted-foreground">Latitude</Label>
                 <Input id="latitude" type="number" step="any" {...register('latitude', { valueAsNumber: true })} />
                {errors.latitude && <p className="text-sm text-destructive">{errors.latitude.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude" className="text-xs text-muted-foreground">Longitude</Label>
                 <Input id="longitude" type="number" step="any" {...register('longitude', { valueAsNumber: true })} />
                {errors.longitude && <p className="text-sm text-destructive">{errors.longitude.message}</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="on_site_person_name">Site Manager Name</Label>
              <Input id="on_site_person_name" {...register('on_site_person_name')} />
              {errors.on_site_person_name && <p className="text-sm text-destructive">{errors.on_site_person_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="on_site_contact_details">Site Manager Phone</Label>
              <Input id="on_site_contact_details" {...register('on_site_contact_details')} />
              {errors.on_site_contact_details && <p className="text-sm text-destructive">{errors.on_site_contact_details.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergency_contact">Emergency Contact Info</Label>
            <Input id="emergency_contact" {...register('emergency_contact')} />
            {errors.emergency_contact && <p className="text-sm text-destructive">{errors.emergency_contact.message}</p>}
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="maxPower">Maximum Site Power Capacity (kW)</Label>
                {watch('maxPower') && Number(watch('maxPower')) > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={applyAutoCalculatedAmps}
                    className="h-7 text-xs text-[#54a8c7] hover:text-[#54a8c7] hover:bg-[#54a8c7]/10"
                  >
                    ⚡ Auto-calc Amps (3-Phase)
                  </Button>
                )}
              </div>
              <Input
                id="maxPower"
                type="number"
                step="any"
                value={watch('maxPower') ?? ""}
                onChange={(e) => handleMaxPowerChange(e.target.value)}
                placeholder="e.g. 50"
              />
              {errors.maxPower && <p className="text-sm text-destructive">{errors.maxPower.message}</p>}
              <p className="text-xs text-muted-foreground">Used for Smart Charging Load Management to dynamically throttle chargers if site load approaches this limit.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="maxAmperage" className="text-xs">Max Current (A)</Label>
                <Input
                  id="maxAmperage"
                  type="number"
                  step="any"
                  value={watch('maxAmperage') ?? ""}
                  onChange={(e) => {
                    setAutoSyncAmps(false);
                    setValue('maxAmperage', e.target.value === "" ? null : parseFloat(e.target.value), { shouldValidate: true });
                  }}
                  placeholder="e.g. 72"
                />
                <p className="text-[10px] text-muted-foreground">Total site draw limit</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxPhaseCurrent" className="text-xs">Per-Phase Limit (A)</Label>
                <Input
                  id="maxPhaseCurrent"
                  type="number"
                  step="any"
                  value={watch('maxPhaseCurrent') ?? ""}
                  onChange={(e) => {
                    setAutoSyncAmps(false);
                    setValue('maxPhaseCurrent', e.target.value === "" ? null : parseFloat(e.target.value), { shouldValidate: true });
                  }}
                  placeholder="e.g. 72"
                />
                <p className="text-[10px] text-muted-foreground">L1/L2/L3 upper fuse</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxPhaseUnbalance" className="text-xs">Max Unbalance (A)</Label>
                <Input
                  id="maxPhaseUnbalance"
                  type="number"
                  step="any"
                  value={watch('maxPhaseUnbalance') ?? ""}
                  onChange={(e) => {
                    setValue('maxPhaseUnbalance', e.target.value === "" ? null : parseFloat(e.target.value), { shouldValidate: true });
                  }}
                  placeholder="e.g. 16"
                />
                <p className="text-[10px] text-muted-foreground">Neutral safety (±16A)</p>
              </div>
            </div>
          </div>

          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="companyId" className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Building2 className="size-4 text-[#3f78e0]" /> Corporate Client (Company)
                </Label>
                <Select
                  value={watch('companyId')?.toString() || 'none'}
                  onValueChange={(val) => setValue('companyId', val === 'none' ? null : parseInt(val, 10))}
                >
                  <SelectTrigger id="companyId">
                    <SelectValue placeholder="Select Corporate Account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Corporate Account (Private / Standalone)</SelectItem>
                    {companiesList.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name} {c.clientNumber ? `(${c.clientNumber})` : ''} {c.city ? `— ${c.city}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Links this location & its EVSEs directly to the corporate account's fleet ledger.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner_id">Assign Station Manager / User</Label>
                <Select
                  value={watch('owner_id')?.toString() || initialData?.owner_id?.toString() || user.id.toString()}
                  onValueChange={(val) => setValue('owner_id', parseInt(val))}
                >
                  <SelectTrigger id="owner_id">
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {usersList.map(u => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.name ? `${u.name} (${u.email})` : u.email} — {u.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Primary contact user with station management rights.</p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-between">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? 'Update Location' : 'Create Location'}
          </Button>
        </CardFooter>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 dark:bg-slate-900 mt-6">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Ground Plan</Label>
                  <p className="text-sm text-muted-foreground">
                    Activate the interactive 2D parking spot layout for this location.
                  </p>
                </div>
                <Switch
                  checked={watch('isGroundPlanEnabled')}
                  onCheckedChange={(checked) => setValue('isGroundPlanEnabled', checked)}
                />
              </div>
              {initialData?.id && watch('isGroundPlanEnabled') && (
                <div className="flex justify-end mt-2">
                  <Button type="button" variant="outline" onClick={() => window.location.href = `/stations/${initialData.id}/ground-plan`}>
                    Edit Ground Plan Layout
                  </Button>
                </div>
              )}

      </form>
    </Card>
  );
}

