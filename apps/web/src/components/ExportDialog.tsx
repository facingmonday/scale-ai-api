import React, { useEffect, useRef, useState, useCallback } from "react";
import { Dialog } from "primereact/dialog";
import { ProgressSpinner } from "primereact/progressspinner";

interface ExportDialogProps {
  visible: boolean;
  onHide: () => void;
  onExport: () => Promise<{ blob: Blob; fileName: string }>;
  exportName?: string;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  visible,
  onHide,
  onExport,
  exportName = "file",
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAutoExportedRef = useRef(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);
    setIsComplete(false);

    try {
      const { blob, fileName } = await onExport();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setIsComplete(true);
    } catch (err) {
      console.error("Export failed:", err);
      const errorMessage =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      setError(
        errorMessage || `Failed to export ${exportName}. Please try again.`
      );
    } finally {
      setIsExporting(false);
    }
  }, [onExport, exportName]);

  useEffect(() => {
    if (!visible) {
      hasAutoExportedRef.current = false;
      return;
    }

    if (hasAutoExportedRef.current) return;
    hasAutoExportedRef.current = true;

    // Reset state when dialog opens
    setIsExporting(false);
    setIsComplete(false);
    setError(null);
    // Start export automatically
    void handleExport();
  }, [visible, handleExport]);

  const handleClose = () => {
    if (isExporting) return;
    setIsComplete(false);
    setError(null);
    onHide();
  };

  return (
    <Dialog
      header={isComplete ? "Export Complete" : "Exporting"}
      visible={visible}
      onHide={handleClose}
      modal
      closable={!isExporting && (isComplete || !!error)}
      dismissableMask={!isExporting && (isComplete || !!error)}
      className="modal w-full max-w-md"
      maskClassName="modal-mask"
      headerClassName="modal-header"
      contentClassName="modal-content"
      pt={{
        headerTitle: { className: "modal-title" },
        footer: { className: "modal-footer" },
      }}
      footer={
        <div className="flex gap-2 justify-end">
          <button
            className="btn-outline"
            onClick={handleClose}
            disabled={isExporting}
            type="button"
          >
            {isComplete ? "Close" : "Cancel"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4 py-6">
        {isExporting && (
          <>
            <ProgressSpinner
              style={{ width: "60px", height: "60px" }}
              strokeWidth="4"
            />
            <p className="text-text-primary text-center">
              Preparing your export...
            </p>
          </>
        )}

        {isComplete && !error && (
          <>
            <div className="w-16 h-16 rounded-full bg-brand-teal/20 flex items-center justify-center">
              <i className="pi pi-check text-brand-teal text-2xl" />
            </div>
            <div className="text-center">
              <p className="text-text-primary font-medium mb-2">
                Export completed successfully!
              </p>
              <p className="text-text-muted text-sm">
                Your file should be downloading now. If it doesn't start
                automatically, check your downloads folder.
              </p>
            </div>
          </>
        )}

        {error && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <i className="pi pi-times text-red-500 text-2xl" />
            </div>
            <div className="text-center">
              <p className="text-text-primary font-medium mb-2 text-red-500">
                Export Failed
              </p>
              <p className="text-text-muted text-sm">{error}</p>
            </div>
            <button
              className="btn-teal mt-2"
              onClick={() => void handleExport()}
              type="button"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
};

export default ExportDialog;
