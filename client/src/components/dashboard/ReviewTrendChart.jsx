import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowDown, ArrowUp, Calendar, Download, Filter, MoreHorizontal, RefreshCw, Share2 } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts';

const chartConfig = {
  positive: {
    label: 'Positive',
    color: '#14b8a6',
  },
  negative: {
    label: 'Negative',
    color: '#ec4899',
  },
};

function buildChartData(weeks) {
  const rows = (weeks || []).slice(-12);
  if (rows.length === 0) {
    return Array.from({ length: 12 }, (_, i) => ({
      week: `W${i + 1}`,
      positive: 0,
      negative: 0,
      positiveArea: 0,
      total: 0,
    }));
  }
  return rows.map((w) => ({
    week: w.label,
    positive: w.positive || 0,
    negative: w.negative || 0,
    positiveArea: w.positive || 0,
    total: (w.positive || 0) + (w.negative || 0),
  }));
}

function ChartLabel({ label, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="size-3.5 rounded-full border-4 bg-background" style={{ borderColor: color }} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const filteredPayload = payload.filter((entry) => entry.dataKey !== 'positiveArea');
  const positiveEntry = filteredPayload.find((entry) => entry.dataKey === 'positive');
  const negativeEntry = filteredPayload.find((entry) => entry.dataKey === 'negative');
  const delta = positiveEntry && negativeEntry && negativeEntry.value > 0
    ? Math.round(((positiveEntry.value - negativeEntry.value) / negativeEntry.value) * 100)
    : null;

  return (
    <div className="rounded-lg border border-border bg-popover p-3 shadow-sm shadow-black/5 min-w-[180px]">
      <div className="text-xs font-medium text-muted-foreground tracking-wide mb-2.5">{label}</div>
      <div className="space-y-2">
        {filteredPayload.map((entry, index) => {
          const config = chartConfig[entry.dataKey];
          return (
            <div key={index} className="flex items-center gap-2 text-xs">
              <ChartLabel label={`${config?.label}:`} color={entry.color} />
              <span className="font-semibold text-popover-foreground">{entry.value}</span>
              {entry.dataKey === 'positive' && delta != null && (
                <Badge
                  variant={delta >= 0 ? 'success' : 'destructive'}
                  appearance="light"
                  className="text-xs flex items-center gap-1"
                >
                  {delta >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                  {Math.abs(delta)}%
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReviewTrendChart({ weeks, onRefresh, compact = false }) {
  const chartData = buildChartData(weeks);
  const currentWeek = chartData[chartData.length - 1]?.week;
  const totalPositive = chartData.reduce((sum, row) => sum + row.positive, 0);
  const totalNegative = chartData.reduce((sum, row) => sum + row.negative, 0);
  const maxValue = Math.max(1, ...chartData.map((row) => Math.max(row.positive, row.negative, row.total)));
  const chartHeight = compact ? 260 : 350;
  const hasAnyData = totalPositive + totalNegative > 0;

  return (
    <Card className={compact ? 'w-full border-0 bg-transparent shadow-none' : 'w-full border-border shadow-xs'}>
      <CardHeader className={compact ? 'border-0 px-0 pt-0 pb-3 min-h-auto' : 'border-0 min-h-auto pt-6 pb-4'}>
        <div>
          <CardTitle className={compact ? 'text-sm font-semibold' : 'text-base font-semibold'}>
            Positive vs negative · last 12 weeks
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {totalPositive} positive · {totalNegative} negative reactions
          </p>
        </div>
        {!compact && (
          <CardToolbar>
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <ChartLabel label="Positive (4★+)" color={chartConfig.positive.color} />
              <ChartLabel label="Negative (&lt;4★)" color={chartConfig.negative.color} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="dim" size="sm" mode="icon" className="-me-1.5" aria-label="Chart options">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom">
                <DropdownMenuItem onClick={() => onRefresh?.()}>
                  <RefreshCw className="size-4" />
                  Refresh data
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/analytics" className="flex items-center gap-2">
                    <Calendar className="size-4" />
                    Full analytics
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Download className="size-4" />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Filter className="size-4" />
                  Filter weeks
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <Share2 className="size-4" />
                  Share report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardToolbar>
        )}
      </CardHeader>

      <CardContent className={compact ? 'px-0 pb-0 pt-0' : 'px-2.5 pb-6 pt-0'}>
        {!hasAnyData ? (
          <div
            className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground"
            style={{ height: chartHeight }}
          >
            No review reactions yet — chart fills in after your first WhatsApp replies.
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="w-full [&_.recharts-curve.recharts-tooltip-cursor]:stroke-initial"
            style={{ height: chartHeight, minHeight: chartHeight }}
          >
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartConfig.positive.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={chartConfig.positive.color} stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="4 4"
                stroke="#ececf1"
                horizontal
                vertical={false}
              />

              <XAxis
                dataKey="week"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                dy={5}
                tickMargin={12}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                allowDecimals={false}
                domain={[0, maxValue + 1]}
                tickMargin={12}
                width={32}
              />

              {currentWeek && (
                <ReferenceLine x={currentWeek} stroke={chartConfig.positive.color} strokeWidth={1} />
              )}

              <ChartTooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#ececf1', strokeWidth: 1 }}
              />

              <Area
                type="monotone"
                dataKey="positiveArea"
                stroke="transparent"
                fill="url(#positiveGradient)"
                strokeWidth={0}
                dot={false}
                isAnimationActive={false}
              />

              <Line
                type="monotone"
                dataKey="positive"
                stroke={chartConfig.positive.color}
                strokeWidth={2}
                dot={{ fill: '#ffffff', strokeWidth: 2, r: 4, stroke: chartConfig.positive.color }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />

              <Line
                type="monotone"
                dataKey="negative"
                stroke={chartConfig.negative.color}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ fill: '#ffffff', strokeWidth: 2, r: 4, stroke: chartConfig.negative.color }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
