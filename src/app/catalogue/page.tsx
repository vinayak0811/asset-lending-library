"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  type FormEvent,
  type MouseEvent,
} from "react";

import { useAuth } from "@/context/AuthContext";

// StatusBadge is a named export.
import { StatusBadge } from "@/components/StatusBadge";

// Keep these as default imports because the original components
// are intended to be rendered as components.
import { LoanTimeline } from "@/components/LoanTimeline";
import { BulkImportModal } from "@/components/BulkImportModal";

import {
  Plus,
  Search,
  Filter,
  Edit3,
  Archive,
  ArchiveRestore,
  Eye,
  Package,
  Users,
  Calendar,
  FileSpreadsheet,
  BookOpen,
  Tag,
  Hash,
  ChevronDown,
  ChevronUp,
  X,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  Trash2,
  Loader2,
  History,
  XCircle,
  AlertCircle,
} from "lucide-react";

import { format } from "date-fns";

// ============================================================
// TYPES
// ============================================================

type Custodian = {
  id: string;
  userId: string;
  itemId?: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
};

type LoanEvent = {
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
};

type Loan = {
  id: string;
  itemId: string;
  borrowerId: string;

  status:
    | "REQUESTED"
    | "ISSUED"
    | "RETURNED"
    | "LOST";

  computedStatus:
    | "REQUESTED"
    | "ISSUED"
    | "OVERDUE"
    | "RETURNED"
    | "LOST";

  requestedDate: string;
  issuedDate: string | null;
  dueDate: string | null;
  returnedDate: string | null;

  notes: string | null;

  alertDismissed: boolean;

  createdAt: string;
  updatedAt: string;

  borrower: {
    id: string;
    name: string;
    email: string;
  };

  events?: LoanEvent[];
};

