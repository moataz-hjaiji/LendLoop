"use client";

import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { todayUtc } from "@/convex/lib/dates";
import { errorMessage } from "@/lib/errors";

type Props = {
  tool: { _id: Id<"tools">; name: string; availability: { booked: { startDate: string; endDate: string }[] } };
  onClose: () => void;
};

export function BorrowDialog({ tool, onClose }: Props) {
  const requestLoan = useMutation(api.loans.request);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await requestLoan({ toolId: tool._id, startDate, endDate });
      toast.success("Request sent to the lender");
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Borrow {tool.name}</DialogTitle>
          <DialogDescription>Choose the days you need it. The lender approves or declines.</DialogDescription>
        </DialogHeader>
        {tool.availability.booked.length > 0 && (
          <div className="text-sm">
            <p className="font-medium">Already booked</p>
            <ul className="text-muted-foreground">
              {tool.availability.booked.map(({ startDate: from, endDate: to }) => (
                <li key={from}>
                  {from} to {to}
                </li>
              ))}
            </ul>
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start-date">From</Label>
              <Input id="start-date" type="date" required min={todayUtc()} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end-date">Until</Label>
              <Input id="end-date" type="date" required min={startDate || todayUtc()} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Send request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
