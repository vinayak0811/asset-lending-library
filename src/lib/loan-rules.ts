import prisma from "./prisma";
import { DisplayStatus, LoanStatus } from "@/types";

export function isLoanOverdue(loan: {
  status: string;
  dueDate?: Date | string | null;
}): boolean {
  if (loan.status !== "ISSUED" || !loan.dueDate) {
    return false;
  }
  const due = new Date(loan.dueDate);
  return due.getTime() < Date.now();
}

export function getComputedStatus(loan: {
  status: string;
  dueDate?: Date | string | null;
}): DisplayStatus {
  if (loan.status === "ISSUED" && isLoanOverdue(loan)) {
    return "OVERDUE";
  }
  return loan.status as DisplayStatus;
}

export function validateLoanTransition(
  currentStatus: LoanStatus | string,
  targetStatus: LoanStatus | string
): { valid: boolean; reason?: string } {
  if (currentStatus === targetStatus) {
    return {
      valid: false,
      reason: `Loan is already in status '${currentStatus}'.`,
    };
  }

  if (currentStatus === "RETURNED") {
    return {
      valid: false,
      reason: "Cannot change the status of a loan that has already been returned.",
    };
  }

  if (currentStatus === "LOST") {
    return {
      valid: false,
      reason: "Cannot change the status of a loan that has been marked as lost.",
    };
  }

  if (currentStatus === "DECLINED") {
    return {
      valid: false,
      reason: "Cannot change the status of a loan that has already been declined.",
    };
  }

  if (currentStatus === "REQUESTED") {
    if (targetStatus === "ISSUED" || targetStatus === "DECLINED") {
      return { valid: true };
    }
    return {
      valid: false,
      reason: `A requested loan must be approved (issued) or declined before it can be '${targetStatus}'.`,
    };
  }

  if (currentStatus === "ISSUED") {
    if (targetStatus === "RETURNED" || targetStatus === "LOST") {
      return { valid: true };
    }
    return {
      valid: false,
      reason: `An issued loan can only be returned or marked lost, not changed to '${targetStatus}'.`,
    };
  }

  return {
    valid: false,
    reason: `Invalid transition from '${currentStatus}' to '${targetStatus}'.`,
  };
}

export async function checkItemHasOpenLoan(
  itemId: string,
  excludeLoanId?: string
): Promise<{ hasOpenLoan: boolean; openLoan?: any }> {
  const openLoan = await prisma.loan.findFirst({
    where: {
      itemId,
      status: {
        in: ["REQUESTED", "ISSUED"],
      },
      ...(excludeLoanId ? { id: { not: excludeLoanId } } : {}),
    },
    include: {
      borrower: { select: { id: true, name: true, email: true } },
    },
  });

  return {
    hasOpenLoan: !!openLoan,
    openLoan,
  };
}

export async function requestLoan(
  itemId: string,
  borrowerId: string,
  notes?: string
) {
  // Check if item exists and is not archived
  const item = await prisma.catalogueItem.findUnique({
    where: { id: itemId },
  });

  if (!item) {
    throw new Error("Catalogue item not found.");
  }

  if (item.isArchived) {
    throw new Error("Cannot request an archived catalogue item.");
  }

  // Check if item already has an open loan
  const { hasOpenLoan, openLoan } = await checkItemHasOpenLoan(itemId);
  if (hasOpenLoan) {
    throw new Error(
      `Cannot request item '${item.title}' (${item.code}) because it already has an open loan (${openLoan.status}) by ${openLoan.borrower.name}.`
    );
  }

  // Create loan and audit event in transaction
  return await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.create({
      data: {
        itemId,
        borrowerId,
        status: "REQUESTED",
        notes,
      },
      include: {
        item: true,
        borrower: true,
      },
    });

    await tx.loanEvent.create({
      data: {
        loanId: loan.id,
        actorId: borrowerId,
        action: "REQUESTED",
        notes: notes || "Loan requested by borrower",
      },
    });

    return loan;
  });
}

