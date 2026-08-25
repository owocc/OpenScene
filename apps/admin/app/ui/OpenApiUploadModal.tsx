"use client";

import { CheckCircle, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { useI18n } from "./i18n";

export interface ParsedOpenApiFile {
  name: string;
  size: number;
  content: string;
  json: Record<string, unknown>;
  endpointsCount: number;
  title?: string;
  version?: string;
}

export interface OpenApiUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (parsed: ParsedOpenApiFile) => void;
  isLoading?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function OpenApiUploadModal({
  open,
  onOpenChange,
  onUpload,
  isLoading = false,
}: OpenApiUploadModalProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedFile, setParsedFile] = useState<ParsedOpenApiFile | null>(null);

  const resetState = () => {
    setError(null);
    setParsedFile(null);
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  };

  const processFile = (file: File) => {
    setError(null);
    setParsedFile(null);

    // Strict validation: only .json files are allowed
    const isJsonName = file.name.toLowerCase().endsWith(".json");

    if (!isJsonName) {
      setError(
        t("onlyJsonSupported") ||
          "Only JSON files (.json) are supported. Please upload an OpenAPI specification in JSON format.",
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text) as unknown;

        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          setError(t("openApiJsonInvalid") || "Invalid JSON: must be an object with paths");
          return;
        }

        const obj = parsed as Record<string, unknown>;
        const paths = obj.paths;

        if (typeof paths !== "object" || paths === null || Array.isArray(paths)) {
          setError(
            t("openApiJsonInvalid") ||
              "Invalid OpenAPI document: must contain a valid 'paths' object.",
          );
          return;
        }

        const info =
          typeof obj.info === "object" && obj.info ? (obj.info as Record<string, unknown>) : {};
        const endpointsCount = Object.keys(paths).length;

        setParsedFile({
          name: file.name,
          size: file.size,
          content: text,
          json: obj,
          endpointsCount,
          title: typeof info.title === "string" ? info.title : undefined,
          version: typeof info.version === "string" ? info.version : undefined,
        });
      } catch (err) {
        setError(
          err instanceof Error ? `JSON parse error: ${err.message}` : "Failed to parse JSON file",
        );
      }
    };

    reader.onerror = () => {
      setError("Failed to read file");
    };

    reader.readAsText(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleConfirm = () => {
    if (parsedFile) {
      onUpload(parsedFile);
      handleClose(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog size="lg" className="px-6 py-5">
        <Dialog.Title>{t("uploadOpenApi") || "Upload OpenAPI specification"}</Dialog.Title>
        <Dialog.Description>
          {t("uploadOpenApiDescription") ||
            "Upload a JSON OpenAPI document. You can drag and drop a .json file directly."}
        </Dialog.Description>

        <div className="grid gap-4 py-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-none ${
              isDragging
                ? "border-kumo-primary bg-kumo-hover ring-2 ring-kumo-primary/20"
                : "border-kumo-line hover:bg-kumo-hover/50 hover:border-kumo-secondary"
            }`}
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-kumo-subtle text-kumo-default">
              <UploadSimple size={24} weight="bold" />
            </div>
            <div className="grid gap-1">
              <div className="font-medium text-kumo-default">
                <Text>{t("dragAndDropJson") || "Drag and drop your OpenAPI .json file here"}</Text>
              </div>
              <div className="text-xs">
                <Text variant="secondary">
                  {t("clickToBrowse") || "or click to select from your computer (JSON only)"}
                </Text>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error ? (
            <div className="flex items-start gap-2 rounded-md bg-kumo-danger-subtle p-3 text-kumo-danger">
              <WarningCircle size={18} className="shrink-0 mt-0.5" />
              <div className="text-sm text-kumo-danger">
                <Text variant="error">{error}</Text>
              </div>
            </div>
          ) : null}

          {/* Parsed file summary preview */}
          {parsedFile ? (
            <LayerCard className="flex flex-col gap-3 p-4 bg-kumo-subtle/40 border border-kumo-line">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-kumo-green" weight="fill" />
                  <span className="font-mono text-sm font-medium text-kumo-default">
                    {parsedFile.name}
                  </span>
                </div>
                <Badge variant="neutral">{formatFileSize(parsedFile.size)}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-t border-kumo-line/60 pt-2.5">
                <div>
                  <span className="text-kumo-secondary">Title: </span>
                  <span className="font-medium text-kumo-default">{parsedFile.title ?? "—"}</span>
                </div>
                <div>
                  <span className="text-kumo-secondary">Version: </span>
                  <span className="font-medium text-kumo-default">{parsedFile.version ?? "—"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-kumo-secondary">Endpoints count: </span>
                  <Badge variant="blue">{`${parsedFile.endpointsCount} paths`}</Badge>
                </div>
              </div>
            </LayerCard>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-kumo-line">
          <Button variant="secondary" onClick={() => handleClose(false)} disabled={isLoading}>
            {t("cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={!parsedFile || isLoading}
            loading={isLoading}
          >
            {t("applyUpload") || "Apply and Import"}
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
