import { useEffect, useRef, useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useSiteList } from "@/hooks/use-site-list";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Loader2, MoveLeft, MoveRight, Plus, X } from "lucide-react";


type Logo = { id: string; src: string; alt?: string };

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif"];

export function EditableLogoBand({ fallback = [] as Logo[] }: { fallback?: Logo[] }) {
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const editable = isAdmin && editMode;
  const { items, save } = useSiteList<Logo>("client-logos", fallback);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      alert("Only JPG, PNG, WebP, SVG or GIF images are allowed");
      return;
    }
    if (file.size > MAX_SIZE) {
      alert("Image must be under 10 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]/g, "-");
      const path = `logos/${base}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const {
        data: { publicUrl },
      } = supabase.storage.from("media").getPublicUrl(path);
      await save([...items, { id: crypto.randomUUID(), src: publicUrl, alt: base }]);
    } catch (e) {
      console.error(e);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this logo?")) return;
    await save(items.filter((l) => l.id !== id));
  };

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const next = [...items];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    save(next);
  };

  if (items.length === 0 && !editable) return null;

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-6 md:py-8">
        <div className="flex flex-nowrap items-center gap-x-6 md:gap-x-10 overflow-x-auto whitespace-nowrap justify-start md:justify-center pb-2">
          {items.map((l, index) => (
            <div key={l.id} className="relative group shrink-0">
              <img
                src={l.src}
                alt={l.alt ?? "Client logo"}
                className="h-6 md:h-9 w-auto object-contain opacity-90 hover:opacity-100 transition"
              />
              {editable && (
                <>
                  <button
                    type="button"
                    onClick={() => remove(l.id)}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove logo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="absolute -top-2 -left-4 p-1 bg-foreground text-background rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                    aria-label="Move left"
                  >
                    <MoveLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    className="absolute -top-2 -right-4 p-1 bg-foreground text-background rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                    aria-label="Move right"
                  >
                    <MoveRight className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          ))}
          {editable && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="shrink-0 h-8 px-3 border-2 border-dashed border-border rounded flex items-center gap-1 text-xs text-muted-foreground hover:bg-accent"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Add logo
            </button>
          )}
        </div>

      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          files.forEach((f, i) => setTimeout(() => handleUpload(f), i * 200));
          e.target.value = "";
        }}
      />
    </section>
  );
}
