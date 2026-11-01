import { formatDistanceToNow } from "date-fns";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { api } from "@/convex/_generated/api";

export type LoanRow = FunctionReturnType<typeof api.loans.listAll>[number];
type Activity = LoanRow["activity"][number];

const KIND_LABEL = { notification: "Notification", reminder: "Reminder", workflow_error: "Workflow" };

function activityText({ kind, status, updatedAt, about }: Activity) {
  const subject = about ? `${KIND_LABEL[kind]} (${about})` : KIND_LABEL[kind];
  return `${subject} ${status} ${formatDistanceToNow(updatedAt, { addSuffix: true })}`;
}

function StatusBadge({ loan }: { loan: LoanRow }) {
  if (loan.overdue) return <Badge variant="destructive">Overdue</Badge>;
  if (loan.status === "approved") return <Badge>Approved</Badge>;
  if (loan.status === "pending") return <Badge variant="outline">Pending</Badge>;
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

export function LoanList({ loans, empty, show, actions }: Props) {
  if (loans === undefined) return <p className="text-muted-foreground">Loading…</p>;
  if (loans.length === 0) return <p className="text-muted-foreground">{empty}</p>;

  return (
    <ul className="grid gap-3">
      {loans.map((loan) => (
        <li key={loan._id}>
          <Card>
            <CardContent className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{loan.toolName}</span>
                  <StatusBadge loan={loan} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {loan.startDate} to {loan.endDate}
                </p>
                {show !== "borrower" && (
                  <p className="text-sm">
                    Lender: {loan.ownerName}
                    {loan.ownerEmail && <span className="text-muted-foreground"> · {loan.ownerEmail}</span>}
                  </p>
                )}
                {show !== "lender" && (
                  <p className="text-sm">
                    Borrower: {loan.borrowerName}
                    {loan.borrowerEmail && <span className="text-muted-foreground"> · {loan.borrowerEmail}</span>}
                  </p>
                )}
                {loan.activity.length > 0 && (
                  <ul aria-label="Automation activity" className="pt-1 text-xs text-muted-foreground">
                    {loan.activity.map((event) => (
                      <li key={event._id} className={event.status === "failed" ? "text-destructive" : undefined}>
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
