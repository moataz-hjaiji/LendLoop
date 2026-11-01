"use client";

import { useMutation, useQuery } from "convex/react";
import { ActionButton } from "@/components/action-button";
import { LoanList } from "@/components/loan-list";
import { PageHeader } from "@/components/page-header";
import { api } from "@/convex/_generated/api";

export default function IncomingPage() {
  const loans = useQuery(api.loans.incoming);
  const approve = useMutation(api.loans.approve);
  const decline = useMutation(api.loans.decline);
  const markReturned = useMutation(api.loans.markReturned);

  return (
    <>
      <PageHeader title="Incoming requests" description="Neighbors asking to borrow your tools." />
      <LoanList
        loans={loans}
        show="borrower"
        empty="Nobody has asked to borrow your tools yet."
        actions={(loan) => (
          <>
            {loan.status === "pending" && (
              <>
                <ActionButton size="sm" success="Request approved" action={() => approve({ loanId: loan._id })}>
                  Approve
                </ActionButton>
                <ActionButton variant="outline" size="sm" success="Request declined" action={() => decline({ loanId: loan._id })}>
                  Decline
                </ActionButton>
              </>
            )}
            {loan.status === "approved" && (
              <ActionButton size="sm" variant="outline" success="Marked as returned" action={() => markReturned({ loanId: loan._id })}>
                Mark returned
              </ActionButton>
            )}
          </>
        )}
      />
    </>
  );
}
