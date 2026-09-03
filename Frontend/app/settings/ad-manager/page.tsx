"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Upload, Tv, Loader2, Play } from "lucide-react";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";

// Drag and drop implementation for file upload
const DroppableArea = ({ onUpload, isUploading, assetUrl }: { onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void, isUploading: boolean, assetUrl: string }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: "droppable",
  });

  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-lg p-10 text-center flex flex-col items-center justify-center cursor-pointer transition-colors ${isOver ? "border-primary bg-primary/10" : "border-muted-foreground/30 hover:bg-muted/50"}`}
      onClick={() => document.getElementById('file-upload')?.click()}
    >
      <Upload className="h-10 w-10 text-muted-foreground mb-4" />
      <h3 className="font-medium text-lg mb-1">Click or drag file to this area</h3>
      <p className="text-sm text-muted-foreground mb-4">Supports images (PNG, JPG) and videos (MP4)</p>
      <input
        id="file-upload"
        type="file"
        className="hidden"
        onChange={onUpload}
        accept="image/*,video/*"
      />
      {isUploading && <Loader2 className="h-5 w-5 animate-spin mt-2" />}
      {assetUrl && <div className="mt-4 text-sm text-green-600 font-medium">File uploaded: {assetUrl.split('/').pop()}</div>}
    </div>
  );
};

export default function AdManagerPage() {
  const { user } = useAuth();

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [displayDuration, setDisplayDuration] = useState("30");
  const [targetModels, setTargetModels] = useState("Alfen,Raedian");
  const [assetUrl, setAssetUrl] = useState("");
  const [stationId, setStationId] = useState("");
  const [chargeGroupId, setChargeGroupId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [campaignsRes, stationsRes, groupsRes] = await Promise.all([
        api.get("/media-campaigns").catch(() => ({ data: [] })),
        api.get("/stations").catch(() => ({ data: [] })),
        api.get("/charge-groups").catch(() => ({ data: [] }))
      ]);
      setCampaigns(campaignsRes.data || []);
      setStations(stationsRes.data || []);
      setGroups(groupsRes.data || []);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/media-campaigns/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setAssetUrl(res.data.url);
      toast.success("File uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateCampaign = async () => {
    try {
      setIsSubmitting(true);
      await api.post("/media-campaigns", {
        name,
        displayDuration: parseInt(displayDuration),
        targetModels: targetModels.split(",").map(m => m.trim()),
        assetUrl,
        stationId: stationId ? parseInt(stationId) : null,
        chargeGroupId: chargeGroupId ? parseInt(chargeGroupId) : null
      });

      toast.success("Campaign created successfully");
      fetchData();

      // Reset form
      setName("");
      setDisplayDuration("30");
      setAssetUrl("");
      setStationId("");
      setChargeGroupId("");
    } catch (error) {
      toast.error("Failed to create campaign");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePushCampaign = async (id: number) => {
    try {
      toast.info("Pushing campaign...");
      await api.post(`/media-campaigns/${id}/push`);
      toast.success("Campaign pushed to chargers successfully");
    } catch (error) {
      toast.error("Failed to push campaign to chargers");
    }
  };

  if (user?.role !== "admin" && user?.role !== "superadmin") {
    return (
      <AppShell>
        <div className="p-8 text-center">Unauthorized Access</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Tv className="h-8 w-8" /> Ad Manager
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Create New Campaign</CardTitle>
              <CardDescription>Push promotional media directly to charger LCD screens.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              <div className="space-y-2">
                <Label>Media Asset</Label>
                <DndContext onDragEnd={() => {}}>
                  <DroppableArea onUpload={handleFileUpload} isUploading={isUploading} assetUrl={assetUrl} />
                </DndContext>
                {assetUrl && (
                  <div className="text-sm text-muted-foreground mt-2">
                    URL: {assetUrl}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">Campaign Name</Label>
                  <Input id="campaign-name" value={name} onChange={e => setName(e.target.value)} placeholder="Summer Promo 2024" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display-duration">Display Duration (seconds)</Label>
                  <Input id="display-duration" type="number" value={displayDuration} onChange={e => setDisplayDuration(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-models">Target Charger Models (comma separated)</Label>
                <Input id="target-models" value={targetModels} onChange={e => setTargetModels(e.target.value)} placeholder="Alfen,Raedian" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Station (Optional)</Label>
                  <Select value={stationId} onValueChange={setStationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a station" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" className="text-muted-foreground">All Stations</SelectItem>
                      {stations.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.station_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target Charge Group (Optional)</Label>
                  <Select value={chargeGroupId} onValueChange={setChargeGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" className="text-muted-foreground">All Groups</SelectItem>
                      {groups.map(g => (
                        <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleCreateCampaign}
                disabled={!name || !assetUrl || isSubmitting}
                className="w-full"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Campaign
              </Button>
            </CardFooter>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Active Campaigns</CardTitle>
              <CardDescription>Deploy your saved campaigns to chargers.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : campaigns.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
                  No campaigns created yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {campaigns.map(c => (
                    <div key={c.id} className="flex flex-col space-y-3 p-4 border rounded-lg bg-card">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{c.name}</h4>
                          <div className="text-xs text-muted-foreground mt-1">
                            {c.displayDuration}s duration • {Array.isArray(c.targetModels) ? c.targetModels.join(", ") : c.targetModels}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {c.station?.station_name || "All Stations"} • {c.chargeGroup?.name || "All Groups"}
                          </div>
                        </div>
                      </div>
                      <Button onClick={() => handlePushCampaign(c.id)} className="w-full" variant="default" size="sm">
                        <Play className="h-4 w-4 mr-2" /> Push to Chargers Now
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
