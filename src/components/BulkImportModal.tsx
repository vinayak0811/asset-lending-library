"use client";

import React, { useState } from "react";
import { BulkImportResponse } from "@/types";
import {
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  RotateCcw,
} from "lucide-react";

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SAMPLE_CSV = `code,title,category,description
CAM-004,Sony Alpha A7 IV Camera,Audio/Visual,Full-frame mirrorless camera with 28-70mm kit lens
TOOL-005,DeWalt 20V Max Cordless Drill,Power Tools,Includes 2 batteries and charger kit
PROJ-003,Epson PowerLite 1080p Projector,Audio/Visual,3800 lumens HDMI projector
CAM-001,Duplicate Test Camera,Audio/Visual,This will intentionally fail because CAM-001 already exists
TOOL-999,,Power Tools,This will intentionally fail because title is missing`;

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [csvText, setCsvText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkImportResponse | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText((event.target?.result as string) || "");
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setCsvText(SAMPLE_CSV);
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) {
      setError("Please paste or upload CSV content first.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/catalogue/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process bulk import.");
      }

      setResult(data);
      if (data.successCount > 0) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setCsvText("");
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Bulk Import Catalogue Items
              </h3>
              <p className="text-xs text-slate-500">
                Upload or paste a CSV file to add multiple items at once
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700">
                  CSV Data (Columns: <code className="text-blue-600">code, title, category, description</code>)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 transition"
                  >
                    Load Sample CSV (with valid & failing rows)
                  </button>
                </div>
              </div>

              {/* Text Area */}
              <textarea
                rows={7}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="code,title,category,description&#10;CAM-101,4K Cinema Camera,Audio/Visual,Cinema rig&#10;TOOL-202,Laser Level,Power Tools,Self-leveling 360"
                className="w-full px-3.5 py-2.5 font-mono text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-inner"
              />

              {/* File Upload Alternative */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span>Or upload a .csv file from your computer:</span>
                </div>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 cursor-pointer"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !csvText.trim()}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition"
                >
                  {isProcessing ? "Processing Rows..." : "Process Bulk Import"}
                </button>
              </div>
            </form>
          ) : (
            /* Result Report Section */
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                  <div className="text-xl font-bold text-slate-900">
                    {result.totalProcessed}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    Total Processed
                  </div>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
                  <div className="text-xl font-bold text-emerald-700">
                    {result.successCount}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-medium">
                    Imported Successfully
                  </div>
                </div>
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-center">
                  <div className="text-xl font-bold text-rose-700">
                    {result.failedCount}
                  </div>
                  <div className="text-[11px] text-rose-600 font-medium">
                    Rejected / Failed
                  </div>
                </div>
              </div>

              {/* Per-Row Detail Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 flex justify-between">
                  <span>Per-Row Execution Report</span>
                  <span>{result.results.length} rows evaluated</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-200">
                  {result.results.map((row, idx) => (
                    <div
                      key={idx}
                      className={`p-3 text-xs flex items-start justify-between gap-3 ${
                        row.success ? "bg-white" : "bg-rose-50/50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                          Row {row.rowNumber}
                        </span>
                        <div>
                          <div className="font-medium text-slate-900">
                            {row.data.code || "—"} · {row.data.title || "(Missing title)"}
                          </div>
                          {row.data.category && (
                            <div className="text-[11px] text-slate-500">
                              Category: {row.data.category}
                            </div>
                          )}
                          {!row.success && (
                            <p className="text-xs font-semibold text-rose-700 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              {row.error}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        {row.success ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Imported
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                            <AlertCircle className="w-3 h-3" /> Rejected
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Import Another CSV
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
