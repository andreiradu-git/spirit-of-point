import { useState, useRef, type ReactNode } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { useTr } from "@/i18n";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useGallery, useInvalidateGallery, type GalleryImage } from "@/hooks/use-gallery";
import { cdn, cdnSrcSet, IMAGE_QUALITY_LARGE, onTransformError } from "@/components/SiteLayout";
import { useServerFn } from "@tanstack/react-start";
import { uploadToR2 } from "@/lib/r2.functions";
import { uploadImageWithProtection } from "@/lib/image-upload";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Upload, X, GripVertical, Loader2, Images, Star } from "lucide-react";
import {
  addGalleryImage,
  removeGalleryImage,
  reorderGalleryImages,
  updateImageMeta,
} from "@/lib/media.functions";
import { MediaLibraryPicker } from "./MediaLibraryPicker";
import { useGalleryCovers, useSetGalleryCover } from "@/hooks/use-gallery-covers";


const MAX_SIZE = 20 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type Props = {
  slug: string;
  fallbackImages: Array<{ src: string; alt?: string; title?: string }>;
  columns?: number;
  aspect?: "square" | "landscape" | "portrait" | "auto";
  layout?: "grid" | "stacked" | "masonry";
  className?: string;
  renderItem?: (img: GalleryImage, props: { onClick: () => void; editable: boolean }) => ReactNode;
  lightbox?: boolean;
  archive?: boolean;
};

