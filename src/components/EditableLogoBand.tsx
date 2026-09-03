import { useEffect, useRef, useState } from "react";
import { cdn, onTransformError } from "@/components/SiteLayout";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useSiteList } from "@/hooks/use-site-list";
import { useServerFn } from "@tanstack/react-start";
import { uploadToR2 } from "@/lib/r2.functions";
import { ChevronLeft, ChevronRight, Loader2, MoveLeft, MoveRight, Plus, X, Image as ImageIcon } from "lucide-react";
import { MediaLibraryPicker } from "./MediaLibraryPicker";


type Logo = { id: string; src: string; alt?: string };

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif"];

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

export function EditableLogoBand({ fallback = [] as Logo[] }: { fallback?: Logo[] }) {
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const editable = isAdmin && editMode;
  const { items, save } = useSiteList<Logo>("client-logos", fallback);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const upload = useServerFn(uploadToR2);



  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, []);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.7), behavior: "smooth" });
  };


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
      const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]/g, "-");
      const dataBase64 = await fileToBase64(file);
      const res = await upload({
        data: { filename: file.name, contentType: file.type, dataBase64, kind: "image" },
      });
      await save([...items, { id: crypto.randomUUID(), src: res.url, alt: base }]);
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
        <div className="relative">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Scroll left"
            className={`hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 h-8 w-8 items-center justify-center rounded-full bg-background/90 border border-border shadow-sm hover:bg-background transition-opacity ${canLeft ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Scroll right"
            className={`hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 h-8 w-8 items-center justify-center rounded-full bg-background/90 border border-border shadow-sm hover:bg-background transition-opacity ${canRight ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div
            ref={scrollRef}
            onWheel={(e) => {
              if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                scrollRef.current?.scrollBy({ left: e.deltaY, behavior: "auto" });
              }
            }}
            className="logo-scroll flex flex-nowrap items-center gap-x-6 md:gap-x-10 overflow-x-auto whitespace-nowrap justify-start pb-2 scroll-smooth"
            style={{ scrollbarWidth: "thin" }}
          >
            {items.map((l, index) => (
              <div key={l.id} className="relative group shrink-0">
                <img
                  src={cdn(l.src, 400)}
                  onError={onTransformError}
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
              <>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className="shrink-0 h-8 px-3 border-2 border-dashed border-border rounded flex items-center gap-1 text-xs text-muted-foreground hover:bg-accent"
                >
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="shrink-0 h-8 px-3 border-2 border-dashed border-border rounded flex items-center gap-1 text-xs text-muted-foreground hover:bg-accent"
                >
                  <ImageIcon className="w-3 h-3" />
                  Pick from library
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <MediaLibraryPicker
        open={pickerOpen}
        kind="image"
        onClose={() => setPickerOpen(false)}
        onPick={(a) =>
          save([...items, { id: crypto.randomUUID(), src: a.url, alt: a.alt ?? a.name ?? "Client logo" }])
        }
      />



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
