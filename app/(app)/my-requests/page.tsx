"use client";

import { useMutation, useQuery } from "convex/react";
import { ActionButton } from "@/components/action-button";
import { LoanList } from "@/components/loan-list";
import { api } from "@/convex/_generated/api";

export default function MyRequestsPage() {
  const loans = useQuery(api.loans.myRequests);
  const cancel = useMutation(api.loans.cancel);

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">My requests</h1>
      <LoanList
        loans={loans}
        show="lender"
        empty="You have not requested anything yet."
        actions={(loan) =>
          loan.status === "pending" && (
            <ActionButton variant="outline" size="sm" success="Request cancelled" action={() => cancel({ loanId: loan._id })}>
              Cancel request
            </ActionButton>
          )
        }
      />
    </>
  );
}
