"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  GripVertical,
  Lock,
  LockOpen,
  MoreVertical,
  Plus,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { AnimatedDashboard } from "@/components/ui/animated-dashboard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface DashboardCustomizableItemProps {
  id: string;
  title: string;
  defaultVisible?: boolean;
  defaultLocked?: boolean;
  children: ReactNode;
}

interface CustomizableDashboardProps {
  storageKey: string;
  className?: string;
  children: ReactNode;
}

interface LayoutState {
  order: string[];
  hidden: string[];
  locked: string[];
}

interface DashboardCardDefinition extends DashboardCustomizableItemProps {
  content: ReactNode;
}

const cardLayoutTransition = {
  type: "spring",
  stiffness: 340,
  damping: 30,
  mass: 0.8,
} as const;

export function DashboardCustomizableItem({
  children,
}: DashboardCustomizableItemProps) {
  return <>{children}</>;
}

function isInteractiveDragOrigin(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      "a, button, input, textarea, select, summary, [role='button'], [data-no-card-drag='true']",
    ),
  );
}

function isDashboardCustomizableElement(
  child: ReactNode,
): child is ReactElement<DashboardCustomizableItemProps> {
  return (
    isValidElement<DashboardCustomizableItemProps>(child) &&
    typeof child.props.id === "string" &&
    typeof child.props.title === "string"
  );
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

function normalizeLayoutState(
  cards: DashboardCardDefinition[],
  stored: Partial<LayoutState> | null,
) {
  const allIds = cards.map((card) => card.id);
  const storedOrder = uniqueIds(
    (stored?.order ?? []).filter((id) => allIds.includes(id)),
  );
  const missingIds = allIds.filter((id) => !storedOrder.includes(id));
  const order = [...storedOrder, ...missingIds];

  const hiddenBase = stored?.hidden
    ? stored.hidden.filter((id) => allIds.includes(id))
    : cards
        .filter((card) => card.defaultVisible === false)
        .map((card) => card.id);
  const lockedBase = stored?.locked
    ? stored.locked.filter((id) => allIds.includes(id))
    : cards
        .filter((card) => card.defaultLocked)
        .map((card) => card.id);

  for (const card of cards) {
    if (card.defaultVisible === false && !stored?.order?.includes(card.id)) {
      hiddenBase.push(card.id);
    }

    if (card.defaultLocked && !stored?.order?.includes(card.id)) {
      lockedBase.push(card.id);
    }
  }

  return {
    order,
    hidden: uniqueIds(hiddenBase),
    locked: uniqueIds(lockedBase),
  } satisfies LayoutState;
}

function moveUnlockedCard(
  order: string[],
  hidden: Set<string>,
  locked: Set<string>,
  draggedId: string,
  targetId: string,
) {
  if (
    draggedId === targetId ||
    locked.has(draggedId) ||
    locked.has(targetId) ||
    hidden.has(draggedId) ||
    hidden.has(targetId)
  ) {
    return order;
  }

  const visibleOrder = order.filter((id) => !hidden.has(id));
  const unlockedOrder = visibleOrder.filter((id) => !locked.has(id));
  const sourceIndex = unlockedOrder.indexOf(draggedId);
  const targetIndex = unlockedOrder.indexOf(targetId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return order;
  }

  const reorderedUnlocked = [...unlockedOrder];
  const [movedCard] = reorderedUnlocked.splice(sourceIndex, 1);
  reorderedUnlocked.splice(targetIndex, 0, movedCard);

  let unlockedIndex = 0;
  const nextVisibleOrder = visibleOrder.map((id) => {
    if (locked.has(id)) {
      return id;
    }

    const nextId = reorderedUnlocked[unlockedIndex];
    unlockedIndex += 1;
    return nextId;
  });

  const hiddenOrder = order.filter((id) => hidden.has(id));
  return [...nextVisibleOrder, ...hiddenOrder];
}

export function CustomizableDashboard({
  storageKey,
  className,
  children,
}: CustomizableDashboardProps) {
  const { messages } = useAppI18n();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const cards = useMemo(() => {
    return Children.toArray(children)
      .filter(isDashboardCustomizableElement)
      .map((child) => ({
        ...child.props,
        content: child.props.children,
      }));
  }, [children]);
  const defaultLayout = useMemo(
    () => normalizeLayoutState(cards, null),
    [cards],
  );
  const [layout, setLayout] = useState<LayoutState>(defaultLayout);
  const [hasLoadedLayout, setHasLoadedLayout] = useState(false);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(storageKey);
      const parsedValue = storedValue
        ? (JSON.parse(storedValue) as Partial<LayoutState>)
        : null;
      setLayout(normalizeLayoutState(cards, parsedValue));
    } catch {
      setLayout(defaultLayout);
    } finally {
      setHasLoadedLayout(true);
    }
  }, [cards, defaultLayout, storageKey]);

  useEffect(() => {
    if (!hasLoadedLayout) {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch {
      // Ignore storage failures and keep customization usable.
    }
  }, [hasLoadedLayout, layout, storageKey]);

  const cardMap = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards],
  );
  const hiddenSet = useMemo(() => new Set(layout.hidden), [layout.hidden]);
  const lockedSet = useMemo(() => new Set(layout.locked), [layout.locked]);
  const isAnyCardDragging = draggingId !== null;
  const visibleCards = layout.order
    .filter((id) => !hiddenSet.has(id))
    .map((id) => cardMap.get(id))
    .filter((card): card is DashboardCardDefinition => Boolean(card));
  const hiddenCards = cards.filter((card) => hiddenSet.has(card.id));

  function showCard(cardId: string) {
    setLayout((current) => {
      if (!current.hidden.includes(cardId)) {
        return current;
      }

      const nextHidden = current.hidden.filter((id) => id !== cardId);
      const visibleOrder = current.order.filter((id) => !current.hidden.includes(id));
      const hiddenOrder = current.order.filter(
        (id) => id !== cardId && current.hidden.includes(id),
      );

      return {
        ...current,
        hidden: nextHidden,
        order: [...visibleOrder, cardId, ...hiddenOrder],
      };
    });
  }

  function hideCard(cardId: string) {
    setLayout((current) => {
      if (current.hidden.includes(cardId)) {
        return current;
      }

      return {
        ...current,
        hidden: [...current.hidden, cardId],
        locked: current.locked.filter((id) => id !== cardId),
      };
    });
  }

  function toggleLocked(cardId: string) {
    setLayout((current) => {
      const isLocked = current.locked.includes(cardId);

      return {
        ...current,
        locked: isLocked
          ? current.locked.filter((id) => id !== cardId)
          : [...current.locked, cardId],
      };
    });
  }

  function reorderCards(draggedId: string, targetId: string) {
    setLayout((current) => ({
      ...current,
      order: moveUnlockedCard(
        current.order,
        new Set(current.hidden),
        new Set(current.locked),
        draggedId,
        targetId,
      ),
    }));
  }

  return (
    <>
      <AnimatedDashboard className={className}>
        <AnimatePresence initial={false} mode="popLayout">
          {visibleCards.map((card) => {
            const isLocked = lockedSet.has(card.id);
            const isDragging = draggingId === card.id;
            const isDropTarget = dragOverId === card.id;

            return (
              <motion.div
                key={card.id}
                layout
                exit={{ opacity: 0, scale: 0.92, y: 18 }}
                transition={cardLayoutTransition}
                className={cn(
                  "group/dashboard-card relative h-full transition-[opacity,transform,box-shadow] duration-200 ease-out will-change-transform",
                  isDragging && "z-20 scale-[1.01] opacity-70 shadow-xl",
                  isDropTarget && "rounded-xl ring-2 ring-primary/35",
                  !isLocked && "cursor-grab active:cursor-grabbing",
                )}
                draggable={!isLocked}
                onDragStartCapture={(event) => {
                  if (isLocked || isInteractiveDragOrigin(event.target)) {
                    event.preventDefault();
                    return;
                  }

                  setDraggingId(card.id);
                  setDragOverId(null);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", card.id);
                }}
                onDragEnterCapture={() => {
                  if (!draggingId || draggingId === card.id || isLocked) {
                    return;
                  }

                  setDragOverId(card.id);
                }}
                onDragOverCapture={(event) => {
                  if (!draggingId || draggingId === card.id || isLocked) {
                    return;
                  }

                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDragLeaveCapture={() => {
                  if (dragOverId === card.id) {
                    setDragOverId(null);
                  }
                }}
                onDropCapture={(event) => {
                  event.preventDefault();

                  if (!draggingId || draggingId === card.id || isLocked) {
                    setDraggingId(null);
                    setDragOverId(null);
                    return;
                  }

                  reorderCards(draggingId, card.id);
                  setDraggingId(null);
                  setDragOverId(null);
                }}
                onDragEndCapture={() => {
                  setDraggingId(null);
                  setDragOverId(null);
                }}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute right-3 top-0 z-10 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity group-hover/dashboard-card:opacity-100 group-focus-within/dashboard-card:opacity-100",
                    isAnyCardDragging && "opacity-0",
                  )}
                >
                  <div className="pointer-events-auto flex items-center gap-1 rounded-full border bg-background/95 px-2 py-1 shadow-sm backdrop-blur-sm">
                    {isLocked ? (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Lock className="h-3.5 w-3.5" />
                        <span className="sr-only">
                          {messages.dashboard.customize.unlockCard}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <GripVertical className="h-3.5 w-3.5" />
                        <span className="sr-only">
                          {messages.dashboard.customize.dragToReorder}
                        </span>
                      </div>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-full"
                        >
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">
                            {messages.dashboard.customize.cardOptions}
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => toggleLocked(card.id)}>
                          {isLocked ? (
                            <LockOpen className="h-4 w-4" />
                          ) : (
                            <Lock className="h-4 w-4" />
                          )}
                          {isLocked
                            ? messages.dashboard.customize.unlockCard
                            : messages.dashboard.customize.lockCard}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => hideCard(card.id)}
                        >
                          {messages.dashboard.customize.removeCard}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div
                  className={cn(
                    "h-full transition-[filter,transform] duration-200",
                    isAnyCardDragging && "pointer-events-none select-none",
                    isDropTarget && "scale-[0.99]",
                  )}
                >
                  {card.content}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <motion.div layout transition={cardLayoutTransition} className="h-full">
          <Card className="h-full border-dashed transition-shadow duration-200 hover:shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-5 w-5 text-primary" />
                {messages.dashboard.customize.addCard}
              </CardTitle>
              <CardDescription>
                {messages.dashboard.customize.addCardsDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex h-full flex-col justify-end">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setIsAddDialogOpen(true)}
              >
                {messages.dashboard.customize.addCard}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatedDashboard>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{messages.dashboard.customize.addCardsTitle}</DialogTitle>
            <DialogDescription>
              {messages.dashboard.customize.addCardsDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {hiddenCards.length > 0 ? (
              hiddenCards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3"
                >
                  <div>
                    <p className="font-medium">{card.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {messages.dashboard.customize.hiddenCardDescription}
                    </p>
                  </div>
                  <Button type="button" size="sm" onClick={() => showCard(card.id)}>
                    {messages.dashboard.customize.addAction}
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                {messages.dashboard.customize.noHiddenCards}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}