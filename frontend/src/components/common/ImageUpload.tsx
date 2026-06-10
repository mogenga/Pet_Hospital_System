import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, Loader2, ImageIcon } from "lucide-react";
import { useMinioDownloadUrl } from "@/hooks/useApiHooks";
import apiClient from "@/api/client";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  fileKey: string; // 目标 MinIO key
  currentKey?: string | null; // 当前已有 key，用于预览
  onSuccess: (key: string) => void; // 上传成功回调
  allowed?: boolean; // 是否有上传权限
  size?: "sm" | "md" | "lg"; // 预览尺寸
}

export default function ImageUpload({
  fileKey,
  currentKey,
  onSuccess,
  allowed = false,
  size = "md",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: downloadData } = useMinioDownloadUrl(currentKey);

  const sizeClasses = {
    sm: "h-10 w-10",
    md: "h-20 w-20",
    lg: "h-40 w-40",
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 前端校验
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("仅支持 JPG、PNG、WebP 格式");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("文件大小不能超过 5MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_key", fileKey);

      await apiClient.post("/api/minio/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      onSuccess(fileKey);
      toast.success("上传成功");
    } catch {
      toast.error("上传失败，请重试");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const previewUrl = downloadData?.url;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* 预览区域 */}
      <div
        className={cn(
          "relative flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 overflow-hidden",
          sizeClasses[size]
        )}
      >
        {uploading ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        ) : previewUrl ? (
          <img
            src={previewUrl}
            alt="预览"
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground/50" />
        )}
      </div>

      {/* 上传按钮 */}
      {allowed && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="size-3" />
            {currentKey ? "更换照片" : "上传照片"}
          </button>
        </>
      )}
    </div>
  );
}
