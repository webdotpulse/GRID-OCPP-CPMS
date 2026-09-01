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
import { Loader2 } from "lucide-react";

const connectorSchema = z.object({
  charger_id: z.number().positive("Must assign to a charger"),
  connector_name: z.string().min(1, "Name is required"),
  status: z.string().min(1, "Status is required"),
  current_type: z.string().min(1, "Current type is required"),
  max_power: z.number().positive().optional(),
  max_current: z.number().positive().optional(),
});

type ConnectorFormValues = z.infer<typeof connectorSchema>;

export function ConnectorForm({ initialData }: { initialData?: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultChargerId = searchParams?.get('chargerId') || '';
  
  const [chargers, setChargers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<ConnectorFormValues>({
    resolver: zodResolver(connectorSchema),
    defaultValues: initialData ? {
      ...initialData,
      charger_id: initialData.evse?.charger_id || initialData.evse?.charger?.charger_id || undefined,
    } : {
      status: "Available",
      current_type: "AC",
      charger_id: defaultChargerId ? parseInt(defaultChargerId) : undefined,
    },
  });

  useEffect(() => {
    const fetchChargers = async () => {
      try {
        const response = await api.get('/chargers');
        const list = Array.isArray(response.data?.data) ? response.data.data : (Array.isArray(response.data) ? response.data : []);
        setChargers(list);
      } catch (error) {
        logger.error("Failed to fetch chargers", error);
      }
    };
    fetchChargers();
  }, []);

  const chargerId = watch('charger_id');
  const status = watch('status');
  const type = watch('current_type');

  const onSubmit = async (data: ConnectorFormValues) => {
    setIsLoading(true);
    try {
      if (initialData) {
        await api.put(`/connectors/${initialData.connector_id}`, data);
      } else {
        await api.post('/connectors', data);
      }
      router.back(); // Or router.push('/connectors')
      router.refresh();
    } catch (error: any) {
      logger.error("Failed to save channel", error);
      alert(error.response?.data?.error || "Failed to save channel.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl shadow-sm">
      <CardHeader className="border-b pb-4">
        <CardTitle>{initialData ? 'Edit Channel' : 'Add Channel'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="charger_id">Assign to Charger</Label>
            <Select 
              value={chargerId ? chargerId.toString() : ''} 
              onValueChange={(val) => setValue('charger_id', parseInt(val))}
              disabled={!!initialData} // Don't allow changing charger once created
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a charger" />
              </SelectTrigger>
              <SelectContent>
                {chargers.map(charger => (
                  <SelectItem key={charger.charger_id} value={charger.charger_id.toString()}>
                    {charger.name} ({charger.model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.charger_id && <p className="text-sm text-destructive">{errors.charger_id.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="connector_name">Channel Name</Label>
              <Input id="connector_name" {...register('connector_name')} placeholder="e.g. Connector A" />
              {errors.connector_name && <p className="text-sm text-destructive">{errors.connector_name.message}</p>}
            </div>
             <div className="space-y-2">
              <Label htmlFor="status">Initial Status</Label>
              <Select 
                value={status} 
                onValueChange={(val) => setValue('status', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Unavailable">Unavailable</SelectItem>
                  <SelectItem value="Faulted">Faulted</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="current_type">Current Type</Label>
              <Select 
                value={type} 
                onValueChange={(val) => setValue('current_type', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AC">AC</SelectItem>
                  <SelectItem value="DC">DC</SelectItem>
                </SelectContent>
              </Select>
              {errors.current_type && <p className="text-sm text-destructive">{errors.current_type.message}</p>}
            </div>
             <div className="space-y-2">
              <Label htmlFor="max_power">Max Power (kW) (Optional)</Label>
              <Input id="max_power" type="number" step="any" {...register('max_power', { valueAsNumber: true })} />
              {errors.max_power && <p className="text-sm text-destructive">{errors.max_power.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="max_current">Max Current (A) (Optional)</Label>
              <Input id="max_current" type="number" step="any" {...register('max_current', { valueAsNumber: true })} />
              {errors.max_current && <p className="text-sm text-destructive">{errors.max_current.message}</p>}
            </div>
          </div>

        </CardContent>
        <CardFooter className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-between">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isLoading}>
             {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
             {initialData ? 'Update Channel' : 'Add Channel'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

