"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import {
  CreditCard,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Download,
  Radio,
  Zap,
  ShieldCheck,
  Building2,
  Globe,
  Loader2,
  Smartphone,
} from "lucide-react";

interface GoogleWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  rfidUserId: number | null;
  rfidTag?: string;
  cardholderName?: string;
}

export function GoogleWalletModal({
  isOpen,
  onClose,
  rfidUserId,
  rfidTag: initialTag,
  cardholderName: initialName,
}: GoogleWalletModalProps) {
  const [loading, setLoading] = useState(false);
  const [passData, setPassData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && rfidUserId) {
      setLoading(true);
      setPassData(null);
      setCopied(false);

      api
        .get(`/rfid/${rfidUserId}/google-wallet`)
        .then((res) => {
          if (res.data?.success && res.data?.data) {
            setPassData(res.data.data);
          } else {
            setPassData(res.data);
          }
        })
        .catch((err) => {
          logger.error("Failed to load Google Wallet pass details", err);
          toast.error("Failed to load Google Wallet pass details");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, rfidUserId]);

  const handleCopyLink = () => {
    if (!passData?.saveUrl) return;
    navigator.clipboard.writeText(passData.saveUrl);
    setCopied(true);
    toast.success("Google Wallet pass URL copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenGoogleWallet = () => {
    if (passData?.saveUrl) {
      window.open(passData.saveUrl, "_blank", "noopener,noreferrer");
      toast.success("Opening Google Wallet...");
    }
  };

  const handleDownloadApplePass = () => {
    if (rfidUserId) {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const query = token ? `?token=${encodeURIComponent(token)}` : "";
      window.open(`/api/rfid/${rfidUserId}/apple-wallet${query}`, "_blank");
    }
  };

  const displayTag = passData?.rfidTag || initialTag || "—";
  const displayName = passData?.name || initialName || "EV Driver";
  const displayScope = passData?.cardScope || "Roaming";
  const displayCompany = passData?.companyName || "GRID Open CPMS";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-6 rounded-3xl bg-[#16191e] border border-white/10 text-white shadow-2xl">
        <DialogHeader className="text-left space-y-1.5 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
              💳
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Google Wallet & NFC Pass
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-400">
                Contactless RFID authorization for physical EV charging stations.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
            <Loader2 className="size-8 animate-spin text-[#54a8c7]" />
            <p className="text-xs">Generating encrypted digital pass...</p>
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* Digital Card Mockup */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e2228] via-[#232832] to-[#1a1d24] p-5 border border-white/15 shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#54a8c7]/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              {/* Card Header */}
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-white/10 flex items-center justify-center">
                    <Zap className="size-4 text-[#54a8c7]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">GRID CPMS</h4>
                    <p className="text-[10px] text-gray-400 font-medium">{displayCompany}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Radio className="size-4 text-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">NFC ACTIVE</span>
                </div>
              </div>

              {/* Card Body */}
              <div className="my-5 space-y-1 relative z-10">
                <div className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Cardholder</div>
                <div className="text-base font-bold text-white tracking-wide truncate">{displayName}</div>
                <div className="font-mono text-sm tracking-widest text-[#54a8c7] pt-1">{displayTag}</div>
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10 relative z-10 text-[11px]">
                <div className="flex items-center gap-1.5">
                  {displayScope?.toLowerCase() === "local" ? (
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px] px-2 py-0.5">
                      <Building2 className="size-3 mr-1" /> Local
                    </Badge>
                  ) : (
                    <Badge className="bg-[#54a8c7]/20 text-[#54a8c7] border-[#54a8c7]/30 text-[10px] px-2 py-0.5">
                      <Globe className="size-3 mr-1" /> Roaming
                    </Badge>
                  )}
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-2 py-0.5">
                    <ShieldCheck className="size-3 mr-1" /> Authorized
                  </Badge>
                </div>
                <div className="text-gray-400 font-mono text-[10px]">SmartTap 2.0</div>
              </div>
            </div>

            {/* QR Code Phone Scanner Section */}
            {passData?.qrCodeDataUrl && (
              <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/40 border border-white/10 text-center space-y-2">
                <div className="p-2 bg-white rounded-xl shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={passData.qrCodeDataUrl}
                    alt={`QR Pass for ${displayTag}`}
                    className="size-36 object-contain"
                  />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-white flex items-center justify-center gap-1.5">
                    <Smartphone className="size-3.5 text-[#54a8c7]" /> Scan with Android Camera
                  </p>
                  <p className="text-[11px] text-gray-400 max-w-xs">
                    Point your mobile phone camera at this QR code to instantly import the pass or authorize charging.
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5">
              {/* Save to Google Wallet Direct Button */}
              <Button
                onClick={handleOpenGoogleWallet}
                className="w-full h-11 rounded-xl bg-black hover:bg-gray-900 border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <span className="text-base">💳</span>
                <span>Save to Google Wallet</span>
                <ExternalLink className="size-3.5 text-gray-400 ml-1" />
              </Button>

              <div className="grid grid-cols-2 gap-2">
                {/* Copy Link */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs h-9"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-emerald-400 mr-1.5" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5 text-gray-400 mr-1.5" />
                      <span>Copy Pass URL</span>
                    </>
                  )}
                </Button>

                {/* Download Apple Wallet pass */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadApplePass}
                  className="rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs h-9"
                >
                  <Download className="size-3.5 text-gray-400 mr-1.5" />
                  <span>Apple .pkpass</span>
                </Button>
              </div>
            </div>

            {/* Instruction Footer */}
            <div className="rounded-xl bg-white/5 p-3 border border-white/5 space-y-1.5 text-[11px] text-gray-300">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Radio className="size-3.5 text-[#54a8c7]" /> Contactless Charging (NFC SmartTap)
              </div>
              <p className="text-gray-400 leading-relaxed">
                Hold your unlocked phone against the RFID reader symbol on the charger. The encrypted token ({displayTag}) will authorize the session instantly.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
