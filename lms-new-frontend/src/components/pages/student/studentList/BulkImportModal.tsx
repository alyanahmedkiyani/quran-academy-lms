"use client";

import { useEffect, useState } from "react";
import ExcelJS from "exceljs";
import { Alert, Button, Modal, Spin, Table, Typography, Upload } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { InboxOutlined, DownloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { bulkImportStudentsThunk, resetBulkImportStatus } from "@/core/redux/studentSlice";
import { BulkImportResult } from "@/services/studentService";

const { Dragger } = Upload;
const { Text, Title } = Typography;

// ─── Template CSV content ─────────────────────────────────────────────────────
const TEMPLATE_HEADERS = [
  "firstName",
  "lastName",
  "username",
  "password",
  "email",
  "contact",
  "address",
  "dateOfBirth",
  "guardian",
  "emergencyContact",
  "countryName",
  "state",
  "city",
  "timeZone",
  "classTime",
  "newClassTime",
  "nameForTeacher",
  "shift",
  "studentLabel",
  "struckOffReason",
  "enrollmentChannel",
  "referenceDetails",
  "planId",
];

const SAMPLE_ROW = [
  "John",          // firstName
  "Doe",           // lastName
  "johndoe01",     // username
  "secret123",     // password
  "john@example.com", // email
  "+1234567890",   // contact
  "123 Main St",   // address
  "2000-01-15",    // dateOfBirth
  "Jane Doe",      // guardian
  "+0987654321",   // emergencyContact
  "United States", // countryName
  "California",    // state
  "Los Angeles",   // city
  "America/Los_Angeles", // timeZone
  "09:00",         // classTime
  "17:00",         // newClassTime
  "JD",            // nameForTeacher
  "Morning",       // shift (Morning | Afternoon | Evening | blank)
  "New Enrollment",// studentLabel (Unassigned | Trial | New Enrollment | Lost | Struck off | blank)
  "",              // struckOffReason (only if studentLabel = Struck off)
  "Meta",          // enrollmentChannel (Meta | Google | TikTok | SEO | Email | Reference | blank)
  "",              // referenceDetails (only if enrollmentChannel = Reference)
  "1",             // planId (required — numeric ID of an existing plan)
];

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top:    { style: "thin", color: { argb: "FFD0D0D0" } },
  left:   { style: "thin", color: { argb: "FFD0D0D0" } },
  bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
  right:  { style: "thin", color: { argb: "FFD0D0D0" } },
};

