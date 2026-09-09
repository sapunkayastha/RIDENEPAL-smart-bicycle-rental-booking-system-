import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Wallet,
  CalendarDays,
  TrendingUp,
  Bike as BikeIcon,
  Package,
  PackageOpen,
  PackageX,
  Loader2,
} from "lucide-react";
import { getMyVendorAnalytics } from "@/lib/vendor.functions";

export const Route = createFileRoute("/_authenticated/vendor-analytics")({
  component: VendorAnalytics,
  head: () => ({ meta: [{ title: "Earnings & Inventory — RIDENEPAL" }] }),
});

type Analytics = {
  periods: {
    today: { revenue: number; bookings: number };
    thisWeek: { revenue: number; bookings: number };
    thisMonth: { revenue: number; bookings: number };
    thisYear: { revenue: number; bookings: number };
    allTime: { revenue: number; bookings: number };
  };
  dailySeries: { date: string; revenue: number }[];
  monthlySeries: { month: string; revenue: number }[];
  bikeBreakdown: {
    id: string;
    name: string;
    stock_quantity: number;
    available_stock: number;
    revenue: number;
    booking_count: number;
  }[];
  inventory: {
    bike_count: number;
    total_units: number;
    available_units: number;
    rented_units: number;
    out_of_stock_bikes: number;
  };
  bulkRentAllTimeRevenue: number;
};

function fmt(n: number) {
  return `NPR ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function VendorAnalytics() {
  const fetchAnalytics = useServerFn(getMyVendorAnalytics);
  const { data, isLoading } = useQuery({
    queryKey: ["vendor-analytics"],
    queryFn: () => fetchAnalytics() as Promise<Analytics>,
  });

  return (
    <div className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <Link
          to="/vendor-dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="size-3.5" /> Back to Vendor Dashboard
        </Link>

        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="size-5 text-primary" />
          <h1 className="text-3xl font-bold">Earnings & Inventory</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Track how much you've earned — today, this week, this month, this year — and how your bike
          stock is moving.
        </p>

        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Loading your analytics…
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {[
                { label: "Today", data: data.periods.today },
                { label: "This Week", data: data.periods.thisWeek },
                { label: "This Month", data: data.periods.thisMonth },
                { label: "This Year", data: data.periods.thisYear },
                { label: "All Time", data: data.periods.allTime },
              ].map((p) => (
                <Card key={p.label} className="p-4 border-0 shadow-sm">
                  <div className="text-xs text-muted-foreground">{p.label}</div>
                  <div className="text-xl font-bold text-primary mt-1">{fmt(p.data.revenue)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {p.data.bookings} order{p.data.bookings === 1 ? "" : "s"}
                  </div>
                </Card>
              ))}
            </div>

            {data.bulkRentAllTimeRevenue > 0 && (
              <Card className="p-4 border-0 shadow-sm mb-8 flex items-center gap-3 bg-blue-50">
                <Wallet className="size-5 text-blue-700 shrink-0" />
                <div className="text-sm text-blue-900">
                  Of your all-time earnings, <strong>{fmt(data.bulkRentAllTimeRevenue)}</strong>{" "}
                  came from confirmed bulk rent bookings.
                </div>
              </Card>
            )}

            <Card className="p-6 border-0 shadow-sm mb-8">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="size-4 text-primary" />
                <h2 className="font-semibold text-sm">Revenue Trend</h2>
              </div>
              <Tabs defaultValue="daily">
                <TabsList>
                  <TabsTrigger value="daily">Last 30 Days</TabsTrigger>
                  <TabsTrigger value="monthly">Last 12 Months</TabsTrigger>
                </TabsList>
                <TabsContent value="daily">
                  <div className="h-64 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.dailySeries}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) =>
                            new Date(d).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })
                          }
                          fontSize={11}
                          interval={4}
                        />
                        <YAxis fontSize={11} width={70} tickFormatter={(v) => fmt(v)} />
                        <Tooltip
                          formatter={(v: number) => fmt(v)}
                          labelFormatter={(d) => new Date(d).toLocaleDateString()}
                        />
                        <Bar dataKey="revenue" fill="#16a34a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
                <TabsContent value="monthly">
                  <div className="h-64 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.monthlySeries}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" fontSize={11} />
                        <YAxis fontSize={11} width={70} tickFormatter={(v) => fmt(v)} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Bar dataKey="revenue" fill="#16a34a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="p-4 border-0 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <BikeIcon className="size-3.5" /> Bike Models
                </div>
                <div className="text-xl font-bold">{data.inventory.bike_count}</div>
              </Card>
              <Card className="p-4 border-0 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Package className="size-3.5" /> Total Units
                </div>
                <div className="text-xl font-bold">{data.inventory.total_units}</div>
              </Card>
              <Card className="p-4 border-0 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <PackageOpen className="size-3.5 text-green-600" /> Available Now
                </div>
                <div className="text-xl font-bold text-green-700">
                  {data.inventory.available_units}
                </div>
              </Card>
              <Card className="p-4 border-0 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <PackageX className="size-3.5 text-destructive" /> Out on Rent
                </div>
                <div className="text-xl font-bold">{data.inventory.rented_units}</div>
              </Card>
            </div>
            {data.inventory.out_of_stock_bikes > 0 && (
              <Card className="p-4 border-0 shadow-sm mb-8 bg-red-50 flex items-center gap-2">
                <PackageX className="size-4 text-destructive shrink-0" />
                <p className="text-sm text-red-800">
                  {data.inventory.out_of_stock_bikes} bike model
                  {data.inventory.out_of_stock_bikes === 1 ? " is" : "s are"} completely out of
                  stock right now — customers can't book them until units free up or you add more.
                </p>
              </Card>
            )}

            <Card className="p-6 border-0 shadow-sm">
              <h2 className="font-semibold text-sm mb-4">Revenue by Bike</h2>
              {data.bikeBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bikes listed yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.bikeBreakdown.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-3 pb-3 border-b last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{b.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {b.booking_count} booking{b.booking_count === 1 ? "" : "s"} ·{" "}
                          {b.available_stock} of {b.stock_quantity} in stock
                          {b.available_stock <= 0 && (
                            <span className="text-destructive font-medium"> · Out of stock</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold text-primary">{fmt(b.revenue)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
