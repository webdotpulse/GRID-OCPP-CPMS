"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";

interface VCC {
  id: number;
  emaid: string;
  macAddress: string | null;
  status: string;
  expirationDate: string;
  userId: number;
  user: { name: string, email: string };
}

export default function VehicleIdentityManagementPage() {
  const { user } = useAuth();

  const [vehicles, setVehicles] = useState<VCC[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    emaid: "",
    macAddress: "",
    userId: user?.id || "",
  });

  const fetchVehicles = async () => {
    try {
      const response = await api.get("/vehicles");
      setVehicles(response.data);
    } catch (error) {
      console.error("Failed to fetch vehicles", error);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/vehicles", {
        emaid: newVehicle.emaid,
        macAddress: newVehicle.macAddress,
        userId: Number(newVehicle.userId || user?.id),
      });
      toast.success("Successfully added new vehicle for Plug & Charge.");
      setIsDialogOpen(false);
      fetchVehicles();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to add vehicle");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/vehicles/${id}`);
      toast.success("Successfully removed vehicle.");
      fetchVehicles();
    } catch (error) {
      toast.error("Failed to remove vehicle");
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vehicle Management</h1>
          <p className="text-muted-foreground mt-2">Manage Plug & Charge (ISO 15118) vehicle certificates and authentication.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Register Vehicle</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Register New Vehicle</DialogTitle>
              <DialogDescription className="text-xs">
                Register an ISO 15118 contract certificate (EMAID) for Plug & Charge authentication.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddVehicle} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">EMAID *</label>
                <Input required value={newVehicle.emaid} onChange={e => setNewVehicle({...newVehicle, emaid: e.target.value})} placeholder="e.g. DE*ABC*E123456789" className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">MAC Address (Optional)</label>
                <Input value={newVehicle.macAddress} onChange={e => setNewVehicle({...newVehicle, macAddress: e.target.value})} placeholder="e.g. 00:1A:2B:3C:4D:5E" className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">User ID *</label>
                <Input type="number" required value={newVehicle.userId} onChange={e => setNewVehicle({...newVehicle, userId: e.target.value})} className="text-xs" />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#54a8c7] hover:bg-[#4596b4] text-white font-bold">
                  Register Vehicle
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered Vehicles</CardTitle>
          <CardDescription>Vehicles authorized for automatic Plug & Charge sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>EMAID</TableHead>
                <TableHead>MAC Address</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Expiration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.emaid}</TableCell>
                  <TableCell>{v.macAddress || "N/A"}</TableCell>
                  <TableCell>{v.user?.name || "Unknown"}</TableCell>
                  <TableCell>{new Date(v.expirationDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={v.status === "Valid" ? "default" : "destructive"}>{v.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {vehicles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No vehicles registered</TableCell>
                </TableRow>
              )}
            </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
