import { useState, useEffect, useCallback, useRef, memo } from "react";
import { Search, ChevronLeft, ChevronRight, Loader2, Package, RotateCw, SearchX, X } from "lucide-react";
import { api, type ItemsPage as ItemsPageData, type ItemRecord } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TextureImage } from "@/components/texture-image";
import { EmptyState, PageHeader } from "@/components/common";

export function ItemsPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ItemsPageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);

  const fetchItems = useCallback(async (p: number, query: string) => {
    const id = ++requestRef.current;
    setLoading(true);
    setFailed(false);
    try {
      const result = await api.getItems(p, query);
      if (id === requestRef.current) setData(result);
    } catch {
      if (id === requestRef.current) setFailed(true);
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, []);

  const qRef = useRef(q);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const isQueryChange = qRef.current !== q;
    qRef.current = q;
    if (isQueryChange) {
      setPage(1);
      debounceRef.current = setTimeout(() => fetchItems(1, q), 300);
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    } else {
      fetchItems(page, q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 0;
  const firstLoad = !data && loading;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-card/60 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3">
          <PageHeader
            icon={Package}
            title="Items"
            description={
              data
                ? `${data.total.toLocaleString()} item${data.total === 1 ? "" : "s"}${q ? " match your search" : " in the game database"}`
                : "Browse the game item database"
            }
          />
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by ID or name…"
              aria-label="Search items"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 pr-9 pl-9"
            />
            {loading && data ? (
              <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : (
              q && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQ("")}
                  className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-4 sm:p-6">
          {failed ? (
            <EmptyState
              icon={Package}
              title="Could not load items"
              description="The item database did not respond. Check that the backend is running and try again."
              action={
                <Button variant="outline" onClick={() => fetchItems(page, q)}>
                  <RotateCw />
                  Try again
                </Button>
              }
            />
          ) : firstLoad ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
              {Array.from({ length: 16 }, (_, i) => (
                <Skeleton key={i} className="aspect-[3/4] w-full" />
              ))}
            </div>
          ) : data && data.items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No items found"
              description={q ? `Nothing matches “${q}”. Try another name or an item ID.` : "The item database is empty."}
              action={
                q ? (
                  <Button variant="outline" onClick={() => setQ("")}>
                    Clear search
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div
              className={
                "grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 " +
                (loading ? "opacity-60" : "opacity-100")
              }
            >
              {data?.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onClick={() => {
                    setSelectedItem(item);
                    setDialogOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-card/60 px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Button variant="outline" size="sm" disabled={!data || page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft />
            <span className="hidden sm:inline">Previous</span>
          </Button>
          <span className="tabular text-sm text-muted-foreground">
            {data ? `Page ${page} of ${totalPages}` : "—"}
          </span>
          <Button variant="outline" size="sm" disabled={!data || page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
            <span className="hidden sm:inline">Next</span>
            <ChevronRight />
          </Button>
        </div>
      </div>

      <ItemDialog item={selectedItem} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function ItemDialog({
  item,
  open,
  onOpenChange,
}: {
  item: ItemRecord | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const shown = item;

  const rows: [string, React.ReactNode][] = shown
    ? [
        ["Rarity", shown.rarity],
        ["Max stack", shown.max_item],
        ["Grow time", shown.grow_time ? `${shown.grow_time}s` : "—"],
        ["Block health", shown.block_health],
        ["Drop chance", shown.drop_chance],
        ["Action type", shown.action_type],
        ["Material", shown.material],
        ["Collision", shown.collision_type],
        ["Render type", shown.render_type],
        ["Clothing type", shown.clothing_type],
        ["Visual effect", shown.visual_effect],
        ["Flags", <span key="f" className="font-mono">0x{shown.flags.toString(16).toUpperCase()}</span>],
        ["Texture", <span key="t" className="font-mono text-xs break-all">{shown.texture_file_name}</span>],
        ["Texture coords", <span key="c" className="font-mono">({shown.texture_x}, {shown.texture_y})</span>],
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        {shown && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-4">
                <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  <TextureImage item={shown} />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block font-mono text-xs font-normal text-muted-foreground">#{shown.id}</span>
                  <span className="block truncate text-lg font-semibold">{shown.name}</span>
                </span>
              </DialogTitle>
              <DialogDescription className="sr-only">Details for {shown.name}</DialogDescription>
            </DialogHeader>

            {shown.description && (
              <p className="rounded-lg bg-muted/60 p-3 text-sm">{shown.description}</p>
            )}

            <dl className="grid gap-x-8 sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 text-sm">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="tabular min-w-0 text-right">{v}</dd>
                </div>
              ))}
            </dl>

            {shown.pet_name && (
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Pet</p>
                <p>
                  {shown.pet_prefix} {shown.pet_name} {shown.pet_suffix}
                </p>
                {shown.pet_ability && <p className="text-muted-foreground">Ability: {shown.pet_ability}</p>}
              </div>
            )}

            {shown.extra_options && (
              <div className="text-sm">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Extra options</p>
                <p className="rounded-lg bg-muted/60 p-2 font-mono text-xs break-all">{shown.extra_options}</p>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const ItemCard = memo(function ItemCard({ item, onClick }: { item: ItemRecord; onClick: () => void }) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: "200px" },
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5 text-left transition-colors outline-none hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
      style={{ contain: "layout style paint" }}
    >
      <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
        {isVisible ? <TextureImage item={item} /> : <Skeleton className="size-full rounded-none" />}
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-xs text-muted-foreground">#{item.id}</span>
        <span className="block truncate text-sm font-medium" title={item.name}>
          {item.name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          Rarity {item.rarity}
          {item.grow_time > 0 ? ` · ${item.grow_time}s` : ""}
        </span>
      </span>
    </button>
  );
});
