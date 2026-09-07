import { useState, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * Drag-and-drop plumbing for gallery reordering.
 *
 * This module (and the ~47 KB dnd-kit dependency it pulls in) is only loaded
 * for a signed-in admin with edit mode on. Visitors used to download it with
 * every gallery page even though they can never reorder anything. The tile
 * markup itself stays in EditableGallery, so nothing about the public render
 * changes.
 */
export type DragProps = {
  setNodeRef: (el: HTMLElement | null) => void;
  style: React.CSSProperties;
  handleProps: Record<string, unknown>;
  isDragging: boolean;
};

function SortableItem({
  id,
  render,
}: {
  id: string;
  render: (drag: DragProps) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <>
      {render({
        setNodeRef,
        style: { transform: CSS.Transform.toString(transform), transition },
        handleProps: { ...attributes, ...listeners },
        isDragging,
      })}
    </>
  );
}

export default function GalleryDnd({
  ids,
  overlaySrc,
  gridClassName,
  onDragEnd,
  renderItem,
  extras,
}: {
  ids: string[];
  overlaySrc: (id: string) => string | undefined;
  gridClassName: string;
  onDragEnd: (event: DragEndEvent) => void | Promise<void>;
  renderItem: (id: string, index: number, drag: DragProps) => ReactNode;
  extras?: ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={(e) => {
        setActiveId(null);
        void onDragEnd(e);
      }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={gridClassName}>
          {ids.map((id, i) => (
            <SortableItem key={id} id={id} render={(drag) => renderItem(id, i, drag)} />
          ))}
          {extras}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeId ? (
          <div className="opacity-80">
            <img src={overlaySrc(activeId)} alt="" className="w-full h-full object-cover" />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
