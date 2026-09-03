"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import { useParams } from "next/navigation";

export default function EditChargeGroupPage() {
  const router = useRouter();
  const params = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxPower, setMaxPower] = useState<number | "">("");

  const [allTariffs, setAllTariffs] = useState<any[]>([]);

  const [selectedChargers, setSelectedChargers] = useState<number[]>([]);
  const [groupUsers, setGroupUsers] = useState<{userId: number, tariffId: number | null}[]>([]);

  // Search states
  const [chargerSearch, setChargerSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [searchedChargers, setSearchedChargers] = useState<any[]>([]);
  const [searchedUsers, setSearchedUsers] = useState<any[]>([]);

  // Keep details for selected entities to render them
  const [selectedChargersDetails, setSelectedChargersDetails] = useState<any[]>([]);
  const [selectedUsersDetails, setSelectedUsersDetails] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tariffsRes, groupRes] = await Promise.all([
          api.get('/tariffs'),
          api.get(`/charge-groups/${params.id}`)
        ]);

        setAllTariffs(tariffsRes.data?.data || tariffsRes.data);

        const groupData = groupRes.data;
        setName(groupData.name);
        setDescription(groupData.description || "");
        setMaxPower(groupData.maxPower !== null ? groupData.maxPower : "");

        const initialChargers = groupData.chargers || [];
        setSelectedChargers(initialChargers.map((c: any) => c.charger_id));
        setSelectedChargersDetails(initialChargers);

        const initialUsers = groupData.users || [];
        setGroupUsers(initialUsers.map((u: any) => ({
          userId: u.userId,
          tariffId: u.tariffId
        })));
        setSelectedUsersDetails(initialUsers.map((u: any) => u.user));
      } catch (err) {
        toast.error("Failed to load charge group data");
      }
    };
    if (params.id) fetchData();
  }, [params.id]);

  useEffect(() => {
    if (!chargerSearch) {
      setSearchedChargers([]);
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      api.get(`/chargers?search=${chargerSearch}`).then(res => {
        setSearchedChargers(res.data );
      });
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [chargerSearch]);

  useEffect(() => {
    if (!userSearch) {
      setSearchedUsers([]);
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      api.get(`/users?search=${userSearch}`).then(res => {
        setSearchedUsers(res.data );
      });
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [userSearch]);

  const addCharger = (charger: any) => {
    if (!selectedChargers.includes(charger.charger_id)) {
      setSelectedChargers(prev => [...prev, charger.charger_id]);
      setSelectedChargersDetails(prev => [...prev, charger]);
    }
    setChargerSearch("");
  };

  const removeCharger = (id: number) => {
    setSelectedChargers(prev => prev.filter(x => x !== id));
    setSelectedChargersDetails(prev => prev.filter(x => x.charger_id !== id));
  };

  const addUser = (user: any) => {
    if (!groupUsers.some(u => u.userId === user.id)) {
      setGroupUsers(prev => [...prev, { userId: user.id, tariffId: null }]);
      setSelectedUsersDetails(prev => [...prev, user]);
    }
    setUserSearch("");
  };

  const removeUser = (userId: number) => {
    setGroupUsers(prev => prev.filter(u => u.userId !== userId));
    setSelectedUsersDetails(prev => prev.filter(u => u.id !== userId));
  };

  const updateUserTariff = (userId: number, tariffId: number | null) => {
    setGroupUsers(prev => prev.map(u => u.userId === userId ? { ...u, tariffId } : u));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return toast.error("Name is required");

    setIsLoading(true);
    try {
      await api.put(`/charge-groups/${params.id}`, {
        name,
        description,
        maxPower: maxPower === "" ? null : Number(maxPower),
        chargerIds: selectedChargers,
        users: groupUsers
      });
      toast.success("Charge group updated");
      router.push('/charge-groups');
    } catch {
      toast.error("Failed to create charge group");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Edit Charge Group</h1>
        </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Group Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="e.g. Employee Parking A" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e: any) => setDescription(e.target.value)} placeholder="Optional details..." />
                </div>
                <div className="space-y-2 pt-2 border-t">
                  <Label>Maximum Group Power Capacity (kW)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={maxPower}
                    onChange={(e: any) => setMaxPower(e.target.value)}
                    placeholder="e.g. 150"
                  />
                  <p className="text-xs text-muted-foreground">Used for Smart Charging Load Management to dynamically throttle chargers if group load approaches this limit.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Assign Chargers</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Input
                    value={chargerSearch}
                    onChange={(e: any) => setChargerSearch(e.target.value)}
                    placeholder="Search chargers by name or serial..."
                  />
                  {searchedChargers.length > 0 && chargerSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {searchedChargers.map(charger => (
                        <div
                          key={charger.charger_id}
                          className="p-2 hover:bg-muted cursor-pointer flex justify-between"
                          onClick={() => addCharger(charger)}
                        >
                          <span>{charger.name} <span className="text-xs text-muted-foreground">({charger.serial_number})</span></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 mt-4">
                  {selectedChargersDetails.map(charger => (
                    <div key={charger.charger_id} className="flex items-center justify-between p-2 border rounded bg-primary/5">
                      <Label className="flex-1">{charger.name} <span className="text-muted-foreground text-xs">({charger.model})</span></Label>
                      <Button variant="ghost" size="icon" type="button" onClick={() => removeCharger(charger.charger_id)} className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {selectedChargersDetails.length === 0 && <p className="text-muted-foreground text-sm">No chargers assigned yet.</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="h-full">
              <CardHeader><CardTitle>Assign Users & Tariffs</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Input
                    value={userSearch}
                    onChange={(e: any) => setUserSearch(e.target.value)}
                    placeholder="Search users by name or email..."
                  />
                  {searchedUsers.length > 0 && userSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {searchedUsers.map(user => (
                        <div
                          key={user.id}
                          className="p-2 hover:bg-muted cursor-pointer flex justify-between"
                          onClick={() => addUser(user)}
                        >
                          <span>{user.email} <span className="text-xs text-muted-foreground">({user.name || 'No name'})</span></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="max-h-[500px] overflow-y-auto space-y-4 mt-4">
                  {selectedUsersDetails.map(u => {
                    if (!u) return null; // Safe guard
                    const selectedTariff = groupUsers.find(gu => gu.userId === u.id)?.tariffId;

                    return (
                      <div key={u.id} className="p-4 border rounded space-y-3 bg-primary/5 border-primary/20">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <Label className="font-medium block">{u.email}</Label>
                            <p className="text-xs text-muted-foreground">{u.userType} - {u.companyName || 'No company'}</p>
                          </div>
                          <Button variant="ghost" size="icon" type="button" onClick={() => removeUser(u.id)} className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="pt-2">
                          <Label className="text-xs mb-1 block">Specific Tariff for this user in this group</Label>
                          <Select
                            value={selectedTariff ? selectedTariff.toString() : "none"}
                            onValueChange={(val) => updateUserTariff(u.id, val === "none" ? null : parseInt(val))}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select a tariff" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Default / No Tariff</SelectItem>
                              {allTariffs.map(t => (
                                <SelectItem key={t.tariff_id} value={t.tariff_id.toString()}>
                                  {t.tariff_name} (€{t.charge})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                  {selectedUsersDetails.length === 0 && <p className="text-muted-foreground text-sm">No users assigned yet.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Charge Group
          </Button>
        </div>
      </form>
      </div>
    </AppShell>
  );
}
