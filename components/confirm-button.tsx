"use client";

import { useState, type ReactNode } from "react";
import { ActionButton } from "@/components/action-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  label: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  success: string;
  action: () => Promise<unknown>;
};

/** A destructive action, behind an explicit confirmation. */
export function ConfirmButton({ label, title, description, confirmLabel, success, action }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <ActionButton variant="destructive" action={action} success={success} onDone={() => setOpen(false)}>
              {confirmLabel}
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
