import React from "react";
import { Download, ExternalLink, Loader2, FileQuestion } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { downloadFile, getPreviewUrl } from "@/services/files";
import { formatBytes } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { toast } from "sonner";
import type { FileItem } from "@/types/file";

interface PreviewDialogProps {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Inline viewer for images, PDFs, text, audio and video. */
export const PreviewDialog: React.FC<PreviewDialogProps> = ({ file, open, onOpenChange }) => {
  const [url, setUrl] = React.useState<string | null>(null);
  const [text, setText] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let revoke: string | null = null;
    let active = true;
    setUrl(null);
    setText(null);

    if (!open || !file) return;

    const mime = file.mime_type ?? "";
    setLoading(true);
    (async () => {
      try {
        const objectUrl = await getPreviewUrl(file);
        if (!active) return;
        if (!objectUrl) {
          setUrl(null);
          return;
        }
        revoke = objectUrl;
        setUrl(objectUrl);
        if (mime.startsWith("text/") || mime === "application/json") {
          const response = await fetch(objectUrl);
          const body = await response.text();
          if (active) setText(body.slice(0, 200_000));
        }
      } catch (error) {
        if (active) toast.error(errorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [file, open]);

  const mime = file?.mime_type ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{file?.filename}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-[240px] items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : !url ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <FileQuestion className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No preview available for this file type ({mime || "unknown"}).
              </p>
            </div>
          ) : mime.startsWith("image/") ? (
            <img src={url} alt={file?.filename} className="max-h-[70vh] w-full object-contain" />
          ) : mime.startsWith("video/") ? (
            <video src={url} controls className="max-h-[70vh] w-full" />
          ) : mime.startsWith("audio/") ? (
            <audio src={url} controls className="w-full p-6" />
          ) : mime === "application/pdf" ? (
            <iframe src={url} title={file?.filename} className="h-[70vh] w-full" />
          ) : text !== null ? (
            <pre className="max-h-[70vh] w-full overflow-auto p-4 text-xs leading-relaxed">{text}</pre>
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {formatBytes(file?.size ?? 0)} · {mime || "unknown type"}
            {file?.version && file.version > 1 ? ` · v${file.version}` : ""}
          </p>
          <div className="flex gap-2">
            {file?.web_url ? (
              <Button variant="outline" size="sm" asChild>
                <a href={file.web_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Open in provider
                </a>
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={async () => {
                if (!file) return;
                try {
                  await downloadFile(file);
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PreviewDialog;
