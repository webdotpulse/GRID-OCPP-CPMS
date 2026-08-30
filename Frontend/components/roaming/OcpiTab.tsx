import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, RefreshCw } from "lucide-react";

type OcpiEndpoint = {
  id: number;
  name: string;
  url: string;
  token: string;
  version: string;
  status: string;
};

export function OcpiTab() {
  const [endpoints, setEndpoints] = useState<OcpiEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<OcpiEndpoint | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [version, setVersion] = useState("2.2.1");

  const fetchEndpoints = async () => {
    try {
      setLoading(true);
      const response = await api.get("/ocpi/endpoints");
      const list = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setEndpoints(list);
    } catch (error: any) {
      toast.error("Failed to fetch OCPI endpoints: " + (error?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEndpoints();
  }, []);

  const handleOpenDialog = (endpoint?: OcpiEndpoint) => {
    if (endpoint) {
      setEditingEndpoint(endpoint);
      setName(endpoint.name);
      setUrl(endpoint.url);
      setToken(endpoint.token);
      setVersion(endpoint.version);
    } else {
      setEditingEndpoint(null);
      setName("");
      setUrl("");
      setToken("");
      setVersion("2.2.1");
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name || !url || !token) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const payload = { name, url, token, version, status: "active" };
      if (editingEndpoint) {
        await api.put(`/ocpi/endpoints/${editingEndpoint.id}`, payload);
        toast.success("Endpoint updated successfully");
      } else {
        await api.post("/ocpi/endpoints", payload);
        toast.success("Endpoint created successfully");
      }
      setIsDialogOpen(false);
      fetchEndpoints();
    } catch (error: any) {
      toast.error((editingEndpoint ? "Failed to update endpoint: " : "Failed to create endpoint: ") + (error?.message || ""));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this endpoint?")) return;
    try {
      await api.delete(`/ocpi/endpoints/${id}`);
      toast.success("Endpoint deleted successfully");
      fetchEndpoints();
    } catch (error: any) {
      toast.error("Failed to delete endpoint: " + (error?.message || ""));
    }
  };

  const handleTest = async (id: number) => {
    try {
      const response = await api.post(`/ocpi/endpoints/${id}/test`);
      if (response.data?.success) {
        toast.success("Connection successful!");
      } else {
        toast.error("Connection failed");
      }
    } catch (error: any) {
      toast.error("Connection test failed: " + (error?.message || ""));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>OCPI Endpoints</CardTitle>
          <CardDescription>Configure connections to other CPOs and eMSPs via OCPI.</CardDescription>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" /> Add Endpoint
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Loading endpoints...</div>
        ) : endpoints.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
            No OCPI endpoints configured. Add one to enable roaming.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpoints.map((endpoint) => (
                  <TableRow key={endpoint.id}>
                    <TableCell className="font-medium">{endpoint.name}</TableCell>
                    <TableCell className="font-mono text-sm">{endpoint.url}</TableCell>
                    <TableCell>{endpoint.version}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${endpoint.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {endpoint.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleTest(endpoint.id)} title="Test Connection">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleOpenDialog(endpoint)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleDelete(endpoint.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEndpoint ? "Edit OCPI Endpoint" : "Add OCPI Endpoint"}</DialogTitle>
            <DialogDescription>
              Enter the credentials provided by the roaming partner.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="e.g. Roaming Partner A" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="url" className="text-right">Base URL</Label>
              <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} className="col-span-3" placeholder="https://api.partner.com/ocpi/cpo" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="token" className="text-right">Token (CREDENTIALS)</Label>
              <Input id="token" type="password" value={token} onChange={(e) => setToken(e.target.value)} className="col-span-3" placeholder="e.g. Bearer eyJhb..." />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="version" className="text-right">Version</Label>
              <Input id="version" value={version} onChange={(e) => setVersion(e.target.value)} className="col-span-3" placeholder="2.2.1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingEndpoint ? "Save Changes" : "Add Endpoint"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