const downloadTemplate = async () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "LMS";
  wb.created = new Date();

  // ─────────────────────────────────────────────────────────────────────────────
  // SHEET 1 — Instructions
  // ─────────────────────────────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("Instructions", {
    properties: { tabColor: { argb: "FF4F46E5" } },
  });

  ws1.columns = [
    { width: 24 },  // A – Column name
    { width: 11 },  // B – Required
    { width: 52 },  // C – Allowed values
    { width: 40 },  // D – Notes
  ];

  // ── Title banner ──────────────────────────────────────────────────────────
  ws1.mergeCells("A1:D1");
  const titleCell = ws1.getCell("A1");
  titleCell.value = "STUDENT BULK IMPORT — INSTRUCTIONS";
  titleCell.font  = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
  titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws1.getRow(1).height = 36;

  // ── How-to steps ──────────────────────────────────────────────────────────
  ws1.addRow([]);

  const stepsHeader = ws1.addRow(["HOW TO USE THIS TEMPLATE"]);
  stepsHeader.getCell(1).font = { bold: true, size: 11, color: { argb: "FF4F46E5" } };
  ws1.getRow(stepsHeader.number).height = 20;

  const steps = [
    "1.  Read this sheet carefully.",
    "2.  Switch to the \"Student Data\" tab (second sheet).",
    "3.  Fill in one student per row starting from row 2  (do NOT edit row 1 — it's the header).",
    "4.  Save the file  (keep it as .xlsx — no need to convert to CSV).",
    "5.  Upload the .xlsx file in the Bulk Import modal and click Import.",
  ];
  steps.forEach((step) => {
    const r = ws1.addRow([step]);
    r.getCell(1).font = { size: 10.5 };
    r.getCell(1).alignment = { wrapText: true };
    ws1.getRow(r.number).height = 18;
    ws1.mergeCells(`A${r.number}:D${r.number}`);
  });

  ws1.addRow([]);

  // ── Field reference header ─────────────────────────────────────────────
  const refTitle = ws1.addRow(["FIELD REFERENCE"]);
  refTitle.getCell(1).font = { bold: true, size: 11, color: { argb: "FF4F46E5" } };
  ws1.getRow(refTitle.number).height = 20;

  const colHeader = ws1.addRow(["Column", "Required", "Allowed Values / Format", "Notes"]);
  colHeader.eachCell((cell) => {
    cell.font    = { bold: true, size: 10.5, color: { argb: "FFFFFFFF" } };
    cell.fill    = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    cell.border  = THIN_BORDER;
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  ws1.getRow(colHeader.number).height = 22;

  // ── Field rows ────────────────────────────────────────────────────────
  const FIELDS: [string, boolean, string, string][] = [
    ["firstName",         true,  "Any text",                                                   "Student's first name"],
    ["lastName",          false, "Any text",                                                   ""],
    ["username",          true,  "Min 3 characters, must be unique",                           "Used to log in"],
    ["password",          true,  "Min 6 characters",                                           "Will be hashed — do not share"],
    ["email",             false, "Valid email  e.g. john@example.com",                         ""],
    ["contact",           false, "Phone with country code  e.g. +12025550123",                 ""],
    ["address",           false, "Any text",                                                   ""],
    ["dateOfBirth",       false, "YYYY-MM-DD  e.g. 2000-01-15",                               ""],
    ["guardian",          false, "Any text",                                                   "Guardian full name"],
    ["emergencyContact",  false, "Phone number",                                               ""],
    ["countryName",       false, "Any text  e.g. United States",                              ""],
    ["state",             false, "Any text",                                                   ""],
    ["city",              false, "Any text",                                                   ""],
    ["timeZone",          false, "IANA string  e.g. America/New_York",                        ""],
    ["classTime",         false, "HH:MM (24-hour)",                                           "Preferred class start time"],
    ["newClassTime",      false, "HH:MM (24-hour)",                                           "Alternative class time"],
    ["nameForTeacher",    false, "Any text",                                                   "Nickname shown to teacher"],
    ["shift",             false, "Morning | Afternoon | Evening",                              "Leave blank if not assigned"],
    ["studentLabel",      false, "Unassigned | Trial | New Enrollment | Lost | Struck off",   "Leave blank for Unassigned"],
    ["struckOffReason",   false, "Any text",                                                   "Only if studentLabel = Struck off"],
    ["enrollmentChannel", false, "Meta | Google | TikTok | SEO | Email | Reference",          "Leave blank if unknown"],
    ["referenceDetails",  false, "Any text",                                                   "Only if enrollmentChannel = Reference"],
    ["planId",            true,  "Number — ID of an existing plan",                            "Ask admin for the correct Plan ID"],
  ];

  FIELDS.forEach(([col, required, allowed, notes], i) => {
    const r = ws1.addRow([col, required ? "YES" : "optional", allowed, notes]);
    const isEven = i % 2 === 0;

    r.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = THIN_BORDER;
      cell.font   = { size: 10 };
      cell.fill   = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: isEven ? "FFF8FAFC" : "FFFFFFFF" },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    });

    // Required badge colouring
    const reqCell = r.getCell(2);
    if (required) {
      reqCell.font = { bold: true, size: 10, color: { argb: "FF166534" } };
      reqCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
    } else {
      reqCell.font = { size: 10, color: { argb: "FF6B7280" } };
    }
    reqCell.alignment = { horizontal: "center", vertical: "middle" };

    ws1.getRow(r.number).height = 18;
  });

  // ── Footer note ───────────────────────────────────────────────────────
  ws1.addRow([]);
  const noteRow = ws1.addRow(["★  Columns marked YES are required. All others are optional — leave blank if unknown."]);
  ws1.mergeCells(`A${noteRow.number}:D${noteRow.number}`);
  noteRow.getCell(1).font      = { italic: true, size: 10, color: { argb: "FF6B7280" } };
  noteRow.getCell(1).alignment = { wrapText: true };

  // ─────────────────────────────────────────────────────────────────────────────
  // SHEET 2 — Student Data
  // ─────────────────────────────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Student Data", {
    properties: { tabColor: { argb: "FF16A34A" } },
  });

  ws2.columns = TEMPLATE_HEADERS.map((h) => ({ header: h, width: 22 }));

  // Style the header row
  const headerRow = ws2.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font      = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    cell.border    = THIN_BORDER;
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Required columns get a teal accent
  const REQUIRED_COLS = ["firstName", "username", "password", "planId"];
  REQUIRED_COLS.forEach((col) => {
    const idx = TEMPLATE_HEADERS.indexOf(col) + 1;
    if (idx > 0) {
      const cell = headerRow.getCell(idx);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    }
  });

  // Sample data row
  const sampleRow = ws2.addRow(SAMPLE_ROW);
  sampleRow.height = 18;
  sampleRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font      = { size: 10.5, italic: true, color: { argb: "FF64748B" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };
    cell.border    = THIN_BORDER;
    cell.alignment = { vertical: "middle" };
  });

  // Freeze the header row so it stays visible while scrolling
  ws2.views = [{ state: "frozen", ySplit: 1 }];

  // ── Download ────────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = "student_import_template.xlsx";
  link.click();
  URL.revokeObjectURL(url);
};

// ─── Component ───────────────────────────────────────────────────────────────
interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
}

