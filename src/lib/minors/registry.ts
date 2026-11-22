import type { MinorStructure } from "./types";
import { minorAi } from "./ai";
import { minorStatistics } from "./statistics";
import { minorMathematics } from "./mathematics";
import { secondMajorStatistics } from "./second-major-statistics";
import { secondMajorMathematics } from "./second-major-mathematics";

// Only a few minors/second majors are modeled so far - NUSMods' API has
// no minor/second-major requirement data, so each one here is manually
// sourced from the NUS Bulletin/department pages (see each file's own
// source + caveats). More get added over time; this is deliberately not
// every NUS minor or second major.
export const ALL_MINORS: MinorStructure[] = [minorAi, minorStatistics, minorMathematics];
export const ALL_SECOND_MAJORS: MinorStructure[] = [secondMajorStatistics, secondMajorMathematics];
