import { NextRequest, NextResponse } from "next/server";
import { requireFullLibrarian } from "@/lib/auth";
import { processItemCsvImport } from "@/lib/csv-helper";

export async function POST(req: NextRequest) {
  try {
    await requireFullLibrarian();

    const contentType = req.headers.get("content-type") || "";
    let csvText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          { error: "No CSV file provided in upload." },
          { status: 400 }
        );
      }
      csvText = await file.text();
    } else {
      const body = await req.json();
      csvText = body.csvText;
    }

    if (!csvText || csvText.trim().length === 0) {
      return NextResponse.json(
        { error: "CSV data is empty." },
        { status: 400 }
      );
    }

    const report = await processItemCsvImport(csvText);

    return NextResponse.json(report, { status: 200 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Only librarians can perform bulk imports." },
        { status: 403 }
      );
    }
    console.error("Bulk import error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process CSV import." },
      { status: 500 }
    );
  }
}
