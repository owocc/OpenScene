import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Eye,
  FileAudio,
  FileIcon,
  FileVideo,
  Folder,
  ImageIcon,
  Music,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Upload,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchStudioAssetFolders,
  fetchStudioAssets,
  uploadStudioAsset,
  type StudioAsset,
} from "@/core/asset-client";

export interface AssetPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: StudioAsset, value: string) => void;
  selectedPath?: string;
  allowedTypes?: "image" | "audio" | "video" | "all";
  title?: string;
}

export function AssetPickerDialog({
  open,
  onOpenChange,
  onSelect,
  selectedPath,
  allowedTypes = "all",
  title = "选择资源 (Asset Picker)",
}: AssetPickerDialogProps) {
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [folders, setFolders] = useState<string[]>(["/"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFolder, setCurrentFolder] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>(allowedTypes);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Current selection
  const [selectedAsset, setSelectedAsset] = useState<StudioAsset | null>(null);

  // Upload modal state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFolder, setUploadFolder] = useState<string>("/");
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedAssets, fetchedFolders] = await Promise.all([
        fetchStudioAssets({
          folder: currentFolder !== "all" ? currentFolder : undefined,
          type: selectedType !== "all" ? selectedType : undefined,
          tag: selectedTag || undefined,
          q: searchQuery || undefined,
        }),
        fetchStudioAssetFolders(),
      ]);
      setAssets(fetchedAssets);
      setFolders(fetchedFolders);

      if (selectedPath && !selectedAsset) {
        const found = fetchedAssets.find(
          (a) => a.path === selectedPath || a.url === selectedPath || a.fileName === selectedPath,
        );
        if (found) setSelectedAsset(found);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void loadData();
    }
  }, [open, currentFolder, selectedType, selectedTag, searchQuery]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const a of assets) {
      for (const t of a.tags || []) {
        set.add(t);
      }
    }
    return Array.from(set);
  }, [assets]);

  const handleConfirmSelect = () => {
    if (!selectedAsset) return;
    const assetPath =
      selectedAsset.path ||
      selectedAsset.url ||
      `/assets/${selectedAsset.id}/${selectedAsset.fileName}`;
    onSelect(selectedAsset, assetPath);
    onOpenChange(false);
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !uploadTags.includes(trimmed)) {
      setUploadTags([...uploadTags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setUploadTags(uploadTags.filter((t) => t !== tag));
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile) return;
    setUploadLoading(true);
    setUploadError(null);
    try {
      const created = await uploadStudioAsset(uploadFile, {
        folder: uploadFolder,
        tags: uploadTags,
      });
      setIsUploading(false);
      setUploadFile(null);
      setUploadTags([]);
      setSelectedAsset(created);
      await loadData();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border/60 shrink-0 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <ImageIcon className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
                <DialogDescription className="text-[11px] text-muted-foreground">
                  支持图片、音频、视频等多媒体资源，支持文件夹分类与标签筛选
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => loadData()}
                disabled={loading}
              >
                <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                刷新
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setIsUploading(true)}
              >
                <Plus className="size-3.5" />
                上传资源
              </Button>
            </div>
          </div>

          {/* Search, Folder & Filter Toolbar */}
          <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="搜索文件名、标签、路径..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-background/80"
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Folder Select */}
            <div className="flex items-center gap-1.5 bg-background border border-input rounded-md px-2 h-8 text-xs">
              <Folder className="size-3.5 text-muted-foreground" />
              <select
                value={currentFolder}
                onChange={(e) => setCurrentFolder(e.target.value)}
                className="bg-transparent outline-none text-xs cursor-pointer"
              >
                <option value="all">所有文件夹 (All)</option>
                {folders.map((f) => (
                  <option key={f} value={f}>
                    {f === "/" ? "/ (根目录)" : f}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Tabs */}
            <Tabs value={selectedType} onValueChange={setSelectedType} className="h-8">
              <TabsList className="h-8 p-0.5 bg-muted/60">
                <TabsTrigger value="all" className="h-7 text-[11px] px-2.5">
                  全部
                </TabsTrigger>
                <TabsTrigger value="image" className="h-7 text-[11px] px-2.5 gap-1">
                  <ImageIcon className="size-3" /> 图片
                </TabsTrigger>
                <TabsTrigger value="audio" className="h-7 text-[11px] px-2.5 gap-1">
                  <Music className="size-3" /> 音频
                </TabsTrigger>
                <TabsTrigger value="video" className="h-7 text-[11px] px-2.5 gap-1">
                  <Video className="size-3" /> 视频
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Tags Chips */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 text-[11px]">
              <span className="text-muted-foreground flex items-center gap-1 text-[10px] shrink-0">
                <Tag className="size-3" /> 标签:
              </span>
              <button
                onClick={() => setSelectedTag(null)}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] border transition-colors shrink-0",
                  selectedTag === null
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground border-transparent",
                )}
              >
                全部
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] border transition-colors shrink-0",
                    selectedTag === tag
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-transparent",
                  )}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* Body Content */}
        {error && (
          <div className="p-2 rounded bg-destructive/10 text-destructive text-xs mx-4 mt-2">
            {error}
          </div>
        )}
        <div className="flex-1 flex overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            {loading && assets.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <RefreshCw className="size-6 animate-spin text-primary" />
                <span className="text-xs">加载资源库中...</span>
              </div>
            ) : assets.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-3 border border-dashed rounded-xl p-8">
                <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center">
                  <ImageIcon className="size-6 opacity-40" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-foreground">暂无符合条件的资源</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    点击右上角“上传资源”上传新的图片或媒体文件
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUploading(true)}
                  className="gap-1.5 text-xs mt-1"
                >
                  <Upload className="size-3.5" /> 上传资源
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {assets.map((asset) => {
                  const isSelected = selectedAsset?.id === asset.id;
                  const isImg = asset.mimeType.startsWith("image/");
                  const isAud = asset.mimeType.startsWith("audio/");
                  const isVid = asset.mimeType.startsWith("video/");

                  return (
                    <div
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      onDoubleClick={() => {
                        setSelectedAsset(asset);
                        const assetPath =
                          asset.path || asset.url || `/assets/${asset.id}/${asset.fileName}`;
                        onSelect(asset, assetPath);
                        onOpenChange(false);
                      }}
                      className={cn(
                        "group relative rounded-xl border p-2.5 flex flex-col gap-2 cursor-pointer transition-all duration-150 text-left bg-card hover:border-primary/50 hover:shadow-sm",
                        isSelected
                          ? "border-primary ring-2 ring-primary/20 bg-primary/[0.02]"
                          : "border-border/60",
                      )}
                    >
                      {/* Thumbnail Preview Box */}
                      <div className="w-full aspect-video rounded-lg bg-muted/40 overflow-hidden flex items-center justify-center relative border border-border/30">
                        {isImg ? (
                          <img
                            src={asset.url || asset.path}
                            alt={asset.fileName}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        ) : isAud ? (
                          <div className="flex flex-col items-center justify-center text-amber-500 gap-1">
                            <FileAudio className="size-8" />
                            {asset.duration && (
                              <span className="text-[10px] font-mono bg-background/80 px-1.5 py-0.5 rounded border border-border/40">
                                {formatDuration(asset.duration)}
                              </span>
                            )}
                          </div>
                        ) : isVid ? (
                          <div className="flex flex-col items-center justify-center text-sky-500 gap-1">
                            <FileVideo className="size-8" />
                            {asset.duration && (
                              <span className="text-[10px] font-mono bg-background/80 px-1.5 py-0.5 rounded border border-border/40">
                                {formatDuration(asset.duration)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <FileIcon className="size-8 text-muted-foreground" />
                        )}

                        {/* Selected Checkmark Badge */}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow">
                            <Check className="size-3 stroke-[3]" />
                          </div>
                        )}

                        {/* Dimensions / Duration overlay badge */}
                        {(asset.width || asset.duration) && (
                          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-background/90 text-foreground border border-border/60 shadow-xs">
                            {asset.width && asset.height
                              ? `${asset.width}×${asset.height}`
                              : formatDuration(asset.duration)}
                          </div>
                        )}
                      </div>

                      {/* Info & Metadata */}
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className="text-xs font-medium truncate text-foreground"
                            title={asset.fileName}
                          >
                            {asset.fileName}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="truncate">{asset.folder || "/"}</span>
                          <span>{formatFileSize(asset.size)}</span>
                        </div>
                        {asset.tags && asset.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {asset.tags.slice(0, 2).map((t) => (
                              <span
                                key={t}
                                className="px-1 py-0.2 rounded bg-muted/60 text-[9px] text-muted-foreground"
                              >
                                #{t}
                              </span>
                            ))}
                            {asset.tags.length > 2 && (
                              <span className="text-[9px] text-muted-foreground">
                                +{asset.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Right Selected Preview Sidebar */}
          {selectedAsset && (
            <div className="w-72 border-l border-border/60 p-4 flex flex-col gap-3 bg-muted/10 shrink-0 overflow-y-auto">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Eye className="size-3.5 text-primary" /> 资源详情
              </h4>

              {/* Large Preview */}
              <div className="w-full aspect-video rounded-lg bg-muted/30 border border-border/50 overflow-hidden flex items-center justify-center p-2">
                {selectedAsset.mimeType.startsWith("image/") ? (
                  <img
                    src={selectedAsset.url || selectedAsset.path}
                    alt={selectedAsset.fileName}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : selectedAsset.mimeType.startsWith("audio/") ? (
                  <div className="w-full flex flex-col items-center gap-2">
                    <FileAudio className="size-10 text-amber-500" />
                    <audio
                      src={selectedAsset.url || selectedAsset.path}
                      controls
                      className="w-full h-8"
                    />
                  </div>
                ) : selectedAsset.mimeType.startsWith("video/") ? (
                  <video
                    src={selectedAsset.url || selectedAsset.path}
                    controls
                    className="max-w-full max-h-full"
                  />
                ) : (
                  <FileIcon className="size-10 text-muted-foreground" />
                )}
              </div>

              {/* Metadata rows */}
              <div className="grid gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-muted-foreground">文件名</label>
                  <p className="font-medium text-xs break-all">{selectedAsset.fileName}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">类型</label>
                    <p className="text-[11px] truncate">{selectedAsset.mimeType}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">文件大小</label>
                    <p className="text-[11px]">{formatFileSize(selectedAsset.size)}</p>
                  </div>
                </div>
                {selectedAsset.width && selectedAsset.height ? (
                  <div>
                    <label className="text-[10px] text-muted-foreground">尺寸 (宽高)</label>
                    <p className="text-[11px] font-mono">
                      {selectedAsset.width} × {selectedAsset.height} px
                    </p>
                  </div>
                ) : null}
                {selectedAsset.duration ? (
                  <div>
                    <label className="text-[10px] text-muted-foreground">时长</label>
                    <p className="text-[11px] font-mono">
                      {formatDuration(selectedAsset.duration)}
                    </p>
                  </div>
                ) : null}
                <div>
                  <label className="text-[10px] text-muted-foreground">文件夹分类</label>
                  <p className="text-[11px]">{selectedAsset.folder || "/"}</p>
                </div>
                {selectedAsset.tags && selectedAsset.tags.length > 0 && (
                  <div>
                    <label className="text-[10px] text-muted-foreground">标签</label>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {selectedAsset.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                          #{t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-muted-foreground">相对地址 (Host-less)</label>
                  <p className="text-[10px] font-mono p-1.5 bg-muted/40 rounded border border-border/40 break-all select-all">
                    {selectedAsset.path || selectedAsset.url}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">模板占位变量引用</label>
                  <p className="text-[10px] font-mono p-1.5 bg-muted/40 rounded border border-border/40 break-all select-all text-primary">
                    {`\${/asset_base_url}${selectedAsset.path || selectedAsset.url}`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-between sm:justify-between shrink-0">
          <div className="text-xs text-muted-foreground truncate max-w-md">
            {selectedAsset ? (
              <span className="flex items-center gap-1.5">
                已选中: <strong className="text-foreground">{selectedAsset.fileName}</strong>
              </span>
            ) : (
              "请选择一个资源或点击上传"
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={!selectedAsset}
              onClick={handleConfirmSelect}
            >
              确定选择
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Upload Sub-dialog */}
      <Dialog open={isUploading} onOpenChange={setIsUploading}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Upload className="size-4 text-primary" /> 上传资源文件
            </DialogTitle>
            <DialogDescription className="text-xs">
              上传图片、音频或视频资源，自动识别尺寸并在应用内管理
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2 text-xs">
            {/* File Input Area */}
            <div className="grid gap-1.5">
              <label className="text-[11px] font-medium text-foreground">选择本地文件</label>
              <label className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/10 hover:bg-muted/20 transition-colors">
                <Upload className="size-6 text-muted-foreground" />
                {uploadFile ? (
                  <div className="text-center">
                    <p className="font-semibold text-xs text-foreground">{uploadFile.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatFileSize(uploadFile.size)} · {uploadFile.type || "unknown type"}
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="font-medium text-xs text-foreground">点击或拖拽文件至此</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      支持 JPG, PNG, WebP, SVG, MP3, WAV, MP4 等
                    </p>
                  </div>
                )}
                <input
                  type="file"
                  className="sr-only"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {/* Folder input */}
            <div className="grid gap-1.5">
              <label className="text-[11px] font-medium text-foreground">文件夹分类</label>
              <div className="flex gap-1.5">
                <Input
                  value={uploadFolder}
                  onChange={(e) => setUploadFolder(e.target.value)}
                  placeholder="例如 /images, /icons, /audio"
                  className="h-8 text-xs"
                />
                <select
                  value={folders.includes(uploadFolder) ? uploadFolder : ""}
                  onChange={(e) => e.target.value && setUploadFolder(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">已有分类...</option>
                  {folders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags input */}
            <div className="grid gap-1.5">
              <label className="text-[11px] font-medium text-foreground">标签 (Tags)</label>
              <div className="flex gap-1.5">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="输入标签后按回车添加..."
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTag}
                  className="h-8 text-xs"
                >
                  添加
                </Button>
              </div>
              {uploadTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {uploadTags.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0.5 gap-1 flex items-center"
                    >
                      #{t}
                      <X
                        className="size-2.5 cursor-pointer hover:text-destructive"
                        onClick={() => handleRemoveTag(t)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {uploadError && (
              <div className="p-2 rounded bg-destructive/10 text-destructive text-[11px]">
                {uploadError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUploading(false)}
              disabled={uploadLoading}
            >
              取消
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleUploadSubmit}
              disabled={!uploadFile || uploadLoading}
            >
              {uploadLoading ? "上传中..." : "开始上传"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
