import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listPendingVendors, approveVendor, rejectVendor } from "@/lib/vendor.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/vendors")({
  component: VendorApprovals,
  head: () => ({ meta: [{ title: "Vendor Approvals — RIDENEPAL" }] }),
});

type PendingVendor = {
  user_id: string;
  email: string;
  full_name: string | null;
  business_name: string;
  pan_number: string;
  vat_number: string | null;
  id_document: string | null;
};

function VendorApprovals() {
  const fetchPending = useServerFn(listPendingVendors);
  const approve = useServerFn(approveVendor);
  const reject = useServerFn(rejectVendor);
  const qc = useQueryClient();
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [zoomedDoc, setZoomedDoc] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pending-vendors"],
    queryFn: () => fetchPending() as Promise<PendingVendor[]>,
  });

  const approveMutation = useMutation({
    mutationFn: (userId: string) => approve({ data: { userId } }),
    onSuccess: () => {
      toast.success("Vendor approved");
      qc.invalidateQueries({ queryKey: ["pending-vendors"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rejectMutation = useMutation({
    mutationFn: (vars: { userId: string; reason: string }) => reject({ data: vars }),
    onSuccess: () => {
      toast.success("Vendor rejected");
      setReasonFor(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["pending-vendors"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-6">Pending Vendor Applications</h1>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        <div className="space-y-4">
          {data?.map((v) => (
            <Card key={v.user_id} className="p-5 border-0 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  {v.id_document && (
                    <img
                      src={v.id_document}
                      alt="Submitted ID"
                      onClick={() => setZoomedDoc(v.id_document)}
                      className="w-28 h-20 rounded-md object-cover border shrink-0 cursor-zoom-in"
                    />
                  )}
                  <div>
                    <div className="font-semibold">{v.business_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {v.full_name} · {v.email}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      PAN {v.pan_number}
                      {v.vat_number ? ` · VAT ${v.vat_number}` : ""}
                    </div>
                    {!v.id_document && (
                      <div className="text-xs text-red-600 mt-1">No ID document submitted</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(v.user_id)}
                  >
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setReasonFor(v.user_id)}>
                    Reject
                  </Button>
                </div>
              </div>
              {reasonFor === v.user_id && (
                <div className="mt-3 flex gap-2">
                  <input
                    className="flex-1 border rounded-md h-9 px-2 text-sm"
                    placeholder="Reason for rejection"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={rejectMutation.isPending || !reason.trim()}
                    onClick={() => rejectMutation.mutate({ userId: v.user_id, reason })}
                  >
                    Confirm
                  </Button>
                </div>
              )}
            </Card>
          ))}
          {data?.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">No pending applications.</p>
          )}
        </div>
      </main>

      {zoomedDoc && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50 cursor-zoom-out"
          onClick={() => setZoomedDoc(null)}
        >
          <img
            src={zoomedDoc}
            alt="Submitted ID, full size"
            className="max-w-full max-h-full rounded-md"
          />
        </div>
      )}
    </div>
  );
}
