"use client";

import { useTranslation } from "react-i18next";
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { getContracts, createOrUpdateContract, getLedgers, exportSepa, ReimbursementContract, ReimbursementLedger } from '@/lib/reimbursements';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Save } from "lucide-react";
import { toast } from "sonner";

export default function ReimbursementsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [contracts, setContracts] = useState<ReimbursementContract[]>([]);
  const [ledgers, setLedgers] = useState<ReimbursementLedger[]>([]);

  // Form state
  const [rfidUserId, setRfidUserId] = useState<string>('');
  const [stationId, setStationId] = useState<string>('');
  const [tariffId, setTariffId] = useState<string>('');
  const [iban, setIban] = useState<string>('');
  const [employeeId, setEmployeeId] = useState<string>(''); // For admin to specify employee

  // Options
  const [stations, setStations] = useState<any[]>([]);
  const [rfids, setRfids] = useState<any[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    loadOptions();
  }, []);

  const loadData = async () => {
    try {
      const fetchedContracts = await getContracts();
      setContracts(fetchedContracts);

      if (user?.role === 'admin' || user?.role === 'superadmin') {
        const fetchedLedgers = await getLedgers();
        setLedgers(fetchedLedgers);
      }

      // Auto-fill form if employee has one contract
      if (user?.role !== 'admin' && user?.role !== 'superadmin' && fetchedContracts.length > 0) {
        const c = fetchedContracts[0];
        if (c) {
          if (c.rfidUserId) setRfidUserId(c.rfidUserId.toString());
          if (c.stationId) setStationId(c.stationId.toString());
          if (c.tariffId) setTariffId(c.tariffId.toString());
          if (c.iban) setIban(c.iban);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load reimbursements data.");
    }
  };

  const loadOptions = async () => {
    try {
      const [resStations, resRfids, resTariffs] = await Promise.all([
        api.get('/stations'),
        api.get('/rfid'),
        api.get('/tariffs'),
      ]);
      setStations(resStations.data || []);
      setRfids(resRfids.data || []);
      setTariffs(resTariffs.data || []);

      if (user?.role === 'admin' || user?.role === 'superadmin') {
         const resUsers = await api.get('/users');
         setUsers(resUsers.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveContract = async () => {
    try {
      await createOrUpdateContract({
        userId: (user?.role === 'admin' || user?.role === 'superadmin') && employeeId ? Number(employeeId) : user?.id,
        rfidUserId: Number(rfidUserId),
        stationId: Number(stationId),
        tariffId: Number(tariffId),
        iban,
      });
      toast.success(t('reimbursements.contractSaved'));
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save contract");
    }
  };

  const handleExport = async () => {
    try {
      await exportSepa();
      toast.success("Export successful");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export SEPA");
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('reimbursements.title')}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('reimbursements.employeeSetup')}</CardTitle>
              <CardDescription>Configure home charging reimbursement settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <div className="space-y-2">
                  <Label>{t('reimbursements.employee')}</Label>
                  <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(u => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.name || u.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t('reimbursements.iban')}</Label>
                <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="BE..." />
              </div>
              <div className="space-y-2">
                <Label>{t('reimbursements.station')}</Label>
                <Select value={stationId} onValueChange={setStationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Home Charger" />
                  </SelectTrigger>
                  <SelectContent>
                    {stations.map(s => {
                      const sId = s.id || s.station_id;
                      return (
                        <SelectItem key={sId} value={String(sId)}>{s.station_name || s.name || `Station #${sId}`}</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('reimbursements.rfid')}</Label>
                <Select value={rfidUserId} onValueChange={setRfidUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Fleet RFID" />
                  </SelectTrigger>
                  <SelectContent>
                    {rfids.map(r => {
                      const rId = r.rfid_user_id || r.id;
                      return (
                        <SelectItem key={rId} value={String(rId)}>{r.rfid_tag || 'TAG'} - {r.name || 'User'}</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('reimbursements.tariff')}</Label>
                <Select value={tariffId} onValueChange={setTariffId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Energy Tariff" />
                  </SelectTrigger>
                  <SelectContent>
                    {tariffs.map(t => {
                      const tId = t.tariff_id || t.id;
                      const rate = t.electricity_rate ?? t.energyFee ?? 0;
                      return (
                        <SelectItem key={tId} value={String(tId)}>{t.tariff_name || t.name || `Tariff #${tId}`} ({rate} EUR/kWh)</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSaveContract} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                {t('reimbursements.saveContract')}
              </Button>
            </CardContent>
          </Card>

          <Card>
             <CardHeader>
               <CardTitle>My Contracts</CardTitle>
             </CardHeader>
             <CardContent>
                <ul className="space-y-2">
                   {contracts.map(c => (
                     <li key={c.id} className="text-sm p-2 border rounded-md">
                       <strong>Station:</strong> {c.station?.station_name} | <strong>RFID:</strong> {c.rfidUser?.rfid_tag} <br/>
                       <strong>IBAN:</strong> {c.iban} <br/>
                       <strong>Tariff:</strong> {c.tariff?.tariff_name}
                     </li>
                   ))}
                   {contracts.length === 0 && <p className="text-muted-foreground text-sm">No contracts found.</p>}
                </ul>
             </CardContent>
          </Card>
        </div>

        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('reimbursements.employerFleet')}</CardTitle>
                <CardDescription>Pending monthly reimbursements.</CardDescription>
              </div>
              <Button onClick={handleExport} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                {t('reimbursements.downloadSepa')}
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reimbursements.employee')}</TableHead>
                    <TableHead>{t('reimbursements.month')}/{t('reimbursements.year')}</TableHead>
                    <TableHead>{t('reimbursements.totalKwh')}</TableHead>
                    <TableHead>{t('reimbursements.amount')}</TableHead>
                    <TableHead>{t('reimbursements.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgers.map(l => (
                    <TableRow key={l.id}>
                      <TableCell>{l.contract?.user?.name || l.contract?.user?.email}</TableCell>
                      <TableCell>{l.month}/{l.year}</TableCell>
                      <TableCell>{l.totalKwh.toFixed(2)} kWh</TableCell>
                      <TableCell>€{l.totalAmount.toFixed(2)}</TableCell>
                      <TableCell>{l.status}</TableCell>
                    </TableRow>
                  ))}
                  {ledgers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">No pending reimbursements.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
