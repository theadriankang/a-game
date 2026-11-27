"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PrereqViolation } from "@/lib/prereq-check";

const KIND_LABEL: Record<PrereqViolation["kind"], string> = {
  prereq: "Prerequisites",
  preclusion: "Preclusion",
  duplicate: "Duplicate",
};

const POPOVER_WIDTH = 288;
const GAP = 8;
const VIEWPORT_MARGIN = 8;

type Position = { left: number; top: number };

/**
 * The red "Check" pill on a planner card, with a popover that explains why. It replaces a native `title`
 * tooltip, which waits about a second to appear, is tiny, can't be styled, and never shows on touch screens.
 *
 * Opens on mouse hover, on keyboard focus, and on tap. It renders into a portal with fixed positioning because
 * the cards sit inside overflow-clipped columns and a transformed hover state, either of which would cut off or
 * misplace an absolutely positioned child.
 */
export function ViolationBadge({ violations }: { violations: PrereqViolation[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // A mouse click on the badge shouldn't close the popover the hover just opened; touch and keyboard clicks
  // should toggle it, since they have no hover to open it with.
  const clickedWithMouse = useRef(false);
  const popoverId = useId();

  // Measure after the popover mounts (hidden, at 0,0) so it can be placed using its real height: below the
  // badge when there's room, above it otherwise, and always kept inside the viewport horizontally.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const button = buttonRef.current;
    const popover = popoverRef.current;
    if (!button || !popover) return;
    const anchor = button.getBoundingClientRect();
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - 2 * VIEWPORT_MARGIN);
    const height = popover.offsetHeight;
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(anchor.left, window.innerWidth - width - VIEWPORT_MARGIN)
    );
    const fitsBelow = anchor.bottom + GAP + height <= window.innerHeight - VIEWPORT_MARGIN;
    const top = fitsBelow ? anchor.bottom + GAP : Math.max(VIEWPORT_MARGIN, anchor.top - GAP - height);
    setPosition({ left, top });
  }, [open]);

  // Fixed positioning would leave the popover floating in the wrong place if the page moved under it, so any
  // scroll or resize just dismisses it. A tap or click anywhere else dismisses it too (touch has no mouse-leave).
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (e: PointerEvent) => {
      if (!buttonRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Check: ${violations.map((v) => v.message).join(" ")}`}
        aria-describedby={open ? popoverId : undefined}
        onPointerDown={(e) => {
          clickedWithMouse.current = e.pointerType === "mouse";
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setOpen(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setOpen(false);
        }}
        // Keyboard focus only: a tap or click also focuses the button, and opening here would let the click that
        // follows toggle the popover straight back shut.
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onClick={() => {
          if (clickedWithMouse.current) {
            clickedWithMouse.current = false;
            return;
          }
          setOpen((o) => !o);
        }}
        className="inline-flex cursor-help items-center rounded-full border border-red-border bg-red-bg px-1.5 py-0.5 text-[10.5px] font-semibold text-red outline-none transition-colors focus-visible:ring-2 focus-visible:ring-red"
      >
        ⚠ Check
      </button>
      {open
        ? createPortal(
            <div
              ref={popoverRef}
              id={popoverId}
              role="tooltip"
              style={{
                left: position?.left ?? 0,
                top: position?.top ?? 0,
                width: `min(${POPOVER_WIDTH}px, calc(100vw - ${2 * VIEWPORT_MARGIN}px))`,
                // Hidden (but laid out, so it can be measured) until the position effect has run.
                visibility: position ? "visible" : "hidden",
              }}
              className="pointer-events-none fixed z-50 animate-fade-in rounded-lg border border-border bg-surface p-3 text-[13px] leading-relaxed text-text1 shadow-lg"
            >
              <ul className="flex flex-col gap-2.5">
                {violations.map((v, i) => (
                  <li key={`${v.kind}-${i}`}>
                    <div className="text-[10.5px] font-semibold uppercase tracking-wide text-red">
                      {KIND_LABEL[v.kind]}
                    </div>
                    <div>{v.message}</div>
                  </li>
                ))}
              </ul>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
