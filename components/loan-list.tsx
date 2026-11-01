import { formatDistanceToNow } from "date-fns";
import type { FunctionReturnType } from "convex/server";
import { Bell, CalendarDays, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { SOFT_AMBER, SOFT_GREEN } from "@/components/availability-badge";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

export type LoanRow = FunctionReturnType<typeof api.loans.listAll>[number];
type Activity = LoanRow["activity"][number];

const KIND_LABEL = { notification: "Notification", reminder: "Reminder", workflow_error: "Workflow" };

function activityText({ kind, status, updatedAt, about }: Activity) {
  const subject = about ? `${KIND_LABEL[kind]} (${about})` : KIND_LABEL[kind];
  return `${subject} ${status} ${formatDistanceToNow(updatedAt, { addSuffix: true })}`;
}

function StatusBadge({ loan }: { loan: LoanRow }) {
  if (loan.overdue) return <Badge variant="destructive">Overdue</Badge>;
  if (loan.status === "approved") return <Badge className={SOFT_GREEN}>Approved</Badge>;
  if (loan.status === "pending") return <Badge className={SOFT_AMBER}>Pending</Badge>;
  return (
    <Badge variant="secondary" className="capitalize">
      {loan.status}
    </Badge>
  );
}

type Props = {
  loans: LoanRow[] | undefined;
  empty: string;
  show: "lender" | "borrower" | "both";
  actions?: (loan: LoanRow) => ReactNode;
};

function Person({ role, name, email }: { role: string; name: string; email?: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
      <UserRound aria-hidden className="size-4 text-muted-foreground" />
      <span className="text-muted-foreground">{role}:</span> {name}
      {email && <span className="text-muted-foreground">· {email}</span>}
    </p>
  );
}

export function LoanList({ loans, empty, show, actions }: Props) {
  if (loans === undefined) return <p className="text-muted-foreground">Loading…</p>;
  if (loans.length === 0) return <EmptyState message={empty} />;

  return (
    <ul className="grid gap-3">
      {loans.map((loan) => (
        <li key={loan._id}>
          <Card>
            <CardContent className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{loan.toolName}</span>
                  <StatusBadge loan={loan} />
                </div>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarDays aria-hidden className="size-4" />
                  {loan.startDate} to {loan.endDate}
                </p>
                {show !== "borrower" && <Person role="Lender" name={loan.ownerName} email={loan.ownerEmail} />}
                {show !== "lender" && <Person role="Borrower" name={loan.borrowerName} email={loan.borrowerEmail} />}
                {loan.activity.length > 0 && (
                  <ul aria-label="Automation activity" className="mt-2 space-y-0.5 border-t pt-2 text-xs text-muted-foreground">
                    {loan.activity.map((event) => (
                      <li
                        key={event._id}
                        className={cn("flex items-center gap-1.5", event.status === "failed" && "text-destructive")}
                      >
                        <Bell aria-hidden className="size-3" />
                        {activityText(event)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {actions && <div className="flex flex-wrap gap-2">{actions(loan)}</div>}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
