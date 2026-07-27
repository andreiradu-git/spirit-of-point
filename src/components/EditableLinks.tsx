import { useSiteList } from "@/hooks/use-site-list";
import type { SiteLink } from "@/routes/admin.links";
import { ExternalLink } from "lucide-react";

export function EditableLinks({
  category,
  className,
  showDescription = false,
}: {
  category?: string;
  className?: string;
  showDescription?: boolean;
}) {
  const { items } = useSiteList<SiteLink>("links", []);
  const filtered = items.filter(
    (l) => l.visible && l.url && (!category || l.category === category),
  );
  if (filtered.length === 0) return null;
  return (
    <ul className={className ?? "flex flex-col gap-2"}>
      {filtered.map((l) => (
        <li key={l.id}>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:underline"
          >
            {l.title}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
          {showDescription && l.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
