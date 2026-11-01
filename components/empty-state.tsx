import { Inbox } from "lucide-react";

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="grid place-items-center gap-3 rounded-xl border border-dashed bg-card/60 px-6 py-14 text-center">
      <Inbox aria-hidden className="size-8 text-muted-foreground" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
