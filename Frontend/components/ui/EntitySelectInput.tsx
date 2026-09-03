"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Building2 } from "lucide-react";

export interface EntityUser {
  id: number;
  email: string;
  name?: string | null;
  role?: string;
  companyName?: string | null;
}

export interface EntityCompany {
  id: number;
  name: string;
  clientNumber?: string | null;
  city?: string | null;
}

interface EntitySelectInputProps {
  id: string;
  label: string;
  description?: string;
  entityType: "user" | "company";
  onEntityTypeChange: (type: "user" | "company") => void;
  selectedUserId?: number | null;
  onUserChange: (userId: number | null) => void;
  selectedCompanyId?: number | null;
  onCompanyChange: (companyId: number | null) => void;
  usersList: EntityUser[];
  companiesList: EntityCompany[];
  allowUnassigned?: boolean;
  unassignedLabel?: string;
  disabled?: boolean;
}

export function EntitySelectInput({
  id,
  label,
  description,
  entityType,
  onEntityTypeChange,
  selectedUserId,
  onUserChange,
  selectedCompanyId,
  onCompanyChange,
  usersList,
  companiesList,
  allowUnassigned = false,
  unassignedLabel = "Not assigned (Inherit owner)",
  disabled = false,
}: EntitySelectInputProps) {
  const isCompany = entityType === "company";

  return (
    <div className="space-y-2 p-3.5 rounded-xl border border-border/60 bg-muted/15 transition-all hover:border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <Label htmlFor={id} className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
            {isCompany ? (
              <Building2 className="size-4 text-[#54a8c7]" />
            ) : (
              <User className="size-4 text-[#3f78e0]" />
            )}
            <span>{label}</span>
          </Label>
          {description && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>

        {/* Entity Type Toggle: User vs Company */}
        <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/50 text-xs self-start sm:self-auto">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onEntityTypeChange("user")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
              !isCompany
                ? "bg-background text-foreground shadow-xs border border-border/40 font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="size-3 text-[#3f78e0]" />
            <span>User</span>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onEntityTypeChange("company")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
              isCompany
                ? "bg-background text-foreground shadow-xs border border-border/40 font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="size-3 text-[#54a8c7]" />
            <span>Company</span>
          </button>
        </div>
      </div>

      {/* Selector Dropdown */}
      <div className="pt-1">
        {!isCompany ? (
          <Select
            value={selectedUserId ? selectedUserId.toString() : allowUnassigned ? "none" : ""}
            onValueChange={(val) => onUserChange(val === "none" ? null : parseInt(val, 10))}
            disabled={disabled}
          >
            <SelectTrigger id={id} className="h-9.5 bg-background border-border/60">
              <SelectValue placeholder="Select an individual user..." />
            </SelectTrigger>
            <SelectContent>
              {allowUnassigned && (
                <SelectItem value="none">
                  <span className="text-muted-foreground italic">{unassignedLabel}</span>
                </SelectItem>
              )}
              {usersList.map((u) => (
                <SelectItem key={u.id} value={u.id.toString()}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {u.name ? `${u.name} (${u.email})` : u.email}
                    </span>
                    {u.role && (
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {u.role}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={selectedCompanyId ? selectedCompanyId.toString() : allowUnassigned ? "none" : ""}
            onValueChange={(val) => onCompanyChange(val === "none" ? null : parseInt(val, 10))}
            disabled={disabled}
          >
            <SelectTrigger id={id} className="h-9.5 bg-background border-border/60">
              <SelectValue placeholder="Select a corporate company..." />
            </SelectTrigger>
            <SelectContent>
              {allowUnassigned && (
                <SelectItem value="none">
                  <span className="text-muted-foreground italic">{unassignedLabel}</span>
                </SelectItem>
              )}
              {companiesList.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{c.name}</span>
                    {c.clientNumber && (
                      <span className="text-[11px] font-mono text-muted-foreground">
                        [{c.clientNumber}]
                      </span>
                    )}
                    {c.city && (
                      <span className="text-[11px] text-muted-foreground">
                        — {c.city}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