function SortableImage({
  image,
  editable,
  onRemove,
  onAltChange,
  onTitleChange,
  onClick,
  aspect,
  archive,
  isCover,
  onSetCover,
}: {
  image: GalleryImage;
  editable: boolean;
  onRemove: (id: string) => void;
  onAltChange: (id: string, alt: string) => void;
  onTitleChange?: (id: string, title: string) => void;
  onClick: () => void;
  aspect: Props["aspect"];
  archive?: boolean;
  isCover?: boolean;
  onSetCover?: (src: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const aspectClass = archive
    ? "aspect-[4/3]"
    : aspect === "square"
    ? "aspect-square"
    : aspect === "landscape"
    ? "aspect-[4/3]"
    : aspect === "portrait"
    ? "aspect-[3/4]"
    : "";
  const caption = image.title || image.alt || "Personal work";
  const t = useTr();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${isDragging ? "opacity-50 z-50" : ""}`}
    >
      <button
        type="button"
        onClick={onClick}
        className="block w-full p-0 m-0 border-0 bg-transparent cursor-pointer"
        disabled={editable}
      >
        <img
          src={cdn(image.src, 500)}
          srcSet={cdnSrcSet(image.src, [400, 800, 1200, 1600])}
          sizes="(min-width:1024px) 20vw, (min-width:768px) 33vw, 50vw"
          alt={image.alt ?? caption}
          loading="lazy"
          decoding="async"
          className={`block w-full object-cover ${aspectClass}`}
          onError={onTransformError}
        />
      </button>
      {archive && <div className="pt-2 pb-1 text-xs text-muted-foreground">{t(caption)}</div>}
      {editable && (
        <>
          <div
            {...attributes}
            {...listeners}
            className="absolute top-2 left-2 p-1.5 bg-white/90 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <GripVertical className="w-4 h-4 text-foreground" />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(image.id);
            }}
            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded shadow-lg z-10 hover:bg-red-600"
            aria-label="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
          {onSetCover && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetCover(image.src);
              }}
              title={isCover ? "Current cover image" : "Set as cover"}
              className={`absolute top-2 right-11 p-1.5 rounded shadow-lg z-10 transition-opacity ${
                isCover
                  ? "bg-yellow-400 text-black opacity-100"
                  : "bg-white/90 text-foreground opacity-0 group-hover:opacity-100 hover:bg-white"
              }`}
              aria-label="Set as cover"
            >
              <Star className={`w-4 h-4 ${isCover ? "fill-black" : ""}`} />
            </button>
          )}


          {onTitleChange && (
            <input
              type="text"
              defaultValue={image.title ?? ""}
              onBlur={(e) => onTitleChange(image.id, e.target.value)}
              placeholder="Label"
              className="absolute bottom-8 left-0 right-0 px-2 py-1 text-xs bg-white/90 border-0 outline-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
            />
          )}
          <input
            type="text"
            defaultValue={image.alt ?? ""}
            onBlur={(e) => onAltChange(image.id, e.target.value)}
            placeholder="Alt text"
            className="absolute bottom-0 left-0 right-0 px-2 py-1.5 text-xs bg-white/90 border-0 outline-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
          />
        </>
      )}
    </div>
  );
}

export function EditableGallery({
  slug,
  fallbackImages,
  columns = 3,
  aspect = "auto",
  layout = "grid",
  className = "",
  renderItem,
  lightbox = false,
  archive = false,
}: Props) {
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const { data: gallery } = useGallery(slug);
  const invalidate = useInvalidateGallery();
  const addImage = useServerFn(addGalleryImage);
  const removeImage = useServerFn(removeGalleryImage);
  const reorder = useServerFn(reorderGalleryImages);
  const updateMeta = useServerFn(updateImageMeta);
  const upload = useServerFn(uploadToR2);
  const { data: covers } = useGalleryCovers();
  const setCover = useSetGalleryCover();
  const coverSrc = covers?.[slug];
  const t = useTr();

  const onSetCover = async (src: string) => {
    try {
      await setCover(slug, coverSrc === src ? null : src);
    } catch (e) {
      alert("Could not set cover: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const [uploading, setUploading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);


  const editable = isAdmin && editMode;

  const images: GalleryImage[] =
    gallery?.images.map((img) => ({ ...img, src: img.src })) ??
    fallbackImages.map((img, i) => ({
      id: `fallback-${i}`,
      src: img.src,
      alt: img.alt ?? null,
      title: img.title ?? null,
      position: i + 1,
    }));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleUpload = async (file: File) => {
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
      await addImage({ data: { gallerySlug: slug, src: result.deliveryUrl, alt: "" } });
      invalidate(slug);
    } catch (e) {
      console.error("Upload failed", e);
      alert("Upload failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
    }
  };

  const onRemove = async (id: string) => {
    if (id.startsWith("fallback-")) {
      alert(
        "This image is a placeholder from the source file. It will disappear once you add real images or replace the gallery contents.",
      );
      return;
    }
    if (!confirm("Remove this image from the gallery?")) return;
    try {
      await removeImage({ data: { imageId: id } });
      invalidate(slug);
    } catch (e) {
      console.error("Delete failed", e);
      alert("Delete failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const pickFromLibrary = async (url: string) => {
    try {
      await addImage({ data: { gallerySlug: slug, src: url, alt: "" } });
      invalidate(slug);
    } catch (e) {
      alert("Add failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };


  const onAltChange = async (id: string, alt: string) => {
    await updateMeta({ data: { imageId: id, alt } });
    invalidate(slug);
  };

  const onTitleChange = async (id: string, title: string) => {
    await updateMeta({ data: { imageId: id, title } });
    invalidate(slug);
  };

  const onDragEnd = async (event: import("@dnd-kit/core").DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex((i) => i.id === active.id);
    const newIndex = images.findIndex((i) => i.id === over.id);
    const next = arrayMove(images, oldIndex, newIndex);
    await reorder({ data: { imageIds: next.map((i) => i.id) } });
    invalidate(slug);
  };

  const gridCols =
    layout === "stacked"
      ? "grid-cols-1"
      : layout === "masonry"
      ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      : archive
      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
      : columns === 2
      ? "grid-cols-2"
      : columns === 4
      ? "grid-cols-2 md:grid-cols-4"
      : columns === 5
      ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
      : columns === 6
      ? "grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
      : "grid-cols-2 md:grid-cols-3";

  // Masonry (non-editable): flex columns with tops aligned at the first row
  if (layout === "masonry" && !editable) {
    const openLightbox = (i: number) => lightbox && setActiveIndex(i);
    const renderColumn = (col: { img: GalleryImage; i: number }[]) => (
      <div className="flex flex-col gap-2 md:gap-3">
        {col.map(({ img, i }) => (
          <button
            key={img.id}
            type="button"
            onClick={() => openLightbox(i)}
            className="block w-full overflow-hidden bg-muted group"
          >
            <img
              src={cdn(img.src, 500)}
              srcSet={cdnSrcSet(img.src, [400, 800, 1200, 1600])}
              sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"
              alt={img.alt ?? ""}
              loading="lazy"
              decoding="async"
              className="block w-full h-auto transition-transform duration-500 group-hover:scale-[1.02]"
              onError={onTransformError}
            />
          </button>
        ))}
      </div>
    );
    const distribute = (n: number) => {
      const cols: { img: GalleryImage; i: number }[][] = Array.from({ length: n }, () => []);
      images.forEach((img, i) => cols[i % n].push({ img, i }));
      return cols;
    };
    const colSets: { n: number; cls: string }[] = [
      { n: 2, cls: "md:hidden" },
      { n: 3, cls: "hidden md:grid lg:hidden" },
      { n: 4, cls: "hidden lg:grid" },
    ];
    return (
      <div className={className}>
        {colSets.map(({ n, cls }) => (
          <div
            key={n}
            className={`${cls} grid gap-2 md:gap-3`}
            style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
          >
            {distribute(n).map((col, ci) => (
              <div key={ci}>{renderColumn(col)}</div>
            ))}
          </div>
        ))}
        {lightbox && activeIndex !== null && (
          <div
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
            onClick={() => setActiveIndex(null)}
          >
            <button
              className="absolute top-4 right-6 text-white text-sm uppercase tracking-widest"
              onClick={() => setActiveIndex(null)}
            >
              Close
            </button>
            <button
              className="absolute left-4 md:left-8 text-white text-3xl px-3"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((a) => (a === null ? a : (a - 1 + images.length) % images.length));
              }}
              aria-label="Previous"
            >
              ‹
            </button>
            <img
              src={cdn(images[activeIndex].src, 2400, IMAGE_QUALITY_LARGE)}
              srcSet={cdnSrcSet(images[activeIndex].src, [800, 1200, 1600, 2400], IMAGE_QUALITY_LARGE)}
              sizes="(min-width:1024px) 90vw, 100vw"
              alt={images[activeIndex].alt ?? ""}
              decoding="async"
              className="max-h-[90vh] max-w-[90vw] object-contain"
              onClick={(e) => e.stopPropagation()}
              onError={onTransformError}
            />
            <button
              className="absolute right-4 md:right-8 text-white text-3xl px-3"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((a) => (a === null ? a : (a + 1) % images.length));
              }}
              aria-label="Next"
            >
              ›
            </button>
          </div>
        )}
      </div>
    );
  }


  return (
    <div className={className}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className={`grid ${gridCols} gap-2 md:gap-3`}>
            {images.map((img, i) =>
              renderItem ? (
                <div key={img.id} className="relative group">
                  {renderItem(img, { onClick: () => lightbox && setActiveIndex(i), editable })}
                  {editable && (
                    <>
                      <div className="absolute top-2 left-2 p-1.5 bg-white/90 rounded cursor-grab opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <GripVertical className="w-4 h-4 text-foreground" />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(img.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded shadow-lg z-10 hover:bg-red-600"
                        aria-label="Remove image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onSetCover(img.src);
                        }}
                        title={coverSrc === img.src ? "Current cover image" : "Set as cover"}
                        className={`absolute top-2 right-11 p-1.5 rounded shadow-lg z-10 ${
                          coverSrc === img.src
                            ? "bg-yellow-400 text-black"
                            : "bg-white/90 text-foreground opacity-0 group-hover:opacity-100"
                        }`}
                        aria-label="Set as cover"
                      >
                        <Star className={`w-4 h-4 ${coverSrc === img.src ? "fill-black" : ""}`} />
                      </button>

                    </>
                  )}
                </div>
              ) : (
                <SortableImage
                  key={img.id}
                  image={img}
                  editable={editable}
                  onRemove={onRemove}
                  onAltChange={onAltChange}
                  onTitleChange={onTitleChange}
                  onClick={() => lightbox && setActiveIndex(i)}
                  aspect={aspect}
                  archive={archive}
                  isCover={coverSrc === img.src}
                  onSetCover={onSetCover}
                />
              ),
            )}
            {editable && (
              <>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded bg-muted hover:bg-accent transition-colors text-muted-foreground ${
                    layout === "stacked" ? "py-8" : "aspect-square"
                  }`}
                >
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                  <span className="text-xs">{uploading ? "Uploading..." : "Upload new"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded bg-muted hover:bg-accent transition-colors text-muted-foreground ${
                    layout === "stacked" ? "py-8" : "aspect-square"
                  }`}
                >
                  <Images className="w-6 h-6" />
                  <span className="text-xs">Pick from library</span>
                </button>
              </>
            )}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <div className="opacity-80">
              <img
                src={images.find((i) => i.id === activeId)?.src}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          files.forEach((f, i) => setTimeout(() => handleUpload(f), i * 200));
          e.target.value = "";
        }}
      />
      {lightbox && activeIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 md:p-8"
          onClick={() => setActiveIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
        >
          <button
            type="button"
            className="absolute top-4 right-5 text-white text-2xl leading-none p-2"
            onClick={() => setActiveIndex(null)}
            aria-label="Close"
          >
            ×
          </button>
          <button
            type="button"
            className="absolute left-2 md:left-8 text-white text-4xl p-3"
            onClick={(e) => {
              e.stopPropagation();
              setActiveIndex((a) => (a === null ? a : (a - 1 + images.length) % images.length));
            }}
            aria-label="Previous"
          >
            ‹
          </button>
          <img
            src={cdn(images[activeIndex].src, 2400, IMAGE_QUALITY_LARGE)}
            srcSet={cdnSrcSet(images[activeIndex].src, [800, 1200, 1600, 2400], IMAGE_QUALITY_LARGE)}
            sizes="(min-width:1024px) 90vw, 100vw"
            alt={images[activeIndex].alt ?? images[activeIndex].title ?? "Personal work"}
            decoding="async"
            className="max-h-[calc(100vh-7rem)] max-w-[88vw] object-contain"
            onClick={(e) => e.stopPropagation()}
            onError={onTransformError}
          />
          <div className="mt-3 max-w-[88vw] text-center text-xs tracking-wide text-white/70">
            {t(images[activeIndex].title || images[activeIndex].alt || "Personal work")}
          </div>
          <button
            type="button"
            className="absolute right-2 md:right-8 text-white text-4xl p-3"
            onClick={(e) => {
              e.stopPropagation();
              setActiveIndex((a) => (a === null ? a : (a + 1) % images.length));
            }}
            aria-label="Next"
          >
            ›
          </button>
        </div>
      )}
      <MediaLibraryPicker
        open={pickerOpen}
        kind="image"
        onClose={() => setPickerOpen(false)}
        onPick={(a) => pickFromLibrary(a.url)}
      />
    </div>

  );
}
