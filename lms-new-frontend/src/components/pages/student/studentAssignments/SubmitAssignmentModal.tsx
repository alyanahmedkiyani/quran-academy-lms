"use client";

import { useRef, useState } from "react";
import { submitAssignment } from "@/services/assignmentService";
import { useNotification } from "@/hooks/useNotification";

interface Props {
  submittedAssignmentId: number;
  assignmentTitle: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const SubmitAssignmentModal = ({
  submittedAssignmentId,
  assignmentTitle,
  onClose,
  onSubmitted,
}: Props) => {
  const notify = useNotification();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async () => {
    if (!file) {
      notify.error("Please select a file to upload.");
      return;
    }
    setUploading(true);
    try {
      await submitAssignment(submittedAssignmentId, file);
      notify.success("Assignment submitted successfully!");
      onSubmitted();
      onClose();
    } catch (err: unknown) {
      notify.error((err as Error).message ?? "Failed to submit assignment");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      style={{ background: "rgba(0,0,0,0.6)", zIndex: 1055 }}
      onClick={(e) => { if (e.target === e.currentTarget && !uploading) onClose(); }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title fw-bold">
              <i className="ti ti-upload me-2 text-primary" />
              Submit Assignment
            </h5>
            {!uploading && (
              <button type="button" className="btn-close" onClick={onClose} />
            )}
          </div>

          <div className="modal-body">
            <p className="text-muted mb-3">
              Upload your work for: <strong>{assignmentTitle}</strong>
            </p>

            {/* Drop zone */}
            <div
              className="border border-2 border-dashed rounded-3 text-center p-4"
              style={{ cursor: "pointer", borderStyle: "dashed" }}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = e.dataTransfer.files[0];
                if (dropped) setFile(dropped);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                className="d-none"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div>
                  <i className="ti ti-file-check fs-3 text-success mb-2 d-block" />
                  <div className="fw-medium">{file.name}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary mt-2"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  >
                    Change file
                  </button>
                </div>
              ) : (
                <div>
                  <i className="ti ti-cloud-upload fs-3 text-muted mb-2 d-block" />
                  <div className="fw-medium text-muted">Click to browse or drag &amp; drop</div>
                  <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                    PDF, DOC, DOCX, images, ZIP, etc.
                  </div>
                </div>
              )}
            </div>

            {uploading && (
              <div className="d-flex align-items-center gap-2 mt-3 text-muted">
                <div className="spinner-border spinner-border-sm text-primary" />
                Uploading…
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!file || uploading}
            >
              <i className="ti ti-send me-1" />
              {uploading ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmitAssignmentModal;
