"use client";

import { logger } from "@/lib/logger";
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { SafeResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import { Cpu, PieChart as PieIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

interface DistributionData {
  status: string;
  count: number;
}

const COLORS: Record<string, string> = {
  Available: '#45c4a0',   // SandBox Green
  Charging: '#54a8c7',    // SandBox Aqua
  Preparing: '#fab758',   // SandBox Yellow
  Finishing: '#747ed1',   // SandBox Purple
  Faulted: '#e2626b',     // SandBox Red
  Unavailable: '#60697b', // SandBox Gray
};

export function ConnectorDistribution() {
  const { t } = useTranslation();
  const [data, setData] = useState<DistributionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDistribution = async () => {
      try {
        const response = await api.get('/dashboard/distribution');
        const payload = response.data;
        if (payload?.distribution) {
          const chartData = Object.entries(payload.distribution).map(([status, details]: [string, any]) => ({
            status,
            count: details.count,
          }));
          setData(chartData);
        } else {
          setData([]);
        }
      } catch (error) {
        logger.error('Failed to fetch distribution metrics', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDistribution();
  }, []);

  const totalConnectors = data.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center">
              <PieIcon className="size-4" />
            </div>
            <CardTitle>{t('dashboard.connectorDistribution', 'Connector Distribution')}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            {totalConnectors} {t('chargers.connectors', 'Connectors')}
          </Badge>
        </div>
        <CardDescription>
          {t('dashboard.energyOverviewDesc', 'Real-time connector availability distribution')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center min-h-[280px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <div className="size-6 border-2 border-[#54a8c7] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs">Loading telemetry...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="text-xs text-muted-foreground">No connector data recorded</div>
        ) : (
          <div className="w-full h-[260px] min-w-0">
            <SafeResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="status"
                  strokeWidth={0}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[entry.status] || COLORS.Unavailable}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid rgba(164, 174, 198, 0.25)',
                    backgroundColor: 'var(--card)',
                    boxShadow: '0 8px 24px rgba(30, 34, 40, 0.12)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                  itemStyle={{ color: 'var(--foreground)' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span className="text-xs font-medium text-foreground">{value}</span>}
                />
              </PieChart>
            </SafeResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
