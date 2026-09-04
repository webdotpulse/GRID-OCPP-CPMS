"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface Channel {
  connector_id: number;
  connector_name?: string;
}

interface ActiveTxn {
  connectorName: string;
}

interface ManualSpeedOverridePanelProps {
  chargerId: number;
  connectors: Channel[];
  activeTxns: ActiveTxn[];
}

export function ManualSpeedOverridePanel({ chargerId, connectors, activeTxns }: ManualSpeedOverridePanelProps) {
  const [speedLimits, setSpeedLimits] = useState<Record<number, number>>({});
  const [isSettingProfile, setIsSettingProfile] = useState<Record<number, boolean>>({});

  const handleSetSpeedLimit = async (connectorId: number, limit: number, txn: ActiveTxn | undefined) => {
    setIsSettingProfile(prev => ({ ...prev, [connectorId]: true }));
    try {
      const payload = {
        chargerId,
        connectorId,
        csChargingProfiles: {
          chargingProfileId: Math.floor(Math.random() * 1000) + 1,
          stackLevel: 1,
          chargingProfilePurpose: txn ? "TxProfile" : "TxDefaultProfile",
          chargingProfileKind: "Relative",
          chargingSchedule: {
            chargingRateUnit: "A",
            chargingSchedulePeriod: [
              {
                startPeriod: 0,
                limit: limit,
              }
            ]
          }
        }
      };

      await api.post('/ocpp/set-charging-profile', payload);
      toast.success(`Speed limit set to ${limit}A for channel ${connectorId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to set charging profile");
    } finally {
      setIsSettingProfile(prev => ({ ...prev, [connectorId]: false }));
    }
  };

  const handleClearSpeedLimit = async (connectorId: number) => {
    setIsSettingProfile(prev => ({ ...prev, [connectorId]: true }));
    try {
      await api.post('/ocpp/clear-charging-profile', {
        chargerId,
        connectorId
      });
      setSpeedLimits(prev => {
        const newLimits = { ...prev };
        delete newLimits[connectorId];
        return newLimits;
      });
      toast.success(`Speed limit cleared for channel ${connectorId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to clear charging profile");
    } finally {
      setIsSettingProfile(prev => ({ ...prev, [connectorId]: false }));
    }
  };

  if (!connectors || connectors.length === 0) {
    return null;
  }

  return (
    <Card className="col-span-1 border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Manual Speed Override</CardTitle>
        </div>
        <CardDescription>
          Throttling the charging speed manually will temporarily override any smart load management configurations until cleared.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {connectors.map((conn) => {
          const activeTxn = activeTxns.find(t => {
            if (!t) return false;
            if (t.connectorName === String(conn.connector_id) || t.connectorName === conn.connector_name) return true;
            const tName = (t.connectorName || "").trim().toLowerCase();
            const cName = (conn.connector_name || "").trim().toLowerCase();
            if (tName && cName && tName === cName) return true;
            const tNum = tName.match(/\d+/)?.[0];
            const cNum = cName.match(/\d+/)?.[0];
            return Boolean(tNum && cNum && tNum === cNum);
          });
          return (
            <div key={conn.connector_id} className="rounded-md border bg-muted/20 p-4">
              <h4 className="font-medium text-sm mb-4">Channel {conn.connector_id} {conn.connector_name ? `(${conn.connector_name})` : ''}</h4>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="flex-1 w-full max-w-md space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Limit</span>
                    <span className="font-mono font-medium">{speedLimits[conn.connector_id] || 32} A</span>
                  </div>
                  <Slider
                    disabled={isSettingProfile[conn.connector_id]}
                    value={[speedLimits[conn.connector_id] || 32]}
                    min={6}
                    max={32}
                    step={1}
                    onValueChange={(val) => {
                      setSpeedLimits(prev => ({ ...prev, [conn.connector_id]: val[0] }));
                    }}
                    onValueCommit={(val) => {
                      handleSetSpeedLimit(conn.connector_id, val[0], activeTxn);
                    }}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>6A</span>
                    <span>32A</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleClearSpeedLimit(conn.connector_id)}
                  disabled={isSettingProfile[conn.connector_id]}
                >
                  {isSettingProfile[conn.connector_id] ? "Applying..." : "Auto / Clear Limit"}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
