import type { MinorStructure } from "./types";
import { minorAi } from "./ai";
import { minorStatistics } from "./statistics";
import { minorMathematics } from "./mathematics";

// Only a few minors are modeled so far - NUSMods' API has no minor
// requirement data, so each one here is manually sourced from the NUS
// Bulletin/department pages (see each file's own source + caveats).
// More get added over time; this is deliberately not every NUS minor.
export const ALL_MINORS: MinorStructure[] = [minorAi, minorStatistics, minorMathematics];
