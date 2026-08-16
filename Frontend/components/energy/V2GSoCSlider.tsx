import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { Battery, BatteryCharging, Zap } from 'lucide-react';

export function V2GSoCSlider() {
  const [minSoc, setMinSoc] = useState<number>(40);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    // Fetch user's current V2G profile setting
    const fetchProfile = async () => {
      try {
        const response = await api.get('/energy-profile');
        const data = response.data;
        const threshold = data?.minSocThreshold ?? data?.data?.minSocThreshold;
        if (typeof threshold === 'number') {
          setMinSoc(threshold);
        }
      } catch (error) {
        logger.error('Failed to fetch energy profile', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await api.post('/energy-profile', { minSocThreshold: minSoc });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (error) {
      logger.error('Failed to save energy profile', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <Card className="animate-pulse h-48" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <CardTitle>Vehicle-to-Grid Settings</CardTitle>
        </div>
        <CardDescription>
          Set your minimum State of Charge (SoC). We will never discharge your vehicle below this limit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-between items-center text-sm font-medium">
          <span className="flex items-center gap-2"><Battery className="h-4 w-4 text-muted-foreground" /> 0%</span>
          <span className="text-xl font-bold text-primary">{minSoc}%</span>
          <span className="flex items-center gap-2"><BatteryCharging className="h-4 w-4 text-muted-foreground" /> 100%</span>
        </div>

        <Slider
          value={[minSoc]}
          onValueChange={(val) => setMinSoc(val[0])}
          max={100}
          min={0}
          step={1}
          className="w-full"
        />

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : savedSuccess ? "Saved!" : "Save Preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