export async function issueLoan(
  loanId: string,
  actorId: string,
  dueDate: Date,
  notes?: string
) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { item: true },
  });

  if (!loan) {
    throw new Error("Loan not found.");
  }

  if (loan.item.isArchived) {
    throw new Error("Cannot issue an archived catalogue item.");
  }

  const transitionCheck = validateLoanTransition(loan.status, "ISSUED");
  if (!transitionCheck.valid) {
    throw new Error(transitionCheck.reason);
  }

  // Verify no OTHER open loan exists on this item
  const { hasOpenLoan, openLoan } = await checkItemHasOpenLoan(
    loan.itemId,
    loan.id
  );
  if (hasOpenLoan) {
    throw new Error(
      `Cannot issue item '${loan.item.title}' because it has another active loan (${openLoan.status}) by ${openLoan.borrower.name}.`
    );
  }

  if (!dueDate || isNaN(dueDate.getTime())) {
    throw new Error("A valid due date is required when issuing a loan.");
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.loan.update({
      where: { id: loanId },
      data: {
        status: "ISSUED",
        issuedDate: new Date(),
        dueDate,
        notes: notes || loan.notes,
      },
      include: { item: true, borrower: true },
    });

    await tx.loanEvent.create({
      data: {
        loanId: loan.id,
        actorId,
        action: "ISSUED",
        notes: notes ? `Issued with due date: ${dueDate.toISOString().split("T")[0]}. Note: ${notes}` : `Issued with due date: ${dueDate.toISOString().split("T")[0]}`,
      },
    });

    return updated;
  });
}

export async function returnLoan(
  loanId: string,
  actorId: string,
  notes?: string
) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { item: true, borrower: true },
  });

  if (!loan) {
    throw new Error("Loan not found.");
  }

  const transitionCheck = validateLoanTransition(loan.status, "RETURNED");
  if (!transitionCheck.valid) {
    throw new Error(transitionCheck.reason);
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.loan.update({
      where: { id: loanId },
      data: {
        status: "RETURNED",
        returnedDate: new Date(),
        alertDismissed: true, // Dismiss any overdue alert once returned
      },
      include: { item: true, borrower: true },
    });

    await tx.loanEvent.create({
      data: {
        loanId: loan.id,
        actorId,
        action: "RETURNED",
        notes: notes || "Item marked as returned by librarian",
      },
    });

    return updated;
  });
}

export async function markLoanLost(
  loanId: string,
  actorId: string,
  notes?: string
) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { item: true, borrower: true },
  });

  if (!loan) {
    throw new Error("Loan not found.");
  }

  const transitionCheck = validateLoanTransition(loan.status, "LOST");
  if (!transitionCheck.valid) {
    throw new Error(transitionCheck.reason);
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.loan.update({
      where: { id: loanId },
      data: {
        status: "LOST",
        alertDismissed: true,
      },
      include: { item: true, borrower: true },
    });

    await tx.loanEvent.create({
      data: {
        loanId: loan.id,
        actorId,
        action: "LOST",
        notes: notes || "Item marked as lost by librarian",
      },
    });

    return updated;
  });
}

export async function declineLoan(
  loanId: string,
  actorId: string,
  notes?: string
) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { item: true, borrower: true },
  });

  if (!loan) {
    throw new Error("Loan not found.");
  }

  const transitionCheck = validateLoanTransition(loan.status, "DECLINED");
  if (!transitionCheck.valid) {
    throw new Error(transitionCheck.reason);
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.loan.update({
      where: { id: loanId },
      data: {
        status: "DECLINED",
        alertDismissed: true,
      },
      include: { item: true, borrower: true },
    });

    await tx.loanEvent.create({
      data: {
        loanId: loan.id,
        actorId,
        action: "DECLINED",
        notes: notes || "Loan request declined by librarian",
      },
    });

    return updated;
  });
}

export async function dismissLoanAlert(loanId: string, actorId: string) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
  });

  if (!loan) {
    throw new Error("Loan not found.");
  }

  if (loan.status !== "ISSUED" || !isLoanOverdue(loan)) {
    throw new Error("Loan is not currently overdue.");
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.loan.update({
      where: { id: loanId },
      data: { alertDismissed: true },
    });

    await tx.loanEvent.create({
      data: {
        loanId: loan.id,
        actorId,
        action: "ALERT_DISMISSED",
        notes: "Overdue loan alert dismissed by librarian",
      },
    });

    return updated;
  });
}