export default function BulkImportModal({ open, onClose }: BulkImportModalProps) {
  const dispatch = useAppDispatch();
  const bulkImportStatus = useAppSelector((s) => s.students.bulkImportStatus);

  const [fileList, setFileList]             = useState<UploadFile[]>([]);
  const [selectedFile, setSelectedFile]     = useState<File | null>(null);
  const [result, setResult]                 = useState<BulkImportResult | null>(null);
  const [importError, setImportError]       = useState<string | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);

  const isLoading = bulkImportStatus === "loading";

  const handleDownloadTemplate = async () => {
    setTemplateLoading(true);
    try {
      await downloadTemplate();
    } finally {
      setTemplateLoading(false);
    }
  };

  // Reset state when modal closes / re-opens
  useEffect(() => {
    if (!open) {
      setFileList([]);
      setSelectedFile(null);
      setResult(null);
      setImportError(null);
      dispatch(resetBulkImportStatus());
    }
  }, [open, dispatch]);

  const handleImport = async () => {
    if (!selectedFile) return;
    setResult(null);
    setImportError(null);

    try {
      const resultData = await dispatch(
        bulkImportStudentsThunk(selectedFile)
      ).unwrap();
      setResult(resultData);
    } catch (err: unknown) {
      setImportError(
        typeof err === "string" ? err : (err as { message?: string })?.message ?? "Import failed."
      );
    }
  };

  const failedColumns = [
    { title: "Row", dataIndex: "row", key: "row", width: 70 },
    { title: "Reason", dataIndex: "reason", key: "reason" },
  ];

  const footer = result ? (
    <Button onClick={onClose}>Close</Button>
  ) : (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <Button onClick={onClose} disabled={isLoading}>Cancel</Button>
      <Button
        type="primary"
        onClick={handleImport}
        disabled={!selectedFile || isLoading}
        loading={isLoading}
        icon={<CheckCircleOutlined />}
      >
        Import
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      title={
        <span>
          <i className="ti ti-file-import me-2" />
          Bulk Import Students
        </span>
      }
      onCancel={() => { if (!isLoading) onClose(); }}
      footer={footer}
      width={640}
      destroyOnClose
    >
      {/* ── Step 1: Download template ──────────────────────────────────── */}
      {!result && (
        <>
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "14px 16px",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <Text strong>Step 1 — Download the template</Text>
                <div style={{ marginTop: 2 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Read the Instructions tab, fill the "Student Data" tab, then upload the file below.
                    Required fields: <strong>firstName, username, password, planId</strong>.
                  </Text>
                </div>
              </div>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadTemplate}
                loading={templateLoading}
                style={{ whiteSpace: "nowrap", marginLeft: 12 }}
              >
                Download Template
              </Button>
            </div>
          </div>

          {/* ── Step 2: Upload ─────────────────────────────────────────── */}
          <Text strong>Step 2 — Upload your CSV file</Text>
          <div style={{ marginTop: 10 }}>
            <Dragger
              accept=".xlsx,.csv"
              maxCount={1}
              fileList={fileList}
              beforeUpload={(file) => {
                setSelectedFile(file as unknown as File);
                setFileList([file as unknown as UploadFile]);
                setResult(null);
                setImportError(null);
                return false; // prevent auto-upload
              }}
              onRemove={() => {
                setSelectedFile(null);
                setFileList([]);
                setResult(null);
                setImportError(null);
              }}
              disabled={isLoading}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag the filled .xlsx file here</p>
              <p className="ant-upload-hint" style={{ fontSize: 12 }}>
                Accepts .xlsx (recommended) or .csv — Max 10 MB.
              </p>
            </Dragger>
          </div>

          {importError && (
            <Alert
              type="error"
              message={importError}
              style={{ marginTop: 16 }}
              showIcon
              closable
              onClose={() => setImportError(null)}
            />
          )}

          {isLoading && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <Spin tip="Importing students…" />
            </div>
          )}
        </>
      )}

      {/* ── Results ───────────────────────────────────────────────────── */}
      {result && (
        <div>
          <Alert
            type={result.imported > 0 ? "success" : "warning"}
            icon={<CheckCircleOutlined />}
            showIcon
            message={
              result.imported > 0
                ? `${result.imported} student${result.imported !== 1 ? "s" : ""} imported successfully.`
                : "No students were imported."
            }
            style={{ marginBottom: result.failed.length > 0 ? 16 : 0 }}
          />

          {result.failed.length > 0 && (
            <>
              <Alert
                type="error"
                icon={<CloseCircleOutlined />}
                showIcon
                message={`${result.failed.length} row${result.failed.length !== 1 ? "s" : ""} failed — see details below.`}
                style={{ marginBottom: 12 }}
              />
              <Table
                size="small"
                dataSource={result.failed.map((f, i) => ({ ...f, key: i }))}
                columns={failedColumns}
                pagination={result.failed.length > 10 ? { pageSize: 10 } : false}
                scroll={{ y: 260 }}
              />
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
