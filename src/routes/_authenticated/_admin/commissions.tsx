import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getCommissionRate,
  setCommissionRate,
  getCommissionSummary,
  listVendorsForFilter,
} from "@/lib/commission.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/commissions")({
  component: Commissions,
  head: () => ({ meta: [{ title: "Commissions — RIDENEPAL" }] }),
});

type BookingRow = {
  id: string;
  total_amount: number;
  platform_commission: number;
  vendor_payout: number;
  created_at: string;
  bike_name: string;
  vendor_id: string | null;
  vendor_name: string | null;
};

function Commissions() {
  const fetchRate = useServerFn(getCommissionRate);
  const saveRate = useServerFn(setCommissionRate);
  const fetchSummary = useServerFn(getCommissionSummary);
  const fetchVendors = useServerFn(listVendorsForFilter);
  const qc = useQueryClient();
  const [rateInput, setRateInput] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");

  const { data: rateData } = useQuery({
    queryKey: ["commission-rate"],
    queryFn: () => fetchRate(),
  });

  const { data: vendors } = useQuery({
    queryKey: ["commission-vendor-list"],
    queryFn: () => fetchVendors() as Promise<{ vendorId: string; businessName: string }[]>,
  });

  const { data: summary, isLoading } = useQuery({
    queryKey: ["commission-summary", vendorFilter],
    queryFn: () =>
      fetchSummary({ data: vendorFilter ? { vendorId: vendorFilter } : undefined }) as Promise<{
        totals: { total_commission: number; total_payouts: number; paid_bookings: number };
        bookings: BookingRow[];
      }>,
  });

  const rateMutation = useMutation({
    mutationFn: (rate: number) => saveRate({ data: { rate } }),
    onSuccess: () => {
      toast.success("Commission rate updated");
      qc.invalidateQueries({ queryKey: ["commission-rate"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update rate"),
  });

  const currentRate = rateData?.rate ?? 15;

  return (
    <div className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-2xl font-bold">Commissions</h1>

        <Card className="p-5 border-0 shadow-sm flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Current commission rate</div>
            <div className="text-2xl font-bold text-primary">{currentRate}%</div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              placeholder={`${currentRate}`}
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              className="w-28"
            />
            <Button
              className="bg-primary hover:bg-primary/90"
              disabled={rateMutation.isPending || !rateInput}
              onClick={() => rateMutation.mutate(Number(rateInput))}
            >
              Update
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5 border-0 shadow-sm">
            <div className="text-xs text-muted-foreground">
              {vendorFilter ? "Commission from this vendor" : "Total commission earned"}
            </div>
            <div className="text-2xl font-bold text-primary mt-1">
              NPR {Number(summary?.totals.total_commission ?? 0).toFixed(0)}
            </div>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <div className="text-xs text-muted-foreground">
              {vendorFilter ? "Paid out to this vendor" : "Total paid out to vendors"}
            </div>
            <div className="text-2xl font-bold mt-1">
              NPR {Number(summary?.totals.total_payouts ?? 0).toFixed(0)}
            </div>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <div className="text-xs text-muted-foreground">Paid bookings</div>
            <div className="text-2xl font-bold mt-1">{summary?.totals.paid_bookings ?? 0}</div>
          </Card>
        </div>

        <Card className="p-5 border-0 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h2 className="font-semibold text-sm">
              {vendorFilter ? "Bookings for this vendor" : "Recent paid bookings"}
            </h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Filter by vendor</label>
              <select
                className="border rounded-md text-sm px-2 py-1.5 bg-background"
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
              >
                <option value="">All vendors</option>
                {vendors?.map((v) => (
                  <option key={v.vendorId} value={v.vendorId}>
                    {v.businessName}
                  </option>
                ))}
              </select>
              {vendorFilter && (
                <Button size="sm" variant="outline" onClick={() => setVendorFilter("")}>
                  Clear
                </Button>
              )}
            </div>
          </div>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-4">Bike</th>
                  <th className="py-2 pr-4">Vendor</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                  <th className="py-2 pr-4 text-right">Your cut</th>
                  <th className="py-2 pr-4 text-right">Vendor payout</th>
                </tr>
              </thead>
              <tbody>
                {summary?.bookings.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{b.bike_name}</td>
                    <td className="py-2 pr-4">
                      {b.vendor_id ? (
                        <Link
                          to="/vendor-detail/$vendorId"
                          params={{ vendorId: b.vendor_id }}
                          className="text-primary hover:underline"
                        >
                          {b.vendor_name ?? "View vendor"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Managing Admin</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      NPR {Number(b.total_amount).toFixed(0)}
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold text-primary">
                      NPR {Number(b.platform_commission).toFixed(0)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      NPR {Number(b.vendor_payout).toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {summary?.bookings.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground py-4">
                {vendorFilter ? "No bookings for this vendor yet." : "No paid bookings yet."}
              </p>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
