"use client";
import { logger } from "@/lib/logger";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Upload, Save, ExternalLink, Zap } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

interface ConfigParam {
  key: string;
  readonly: boolean;
  value: string;
}

interface ConfigurationProfileItem {
  key: string;
  value: string;
}

interface ConfigurationProfile {
  id: number;
  name: string;
  description: string | null;
  items: ConfigurationProfileItem[];
  createdAt?: string;
}

interface ChargerConfigurationPanelProps {
  chargerId: number;
  chargerName?: string;
  isOnline?: boolean;
}

export function ChargerConfigurationPanel({
  chargerId,
  chargerName,
  isOnline = true,
}: ChargerConfigurationPanelProps) {
  const [configs, setConfigs] = useState<ConfigParam[]>([]);
  const [editedValues, setEditedValues] = useState<{ [key: string]: string }>({});
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Save dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveMode, setSaveMode] = useState<"new" | "update">("new");
  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [selectedTargetProfileId, setSelectedTargetProfileId] = useState("");
  const [excludeReadOnly, setExcludeReadOnly] = useState(true);
  const [includeEditedValues, setIncludeEditedValues] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load dialog state
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [existingProfiles, setExistingProfiles] = useState<ConfigurationProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [selectedLoadProfileId, setSelectedLoadProfileId] = useState("");
  const [isApplyingDirectly, setIsApplyingDirectly] = useState(false);

  useEffect(() => {
    const loadSavedConfigurations = async () => {
      try {
        const response = await api.get(`/chargers/${chargerId}/configurations`);
        if (response.data) {
          const list = Array.isArray(response.data) ? response.data : (response.data.keys || response.data.data || []);
          setConfigs(Array.isArray(list) ? list : []);
        }
      } catch (error) {
        logger.error('Failed to load saved configurations', error);
      }
    };

    loadSavedConfigurations();
  }, [chargerId]);

  const fetchConfiguration = async () => {
    setIsLoading(true);
    try {
      const response = await api.post('/ocpp/get-configuration', { chargerId });
      if (response.data.status === 'Accepted' && response.data.configurationKey) {
        setConfigs(response.data.configurationKey);
        // Reset state
        setEditedValues({});
        setSelectedKeys(new Set());
      } else {
        toast.error(response.data.error || 'Failed to fetch configuration');
      }
    } catch (error: any) {
      logger.error('Failed to get configuration', error);
      toast.error(error.response?.data?.error || 'Failed to fetch configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfilesList = async () => {
    setLoadingProfiles(true);
    try {
      const response = await api.get("/config-profiles");
      const list = response.data?.data || response.data || [];
      const profilesArr = Array.isArray(list) ? list : [];
      setExistingProfiles(profilesArr);
      if (profilesArr.length > 0 && !selectedLoadProfileId) {
        setSelectedLoadProfileId(String(profilesArr[0].id));
      }
    } catch (error) {
      logger.error("Failed to load configuration profiles", error);
      toast.error("Failed to load configuration profiles list");
    } finally {
      setLoadingProfiles(false);
    }
  };

  const openSaveDialog = () => {
    if (configs.length === 0) {
      toast.error("No parameters available to save. Click 'Get Parameters' first.");
      return;
    }
    const defaultName = chargerName
      ? `${chargerName} Configuration`
      : `Charger #${chargerId} Configuration`;
    setProfileName(defaultName);
    setProfileDescription(`Exported configuration parameters from ${chargerName || `Charger #${chargerId}`}`);
    setSaveMode("new");
    setSaveDialogOpen(true);
    fetchProfilesList();
  };

  const openLoadDialog = () => {
    setLoadDialogOpen(true);
    fetchProfilesList();
  };

  const handleValueChange = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
    // Auto-select when a value is edited
    setSelectedKeys(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const toggleSelection = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submitSelected = async () => {
    if (selectedKeys.size === 0) return;

    setIsSubmitting(true);
    try {
      const configurationKey = Array.from(selectedKeys).map(key => {
        // Fallback to original value if not edited
        const originalConfig = configs.find(c => c.key === key);
        const value = editedValues[key] !== undefined ? editedValues[key] : (originalConfig?.value || "");
        return { key, value };
      });

      const response = await api.post('/ocpp/set-configuration', {
        chargerId,
        configurationKey
      });

      toast.success(`Set Configuration result: ${response.data.status || 'Accepted'}`);

      // Refresh configurations to see applied changes
      await fetchConfiguration();
    } catch (error: any) {
      logger.error('Failed to set configuration', error);
      toast.error(error.response?.data?.error || 'Failed to set configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Are you sure you want to delete all saved configurations?")) return;
    try {
      await api.delete(`/ocpp/configuration/${chargerId}`);
      toast.success("Configurations deleted successfully");
      setConfigs([]);
      setEditedValues({});
      setSelectedKeys(new Set());
    } catch (error) {
      logger.error('Failed to delete configurations', error);
      toast.error("Failed to delete configurations");
    }
  };

  const calculatedItemsCount = useMemo(() => {
    const list = excludeReadOnly ? configs.filter(c => !c.readonly) : configs;
    return list.length;
  }, [configs, excludeReadOnly]);

  const selectedLoadProfile = useMemo(() => {
    return existingProfiles.find(p => String(p.id) === selectedLoadProfileId) || null;
  }, [existingProfiles, selectedLoadProfileId]);

  const handleSaveProfile = async () => {
    if (saveMode === "new" && !profileName.trim()) {
      toast.error("Please enter a profile name");
      return;
    }
    if (saveMode === "update" && !selectedTargetProfileId) {
      toast.error("Please select a profile to update");
      return;
    }

    setIsSaving(true);
    try {
      const paramsToSave = excludeReadOnly ? configs.filter(c => !c.readonly) : configs;
      const uniqueItemsMap = new Map<string, string>();
      for (const c of paramsToSave) {
        const val = (includeEditedValues && editedValues[c.key] !== undefined)
          ? editedValues[c.key]
          : (c.value || "");
        uniqueItemsMap.set(c.key.trim(), String(val));
      }
      const items = Array.from(uniqueItemsMap.entries()).map(([key, value]) => ({ key, value }));

      if (items.length === 0) {
        toast.error("No parameters match the selection criteria to save.");
        setIsSaving(false);
        return;
      }

      if (saveMode === "new") {
        await api.post("/config-profiles", {
          name: profileName.trim(),
          description: profileDescription.trim() || null,
          items,
        });
        toast.success(`Saved profile "${profileName.trim()}" with ${items.length} parameter(s) to Configuration Profiles!`);
      } else {
        const existing = existingProfiles.find(p => String(p.id) === selectedTargetProfileId);
        const nameToUse = existing?.name || profileName.trim();
        await api.put(`/config-profiles/${selectedTargetProfileId}`, {
          name: nameToUse,
          description: profileDescription.trim() || existing?.description || null,
          items,
        });
        toast.success(`Updated profile "${nameToUse}" with ${items.length} parameter(s)!`);
      }

      setSaveDialogOpen(false);
    } catch (error: any) {
      logger.error("Failed to save configuration profile", error);
      toast.error(error.response?.data?.error || "Failed to save configuration profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadIntoEditor = () => {
    if (!selectedLoadProfile) return;

    const items = selectedLoadProfile.items || [];
    if (items.length === 0) {
      toast.error("The selected profile contains no parameters.");
      return;
    }

    const existingKeyMap = new Map(configs.map(c => [c.key, c]));
    const newEditedValues = { ...editedValues };
    const newSelectedKeys = new Set(selectedKeys);
    const updatedConfigs = [...configs];

    for (const item of items) {
      newEditedValues[item.key] = item.value;
      newSelectedKeys.add(item.key);

      if (existingKeyMap.has(item.key)) {
        const idx = updatedConfigs.findIndex(c => c.key === item.key);
        if (idx !== -1) {
          updatedConfigs[idx] = {
            ...updatedConfigs[idx],
            value: item.value,
          };
        }
      } else {
        updatedConfigs.push({
          key: item.key,
          readonly: false,
          value: item.value,
        });
      }
    }

    setConfigs(updatedConfigs);
    setEditedValues(newEditedValues);
    setSelectedKeys(newSelectedKeys);
    setLoadDialogOpen(false);

    toast.success(
      `Loaded ${items.length} parameter(s) from "${selectedLoadProfile.name}" into editor. Checkboxes selected.`
    );
  };

  const handleApplyDirectly = async () => {
    if (!selectedLoadProfile) return;
    if (isOnline === false) {
      toast.error("Charger is currently offline. Cannot apply configurations.");
      return;
    }

    setIsApplyingDirectly(true);
    try {
      const response = await api.post(`/config-profiles/${selectedLoadProfile.id}/apply/${chargerId}`);
      toast.success(response.data?.message || `Configuration profile "${selectedLoadProfile.name}" applied directly to charger!`);
      setLoadDialogOpen(false);
      await fetchConfiguration();
    } catch (error: any) {
      logger.error("Failed to apply configuration profile directly", error);
      toast.error(error.response?.data?.error || "Failed to apply configuration profile to charger");
    } finally {
      setIsApplyingDirectly(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b pb-4 flex flex-row items-center justify-between flex-wrap gap-4">
        <div>
          <CardTitle className="text-xl">Configuration Parameters</CardTitle>
          <CardDescription>View, modify, save, and load specific charger parameters.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {configs.length > 0 && (
            <Button
              onClick={handleDeleteAll}
              variant="destructive"
              size="sm"
              className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border-0"
            >
              Delete All
            </Button>
          )}
          <Button
            onClick={fetchConfiguration}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Get Parameters
          </Button>
          <Button
            onClick={openSaveDialog}
            disabled={configs.length === 0}
            variant="outline"
            size="sm"
            title={configs.length === 0 ? "Fetch parameters first to save them" : "Save parameters to Configuration Profiles"}
          >
            <Save className="h-4 w-4 mr-2 text-primary" />
            Save Parameters
          </Button>
          <Button
            onClick={openLoadDialog}
            variant="outline"
            size="sm"
            title="Load parameters from Configuration Profiles"
          >
            <Upload className="h-4 w-4 mr-2 text-primary" />
            Load Parameters
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {configs.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground border-dashed border-2 rounded-lg">
            <p>No configuration parameters loaded.</p>
            <p className="text-sm mt-1">
              Click &quot;Get Parameters&quot; to request them from the charger, or &quot;Load Parameters&quot; to import from an OCPP Configuration Profile.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => {
                    const isSelected = selectedKeys.has(config.key);
                    const currentValue = editedValues[config.key] !== undefined ? editedValues[config.key] : config.value || "";

                    return (
                      <TableRow key={config.key} className={isSelected ? "bg-muted/50" : ""}>
                        <TableCell>
                          {!config.readonly && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelection(config.key)}
                            />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[200px] truncate" title={config.key}>
                          {config.key}
                        </TableCell>
                        <TableCell>
                          {config.readonly ? (
                            <Badge variant="outline" className="text-xs">Read-Only</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">R/W</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {config.readonly ? (
                            <div className="font-mono text-xs break-all max-w-md">{config.value}</div>
                          ) : (
                            <Input
                              value={currentValue}
                              onChange={(e) => handleValueChange(config.key, e.target.value)}
                              className="font-mono text-xs h-8"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border">
              <span className="text-sm font-medium">
                {selectedKeys.size} parameter(s) selected
              </span>
              <Button
                onClick={submitSelected}
                disabled={selectedKeys.size === 0 || isSubmitting}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Send Selected Values
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Save Parameters Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5 text-primary" />
              Save Parameters to Configuration Profile
            </DialogTitle>
            <DialogDescription>
              Save this charger&apos;s parameters to an OCPP Configuration Profile template that can be managed from the Configuration Profiles page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Save Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={saveMode === "new" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSaveMode("new")}
                >
                  Create New Profile
                </Button>
                <Button
                  type="button"
                  variant={saveMode === "update" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSaveMode("update")}
                  disabled={existingProfiles.length === 0}
                >
                  Update Existing ({existingProfiles.length})
                </Button>
              </div>
            </div>

            {saveMode === "update" ? (
              <div className="space-y-2">
                <Label>Select Existing Profile to Overwrite</Label>
                <Select value={selectedTargetProfileId} onValueChange={setSelectedTargetProfileId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a profile to update" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingProfiles.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} ({p.items?.length || 0} params)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="profile-name">Profile Name *</Label>
                <Input
                  id="profile-name"
                  placeholder="e.g. Alfen Eve Double Fast Baseline"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="profile-desc">Description</Label>
              <Input
                id="profile-desc"
                placeholder="Optional description of this parameter set"
                value={profileDescription}
                onChange={(e) => setProfileDescription(e.target.value)}
              />
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="exclude-readonly"
                  checked={excludeReadOnly}
                  onCheckedChange={(checked) => setExcludeReadOnly(Boolean(checked))}
                />
                <label
                  htmlFor="exclude-readonly"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Exclude read-only parameters ({configs.filter(c => c.readonly).length} read-only keys)
                </label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Recommended: read-only parameters cannot be modified via ChangeConfiguration.
              </p>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-edits"
                  checked={includeEditedValues}
                  onCheckedChange={(checked) => setIncludeEditedValues(Boolean(checked))}
                />
                <label
                  htmlFor="include-edits"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Include currently edited values from table ({Object.keys(editedValues).length} modified)
                </label>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-3 text-xs flex justify-between items-center border">
              <span className="text-muted-foreground">Parameters to save:</span>
              <Badge variant="secondary" className="font-mono">
                {calculatedItemsCount} parameters
              </Badge>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={isSaving || (saveMode === "new" && !profileName.trim()) || (saveMode === "update" && !selectedTargetProfileId)}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {saveMode === "update" ? "Overwrite Profile" : "Save Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Parameters Dialog */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Load Configuration Profile
            </DialogTitle>
            <DialogDescription>
              Select an OCPP Configuration Profile from the library to populate or apply to this charger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex justify-between items-center">
              <Label>Select Configuration Profile</Label>
              <Link
                href="/config-profiles"
                target="_blank"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Open Profiles Page <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {loadingProfiles ? (
              <div className="flex items-center justify-center p-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading profiles...
              </div>
            ) : existingProfiles.length === 0 ? (
              <div className="text-center p-6 border border-dashed rounded-lg text-muted-foreground space-y-2">
                <p>No configuration profiles found.</p>
                <Link href="/config-profiles">
                  <Button variant="outline" size="sm" className="mt-2">
                    Go to Configuration Profiles
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <Select value={selectedLoadProfileId} onValueChange={setSelectedLoadProfileId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a configuration profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingProfiles.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} ({p.items?.length || 0} params)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedLoadProfile && (
                  <div className="space-y-3">
                    {selectedLoadProfile.description && (
                      <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border">
                        {selectedLoadProfile.description}
                      </p>
                    )}

                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>Contains {selectedLoadProfile.items?.length || 0} parameter(s):</span>
                    </div>

                    <div className="rounded-md border max-h-[220px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow className="text-xs">
                            <TableHead className="py-2">Key</TableHead>
                            <TableHead className="py-2">Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(selectedLoadProfile.items || []).map((item) => (
                            <TableRow key={item.key} className="text-xs">
                              <TableCell className="font-mono py-1.5 font-medium max-w-[200px] truncate" title={item.key}>
                                {item.key}
                              </TableCell>
                              <TableCell className="font-mono py-1.5 text-muted-foreground truncate max-w-[250px]" title={item.value}>
                                {item.value}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setLoadDialogOpen(false)}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleLoadIntoEditor}
                disabled={!selectedLoadProfile || isApplyingDirectly}
              >
                Load into Editor
              </Button>
              <Button
                onClick={handleApplyDirectly}
                disabled={!selectedLoadProfile || isApplyingDirectly || isOnline === false}
                className="bg-primary hover:bg-primary/90"
              >
                {isApplyingDirectly ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                Apply Directly to Charger
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
