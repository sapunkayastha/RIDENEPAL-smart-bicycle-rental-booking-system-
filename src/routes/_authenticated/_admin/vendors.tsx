import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { MapPin, Mail, User, Hash, Calendar, Eye } from "lucide-react";
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
  location: string | null;
  pan_number: string;
  vat_number: string | null;
  id_document: string | null;
  created_at: string;
};

function VendorApprovals() {
  const fetchPending = useServerFn(listPendingVendors);
  const approve = useServerFn(approveVendor);
  const reject = useServerFn(rejectVendor);
  const qc = useQueryClient();
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [zoomedDoc, setZoomedDoc] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PendingVendor | null>(null);
  const [confirmApprove, setConfirmApprove] = useState<PendingVendor | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pending-vendors"],
    queryFn: () => fetchPending() as Promise<PendingVendor[]>,
  });

  const approveMutation = useMutation({
    mutationFn: (userId: string) => approve({ data: { userId } }),
    onSuccess: () => {
      toast.success("Vendor approved");
      setViewing(null);
      setConfirmApprove(null);
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
      setViewing(null);
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
                    {v.location && (
                      <div className="text-xs text-muted-foreground mt-0.5">📍 {v.location}</div>
                    )}
                    {!v.id_document && (
                      <div className="text-xs text-red-600 mt-1">No ID document submitted</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => setViewing(v)}
                  >
                    <Eye className="size-3.5" /> View Details
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                      disabled={approveMutation.isPending}
                      onClick={() => setConfirmApprove(v)}
                    >
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setReasonFor(v.user_id)}>
                      Reject
                    </Button>
                  </div>
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

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.business_name}</DialogTitle>
                <DialogDescription>
                  Vendor application — review the details below before approving or declining.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <User className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Applicant</div>
                      <div className="font-medium">{viewing.full_name ?? "—"}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Mail className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Email</div>
                      <div className="font-medium break-all">{viewing.email}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Shop / pickup location</div>
                      <div className="font-medium">{viewing.location ?? "Not provided"}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Applied on</div>
                      <div className="font-medium">
                        {new Date(viewing.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Hash className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">PAN number</div>
                      <div className="font-medium">{viewing.pan_number}</div>
                    </div>
                  </div>
                  {viewing.vat_number && (
                    <div className="flex items-start gap-2">
                      <Hash className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs text-muted-foreground">VAT number</div>
                        <div className="font-medium">{viewing.vat_number}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">Submitted ID document</div>
                  {viewing.id_document ? (
                    <img
                      src={viewing.id_document}
                      alt="Submitted ID document"
                      onClick={() => setZoomedDoc(viewing.id_document)}
                      className="w-full max-h-72 object-contain rounded-md border cursor-zoom-in bg-secondary/30"
                    />
                  ) : (
                    <p className="text-sm text-red-600">No ID document was submitted.</p>
                  )}
                </div>

                {reasonFor === viewing.user_id && (
                  <div className="flex gap-2">
                    <input
                      className="flex-1 border rounded-md h-9 px-2 text-sm"
                      placeholder="Reason for rejection"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={rejectMutation.isPending || !reason.trim()}
                      onClick={() => rejectMutation.mutate({ userId: viewing.user_id, reason })}
                    >
                      Confirm Decline
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-4 gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReasonFor(viewing.user_id);
                    setReason("");
                  }}
                  disabled={rejectMutation.isPending}
                >
                  Decline
                </Button>
                <Button
                  className="bg-primary hover:bg-primary/90"
                  disabled={approveMutation.isPending}
                  onClick={() => setConfirmApprove(viewing)}
                >
                  {approveMutation.isPending ? "Approving…" : "Approve Vendor"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmApprove}
        onOpenChange={(open) => !open && setConfirmApprove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve {confirmApprove?.business_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This grants them a vendor account so they can list bikes and take bookings on
              RideNepal right away. Make sure you've reviewed their details and ID document first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={approveMutation.isPending}
              onClick={() => confirmApprove && approveMutation.mutate(confirmApprove.user_id)}
            >
              {approveMutation.isPending ? "Approving…" : "Yes, Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {zoomedDoc && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-60 cursor-zoom-out"
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
