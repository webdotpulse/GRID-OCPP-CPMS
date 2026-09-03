"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Edit, CreditCard, Globe, Building2, User } from "lucide-react";
import { RfidSessionHistory } from "@/components/rfid/RfidSessionHistory";
import { GoogleWalletModal } from "@/components/rfid/GoogleWalletModal";

export default function RfidDetailPage() {
  const { id } = useParams();
  const [tag, setTag] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  useEffect(() => {
    const fetchTag = async () => {
      try {
        const response = await api.get(`/rfid/${id}`);
        setTag(response.data?.data || response.data);
      } catch (error) {
        logger.error("Failed to fetch RFID details", error);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchTag();
  }, [id]);

  if (isLoading) return <AppShell><div className="p-8">Loading tag details...</div></AppShell>;
  if (!tag) return <AppShell><div className="p-8 text-red-500">Tag not found</div></AppShell>;

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-4">
          <Link href="/rfid">
            <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to RFID Tags
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2 rounded-lg">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-3xl font-bold tracking-tight font-mono">{tag.rfid_tag}</h1>
              {tag.external_id && (
                <span className="text-sm text-muted-foreground">Ext ID: {tag.external_id}</span>
              )}
            </div>
            <Badge variant="outline" className={tag.active ? 'text-green-500 bg-green-500/10' : 'bg-muted'}>
              {tag.active ? 'AUTHORIZED' : 'BLOCKED'}
            </Badge>
            {tag.cardScope?.toLowerCase() === 'local' ? (
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 gap-1.5 px-3 py-1 text-xs font-bold">
                <Building2 className="size-3.5" /> LOCAL ONLY
              </Badge>
            ) : (
              <Badge className="bg-[#54a8c7]/20 text-[#54a8c7] border-[#54a8c7]/30 gap-1.5 px-3 py-1 text-xs font-bold">
                <Globe className="size-3.5" /> ROAMING
              </Badge>
            )}
          </div>
          {(() => {
            const assignedHolder = tag.holderCompany?.name || tag.holderUser?.name || tag.holderUser?.email || (tag.name && tag.name !== 'Unassigned' ? tag.name : 'Unassigned');
            return <p className="text-muted-foreground">Assigned Holder: <span className="font-semibold text-foreground">{assignedHolder}</span></p>;
          })()}
        </div>
        <div className="flex items-center gap-2">
          {/* Apple Wallet Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
              const query = token ? `?token=${encodeURIComponent(token)}` : "";
              window.open(`/api/rfid/${tag.rfid_user_id}/apple-wallet${query}`, '_blank');
            }}
            className="rounded-xl border-border/80 hover:bg-muted/80 gap-1.5 text-xs font-semibold"
          >
            <span>🍏</span> Apple Wallet
          </Button>

          {/* Google Wallet Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsWalletModalOpen(true)}
            className="rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 gap-1.5 text-xs font-semibold"
          >
            <span>💳</span> Google Wallet
          </Button>

          <Link href={`/rfid/${id}/edit`}>
            <Button className="rounded-xl">
              <Edit className="mr-2 h-4 w-4" /> Edit Tag
            </Button>
          </Link>
        </div>
      </div>

      {/* Connected Entities Section */}
      <Card className="mb-6">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="size-4 text-[#54a8c7]" /> Connected Entities
          </CardTitle>
          <CardDescription>
            Cardholder identity, RFID card asset ownership, and session transaction settlement payer.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. The Holder */}
            <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">The Holder</p>
                {tag.holderCompany ? (
                  <Badge variant="outline" className="bg-[#54a8c7]/15 text-[#54a8c7] border-[#54a8c7]/30 text-[10px] font-bold">
                    <Building2 className="size-3 mr-1" /> Company
                  </Badge>
                ) : tag.holderUser ? (
                  <Badge variant="outline" className="bg-[#3f78e0]/15 text-[#3f78e0] border-[#3f78e0]/30 text-[10px] font-bold">
                    <User className="size-3 mr-1" /> User
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground border-border/60 text-[10px]">
                    Cardholder
                  </Badge>
                )}
              </div>
              {tag.holderCompany ? (
                <div>
                  <p className="font-bold text-foreground text-sm">{tag.holderCompany.name}</p>
                  {tag.holderCompany.clientNumber && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">Account: {tag.holderCompany.clientNumber}</p>
                  )}
                </div>
              ) : tag.holderUser ? (
                <div>
                  <p className="font-bold text-foreground text-sm">{tag.holderUser.name || tag.holderUser.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tag.holderUser.email}</p>
                </div>
              ) : (
                <div>
                  <p className="font-bold text-foreground text-sm">{tag.name && tag.name !== 'Unassigned' ? tag.name : 'Unassigned'}</p>
                </div>
              )}
            </div>

            {/* 2. The Owner */}
            <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">The Owner</p>
                {tag.ownerType === 'company' && tag.ownerCompany ? (
                  <Badge variant="outline" className="bg-[#54a8c7]/15 text-[#54a8c7] border-[#54a8c7]/30 text-[10px] font-bold">
                    <Building2 className="size-3 mr-1" /> Company
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-[#3f78e0]/15 text-[#3f78e0] border-[#3f78e0]/30 text-[10px] font-bold">
                    <User className="size-3 mr-1" /> User
                  </Badge>
                )}
              </div>
              {tag.ownerType === 'company' && tag.ownerCompany ? (
                <div>
                  <p className="font-bold text-foreground text-sm">{tag.ownerCompany.name}</p>
                  {tag.ownerCompany.clientNumber && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">Account ID: {tag.ownerCompany.clientNumber}</p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="font-bold text-foreground text-sm">{tag.owner?.name || tag.owner?.email || 'Individual Owner'}</p>
                  {tag.owner?.email && (
                    <p className="text-xs text-muted-foreground mt-0.5">{tag.owner.email}</p>
                  )}
                </div>
              )}
            </div>

            {/* 3. The Payer of the Transactions */}
            <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">The Payer of Transactions</p>
                {tag.transactionPayerCompany ? (
                  <Badge variant="outline" className="bg-[#54a8c7]/15 text-[#54a8c7] border-[#54a8c7]/30 text-[10px] font-bold">
                    <Building2 className="size-3 mr-1" /> Company
                  </Badge>
                ) : tag.transactionPayerUser ? (
                  <Badge variant="outline" className="bg-[#3f78e0]/15 text-[#3f78e0] border-[#3f78e0]/30 text-[10px] font-bold">
                    <User className="size-3 mr-1" /> User
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground border-border/60 text-[10px]">
                    Inherit Owner
                  </Badge>
                )}
              </div>
              {tag.transactionPayerCompany ? (
                <div>
                  <p className="font-bold text-foreground text-sm">{tag.transactionPayerCompany.name}</p>
                  {tag.transactionPayerCompany.clientNumber && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">Account: {tag.transactionPayerCompany.clientNumber}</p>
                  )}
                </div>
              ) : tag.transactionPayerUser ? (
                <div>
                  <p className="font-bold text-foreground text-sm">{tag.transactionPayerUser.name || tag.transactionPayerUser.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tag.transactionPayerUser.email}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Settled by the RFID card owner by default.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Card Specifications</CardTitle>
            <CardDescription>Authentication parameters & scope</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <span className="text-muted-foreground">Tag UID</span>
                <span className="font-mono font-bold">{tag.rfid_tag}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <span className="text-muted-foreground">External ID</span>
                <span className="font-mono text-xs">{tag.external_id || "None"}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <span className="text-muted-foreground">Account Type</span>
                <Badge variant="secondary" className="capitalize">{tag.type}</Badge>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <span className="text-muted-foreground">Authorization Scope</span>
                <Badge variant="outline" className="capitalize font-semibold">
                  {tag.cardScope || "Roaming"}
                </Badge>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <span className="text-muted-foreground">Registered Date</span>
                <span className="text-xs text-muted-foreground">{new Date(tag.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Charging History</CardTitle>
            <CardDescription>Recent sessions authenticated with this tag</CardDescription>
          </CardHeader>
          <CardContent>
            <RfidSessionHistory rfidUserId={tag.rfid_user_id} />
          </CardContent>
        </Card>
      </div>

      {/* Google Wallet Modal */}
      <GoogleWalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        rfidUserId={tag?.rfid_user_id || null}
        rfidTag={tag?.rfid_tag}
        cardholderName={tag.holderCompany?.name || tag.holderUser?.name || tag.holderUser?.email || (tag.name && tag.name !== 'Unassigned' ? tag.name : undefined)}
      />
    </AppShell>
  );
}
