import Papa from "papaparse";
import prisma from "./prisma";
import { BulkImportResponse, BulkImportRowResult } from "@/types";

export interface ItemCsvRow {
  code?: string;
  title?: string;
  category?: string;
  description?: string;
  [key: string]: any;
}

export async function processItemCsvImport(
  csvText: string
): Promise<BulkImportResponse> {
  const parsed = Papa.parse<ItemCsvRow>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const results: BulkImportRowResult[] = [];
  let successCount = 0;
  let failedCount = 0;

  const rows = parsed.data;

  // Process rows sequentially to track duplicate codes within CSV as well as DB
  const seenCodesInBatch = new Set<string>();

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNumber = index + 2; // +1 for 0-index, +1 for CSV header row
    const rawData: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      rawData[k] = String(v ?? "").trim();
    }

    const code = rawData.code;
    const title = rawData.title;
    const category = rawData.category;
    const description = rawData.description || "";

    // Validation checks
    if (!code) {
      results.push({
        rowNumber,
        data: rawData,
        error: "Missing required column 'code'.",
        success: false,
      });
      failedCount++;
      continue;
    }

    if (!title) {
      results.push({
        rowNumber,
        data: rawData,
        error: "Missing required column 'title'.",
        success: false,
      });
      failedCount++;
      continue;
    }

    if (!category) {
      results.push({
        rowNumber,
        data: rawData,
        error: "Missing required column 'category'.",
        success: false,
      });
      failedCount++;
      continue;
    }

    if (seenCodesInBatch.has(code.toLowerCase())) {
      results.push({
        rowNumber,
        data: rawData,
        error: `Duplicate code '${code}' encountered within the same CSV upload.`,
        success: false,
      });
      failedCount++;
      continue;
    }

    // Check if code exists in DB
    const existing = await prisma.catalogueItem.findUnique({
      where: { code },
    });

    if (existing) {
      results.push({
        rowNumber,
        data: rawData,
        error: `Item code '${code}' already exists in the catalogue.`,
        success: false,
      });
      failedCount++;
      continue;
    }

    // Insert valid item
    try {
      await prisma.catalogueItem.create({
        data: {
          code,
          title,
          category,
          description: description || null,
        },
      });

      seenCodesInBatch.add(code.toLowerCase());
      results.push({
        rowNumber,
        data: rawData,
        success: true,
      });
      successCount++;
    } catch (err: any) {
      results.push({
        rowNumber,
        data: rawData,
        error: err.message || "Failed to create catalogue item in database.",
        success: false,
      });
      failedCount++;
    }
  }

  return {
    totalProcessed: rows.length,
    successCount,
    failedCount,
    results,
  };
}

export function generateActiveLoansCsv(
  loans: {
    item: { code: string; title: string; category: string };
    borrower: { name: string; email: string };
    requestedDate: Date | string;
    issuedDate?: Date | string | null;
    dueDate?: Date | string | null;
    status: string;
    computedStatus: string;
  }[]
): string {
  const data = loans.map((l) => ({
    "Item Code": l.item.code,
    "Item Title": l.item.title,
    Category: l.item.category,
    "Borrower Name": l.borrower.name,
    "Borrower Email": l.borrower.email,
    "Requested Date": l.requestedDate
      ? new Date(l.requestedDate).toISOString().split("T")[0]
      : "",
    "Issued Date": l.issuedDate
      ? new Date(l.issuedDate).toISOString().split("T")[0]
      : "",
    "Due Date": l.dueDate
      ? new Date(l.dueDate).toISOString().split("T")[0]
      : "",
    Status: l.computedStatus,
  }));

  return Papa.unparse(data);
}
