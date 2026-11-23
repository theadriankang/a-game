// A lightweight word-cloud: bigger, bolder, more prominent tags are the
// ones that showed up across more sources (see ModuleAnalysis.tagWeights
// and the weighting scheme in lib/anthropic.ts). This sits alongside the
// written summary as a quick-glance visual, not a replacement for it.
//
// No external word-cloud library/physics packing here on purpose - a
// centered flex-wrap, sized and colored by weight, gets the "common
// things stand out, rare things fade" effect Mentimeter-style word clouds
// go for, without the complexity (or bundle size) of a true collision-
// avoiding layout. Fine at the 3-6 tags this ever has to render.

type Props = {
  tags: string[];
  // Parallel to tags. Missing/short (older cached reports, or a parse
  // that didn't get weights) falls back to every tag at the same
  // mid-weight, so the cloud still renders, just without emphasis.
  weights?: number[];
};

const SIZE_BY_WEIGHT: Record<number, string> = {
  1: "text-[11px] font-medium text-text3",
  2: "text-[13px] font-medium text-text2",
  3: "text-[16px] font-semibold text-text1",
  4: "text-[20px] font-semibold text-text0",
  5: "text-[26px] font-bold text-accent",
};

export function TagCloud({ tags, weights }: Props) {
  if (tags.length === 0) return null;

  const resolvedWeights =
    weights && weights.length === tags.length ? weights : tags.map(() => 3);

  const items = tags
    .map((tag, i) => ({
      tag,
      weight: Math.min(5, Math.max(1, Math.round(resolvedWeights[i] ?? 3))),
    }))
    // Biggest/most-common first, like a real word cloud draws attention
    // to the dominant words before the long tail.
    .sort((a, b) => b.weight - a.weight);

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2"
      title="Bigger = came up across more sources"
    >
      {items.map(({ tag, weight }) => (
        <span
          key={tag}
          className={`leading-tight transition-opacity ${SIZE_BY_WEIGHT[weight]}`}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
