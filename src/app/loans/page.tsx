"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { LoanTimeline } from '@/components/LoanTimeline';
import { LoanDTO, BulkReturnResponse } from '@/types';
import { format, isPast, parseISO } from 'date-fns';
import {
  Search, Filter, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  ArrowUpDown, Download, RotateCcw, Eye, X, CheckCircle2, AlertCircle,
  Package, User, Calendar, Clock, Loader2, FileDown, CheckSquare, Square
} from 'lucide-react';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function LoansPage() {
  const { user } = useAuth();
  const isLibrarian = user?.role === 'LIBRARIAN';
  const isDemo = !!user?.isDemo;

  // Fetch State
  const [loans, setLoans] = useState<LoanDTO[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination State
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [status, setStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('requestedDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Selection State
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [isBulkReturning, setIsBulkReturning] = useState(false);
  const [bulkReturnResult, setBulkReturnResult] = useState<BulkReturnResponse | null>(null);

  // Detail Modal State
  const [selectedLoan, setSelectedLoan] = useState<LoanDTO | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [actionDueDate, setActionDueDate] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState('');

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(status !== 'ALL' && { status }),
      });

      const response = await fetch(`/api/loans?${query.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch loans');
      
      const data = await response.json();
      setLoans(data.loans || []);
      setTotalItems(data.pagination?.totalCount || 0);
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortOrder, debouncedSearch, status]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const toggleSelectAll = () => {
    if (selectedLoanIds.length === loans.length) {
      setSelectedLoanIds([]);
    } else {
      setSelectedLoanIds(loans.map((l) => l.id));
    }
  };

  const toggleSelectLoan = (id: string) => {
    setSelectedLoanIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkReturn = async () => {
    if (!selectedLoanIds.length) return;
    setIsBulkReturning(true);
    try {
      const response = await fetch('/api/loans/bulk-return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanIds: selectedLoanIds }),
      });
      const result: BulkReturnResponse = await response.json();
      setBulkReturnResult(result);
      if (result.successCount > 0) {
        fetchLoans();
        setSelectedLoanIds([]);
      }
    } catch (error) {
      console.error('Bulk return failed:', error);
    } finally {
      setIsBulkReturning(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/loans/export');
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loans_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export CSV:', error);
    }
  };

  const openLoanModal = (loan: LoanDTO) => {
    setSelectedLoan(loan);
    setActionNotes('');
    setActionDueDate('');
    setTransitionError('');
    setIsModalOpen(true);
  };

  const handleTransition = async (action: string, notesOverride?: string) => {
    if (!selectedLoan) return;
    setIsTransitioning(true);
    setTransitionError('');

    try {
      // The transition endpoint expects "MARK_LOST", not "LOST".
      const transitionAction = action === 'LOST' ? 'MARK_LOST' : action;
      const payload: any = { action: transitionAction };
      const effectiveNotes = notesOverride !== undefined ? notesOverride : actionNotes;
      if (effectiveNotes.trim()) payload.notes = effectiveNotes.trim();
      if (action === 'ISSUE') {
        if (!actionDueDate) {
          throw new Error('Due date is required to issue an item');
        }
        payload.dueDate = actionDueDate;
      }

      const response = await fetch(`/api/loans/${selectedLoan.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transition failed');
      }

      // The transition endpoint's response doesn't include the full
      // event timeline, so re-fetch the loan detail (which does) to
      // keep the open modal's timeline accurate and complete.
      const detailResponse = await fetch(`/api/loans/${selectedLoan.id}`);
      if (detailResponse.ok) {
        const refreshed = await detailResponse.json();
        setSelectedLoan(refreshed);
      }

      setActionNotes('');
      setActionDueDate('');
      fetchLoans();
    } catch (err: any) {
      setTransitionError(err.message || 'An error occurred');
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleDeclineRequest = () => {
    const reason = window.prompt('Reason for declining this request (optional):');
    if (reason === null) return; // cancelled
    handleTransition('DECLINE', reason);
  };

  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  const renderSortIcon = (column: string) => {
    if (sortBy !== column) return <ArrowUpDown className="w-4 h-4 ml-1 text-gray-400" />;
    return sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 ml-1 text-blue-600" /> : <ChevronDown className="w-4 h-4 ml-1 text-blue-600" />;
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Loans Management</h1>
        
        {isLibrarian && !isDemo && (
          <div className="flex gap-2">
            {selectedLoanIds.length > 0 && (
              <button
                onClick={handleBulkReturn}
                disabled={isBulkReturning}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {isBulkReturning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                Return Selected ({selectedLoanIds.length})
              </button>
            )}
            <button
              onClick={handleExportCSV}
              className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors bg-white"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export CSV
            </button>
          </div>
        )}
      </div>

      {isDemo && (
        <div className="mb-6 p-3 bg-amber-50 text-amber-800 text-sm rounded-md border border-amber-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {isLibrarian
            ? "Demo librarian mode: you can view all loans, but member names are hidden and approval actions are disabled."
            : "Demo member mode: you can view your loan history, but you cannot submit new requests."}
        </div>
      )}

      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by item title or borrower name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="REQUESTED">Requested</option>
              <option value="ISSUED">Issued</option>
              <option value="OVERDUE">Overdue</option>
              <option value="RETURNED">Returned</option>
              <option value="LOST">Lost</option>
              <option value="DECLINED">Declined</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b text-gray-700 uppercase">
              <tr>
                {isLibrarian && !isDemo && (
                  <th className="px-6 py-3 w-12 text-center">
                    <button onClick={toggleSelectAll} className="text-gray-500 hover:text-blue-600 focus:outline-none">
                      {selectedLoanIds.length === loans.length && loans.length > 0 ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </th>
                )}
                <th 
                  className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('item')}
                >
                  <div className="flex items-center">Item {renderSortIcon('item')}</div>
                </th>
                <th 
                  className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('borrower')}
                >
                  <div className="flex items-center">Borrower {renderSortIcon('borrower')}</div>
                </th>
                <th 
                  className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">Status {renderSortIcon('status')}</div>
                </th>
                <th 
                  className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('requestedDate')}
                >
                  <div className="flex items-center">Requested {renderSortIcon('requestedDate')}</div>
                </th>
                <th 
                  className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('dueDate')}
                >
                  <div className="flex items-center">Due Date {renderSortIcon('dueDate')}</div>
                </th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={isLibrarian ? 7 : 6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                    <p className="mt-2 text-gray-500">Loading loans...</p>
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={isLibrarian ? 7 : 6} className="px-6 py-12 text-center text-gray-500">
                    No loans found matching your criteria.
                  </td>
                </tr>
              ) : (
                loans.map((loan) => {
                  const isLoanOverdue = loan.dueDate && isPast(parseISO(loan.dueDate)) && loan.status === 'ISSUED';
                  
                  return (
                    <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                      {isLibrarian && !isDemo && (
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => toggleSelectLoan(loan.id)}
                            className="text-gray-500 hover:text-blue-600 focus:outline-none"
                          >
                            {selectedLoanIds.includes(loan.id) ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{loan.item.title}</div>
                        <div className="text-xs text-gray-500">{loan.item.code}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-gray-900 ${isDemo ? 'demo-blur' : ''}`} title={isDemo ? 'Hidden for the demo librarian account' : undefined}>{loan.borrower.name}</div>
                        <div className={`text-xs text-gray-500 ${isDemo ? 'demo-blur' : ''}`} title={isDemo ? 'Hidden for the demo librarian account' : undefined}>{loan.borrower.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={isLoanOverdue ? 'OVERDUE' : loan.status} />
                      </td>
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                        {format(parseISO(loan.requestedDate), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {loan.dueDate ? (
                          <span className={isLoanOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                            {format(parseISO(loan.dueDate), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openLoanModal(loan)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalItems > 0 && (
          <div className="bg-white px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{Math.min((page - 1) * pageSize + 1, totalItems)}</span> to{' '}
              <span className="font-medium">{Math.min(page * pageSize, totalItems)}</span> of{' '}
              <span className="font-medium">{totalItems}</span> results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Return Result Modal */}
      {bulkReturnResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Bulk Return Results</h3>
              <button onClick={() => setBulkReturnResult(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <div className="flex gap-4 mb-4">
                <div className="bg-green-50 p-3 rounded-lg flex-1 border border-green-100">
                  <div className="text-green-800 font-medium">Successful</div>
                  <div className="text-2xl font-bold text-green-600">{bulkReturnResult.successCount}</div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg flex-1 border border-red-100">
                  <div className="text-red-800 font-medium">Failed</div>
                  <div className="text-2xl font-bold text-red-600">{bulkReturnResult.failedCount}</div>
                </div>
              </div>

              {bulkReturnResult.results && bulkReturnResult.results.length > 0 && (
                <div className="mt-4 max-h-48 overflow-y-auto border border-gray-200 rounded-md divide-y">
                  {bulkReturnResult.results.map((row, i) => (
                    <div
                      key={row.loanId || i}
                      className={`p-3 text-sm flex items-start gap-2 ${
                        row.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {row.success ? (
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <span className="font-semibold">
                          {row.itemTitle || row.loanId}
                        </span>
                        : {row.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setBulkReturnResult(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loan Detail Modal */}
      {isModalOpen && selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                Loan Details
                <StatusBadge 
                  status={selectedLoan.dueDate && isPast(parseISO(selectedLoan.dueDate)) && selectedLoan.status === 'ISSUED' ? 'OVERDUE' : selectedLoan.status} 
                />
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Item Info */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" /> Item Information
                  </h3>
                  <div className="space-y-2">
                    <p><span className="text-gray-500">Title:</span> <span className="font-medium text-gray-900">{selectedLoan.item.title}</span></p>
                    <p><span className="text-gray-500">Code:</span> <span className="text-gray-900">{selectedLoan.item.code}</span></p>
                    {selectedLoan.item.category && (
                      <p><span className="text-gray-500">Category:</span> <span className="text-gray-900">{selectedLoan.item.category}</span></p>
                    )}
                  </div>
                </div>

                {/* Borrower Info */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" /> Borrower Information
                  </h3>
                  <div className="space-y-2">
                    <p><span className="text-gray-500">Name:</span> <span className={`font-medium text-gray-900 ${isDemo ? 'demo-blur' : ''}`} title={isDemo ? 'Hidden for the demo librarian account' : undefined}>{selectedLoan.borrower.name}</span></p>
                    <p><span className="text-gray-500">Email:</span> <span className={`text-gray-900 ${isDemo ? 'demo-blur' : ''}`} title={isDemo ? 'Hidden for the demo librarian account' : undefined}>{selectedLoan.borrower.email}</span></p>
                  </div>
                </div>
                
                {/* Dates Info */}
                <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg border border-gray-100 flex flex-wrap gap-6">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-xs text-gray-500 uppercase font-semibold">Requested</div>
                      <div className="text-gray-900">{format(parseISO(selectedLoan.requestedDate), 'MMM d, yyyy HH:mm')}</div>
                    </div>
                  </div>
                  
                  {selectedLoan.issuedDate && (
                    <div className="flex items-start gap-2">
                      <Clock className="w-5 h-5 text-blue-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-gray-500 uppercase font-semibold">Issued</div>
                        <div className="text-gray-900">{format(parseISO(selectedLoan.issuedDate), 'MMM d, yyyy HH:mm')}</div>
                      </div>
                    </div>
                  )}

                  {selectedLoan.dueDate && (
                    <div className="flex items-start gap-2">
                      <Calendar className="w-5 h-5 text-orange-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-gray-500 uppercase font-semibold">Due Date</div>
                        <div className={`font-medium ${selectedLoan.status === 'ISSUED' && isPast(parseISO(selectedLoan.dueDate)) ? 'text-red-600' : 'text-gray-900'}`}>
                          {format(parseISO(selectedLoan.dueDate), 'MMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedLoan.returnedDate && (
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <div className="text-xs text-gray-500 uppercase font-semibold">Returned</div>
                        <div className="text-gray-900">{format(parseISO(selectedLoan.returnedDate), 'MMM d, yyyy HH:mm')}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Librarian Actions */}
              {isLibrarian && ['REQUESTED', 'ISSUED'].includes(selectedLoan.status) && (
                <div className="mb-8 p-5 border border-blue-100 bg-blue-50/30 rounded-lg">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Librarian Actions</h3>
                  
                  {transitionError && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-100 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      {transitionError}
                    </div>
                  )}

                  {isDemo ? (
                    <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-md border border-amber-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      This demo librarian account is view-only and cannot approve, issue, decline, return, or mark items lost.
                    </div>
                  ) : (
                  <div className="space-y-4">
                    {selectedLoan.status === 'REQUESTED' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Set Due Date *</label>
                        <input
                          type="date"
                          value={actionDueDate}
                          onChange={(e) => setActionDueDate(e.target.value)}
                          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Action Notes (Optional)</label>
                      <textarea
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        placeholder="Add any relevant notes..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        rows={2}
                      />
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      {selectedLoan.status === 'REQUESTED' && (
                        <>
                          <button
                            onClick={() => handleTransition('ISSUE')}
                            disabled={isTransitioning || !actionDueDate}
                            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {isTransitioning ? 'Processing...' : 'Approve & Issue'}
                          </button>
                          <button
                            onClick={handleDeclineRequest}
                            disabled={isTransitioning}
                            className="px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            Decline Request
                          </button>
                        </>
                      )}
                      
                      {selectedLoan.status === 'ISSUED' && (
                        <>
                          <button
                            onClick={() => handleTransition('RETURN')}
                            disabled={isTransitioning}
                            className="px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            Mark Returned
                          </button>
                          <button
                            onClick={() => handleTransition('LOST')}
                            disabled={isTransitioning}
                            className="px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            Mark Lost
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              )}

              {/* Timeline */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">History Timeline</h3>
                <LoanTimeline
                  events={selectedLoan.events || []}
                  loanId={selectedLoan.id}
                  isLibrarian={isLibrarian}
                  isDemo={isDemo}
                  onNoteAdded={async () => {
                    const detailResponse = await fetch(`/api/loans/${selectedLoan.id}`);
                    if (detailResponse.ok) {
                      const refreshed = await detailResponse.json();
                      setSelectedLoan(refreshed);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
