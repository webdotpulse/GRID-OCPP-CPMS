"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash, Download, Upload, Save, Edit, Sun, CreditCard, ArrowRight, ShieldAlert, Sparkles, Layers } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CardMapping {
  from: string;
  to: string;
}

interface QuirkProfile {
  id: number;
  name: string;
  description: string | null;
  rules: any;
  createdAt: string;
}

export default function QuirkProfilesPage() {
  const [profiles, setProfiles] = useState<QuirkProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<QuirkProfile | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mapAllCards, setMapAllCards] = useState(false);
  const [singleTargetCardId, setSingleTargetCardId] = useState("");
  const [cardMappings, setCardMappings] = useState<CardMapping[]>([]);
  const [ignoreMeterStart, setIgnoreMeterStart] = useState(false);
  const [calculatePower, setCalculatePower] = useState(false);
  const [estimateEnergy, setEstimateEnergy] = useState(false);
  const [jsonRules, setJsonRules] = useState("{}");
  const [activeTab, setActiveTab] = useState<"visual" | "json">("visual");

  const fetchProfiles = async () => {
    try {
      const response = await api.get("/quirk-profiles");
      setProfiles(response.data || []);
    } catch {
      toast.error("Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const parseRulesToVisualState = (rulesObj: any) => {
    const mappings: CardMapping[] = [];

    // Parse object format: rules.cardIdMapping or rules.solarCardIdMapping
    const rawMap = rulesObj?.cardIdMapping || rulesObj?.solarCardIdMapping || rulesObj?.idTagMapping;

    // Check if universal single card mapping is configured
    const universalCardId =
      rulesObj?.mapAllCardsTo ||
      rulesObj?.singleCardId ||
      rulesObj?.mapAllTo ||
      rulesObj?.allCardsMappedTo ||
      rulesObj?.defaultForwardCardId ||
      (rawMap && typeof rawMap === "object" && !Array.isArray(rawMap) && (rawMap["*"] || rawMap["ALL"] || rawMap["any"]));

    if (universalCardId && typeof universalCardId === "string") {
      setMapAllCards(true);
      setSingleTargetCardId(universalCardId);
    } else {
      setMapAllCards(false);
      setSingleTargetCardId("");
    }

    if (rawMap && typeof rawMap === "object" && !Array.isArray(rawMap)) {
      for (const [from, to] of Object.entries(rawMap)) {
        if (typeof to === "string" && from !== "*" && from !== "ALL" && from !== "any") {
          mappings.push({ from, to });
        }
      }
    } else if (Array.isArray(rulesObj?.cardMappings)) {
      for (const m of rulesObj.cardMappings) {
        if (m && m.from && m.to) {
          mappings.push({ from: m.from, to: m.to });
        }
      }
    }

    setCardMappings(mappings);
    setIgnoreMeterStart(Boolean(rulesObj?.ignoreMeterStart));
    setCalculatePower(Boolean(rulesObj?.calculatePowerFromVoltageAndCurrent));
    setEstimateEnergy(Boolean(rulesObj?.estimateEnergyFromPower));
  };

  const syncVisualStateToJson = (
    mappings: CardMapping[],
    ignoreStart: boolean,
    calcPwr: boolean,
    estEnergy: boolean,
    isMapAll: boolean = mapAllCards,
    targetSingleCard: string = singleTargetCardId
  ) => {
    let currentObj: any = {};
    try {
      currentObj = JSON.parse(jsonRules);
    } catch {
      currentObj = {};
    }

    if (isMapAll && targetSingleCard.trim()) {
      currentObj.mapAllCardsTo = targetSingleCard.trim();
      currentObj.cardIdMapping = { "*": targetSingleCard.trim() };
      delete currentObj.solarCardIdMapping;
      delete currentObj.cardMappings;
    } else {
      delete currentObj.mapAllCardsTo;
      delete currentObj.singleCardId;
      delete currentObj.mapAllTo;
      delete currentObj.allCardsMappedTo;
      delete currentObj.defaultForwardCardId;

      if (mappings.length > 0) {
        const mapObj: Record<string, string> = {};
        mappings.forEach((m) => {
          if (m.from.trim() && m.to.trim()) {
            mapObj[m.from.trim()] = m.to.trim();
          }
        });
        currentObj.cardIdMapping = mapObj;
      } else {
        delete currentObj.cardIdMapping;
        delete currentObj.solarCardIdMapping;
        delete currentObj.cardMappings;
      }
    }

    if (ignoreStart) {
      currentObj.ignoreMeterStart = true;
    } else {
      delete currentObj.ignoreMeterStart;
    }

    if (calcPwr) {
      currentObj.calculatePowerFromVoltageAndCurrent = true;
    } else {
      delete currentObj.calculatePowerFromVoltageAndCurrent;
    }

    if (estEnergy) {
      currentObj.estimateEnergyFromPower = true;
    } else {
      delete currentObj.estimateEnergyFromPower;
    }

    setJsonRules(JSON.stringify(currentObj, null, 2));
  };

  const handleOpenDialog = (profile?: QuirkProfile) => {
    if (profile) {
      setEditingProfile(profile);
      setName(profile.name);
      setDescription(profile.description || "");
      const rules = profile.rules || {};
      setJsonRules(JSON.stringify(rules, null, 2));
      parseRulesToVisualState(rules);
    } else {
      setEditingProfile(null);
      setName("");
      setDescription("");
      setMapAllCards(false);
      setSingleTargetCardId("");
      setCardMappings([]);
      setIgnoreMeterStart(false);
      setCalculatePower(false);
      setEstimateEnergy(false);
      setJsonRules("{\n  \n}");
    }
    setActiveTab("visual");
    setIsDialogOpen(true);
  };

  const handleAddCardMapping = () => {
    const updated = [...cardMappings, { from: "", to: "" }];
    setCardMappings(updated);
    syncVisualStateToJson(updated, ignoreMeterStart, calculatePower, estimateEnergy, mapAllCards, singleTargetCardId);
  };

  const handleUpdateCardMapping = (index: number, field: "from" | "to", value: string) => {
    const updated = [...cardMappings];
    updated[index][field] = value;
    setCardMappings(updated);
    syncVisualStateToJson(updated, ignoreMeterStart, calculatePower, estimateEnergy, mapAllCards, singleTargetCardId);
  };

  const handleRemoveCardMapping = (index: number) => {
    const updated = cardMappings.filter((_, i) => i !== index);
    setCardMappings(updated);
    syncVisualStateToJson(updated, ignoreMeterStart, calculatePower, estimateEnergy, mapAllCards, singleTargetCardId);
  };

  const handleToggleIgnoreMeterStart = (val: boolean) => {
    setIgnoreMeterStart(val);
    syncVisualStateToJson(cardMappings, val, calculatePower, estimateEnergy, mapAllCards, singleTargetCardId);
  };

  const handleToggleCalculatePower = (val: boolean) => {
    setCalculatePower(val);
    syncVisualStateToJson(cardMappings, ignoreMeterStart, val, estimateEnergy, mapAllCards, singleTargetCardId);
  };

  const handleApplyTemplate = (templateName: string) => {
    if (templateName === "universal") {
      setName((prev) => prev || "Universal Single Card Mapping");
      setDescription(
        (prev) =>
          prev ||
          "Maps all incoming RFID card swipes, Plug & Charge tokens, and solar tags to a single master RFID card."
      );
      setMapAllCards(true);
      setSingleTargetCardId("NL-MINT-00012345");
      setCardMappings([]);
      syncVisualStateToJson([], ignoreMeterStart, calculatePower, estimateEnergy, true, "NL-MINT-00012345");
      toast.success("Loaded Universal Single Card template");
    } else if (templateName === "solar") {
      setName((prev) => prev || "Solar Mode Card ID Translation");
      setDescription(
        (prev) =>
          prev ||
          "Translates solar modus RFID tag emitted by charger into the customer card ID for 3rd-party backend proxying."
      );
      setMapAllCards(false);
      setSingleTargetCardId("");
      const newMappings = [{ from: "SOLAR_DEFAULT", to: "NL-MINT-00012345" }];
      setCardMappings(newMappings);
      syncVisualStateToJson(newMappings, ignoreMeterStart, calculatePower, estimateEnergy, false, "");
      toast.success("Loaded Solar Mode Translation template");
    } else if (templateName === "alfen") {
      setName((prev) => prev || "Alfen Solar & Zero-TxId Quirk");
      setDescription(
        (prev) =>
          prev ||
          "Remaps solar smart charging tag to roaming tag and handles Alfen meterStart quirks."
      );
      setMapAllCards(false);
      setSingleTargetCardId("");
      const newMappings = [{ from: "EVE_SOLAR", to: "NL-ALL-99887766" }];
      setCardMappings(newMappings);
      setIgnoreMeterStart(true);
      syncVisualStateToJson(newMappings, true, calculatePower, estimateEnergy, false, "");
      toast.success("Loaded Alfen Quirk template");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    let parsedRules;
    try {
      parsedRules = JSON.parse(jsonRules);
    } catch {
      toast.error("Rules must be valid JSON");
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        rules: parsedRules,
      };

      if (editingProfile) {
        await api.put(`/quirk-profiles/${editingProfile.id}`, payload);
        toast.success("Profile updated");
      } else {
        await api.post("/quirk-profiles", payload);
        toast.success("Profile created");
      }

      setIsDialogOpen(false);
      fetchProfiles();
    } catch {
      toast.error("Failed to save profile");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    try {
      await api.delete(`/quirk-profiles/${id}`);
      toast.success("Profile deleted");
      fetchProfiles();
    } catch {
      toast.error("Failed to delete profile");
    }
  };

  const handleExport = (profile: QuirkProfile) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profile, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `quirk-profile-${profile.name.toLowerCase().replace(/\s+/g, "-")}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.name && json.rules) {
          await api.post("/quirk-profiles", {
            name: json.name + " (Imported)",
            description: json.description || null,
            rules: json.rules,
          });
          toast.success("Profile imported successfully");
          fetchProfiles();
        } else {
          toast.error("Invalid quirk profile JSON format");
        }
      } catch {
        toast.error("Failed to parse JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const getProfileMappingsCount = (rules: any) => {
    if (rules?.mapAllCardsTo || rules?.singleCardId || rules?.mapAllTo || rules?.cardIdMapping?.["*"] || rules?.cardIdMapping?.["ALL"]) {
      return 1;
    }
    const map = rules?.cardIdMapping || rules?.solarCardIdMapping || rules?.idTagMapping;
    if (map && typeof map === "object" && !Array.isArray(map)) {
      return Object.keys(map).length;
    }
    if (Array.isArray(rules?.cardMappings)) {
      return rules.cardMappings.length;
    }
    return 0;
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Hardware Quirk Profiles</h2>
            <p className="text-muted-foreground">
              Configure brand-specific hardware quirks, solar mode charge card translations, and 3rd-party backend proxy rules.
            </p>
          </div>
          <div className="flex gap-2">
            <Label htmlFor="import-profile" className="cursor-pointer">
              <div className="flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground">
                <Upload className="w-4 h-4 mr-2" />
                Import Profile
              </div>
            </Label>
            <input
              id="import-profile"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="w-4 h-4 mr-2" /> New Quirk Profile
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden bg-card text-card-foreground border-border">
                <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border/40">
                  <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground font-heading">
                    <Layers className="w-5 h-5 text-[#54a8c7]" />
                    {editingProfile ? "Edit Quirk Profile" : "Create Quirk Profile"}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-xs">
                    Configure hardware compatibility overrides, RFID card ID translations, and power synthesis rules.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Profile Name</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Alfen Solar Mode Card Translation"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional description..."
                      />
                    </div>
                  </div>

                  {/* Preset Templates */}
                  <div className="p-3 bg-muted/40 rounded-lg border border-border/50 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Quick Templates:
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-background/50 hover:bg-background"
                      onClick={() => handleApplyTemplate("universal")}
                    >
                      <CreditCard className="w-3 h-3 mr-1 text-emerald-500" /> Single Universal Card
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-background/50 hover:bg-background"
                      onClick={() => handleApplyTemplate("solar")}
                    >
                      <Sun className="w-3 h-3 mr-1 text-amber-500" /> Solar Mode Translation
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-background/50 hover:bg-background"
                      onClick={() => handleApplyTemplate("alfen")}
                    >
                      <Layers className="w-3 h-3 mr-1 text-sky-500" /> Alfen Eve Quirk
                    </Button>
                  </div>

                  {/* Tabs: Visual Builder vs Raw JSON */}
                  <div className="flex border-b border-border">
                    <button
                      type="button"
                      onClick={() => setActiveTab("visual")}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "visual"
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Visual Rule Builder
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("json");
                      }}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "json"
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Advanced JSON Editor
                    </button>
                  </div>

                  {activeTab === "visual" ? (
                    <div className="space-y-6">
                      {/* Solar Card ID / Hardware Card Translation Section */}
                      <div className="p-4 border rounded-xl bg-card/60 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                              <CreditCard className="w-4 h-4 text-amber-500" />
                              Solar Mode & Charge Card ID Translation
                            </h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Translate solar mode tags and hardware RFID cards to designated target card IDs for local authorization and 3rd-party backend proxying.
                            </p>
                          </div>
                          {!mapAllCards && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={handleAddCardMapping}
                              className="h-8 text-xs shrink-0 self-start sm:self-auto"
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" /> Add Card Mapping
                            </Button>
                          )}
                        </div>

                        {/* Mode Toggle: Map All to 1 Single Card */}
                        <div className="p-3 bg-muted/40 rounded-lg border border-border/60 flex items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <Label htmlFor="map-all-cards" className="text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Map ALL incoming RFID cards to 1 single card ID
                            </Label>
                            <p className="text-[11px] text-muted-foreground">
                              Every scanned RFID card, solar mode tag, or Plug & Charge token will be automatically translated to one universal card ID.
                            </p>
                          </div>
                          <Switch
                            id="map-all-cards"
                            checked={mapAllCards}
                            onCheckedChange={(checked) => {
                              setMapAllCards(checked);
                              if (checked && !singleTargetCardId) {
                                setSingleTargetCardId("NL-MINT-00012345");
                                syncVisualStateToJson(cardMappings, ignoreMeterStart, calculatePower, estimateEnergy, true, "NL-MINT-00012345");
                              } else {
                                syncVisualStateToJson(cardMappings, ignoreMeterStart, calculatePower, estimateEnergy, checked, singleTargetCardId);
                              }
                            }}
                          />
                        </div>

                        {mapAllCards ? (
                          <div className="p-3.5 bg-card/90 rounded-lg border border-primary/20 space-y-2">
                            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                              Universal Target Master RFID Card ID
                            </Label>
                            <Input
                              value={singleTargetCardId}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSingleTargetCardId(val);
                                syncVisualStateToJson(cardMappings, ignoreMeterStart, calculatePower, estimateEnergy, true, val);
                              }}
                              placeholder="e.g. NL-MINT-00012345 or FLEET_MASTER_CARD"
                              className="h-9 text-xs font-mono"
                            />
                            <p className="text-[11px] text-muted-foreground">
                              All incoming sessions will be assigned to this target card tag for whitelisting, roaming, and 3rd-party backend forwarding.
                            </p>
                          </div>
                        ) : cardMappings.length === 0 ? (
                          <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                            No card ID mappings configured. Click <strong>Add Card Mapping</strong> or toggle <strong>Map ALL incoming cards</strong> above.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground px-1">
                              <div className="col-span-5">Source Card ID (Solar Mode / Hardware Tag or *)</div>
                              <div className="col-span-1 text-center"></div>
                              <div className="col-span-5">Forwarded Target Card ID (Upstream / Roaming)</div>
                              <div className="col-span-1"></div>
                            </div>
                            {cardMappings.map((mapping, idx) => (
                              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-5">
                                  <Input
                                    value={mapping.from}
                                    onChange={(e) => handleUpdateCardMapping(idx, "from", e.target.value)}
                                    placeholder="e.g. SOLAR_DEFAULT or *"
                                    className="h-8 text-xs font-mono"
                                  />
                                </div>
                                <div className="col-span-1 flex justify-center text-muted-foreground">
                                  <ArrowRight className="w-4 h-4" />
                                </div>
                                <div className="col-span-5">
                                  <Input
                                    value={mapping.to}
                                    onChange={(e) => handleUpdateCardMapping(idx, "to", e.target.value)}
                                    placeholder="e.g. NL-MINT-00012345"
                                    className="h-8 text-xs font-mono"
                                  />
                                </div>
                                <div className="col-span-1 flex justify-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveCardMapping(idx)}
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Additional Standard Quirk Toggles */}
                      <div className="space-y-2 pt-1">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Hardware Fixes & Workarounds
                        </Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <label className="flex items-start gap-2.5 p-3 rounded-lg border bg-card/40 cursor-pointer hover:bg-card/70 transition-colors">
                            <input
                              type="checkbox"
                              checked={ignoreMeterStart}
                              onChange={(e) => handleToggleIgnoreMeterStart(e.target.checked)}
                              className="mt-0.5 rounded text-primary focus:ring-primary"
                            />
                            <div>
                              <div className="text-xs font-medium">Ignore Missing MeterStart</div>
                              <div className="text-[11px] text-muted-foreground">
                                Retroactively populates meterStart from the first MeterValue sample.
                              </div>
                            </div>
                          </label>

                          <label className="flex items-start gap-2.5 p-3 rounded-lg border bg-card/40 cursor-pointer hover:bg-card/70 transition-colors">
                            <input
                              type="checkbox"
                              checked={calculatePower}
                              onChange={(e) => handleToggleCalculatePower(e.target.checked)}
                              className="mt-0.5 rounded text-primary focus:ring-primary"
                            />
                            <div>
                              <div className="text-xs font-medium">Calculate Power from V & A</div>
                              <div className="text-[11px] text-muted-foreground">
                                Computes 3-phase and single-phase wattage if hardware omits Power.Active.Import.
                              </div>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Rules Configuration (JSON)</Label>
                      <Textarea
                        value={jsonRules}
                        onChange={(e) => {
                          setJsonRules(e.target.value);
                          try {
                            const parsed = JSON.parse(e.target.value);
                            parseRulesToVisualState(parsed);
                          } catch {
                            // wait for valid JSON
                          }
                        }}
                        placeholder='{ "mapAllCardsTo": "NL-MINT-00012345", "ignoreMeterStart": true }'
                        rows={12}
                        className="font-mono text-xs"
                      />
                    </div>
                  )}
                </div>

                <DialogFooter className="px-6 py-4 shrink-0 border-t border-border bg-muted/20 flex flex-row items-center justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} className="bg-[#54a8c7] hover:bg-[#4596b4] text-white font-bold">
                    <Save className="w-4 h-4 mr-1.5" /> Save Profile
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading quirk profiles...</div>
        ) : profiles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground space-y-3">
              <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground/60" />
              <div>No quirk profiles found. Create one to handle solar card translation and hardware quirks.</div>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" /> Create First Profile
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((profile) => {
              const isUniversal = Boolean(
                profile.rules?.mapAllCardsTo ||
                profile.rules?.singleCardId ||
                profile.rules?.mapAllTo ||
                profile.rules?.allCardsMappedTo ||
                profile.rules?.defaultForwardCardId ||
                profile.rules?.cardIdMapping?.["*"] ||
                profile.rules?.cardIdMapping?.["ALL"]
              );
              const universalId =
                profile.rules?.mapAllCardsTo ||
                profile.rules?.singleCardId ||
                profile.rules?.mapAllTo ||
                profile.rules?.allCardsMappedTo ||
                profile.rules?.defaultForwardCardId ||
                profile.rules?.cardIdMapping?.["*"] ||
                profile.rules?.cardIdMapping?.["ALL"];

              const mappingsCount = getProfileMappingsCount(profile.rules);
              const hasSolarMapping = mappingsCount > 0;
              const hasIgnoreMeterStart = Boolean(profile.rules?.ignoreMeterStart);
              const hasPowerCalc = Boolean(profile.rules?.calculatePowerFromVoltageAndCurrent);

              return (
                <Card key={profile.id} className="flex flex-col justify-between hover:border-border/80 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-semibold">{profile.name}</CardTitle>
                        {profile.description && (
                          <CardDescription className="text-xs line-clamp-2">
                            {profile.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {isUniversal ? (
                          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs border border-emerald-500/20">
                            <CreditCard className="w-3 h-3 mr-1" />
                            Universal Single Card
                          </Badge>
                        ) : hasSolarMapping ? (
                          <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs border border-amber-500/20">
                            <Sun className="w-3 h-3 mr-1" />
                            Card Translation ({mappingsCount})
                          </Badge>
                        ) : null}
                        {hasIgnoreMeterStart && (
                          <Badge variant="outline" className="text-xs">
                            Ignore MeterStart
                          </Badge>
                        )}
                        {hasPowerCalc && (
                          <Badge variant="outline" className="text-xs">
                            Power Calc
                          </Badge>
                        )}
                      </div>

                      {isUniversal && universalId ? (
                        <div className="p-2.5 bg-muted/40 rounded-lg text-xs space-y-1 font-mono text-muted-foreground">
                          <div className="text-[10px] font-sans font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> All Cards Mapped To:
                          </div>
                          <div className="truncate flex items-center gap-1.5">
                            <span className="text-muted-foreground font-semibold">ALL Cards (*)</span>
                            <span>→</span>
                            <span className="text-emerald-500 font-semibold">{String(universalId)}</span>
                          </div>
                        </div>
                      ) : hasSolarMapping ? (
                        <div className="p-2.5 bg-muted/40 rounded-lg text-xs space-y-1 font-mono text-muted-foreground">
                          <div className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground/80">
                            Active Mappings:
                          </div>
                          {(() => {
                            const rawMap =
                              profile.rules?.cardIdMapping ||
                              profile.rules?.solarCardIdMapping ||
                              profile.rules?.idTagMapping;
                            if (rawMap && typeof rawMap === "object") {
                              return Object.entries(rawMap).slice(0, 2).map(([from, to], i) => (
                                <div key={i} className="truncate flex items-center gap-1.5">
                                  <span className="text-amber-500 font-semibold">{from}</span>
                                  <span>→</span>
                                  <span className="text-emerald-500 font-semibold">{String(to)}</span>
                                </div>
                              ));
                            }
                            return null;
                          })()}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button size="sm" variant="outline" onClick={() => handleOpenDialog(profile)} className="h-8 text-xs">
                        <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleExport(profile)} className="h-8 text-xs">
                        <Download className="w-3.5 h-3.5 mr-1" /> Export
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(profile.id)} className="h-8 text-xs">
                        <Trash className="w-3.5 h-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
