export type Role = "LIBRARIAN" | "MEMBER";

export type LoanStatus = "REQUESTED" | "ISSUED" | "RETURNED" | "LOST" | "DECLINED";

export type DisplayStatus = "REQUESTED" | "ISSUED" | "OVERDUE" | "RETURNED" | "LOST" | "DECLINED";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  // Restricted "demo" librarian: full read visibility, but member
  // names are hidden and item-approval actions are blocked.
  isDemo?: boolean;
}

export interface CatalogueItemDTO {
  id: string;
  code: string;
  title: string;
  category: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  custodians?: {
    id: string;
    userId: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }[];
  activeLoan?: LoanDTO | null;
  loansCount?: number;
}

export interface LoanEventDTO {
  id: string;
  loanId: string;
  actorId: string;
  action: string;
  notes: string | null;
  timestamp: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface LoanDTO {
  id: string;
  itemId: string;
  borrowerId: string;
  status: LoanStatus;
  computedStatus: DisplayStatus;
  requestedDate: string;
  issuedDate: string | null;
  dueDate: string | null;
  returnedDate: string | null;
  notes: string | null;
  alertDismissed: boolean;
  createdAt: string;
  updatedAt: string;
  item: {
    id: string;
    code: string;
    title: string;
    category: string;
    isArchived: boolean;
  };
  borrower: {
    id: string;
    name: string;
    email: string;
  };
  events?: LoanEventDTO[];
}

export interface BulkImportRowResult {
  rowNumber: number;
  data: Record<string, string>;
  error?: string;
  success: boolean;
}

export interface BulkImportResponse {
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  results: BulkImportRowResult[];
}

export interface BulkReturnItemResult {
  loanId: string;
  itemCode?: string;
  itemTitle?: string;
  success: boolean;
  message: string;
}

export interface BulkReturnResponse {
  totalRequested: number;
  successCount: number;
  failedCount: number;
  results: BulkReturnItemResult[];
}

export interface DashboardMetrics {
  itemsCurrentlyOut: number;
  itemsOverdue: number;
  loansReturnedThisWeek: number;
  totalCatalogueItems: number;
  loansByStatus: {
    status: DisplayStatus;
    count: number;
  }[];
  loansByCustodian: {
    custodianName: string;
    custodianEmail: string;
    itemCount: number;
    activeLoanCount: number;
  }[];
  returnsPerWeek: {
    weekLabel: string;
    startDate: string;
    endDate: string;
    count: number;
  }[];
}
