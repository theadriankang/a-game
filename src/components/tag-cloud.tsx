"use client";

import { useEffect, useRef, useState } from "react";

// An actual packed word cloud - not just a sized list. Bigger/bolder
// words are the ones that showed up across more sources (see
// ModuleAnalysis.keywordWeights and the weighting scheme in
// lib/anthropic.ts); they anchor near the center the way a Mentimeter
// word cloud settles its most-submitted answers in the middle, with
// smaller/rarer ones packed in around them.
//
// This does its own two-pass layout (measure invisible copies, then
// place them along an expanding spiral until each one lands somewhere
// that doesn't overlap what's already placed) instead of pulling in a
// word-cloud library - the word counts here are small (under ~15) so a
// simple spiral-search packer is plenty, and it's a few KB instead of a
// dependency.

type Props = {
  words: string[];
  weights?: number[];
  height?: number;
};

type Word = { text: string; weight: number };
type Placed = Word & { x: number; y: number; angle: number; w: number; h: number };

const FONT_SIZE_PX: Record<number, number> = { 1: 12, 2: 15, 3: 19, 4: 24, 5: 32 };
const COLOR_CLASS: Record<number, string> = {
  1: "text-text3 font-medium",
  2: "text-text2 font-medium",
  3: "text-text1 font-semibold",
  4: "text-text0 font-semibold",
  5: "text-accent font-bold",
};

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  pad = 4
) {
  return !(
    a.x + a.w / 2 + pad < b.x - b.w / 2 ||
    a.x - a.w / 2 - pad > b.x + b.w / 2 ||
    a.y + a.h / 2 + pad < b.y - b.h / 2 ||
    a.y - a.h / 2 - pad > b.y + b.h / 2
  );
}

export function TagCloud({ words, weights, height = 200 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [placed, setPlaced] = useState<Placed[] | null>(null);

  const items: Word[] = words.map((text, i) => ({
    text,
    weight: Math.min(5, Math.max(1, Math.round(weights?.[i] ?? 3))),
  }));
  // Biggest first, so the dominant words get first claim on the center
  // and everything else packs in around them.
  const sorted = [...items].sort((a, b) => b.weight - a.weight);
  // Identifies this exact set of words+weights, so the layout effect
  // below only re-runs when the actual cloud content changes, not on
  // every unrelated parent re-render.
  const contentKey = sorted.map((w) => `${w.text}:${w.weight}`).join("|");

  useEffect(() => {
    setPlaced(null); // re-measure from scratch when the content itself changes
  }, [contentKey]);

  useEffect(() => {
    if (placed !== null) return; // already laid out for this content
    const container = containerRef.current;
    if (!container || sorted.length === 0) return;

    const cw = container.clientWidth || 300;
    const cx = cw / 2;
    const cy = height / 2;
    const results: Placed[] = [];

    sorted.forEach((word, i) => {
      const el = measureRefs.current[i];
      if (!el) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;

      let x = cx;
      let y = cy;
      if (i > 0) {
        // Each word starts its spiral search from a different angle
        // (golden-angle offset) so they don't all fan out along the same
        // seam and end up visibly lined up.
        let angle = (i * 137.5 * Math.PI) / 180;
        let radius = 0;
        const angleStep = 0.32;
        const radiusStep = 2.4;
        for (let t = 0; t < 3000; t++) {
          angle += angleStep;
          radius += radiusStep * angleStep;
          x = cx + radius * Math.cos(angle);
          y = cy + radius * Math.sin(angle);
          const candidate = { x, y, w, h };
          const collides = results.some((r) => overlaps(candidate, r));
          const outOfBounds =
            x - w / 2 < 0 || x + w / 2 > cw || y - h / 2 < 0 || y + h / 2 > height;
          if (!collides && !outOfBounds) break;
        }
      }
      // A small deterministic tilt per word for an organic, hand-placed
      // feel - not full randomness, so the same data lays out the same
      // way on every render rather than jittering.
      const tilt = ((i * 53) % 7) - 3;
      results.push({ ...word, x, y, angle: tilt * 2, w, h });
    });

    setPlaced(results);
  }, [placed, sorted, height]);

  if (words.length === 0) return null;

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      {placed === null &&
        sorted.map((word, i) => (
          <span
            key={i}
            ref={(el) => {
              measureRefs.current[i] = el;
            }}
            className={`absolute left-0 top-0 whitespace-nowrap opacity-0 ${COLOR_CLASS[word.weight]}`}
            style={{ fontSize: FONT_SIZE_PX[word.weight] }}
          >
            {word.text}
          </span>
        ))}

      {placed?.map((word, i) => (
        <span
          key={i}
          className={`animate-fade-in absolute whitespace-nowrap leading-none transition-opacity ${COLOR_CLASS[word.weight]}`}
          style={{
            left: word.x,
            top: word.y,
            fontSize: FONT_SIZE_PX[word.weight],
            transform: `translate(-50%, -50%) rotate(${word.angle}deg)`,
          }}
        >
          {word.text}
        </span>
      ))}
    </div>
  );
}
