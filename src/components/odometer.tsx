"use client";

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
  return (
    <span className="relative inline-block h-[1em] overflow-hidden align-baseline">
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

  return (
    <span className={`inline-flex flex-row-reverse tabular-nums ${className ?? ""}`}>
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
