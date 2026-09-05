import { Send, Star, Rocket, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-shadcn';
import { Separator } from '@/components/ui/separator';
import ReviewTrendChart from '@/components/dashboard/ReviewTrendChart';

function StatTile({ icon: Icon, label, value, tone = 'default' }) {
  const tones = {
    default: 'text-foreground',
    accent: 'text-primary',
    ok: 'text-green-600',
  };

  return (
    <Card className="border-border/80 shadow-none">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-xl font-semibold tracking-tight ${tones[tone] || tones.default}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardDemo({ stats, weeks, unreadReviews = 0, onRefresh, businessName }) {
  const hasData = (weeks || []).some((w) => (w.positive || 0) + (w.negative || 0) + (w.count || 0) > 0);

  return (
    <div className="w-full max-w-4xl rounded-xl border border-border/80 bg-background/95 p-4 shadow-lg backdrop-blur-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live dashboard</p>
          <h3 className="text-sm font-semibold text-foreground">{businessName || 'Your business'}</h3>
        </div>
        <Badge variant="secondary" appearance="light" className="rounded-full">
          {hasData ? 'Updated just now' : 'Waiting for data'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Send} label="Requests sent" value={stats?.totalSent ?? 0} tone="accent" />
        <StatTile icon={Star} label="Reviews received" value={stats?.totalReceived ?? 0} />
        <StatTile icon={Rocket} label="Conversion" value={`${stats?.conversionRate ?? 0}%`} tone="ok" />
        <StatTile icon={Users} label="Unread reviews" value={unreadReviews} />
      </div>

      <Separator className="my-4" />

      <ReviewTrendChart weeks={weeks} onRefresh={onRefresh} compact />
    </div>
  );
}
