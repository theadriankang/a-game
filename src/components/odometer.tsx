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

type Props = {
  value: number;
  format?: (n: number) => string;
  className?: string;
};

function DigitColumn({ digit }: { digit: number }) {
  return (
    <span className="relative inline-block h-[1em] overflow-hidden align-baseline">
      {/* Invisible 0-9 stack sets the column's width to one digit glyph. */}
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
    </span>
  );
}

export function Odometer({ value, format, className }: Props) {
  const formatted = (format ?? ((n: number) => n.toLocaleString()))(value);
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
          <span key={i} className="inline-block">
            {ch}
          </span>
        )
      )}
    </span>
  );
}
