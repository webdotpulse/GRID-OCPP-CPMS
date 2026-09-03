"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { RfidForm } from "@/components/rfid/RfidForm";
import { api } from "@/lib/api";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function EditRfidPage() {
  const { id } = useParams();
  const [initialData, setInitialData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTag = async () => {
      try {
        const response = await api.get(`/rfid/${id}`);
        setInitialData(response.data);
      } catch (error) {
        logger.error("Failed to fetch RFID tag", error);
        alert("Failed to load tag.");
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchTag();
  }, [id]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="mb-6 space-y-4">
          <Link href={`/rfid/${id}`}>
            <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Tag Details
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit RFID Tag</h1>
            <p className="text-muted-foreground">Update holder information or authorization level.</p>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-8">Loading...</div>
        ) : initialData ? (
          <RfidForm initialData={initialData} />
        ) : (
          <div className="text-red-500">Failed to load tag data.</div>
        )}
      </div>
    </AppShell>
  );
}
