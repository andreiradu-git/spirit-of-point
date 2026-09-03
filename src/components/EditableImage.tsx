import { useRef, useState, type ReactNode } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useServerFn } from "@tanstack/react-start";
import { uploadToR2 } from "@/lib/r2.functions";
import { uploadImageWithProtection } from "@/lib/image-upload";
import { Upload, Loader2 } from "lucide-react";
import { cdn, cdnSrcSet, onTransformError } from "@/components/SiteLayout";

type Props = {
  src: string;
  alt?: string;
  onChange?: (url: string) => void;
  className?: string;
  imgClassName?: string;
  prefix?: string;
  children?: ReactNode;
};

const MAX_SIZE = 20 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function EditableImage({
  src,
  alt = "",
  onChange,
  className = "",
  imgClassName = "",
  prefix: _prefix = "site",
  children,
}: Props) {
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const editable = isAdmin && editMode;
  const upload = useServerFn(uploadToR2);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      alert("Only JPG, PNG, WebP or GIF images are allowed");
      return;
    }
    if (file.size > MAX_SIZE) {
      alert("Image must be under 20 MB");
      return;
    }

    setUploading(true);
    try {
      const result = await uploadImageWithProtection(file, async (input) => upload(input));
      onChange?.(result.deliveryUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Upload failed", e);
      alert("Upload failed: " + msg);
    } finally {
      setUploading(false);
    }

  };

  const onClick = () => {
    if (!editable || uploading) return;
    inputRef.current?.click();
  };

  return (
    <div
      className={
        (className ? className + " " : "") +
        (editable ? "relative cursor-pointer group " : "")
      }
      onClick={editable ? onClick : undefined}
    >
      {children ? (
        children
      ) : (
        <img
          src={src ? cdn(src, 1600) : "/placeholder.svg"}
          srcSet={src ? cdnSrcSet(src, [400, 800, 1200, 1600]) : undefined}
          sizes="100vw"
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={onTransformError}
          className={imgClassName}
        />
      )}
      {editable && (
        <>
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
            {uploading ? (
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
          <div className="absolute inset-0 outline outline-1 outline-dashed outline-blue-400/60 rounded-sm pointer-events-none" />
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
