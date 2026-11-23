"use client";

import { useAnimate } from "motion/react";
import { useEffect, useRef } from "react";

// A rolling-digit counter: when `value` changes, each digit column
// animates vertically to its new position instead of just swapping text,
// the classic "odometer" effect. Non-digit characters (commas, "$", ".",
// "<") render as plain static text alongside the animated digits.
//
// Digits are matched up by their position from the right (least
// significant first) so that e.g. 998 -> 999 rolls the last digit
// smoothly. If the number gains a new leading digit (999 -> 1000), that
// new column just appears - a rare edge case here, not worth the extra
// complexity of an enter/exit transition for it.
//
// On top of the per-digit roll, the whole number also gets a quick
// spring "pop" whenever the value changes - borrowed from Motion's
// "Characters remaining" example (motion.dev/examples/react-characters-remaining):
// it fires an imperative spring via useAnimate rather than a declarative
// transition, and feeds the spring a starting velocity proportional to
// how big the jump was, so a cron batch landing 15 new tokens at once
// snaps harder than a lone +1. That reads as "something just happened"
// a plain CSS transition on its own doesn't convey.

// "format" used to be a function prop, but a Server Component can't pass
// a plain function into a Client Component (not serializable across that
// boundary - this is what broke /usage). A string variant keeps the
// formatting logic in here instead, so only serializable props cross.
type Variant = "number" | "usd";

type Props = {
  value: number;
  variant?: Variant;
  className?: string;
};

function formatValue(value: number, variant: Variant): string {
  if (variant === "usd") {
    return value < 0.01 && value > 0 ? "<$0.01" : `$${value.toFixed(2)}`;
  }
  return value.toLocaleString();
}

// Shared by every character - digit columns AND plain punctuation. An
// inline-block with non-visible overflow has its CSS baseline defined as
// its own bottom edge rather than its text's baseline (that's the spec
// rule, not a bug we can "turn off"). DigitColumn needs overflow-hidden
// to clip the scrolling 0-9 strip, so its baseline is always bottom-edge.
// If plain characters next to it ("$", ".", ",") were left as ordinary
// text, they'd align by their *normal* text baseline instead - a
// different reference line - and the mismatch is exactly what made "2"
// in "$2.06" look like it was floating/shrunk relative to its neighbors.
// Routing every character through this same boxed wrapper means they all
// resolve to the same (consistent) baseline rule, so nothing drifts.
function CharBox({ children }: { children: React.ReactNode }) {
  // leading-[1em] matters as much as h-[1em] here: without it, a plain
  // text node inherits the page's normal line-height (taller than 1em),
  // and since the box clips to exactly h-[1em], whatever part of the
  // glyph sits lower in that taller line box - which for "." and ","
  // is most of the visible ink - gets cut off. Forcing the line-height
  // down to match the box height keeps the whole glyph inside the
  // visible window. DigitColumn's own rows already do this for the same
  // reason; this wrapper needs it too now that plain characters share it.
  return (
    <span className="relative inline-block h-[1em] overflow-hidden align-baseline leading-[1em]">
      {children}
    </span>
  );
}

function DigitColumn({ digit }: { digit: number }) {
  return (
    <CharBox>
      {/* Invisible 0 sets the column's width to one digit glyph. */}
      <span className="invisible">0</span>
      <span
        className="absolute inset-0 flex flex-col transition-transform duration-500 ease-out"
        style={{ transform: `translateY(${-digit}em)` }}
      >
        {Array.from({ length: 10 }, (_, d) => (
          <span key={d} className="h-[1em] leading-[1em] text-center">
            {d}
          </span>
        ))}
      </span>
    </CharBox>
  );
}

export function Odometer({ value, variant = "number", className }: Props) {
  const formatted = formatValue(value, variant);
  // Reverse so index 0 is the rightmost (least significant) character -
  // that's what keeps a given digit column tracking the same place value
  // across renders even if the string's length changes.
  const reversedChars = formatted.split("").reverse();

  const [scope, animate] = useAnimate();
  const prevValue = useRef(value);

  useEffect(() => {
    const delta = value - prevValue.current;
    prevValue.current = value;
    if (delta === 0 || !scope.current) return;

    // The target is just the resting scale (1) - no keyframes. The
    // bounce comes entirely from handing the spring a starting velocity,
    // the way you'd flick a physical dial: a positive push away from
    // rest that the spring's stiffness/damping then pulls back and
    // settles, producing a natural overshoot-and-recover with no
    // explicit "peak" value to tune. Clamped so a huge cron-batch delta
    // doesn't fling it into an absurd overshoot.
    const velocity = Math.max(-40, Math.min(40, Math.abs(delta) * 2 + 8));
    animate(
      scope.current,
      { scale: 1 },
      { type: "spring", velocity, stiffness: 700, damping: 22 }
    );
  }, [value, animate, scope]);

  return (
    <span
      ref={scope}
      className={`inline-flex flex-row-reverse tabular-nums ${className ?? ""}`}
    >
      {reversedChars.map((ch, i) =>
        /[0-9]/.test(ch) ? (
          <DigitColumn key={i} digit={Number(ch)} />
        ) : (
          <CharBox key={i}>{ch}</CharBox>
        )
      )}
    </span>
  );
}