type Item = {
  id: string;
  code: string;
  title: string;
  category: string;
  description: string | null;
  isArchived: boolean;

  createdAt?: string;
  updatedAt?: string;

  custodians: Custodian[];

  activeLoans: Loan[];

  loans?: Loan[];

  _count: {
    loans: number;
  };
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

// ============================================================
// PAGE
// ============================================================

export default function CataloguePage() {
  const { user } = useAuth();

  const isLibrarian =
    user?.role === "LIBRARIAN";

  const isDemo = !!user?.isDemo;

  // ==========================================================
  // STATE
  // ==========================================================

  const [items, setItems] = useState<Item[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [categories, setCategories] =
    useState<string[]>([]);

  const [activeTab, setActiveTab] =
    useState<
      "active" | "archived" | "my-custodian"
    >("active");

  const [search, setSearch] =
    useState("");

  const [selectedCategory, setSelectedCategory] =
    useState("");

  // ==========================================================
  // MODAL STATE
  // ==========================================================

  const [isCreateModalOpen, setIsCreateModalOpen] =
    useState(false);

  const [isEditModalOpen, setIsEditModalOpen] =
    useState(false);

  const [isDetailModalOpen, setIsDetailModalOpen] =
    useState(false);

  const [isBulkImportOpen, setIsBulkImportOpen] =
    useState(false);

  const [selectedItem, setSelectedItem] =
    useState<Item | null>(null);

  // ==========================================================
  // FORM STATE
  // ==========================================================

  const [formData, setFormData] = useState({
    code: "",
    title: "",
    category: "",
    description: "",
  });

  const [formError, setFormError] =
    useState("");

  const [formLoading, setFormLoading] =
    useState(false);

  // ==========================================================
  // DETAIL MODAL STATE
  // ==========================================================

  const [itemDetail, setItemDetail] =
    useState<Item | null>(null);

  const [detailLoading, setDetailLoading] =
    useState(false);

  const [expandedLoanId, setExpandedLoanId] =
    useState<string | null>(null);

  const [allUsers, setAllUsers] =
    useState<User[]>([]);

  const [issueFormData, setIssueFormData] =
    useState({
      userId: "",
      dueDate: "",
    });

  const [actionLoading, setActionLoading] =
    useState(false);

  const [issueMode, setIssueMode] =
    useState(false);

  const [approveDueDate, setApproveDueDate] =
    useState("");

  // ==========================================================
  // FETCH CATALOGUE ITEMS
  // ==========================================================

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);

      const params =
        new URLSearchParams();

      if (activeTab === "archived") {
        params.append("archived", "true");
      }

      if (activeTab === "active") {
        params.append("archived", "false");
      }

      if (
        activeTab === "my-custodian" &&
        user?.id
      ) {
        params.append(
          "custodianId",
          user.id
        );
      }

      if (search.trim()) {
        params.append(
          "search",
          search.trim()
        );
      }

      if (selectedCategory) {
        params.append(
          "category",
          selectedCategory
        );
      }

      const res = await fetch(
        `/api/catalogue?${params.toString()}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!res.ok) {
        throw new Error(
          "Failed to fetch catalogue items"
        );
      }

      const data = await res.json();

      setItems(data.items ?? []);

      // Build category list.
      if (
        !search &&
        !selectedCategory
      ) {
        const cats = Array.from(
          new Set(
            (data.items ?? []).map(
              (item: Item) =>
                item.category
            )
          )
        ) as string[];

        setCategories(cats);
      }
    } catch (error) {
      console.error(
        "Failed to fetch catalogue:",
        error
      );
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    search,
    selectedCategory,
    user?.id,
  ]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // ==========================================================
  // FETCH USERS
  // ==========================================================

  const fetchUsers = async () => {
    try {
      const res = await fetch(
        "/api/users",
        {
          credentials: "include",
        }
      );

      if (!res.ok) {
        throw new Error(
          "Failed to fetch users"
        );
      }

      const data = await res.json();

      setAllUsers(data.users ?? []);
    } catch (error) {
      console.error(
        "Failed to fetch users:",
        error
      );
    }
  };

  // ==========================================================
  // FETCH ITEM DETAILS
  // ==========================================================

  const fetchItemDetail = async (
    id: string
  ) => {
    try {
      setDetailLoading(true);

      const res = await fetch(
        `/api/catalogue/${id}`,
        {
          credentials: "include",
        }
      );

      if (!res.ok) {
        throw new Error(
          "Failed to fetch item details"
        );
      }

      const data = await res.json();

      setItemDetail(data.item ?? null);
    } catch (error) {
      console.error(
        "Failed to fetch item details:",
        error
      );
    } finally {
      setDetailLoading(false);
    }
  };

  // ==========================================================
  // CREATE ITEM
  // ==========================================================

  const handleCreateSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setFormError("");
    setFormLoading(true);

    try {
      const res = await fetch(
        "/api/catalogue",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials: "include",

          body: JSON.stringify(formData),
        }
      );

      if (!res.ok) {
        const err =
          await res.json().catch(
            () => ({})
          );

        throw new Error(
          err.error ||
            "Failed to create item"
        );
      }

      setIsCreateModalOpen(false);

      setFormData({
        code: "",
        title: "",
        category: "",
        description: "",
      });

      await fetchItems();
    } catch (error: unknown) {
      if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError(
          "Failed to create item"
        );
      }
    } finally {
      setFormLoading(false);
    }
  };

  // ==========================================================
  // EDIT ITEM
  // ==========================================================

  const handleEditSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!selectedItem) {
      return;
    }

    setFormError("");
    setFormLoading(true);

    try {
      const res = await fetch(
        `/api/catalogue/${selectedItem.id}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials: "include",

          body: JSON.stringify(formData),
        }
      );

      if (!res.ok) {
        const err =
          await res.json().catch(
            () => ({})
          );

        throw new Error(
          err.error ||
            "Failed to update item"
        );
      }

      setIsEditModalOpen(false);

      await fetchItems();

      // Refresh selected item if detail
      // is currently open.
      if (itemDetail) {
        await fetchItemDetail(
          itemDetail.id
        );
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError(
          "Failed to update item"
        );
      }
    } finally {
      setFormLoading(false);
    }
  };

  // ==========================================================
  // ARCHIVE / RESTORE
  // ==========================================================

  const toggleArchive = async (
    item: Item
  ) => {
    try {
      const res = await fetch(
        `/api/catalogue/${item.id}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials: "include",

          body: JSON.stringify({
            isArchived:
              !item.isArchived,
          }),
        }
      );

      if (!res.ok) {
        const data =
          await res.json().catch(
            () => ({})
          );

        throw new Error(
          data.error ||
            "Failed to update archive status"
        );
      }

      await fetchItems();

      setIsEditModalOpen(false);

      if (itemDetail?.id === item.id) {
        await fetchItemDetail(item.id);
      }
    } catch (error) {
      console.error(
        "Archive action failed:",
        error
      );
    }
  };

  // ==========================================================
  // ADD CUSTODIAN
  // ==========================================================

  const handleAddCustodian = async (
    userId: string
  ) => {
    if (!itemDetail) {
      return;
    }

    try {
      const res = await fetch(
        `/api/catalogue/${itemDetail.id}/custodians`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials: "include",

          body: JSON.stringify({
            userId,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(
          "Failed to add custodian"
        );
      }

      await fetchItemDetail(
        itemDetail.id
      );

      await fetchItems();
    } catch (error) {
      console.error(
        "Failed to add custodian:",
        error
      );
    }
  };

  // ==========================================================
  // REMOVE CUSTODIAN
  // ==========================================================

  const handleRemoveCustodian = async (
    userId: string
  ) => {
    if (!itemDetail) {
      return;
    }

    try {
      const res = await fetch(
        `/api/catalogue/${itemDetail.id}/custodians`,
        {
          method: "DELETE",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials: "include",

          body: JSON.stringify({
            userId,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(
          "Failed to remove custodian"
        );
      }

      await fetchItemDetail(
        itemDetail.id
      );

      await fetchItems();
    } catch (error) {
      console.error(
        "Failed to remove custodian:",
        error
      );
    }
  };

  // ==========================================================
  // LOAN ACTION
  // ==========================================================

  const handleLoanAction = async (
    action:
      | "REQUEST"
      | "ISSUE"
      | "RETURN"
      | "LOST"
      | "DECLINE",
    loanId?: string,
    extraData?: Record<
      string,
      unknown
    >
  ) => {
    if (!itemDetail) {
      return;
    }

    setActionLoading(true);

    try {
      let url: string;

      let body: Record<
        string,
        unknown
      >;

      if (loanId) {
        // Acting on an existing loan: approve (issue), decline,
        // return, or mark lost. All of these go through the
        // dedicated transition endpoint, which enforces the
        // lifecycle rules server-side.
        const transitionAction =
          action === "LOST"
            ? "MARK_LOST"
            : action;

        url = `/api/loans/${loanId}/transition`;

        body = {
          action: transitionAction,
          ...(extraData || {}),
        };
      } else if (action === "ISSUE") {
        // Direct issue: librarian creates a brand-new loan that is
        // immediately ISSUED, with no prior request.
        url = "/api/loans";

        body = {
          itemId: itemDetail.id,
          directIssue: true,
          ...(extraData || {}),
        };
      } else {
        // A member (or librarian, on a member's behalf) requesting
        // an item. Starts life as REQUESTED, awaiting approval.
        url = "/api/loans";

        body = {
          itemId: itemDetail.id,
          ...(extraData || {}),
        };
      }

      const res = await fetch(
        url,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials: "include",

          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const data =
          await res.json().catch(
            () => ({})
          );

        throw new Error(
          data.error ||
            "Failed to perform loan action"
        );
      }

      setIssueMode(false);

      setIssueFormData({
        userId: "",
        dueDate: "",
      });

      setApproveDueDate("");

      await fetchItemDetail(
        itemDetail.id
      );

      await fetchItems();
    } catch (error: unknown) {
      console.error(
        "Loan action failed:",
        error
      );

      if (error instanceof Error) {
        window.alert(error.message);
      } else {
        window.alert(
          "Failed to perform loan action"
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================================
  // DECLINE A LOAN REQUEST
  // ==========================================================

  const handleDeclineRequest = (
    loanId: string
  ) => {
    const reason = window.prompt(
      "Reason for declining this request (optional):"
    );

    // A null return means the librarian hit Cancel — abort.
    if (reason === null) {
      return;
    }

    handleLoanAction(
      "DECLINE",
      loanId,
      reason.trim()
        ? { notes: reason.trim() }
        : undefined
    );
  };

  // ==========================================================
  // OPEN EDIT MODAL
  // ==========================================================

  const openEditModal = (
    item: Item,
    e: MouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();

    setSelectedItem(item);

    setFormData({
      code: item.code,
      title: item.title,
      category: item.category,
      description:
        item.description || "",
    });

    setFormError("");

    setIsEditModalOpen(true);
  };

  // ==========================================================
  // OPEN DETAIL MODAL
  // ==========================================================

  const openDetailModal = (
    item: Item
  ) => {
    setSelectedItem(item);

    setExpandedLoanId(null);

    setIssueMode(false);

    setApproveDueDate("");

    setIsDetailModalOpen(true);

    fetchItemDetail(item.id);

    if (isLibrarian) {
      fetchUsers();
    }
  };

  // ==========================================================
  // AVAILABILITY
  // ==========================================================

  const isItemAvailable = (
    item: Item
  ) => {
    return (
      !item.activeLoans ||
      item.activeLoans.length === 0
    );
  };

  // ==========================================================
  // CLOSE DETAIL
  // ==========================================================

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);

    setItemDetail(null);

    setExpandedLoanId(null);

    setIssueMode(false);

    setApproveDueDate("");
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">

        <div>

          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">

            <BookOpen className="h-8 w-8 text-blue-600" />

            Asset Catalogue

          </h1>

          <p className="text-gray-500 mt-1">
            Browse and manage available items
          </p>

        </div>

        {isLibrarian && !isDemo && (
          <div className="flex gap-2">

            <button
              type="button"
              onClick={() =>
                setIsBulkImportOpen(true)
              }
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >

              <FileSpreadsheet className="w-4 h-4" />

              Bulk Import

            </button>

            <button
              type="button"
              onClick={() => {
                setFormData({
                  code: "",
                  title: "",
                  category: "",
                  description: "",
                });

                setFormError("");

                setIsCreateModalOpen(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >

              <Plus className="w-4 h-4" />

              Add Item

            </button>

          </div>
        )}

      </div>

      {isDemo && (
        <div className="mb-6 p-3 bg-amber-50 text-amber-800 text-sm rounded-md border border-amber-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {isLibrarian
            ? "Demo librarian mode: you can view everything, but member names are hidden and approval actions are disabled."
            : "Demo member mode: you can browse and view everything, but you cannot submit loan requests."}
        </div>
      )}

      {/* ======================================================
          FILTERS
      ====================================================== */}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">

        <div className="border-b border-gray-200">

          <nav className="flex -mb-px px-4 gap-6">

            <button
              type="button"
              onClick={() =>
                setActiveTab("active")
              }
              className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "active"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Package className="w-4 h-4" />

              Active Items
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab("archived")
              }
              className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "archived"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Archive className="w-4 h-4" />

              Archived Items
            </button>

            {isLibrarian && (
              <button
                type="button"
                onClick={() =>
                  setActiveTab(
                    "my-custodian"
                  )
                }
                className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab ===
                  "my-custodian"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Users className="w-4 h-4" />

                My Custodian Items
              </button>
            )}

          </nav>

        </div>

        <div className="p-4 flex flex-col sm:flex-row gap-4 bg-gray-50/50">

          {/* Search */}

          <div className="relative flex-1">

            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />

            <input
              type="text"
              placeholder="Search items by code, title, or description..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
            />

          </div>

          {/* Category */}

          <div className="relative min-w-[200px]">

            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />

            <select
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              value={selectedCategory}
              onChange={(e) =>
                setSelectedCategory(
                  e.target.value
                )
              }
            >

              <option value="">
                All Categories
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                )
              )}

            </select>

          </div>

        </div>

      </div>

      {/* ======================================================
          ITEMS
      ====================================================== */}

      {loading ? (

        <div className="flex justify-center items-center py-20">

          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />

        </div>

      ) : items.length === 0 ? (

        <div className="text-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">

          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />

          <h3 className="text-lg font-medium text-gray-900">
            No items found
          </h3>

          <p className="text-gray-500 mt-1">
            Try adjusting your search or filters.
          </p>

        </div>

      ) : (

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {items.map((item) => (

            <div
              key={item.id}
              onClick={() =>
                openDetailModal(item)
              }
              className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer flex flex-col group"
            >

              <div className="p-5 flex-1">

                {/* Item header */}

                <div className="flex justify-between items-start mb-3">

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-gray-100 text-gray-800">

                    <Hash className="w-3 h-3" />

                    {item.code}

                  </span>

                  <div className="flex gap-2">

                    {item.activeLoans?.[0] ? (

                      <StatusBadge
                        status={
                          item.activeLoans[0]
                            .computedStatus
                        }
                      />

                    ) : (

                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Available
                      </span>

                    )}

                    {isLibrarian && !isDemo && (
                      <button
                        type="button"
                        onClick={(e) =>
                          openEditModal(
                            item,
                            e
                          )
                        }
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit item"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}

                  </div>

                </div>

                {/* Title */}

                <h3
                  className="text-lg font-semibold text-gray-900 mb-1 line-clamp-1"
                  title={item.title}
                >
                  {item.title}
                </h3>

                {/* Category */}

                <div className="flex items-center gap-2 mb-3">

                  <Tag className="w-4 h-4 text-gray-400" />

                  <span className="text-sm text-gray-600">
                    {item.category}
                  </span>

                </div>

                {/* Description */}

                <p className="text-gray-500 text-sm line-clamp-2 mb-4 h-10">
                  {item.description ||
                    "No description provided."}
                </p>

                {/* Bottom info */}

                <div className="flex items-center gap-4 mt-auto pt-4 border-t border-gray-100">

                  <div className="flex items-center gap-1.5 text-sm text-gray-500">

                    <History className="w-4 h-4" />

                    <span>
                      {item._count?.loans ||
                        0}{" "}
                      loans
                    </span>

                  </div>

                  {item.custodians?.length >
                    0 && (

                    <div className="flex items-center gap-2 ml-auto">

                      <div className="flex -space-x-2">

                        {item.custodians
                          .slice(0, 3)
                          .map(
                            (
                              custodian,
                              index
                            ) => (

                              <div
                                key={
                                  custodian.user.id ||
                                  index
                                }
                                className="w-6 h-6 rounded-full bg-blue-100 border border-white flex items-center justify-center text-xs font-medium text-blue-700"
                                title={
                                  custodian.user
                                    .name
                                }
                              >
                                {custodian.user.name.charAt(
                                  0
                                )}
                              </div>

                            )
                          )}

                      </div>

                    </div>
                  )}

                </div>

              </div>

            </div>

          ))}

        </div>

      )}

      {/* ======================================================
          CREATE / EDIT MODAL
      ====================================================== */}

      {(isCreateModalOpen ||
        isEditModalOpen) && (

        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">

            <div className="flex justify-between items-center p-6 border-b border-gray-200">

              <h2 className="text-xl font-semibold text-gray-900">
                {isEditModalOpen
                  ? "Edit Item"
                  : "Add New Item"}
              </h2>

              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(
                    false
                  );
                  setIsEditModalOpen(
                    false
                  );
                  setFormError("");
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <form
              onSubmit={
                isEditModalOpen
                  ? handleEditSubmit
                  : handleCreateSubmit
              }
              className="p-6 space-y-4"
            >

              {formError && (

                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">

                  <AlertTriangle className="w-4 h-4" />

                  {formError}

                </div>

              )}

              {/* Code */}

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Code
                </label>

                <input
                  required
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. LPT-001"
                  disabled={
                    isEditModalOpen
                  }
                />

              </div>

              {/* Title */}

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>

                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      title: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Item Name"
                />

              </div>

              {/* Category */}

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>

                <input
                  required
                  type="text"
                  value={
                    formData.category
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category:
                        e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Electronics, Books"
                />

              </div>

              {/* Description */}

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>

                <textarea
                  rows={3}
                  value={
                    formData.description
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      description:
                        e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Optional details..."
                />

              </div>

              {/* Archive */}

              {isEditModalOpen &&
                selectedItem && (

                  <div className="pt-2 flex items-center justify-between">

                    <span className="text-sm text-gray-700">
                      Archived Status
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        toggleArchive(
                          selectedItem
                        )
                      }
                      className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                        selectedItem.isArchived
                          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >

                      {selectedItem.isArchived ? (
                        <ArchiveRestore className="w-4 h-4" />
                      ) : (
                        <Archive className="w-4 h-4" />
                      )}

                      {selectedItem.isArchived
                        ? "Restore Item"
                        : "Archive Item"}

                    </button>

                  </div>
                )}

              {/* Buttons */}

              <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">

                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(
                      false
                    );
                    setIsEditModalOpen(
                      false
                    );
                    setFormError("");
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-70"
                >

                  {formLoading && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}

                  {isEditModalOpen
                    ? "Save Changes"
                    : "Create Item"}

                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* ======================================================
          DETAIL MODAL
      ====================================================== */}

      {isDetailModalOpen && (

        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

            {/* Header */}

            <div className="flex justify-between items-center p-6 border-b border-gray-200 shrink-0">

              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">

                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm font-mono">
                  {selectedItem?.code}
                </span>

                {selectedItem?.title}

              </h2>

              <button
                type="button"
                onClick={
                  closeDetailModal
                }
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

            </div>

            {/* Body */}

            <div className="overflow-y-auto p-6 flex-1 bg-gray-50/50">

              {detailLoading ? (

                <div className="flex justify-center py-12">

                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />

                </div>

              ) : itemDetail ? (

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* ==================================================
                      LEFT COLUMN
                  ================================================== */}

                  <div className="lg:col-span-1 space-y-6">

                    {/* Item Overview */}

                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">

                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">

                        <Eye className="w-4 h-4 text-blue-600" />

                        Item Overview

                      </h3>

                      <div className="space-y-4">

                        <div>

                          <span className="text-xs text-gray-500 uppercase font-semibold">
                            Category
                          </span>

                          <p className="text-gray-900 font-medium">
                            {itemDetail.category}
                          </p>

                        </div>

                        <div>

                          <span className="text-xs text-gray-500 uppercase font-semibold">
                            Description
                          </span>

                          <p className="text-gray-700 text-sm mt-1">
                            {itemDetail.description ||
                              "No description provided."}
                          </p>

                        </div>

                        <div>

                          <span className="text-xs text-gray-500 uppercase font-semibold">
                            Status
                          </span>

                          <div className="mt-1">

                            {itemDetail.activeLoans?.[0] ? (

                              <StatusBadge
                                status={
                                  itemDetail
                                    .activeLoans[0]
                                    .computedStatus
                                }
                              />

                            ) : (

                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Available for Loan
                              </span>

                            )}

                          </div>

                        </div>

                      </div>

                      {/* Loan Actions */}

                      <div className="mt-6 pt-6 border-t border-gray-100">

                        {isLibrarian ? (

                          <div className="space-y-3">

                            {/* Direct issue */}

                            {isItemAvailable(
                              itemDetail
                            ) &&
                              !issueMode &&
                              !isDemo && (

                                <button
                                  type="button"
                                  onClick={() =>
                                    setIssueMode(
                                      true
                                    )
                                  }
                                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center justify-center gap-2"
                                >

                                  <Send className="w-4 h-4" />

                                  Direct Issue

                                </button>
                              )}

                            {/* Issue form */}

                            {issueMode && !isDemo && (

                              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-3">

                                <h4 className="text-sm font-semibold text-blue-900">
                                  Issue Item
                                </h4>

                                <select
                                  value={
                                    issueFormData.userId
                                  }
                                  onChange={(e) =>
                                    setIssueFormData({
                                      ...issueFormData,
                                      userId:
                                        e.target
                                          .value,
                                    })
                                  }
                                  className="w-full text-sm rounded border-gray-300 p-2"
                                >

                                  <option value="">
                                    Select Member...
                                  </option>

                                  {allUsers
                                    .filter(
                                      (u) =>
                                        u.role ===
                                        "MEMBER"
                                    )
                                    .map(
                                      (u) => (
                                        <option
                                          key={u.id}
                                          value={
                                            u.id
                                          }
                                        >
                                          {u.name} (
                                          {u.email})
                                        </option>
                                      )
                                    )}

                                </select>

                                <input
                                  type="date"
                                  value={
                                    issueFormData.dueDate
                                  }
                                  onChange={(e) =>
                                    setIssueFormData({
                                      ...issueFormData,
                                      dueDate:
                                        e.target
                                          .value,
                                    })
                                  }
                                  className="w-full text-sm rounded border-gray-300 p-2"
                                />

                                <div className="flex gap-2">

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleLoanAction(
                                        "ISSUE",
                                        undefined,
                                        {
                                          borrowerId:
                                            issueFormData.userId,
                                          userId:
                                            issueFormData.userId,
                                          dueDate:
                                            issueFormData.dueDate,
                                        }
                                      )
                                    }
                                    disabled={
                                      !issueFormData.userId ||
                                      actionLoading
                                    }
                                    className="flex-1 bg-blue-600 text-white text-sm py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    {actionLoading ? (
                                      <Loader2 className="w-4 h-4 mx-auto animate-spin" />
                                    ) : (
                                      "Issue"
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setIssueMode(
                                        false
                                      )
                                    }
                                    className="flex-1 bg-gray-200 text-gray-800 text-sm py-1.5 rounded hover:bg-gray-300"
                                  >
                                    Cancel
                                  </button>

                                </div>

                              </div>
                            )}

                            {/* Review request: approve (with due date) or decline */}

                            {itemDetail.activeLoans?.[0]
                              ?.status ===
                              "REQUESTED" && (

                              isDemo ? (
                                <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-md border border-amber-200 flex items-start gap-2">
                                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                  This demo librarian account cannot approve, issue, or decline loan requests.
                                </div>
                              ) : (
                              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 space-y-3">

                                <h4 className="text-sm font-semibold text-indigo-900">
                                  Review Loan Request
                                </h4>

                                <p className="text-xs text-indigo-700">
                                  Requested by{" "}
                                  {itemDetail.activeLoans[0].borrower.name}
                                </p>

                                <div>
                                  <label className="text-xs text-gray-600 block mb-1">
                                    Due date (required to approve)
                                  </label>
                                  <input
                                    type="date"
                                    value={approveDueDate}
                                    onChange={(e) =>
                                      setApproveDueDate(e.target.value)
                                    }
                                    className="w-full text-sm rounded border-gray-300 p-2"
                                  />
                                </div>

                                <div className="flex gap-2">

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleLoanAction(
                                        "ISSUE",
                                        itemDetail.activeLoans[0].id,
                                        { dueDate: approveDueDate }
                                      )
                                    }
                                    disabled={
                                      actionLoading || !approveDueDate
                                    }
                                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                  >

                                    {actionLoading ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="w-4 h-4" />
                                    )}

                                    Approve

                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeclineRequest(
                                        itemDetail.activeLoans[0].id
                                      )
                                    }
                                    disabled={
                                      actionLoading
                                    }
                                    className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                  >

                                    <XCircle className="w-4 h-4" />

                                    Decline

                                  </button>

                                </div>

                              </div>
                              )
                            )}

                            {/* Return / Lost */}

                            {itemDetail.activeLoans?.[0]
                              ?.status ===
                              "ISSUED" && !isDemo && (

                              <div className="flex gap-2">

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleLoanAction(
                                      "RETURN",
                                      itemDetail
                                        .activeLoans[0]
                                        .id
                                    )
                                  }
                                  disabled={
                                    actionLoading
                                  }
                                  className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors text-sm disabled:opacity-50"
                                >
                                  Mark Returned
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleLoanAction(
                                      "LOST",
                                      itemDetail
                                        .activeLoans[0]
                                        .id
                                    )
                                  }
                                  disabled={
                                    actionLoading
                                  }
                                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors text-sm disabled:opacity-50"
                                >
                                  Mark Lost
                                </button>

                              </div>
                            )}

                          </div>

                        ) : (

                          // MEMBER VIEW

                          isDemo ? (

                            <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-md border border-amber-200 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                              This demo member account can browse the catalogue but cannot submit loan requests.
                            </div>

                          ) : isItemAvailable(
                            itemDetail
                          ) ? (

                            <button
                              type="button"
                              onClick={() =>
                                handleLoanAction(
                                  "REQUEST"
                                )
                              }
                              disabled={
                                actionLoading
                              }
                              className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >

                              {actionLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Calendar className="w-4 h-4" />
                              )}

                              Request Loan

                            </button>

                          ) : (

                            <div className="text-sm text-center text-gray-500 bg-gray-50 py-3 rounded-lg border border-gray-200">
                              Currently unavailable
                            </div>

                          )
                        )}

                      </div>

                    </div>

                    {/* ==================================================
                        CUSTODIANS
                    ================================================== */}

                    {isLibrarian && (

                      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">

                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">

                          <Users className="w-4 h-4 text-blue-600" />

                          Custodians

                        </h3>

                        <div className="space-y-3 mb-4">

                          {itemDetail.custodians?.map(
                            (custodian) => (

                              <div
                                key={
                                  custodian.user.id
                                }
                                className="flex justify-between items-center text-sm"
                              >

                                <div className="flex items-center gap-2">

                                  <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-medium text-xs">
                                    {custodian.user.name.charAt(
                                      0
                                    )}
                                  </div>

                                  <span className="text-gray-700">
                                    {
                                      custodian
                                        .user
                                        .name
                                    }
                                  </span>

                                </div>

                                {!isDemo && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveCustodian(
                                      custodian.user
                                        .id
                                    )
                                  }
                                  className="text-gray-400 hover:text-red-600 transition-colors"
                                  title="Remove Custodian"
                                >

                                  <Trash2 className="w-4 h-4" />

                                </button>
                                )}

                              </div>
                            )
                          )}

                          {(!itemDetail.custodians ||
                            itemDetail.custodians
                              .length === 0) && (

                            <p className="text-sm text-gray-500 italic">
                              No custodians assigned.
                            </p>

                          )}

                        </div>

                        {!isDemo && (
                        <div className="relative">

                          <select
                            className="w-full text-sm border-gray-300 rounded-lg py-2 pl-3 pr-8 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-gray-50"
                            defaultValue=""
                            onChange={(e) => {

                              const value =
                                e.target
                                  .value;

                              if (value) {
                                handleAddCustodian(
                                  value
                                );

                                e.target.value =
                                  "";
                              }

                            }}
                          >

                            <option
                              value=""
                              disabled
                            >
                              Add custodian...
                            </option>

                            {allUsers
                              .filter(
                                (u) =>
                                  u.role ===
                                    "LIBRARIAN" &&
                                  !itemDetail.custodians?.some(
                                    (c) =>
                                      c.user.id ===
                                      u.id
                                  )
                              )
                              .map(
                                (u) => (
                                  <option
                                    key={u.id}
                                    value={
                                      u.id
                                    }
                                  >
                                    {u.name}
                                  </option>
                                )
                              )}

                          </select>

                          <UserPlus className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />

                        </div>
                        )}

                      </div>
                    )}

                  </div>

                  {/* ==================================================
                      RIGHT COLUMN - LOAN HISTORY
                  ================================================== */}

                  <div className="lg:col-span-2">

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">

                      <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">

                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">

                          <History className="w-4 h-4 text-blue-600" />

                          Loan History

                        </h3>

                        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">

                          {itemDetail.loans?.length ||
                            0}{" "}
                          Records

                        </span>

                      </div>

                      <div className="p-0 overflow-y-auto max-h-[500px]">

                        {!itemDetail.loans ||
                        itemDetail.loans.length ===
                          0 ? (

                          <div className="text-center py-12 text-gray-500">

                            <Clock className="w-8 h-8 mx-auto mb-3 text-gray-300" />

                            <p>
                              No loan history for
                              this item.
                            </p>

                          </div>

                        ) : (

                          <div className="divide-y divide-gray-100">

                            {itemDetail.loans.map(
                              (loan) => (

                                <div
                                  key={loan.id}
                                  className="p-4 hover:bg-gray-50 transition-colors"
                                >

                                  <div
                                    className="flex justify-between items-start cursor-pointer group"
                                    onClick={() =>
                                      setExpandedLoanId(
                                        expandedLoanId ===
                                          loan.id
                                          ? null
                                          : loan.id
                                      )
                                    }
                                  >

                                    <div>

                                      <div className="flex items-center gap-2 mb-1">

                                        <StatusBadge
                                          status={
                                            loan.computedStatus
                                          }
                                        />

                                        <span
                                          className={`text-sm font-medium text-gray-900 ${isDemo ? "demo-blur" : ""}`}
                                          title={isDemo ? "Hidden for the demo librarian account" : undefined}
                                        >
                                          {
                                            loan
                                              .borrower
                                              .name
                                          }
                                        </span>

                                      </div>

                                      <div className="text-xs text-gray-500 flex flex-wrap gap-4">

                                        <span>
                                          Req:{" "}
                                          {format(
                                            new Date(
                                              loan.requestedDate
                                            ),
                                            "MMM d, yyyy"
                                          )}
                                        </span>

                                        {loan.issuedDate && (

                                          <span>
                                            Iss:{" "}
                                            {format(
                                              new Date(
                                                loan.issuedDate
                                              ),
                                              "MMM d, yyyy"
                                            )}
                                          </span>

                                        )}

                                        {loan.dueDate && (

                                          <span>
                                            Due:{" "}
                                            {format(
                                              new Date(
                                                loan.dueDate
                                              ),
                                              "MMM d, yyyy"
                                            )}
                                          </span>

                                        )}

                                        {loan.returnedDate && (

                                          <span>
                                            Returned:{" "}
                                            {format(
                                              new Date(
                                                loan.returnedDate
                                              ),
                                              "MMM d, yyyy"
                                            )}
                                          </span>

                                        )}

                                      </div>

                                    </div>

                                    <button
                                      type="button"
                                      className="text-gray-400 group-hover:text-blue-600 transition-colors p-1"
                                      onClick={(e) => {
                                        e.stopPropagation();

                                        setExpandedLoanId(
                                          expandedLoanId ===
                                            loan.id
                                            ? null
                                            : loan.id
                                        );
                                      }}
                                      aria-label={
                                        expandedLoanId ===
                                        loan.id
                                          ? "Collapse loan"
                                          : "Expand loan"
                                      }
                                    >

                                      {expandedLoanId ===
                                      loan.id ? (
                                        <ChevronUp className="w-5 h-5" />
                                      ) : (
                                        <ChevronDown className="w-5 h-5" />
                                      )}

                                    </button>

                                  </div>

                                  {/* Loan events */}

                                  {expandedLoanId ===
                                    loan.id && (

                                    <div className="mt-4 pt-4 border-t border-gray-100 pl-2">

                                      {loan.events &&
                                      loan.events
                                        .length >
                                        0 ? (

                                        <LoanTimeline
                                          events={loan.events ?? []}
                                          loanId={loan.id}
                                          isLibrarian={isLibrarian}
                                          isDemo={isDemo}
                                          onNoteAdded={() => {
                                            if (itemDetail) {
                                              fetchItemDetail(itemDetail.id);
                                            }
                                          }}
                                        />

                                      ) : (

                                        <div className="text-sm text-gray-500">

                                          No event history
                                          available.

                                        </div>

                                      )}

                                    </div>

                                  )}

                                </div>
                              )
                            )}

                          </div>

                        )}

                      </div>

                    </div>

                  </div>

                </div>

              ) : null}

            </div>

          </div>

        </div>
      )}

      {/* ======================================================
          BULK IMPORT
      ====================================================== */}

      {isLibrarian && (

        <BulkImportModal
          isOpen={
            isBulkImportOpen
          }
          onClose={() =>
            setIsBulkImportOpen(false)
          }
          onSuccess={() => {
            setIsBulkImportOpen(false);
            fetchItems();
          }}
        />

      )}

    </div>
  );
}