"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { TariffForm } from "@/components/tariffs/TariffForm";
import { api } from "@/lib/api";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function EditTariffPage() {
  const { id } = useParams();
  const [initialData, setInitialData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTariff = async () => {
      try {
        const response = await api.get(`/tariffs/${id}`);
        setInitialData(response.data);
      } catch (error) {
        logger.error("Failed to fetch tariff", error);
        alert("Failed to load tariff data.");
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchTariff();
  }, [id]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="mb-6 space-y-4">
          <Link href="/tariffs">
            <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Tariffs
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Tariff Plan</h1>
            <p className="text-muted-foreground">Update pricing metrics for this tariff structure.</p>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-8">Loading...</div>
        ) : initialData ? (
          <TariffForm initialData={initialData} />
        ) : (
          <div className="text-red-500">Failed to load tariff data.</div>
        )}
      </div>
    </AppShell>
  );
}
