"use client";

import { useMutation, useQuery } from "convex/react";
import { ActionButton } from "@/components/action-button";
import { LoanList } from "@/components/loan-list";
import { PageHeader } from "@/components/page-header";
import { api } from "@/convex/_generated/api";

export default function MyRequestsPage() {
  const loans = useQuery(api.loans.myRequests);
  const cancel = useMutation(api.loans.cancel);

  return (
    <>
      <PageHeader title="My requests" description="What you have asked to borrow, and where each request stands." />
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
