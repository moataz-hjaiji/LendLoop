"use client";

import { useState, type ComponentProps } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

type Props = Omit<ComponentProps<typeof Button>, "onClick"> & {
  action: () => Promise<unknown>;
  success?: string;
  onDone?: () => void;
};

/** A button for one mutation: disabled while it runs, and reports the outcome in a toast. */
export function ActionButton({ action, success, onDone, disabled, ...props }: Props) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      {...props}
      disabled={disabled || pending}
      onClick={async () => {
        setPending(true);
        try {
          await action();
          if (success) toast.success(success);
          onDone?.();
        } catch (error) {
          toast.error(errorMessage(error));
        } finally {
          setPending(false);
        }
      }}
    />
  );
}
