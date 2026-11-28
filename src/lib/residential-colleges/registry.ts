import type { CollegeStructure } from "./types";
import { acacia } from "./acacia";
import { capt } from "./capt";
import { rc4 } from "./rc4";
import { tembusu } from "./tembusu";
import { rvrc } from "./rvrc";

// All 5 NUS residential colleges. Acacia is modeled in the most depth
// (it's the one college-specific quirk the author could verify directly);
// the other four are structurally complete but worth a second verification
// pass against each college's live course list before anyone leans on the
// exact pillar mapping - see each file's own caveats.
export const ALL_COLLEGES: CollegeStructure[] = [acacia, capt, rc4, tembusu, rvrc];

export function getCollege(id: string): CollegeStructure | undefined {
  return ALL_COLLEGES.find((c) => c.id === id);
}
