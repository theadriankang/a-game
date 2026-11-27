import { credentialKey } from "./normalize";

export type Qualification = "POLYTECHNIC" | "H3" | "OLYMPIAD";

export type StoredGrant = {
  moduleCode: string | null;
  label: string;
  mc: number;
  kind: "PROGRAMME" | "UNRESTRICTED_ELECTIVE";
  grant: "AUTOMATIC" | "OPT_IN";
  note: string | null;
};

/** The subset of an ExemptionRule row that matching needs. */
export type RuleLike = {
  faculty: string;
  programmes: string[];
  qualification: Qualification;
  institution: string | null;
  credential: string;
  credentialKey: string;
  grants: StoredGrant[];
  sourceUrl: string;
};

export type SuggestQuery = {
  faculty: string;
  programme: string;
  qualification: Qualification;
  /** Polytechnic name, e.g. "Nanyang Polytechnic" (POLYTECHNIC only). */
  institution?: string;
  /** Diploma name as the app lists it, or an olympiad medal category as published. */
  credential?: string;
};

export type SuggestedModule = {
  moduleCode: string;
  label: string;
  mc: number;
  kind: StoredGrant["kind"];
  grant: StoredGrant["grant"];
  notes: string[];
};

export type GenericCredit = { label: string; mc: number; notes: string[] };

export type Suggestions = {
  /**
   * none:     the faculty has published nothing we hold for this intake year/qualification
   * unlisted: it has, but this diploma/category isn't in its list
   * matched:  there is something for this student
   */
  coverage: "none" | "unlisted" | "matched";
  modules: SuggestedModule[];
  generic: GenericCredit[];
  sources: string[];
};

/** A rule applies to the student's programme if it names it, or (when it names none) covers their whole faculty. */
export function inScope(rule: RuleLike, q: Pick<SuggestQuery, "faculty" | "programme">): boolean {
  return rule.programmes.length > 0 ? rule.programmes.includes(q.programme) : rule.faculty === q.faculty;
}

export function matchesCredential(rule: RuleLike, q: SuggestQuery): boolean {
  if (rule.credentialKey === "*") return true;
  if (!q.credential) return false;
  if (rule.credentialKey !== credentialKey(q.credential)) return false;
  return rule.qualification !== "POLYTECHNIC" || rule.institution === (q.institution ?? null);
}

export function suggestFromRules(rules: RuleLike[], q: SuggestQuery): Suggestions {
  const scoped = rules.filter((r) => r.qualification === q.qualification && inScope(r, q));
  if (scoped.length === 0) return { coverage: "none", modules: [], generic: [], sources: [] };

  const matched = scoped.filter((r) => matchesCredential(r, q));
  const modules = new Map<string, SuggestedModule>();
  const generic = new Map<string, GenericCredit>();
  const sources = new Set<string>();

  for (const rule of matched) {
    sources.add(rule.sourceUrl);
    for (const g of rule.grants) {
      const notes = g.note ? [g.note] : [];
      if (g.moduleCode === null) {
        // Generic credit is a pool, not a list: two faculties' pages (e.g. Computing and CDE for Computer
        // Engineering) both stating "20 units of electives" describe the same credit, so keep one per kind.
        const have = generic.get(g.kind);
        if (!have) generic.set(g.kind, { label: g.label, mc: g.mc, notes });
        else {
          have.notes = [...new Set([...have.notes, ...notes])];
          if (g.mc > have.mc) Object.assign(have, { label: g.label, mc: g.mc });
        }
      } else {
        const have = modules.get(g.moduleCode);
        if (have) {
          have.notes = [...new Set([...have.notes, ...notes])];
          if (g.grant === "AUTOMATIC") have.grant = "AUTOMATIC";
        } else {
          modules.set(g.moduleCode, { moduleCode: g.moduleCode, label: g.label, mc: g.mc, kind: g.kind, grant: g.grant, notes });
        }
      }
    }
  }

  const moduleList = [...modules.values()].sort((a, b) => a.moduleCode.localeCompare(b.moduleCode));
  const genericList = [...generic.values()];
  return {
    coverage: moduleList.length === 0 && genericList.length === 0 ? "unlisted" : "matched",
    modules: moduleList,
    generic: genericList,
    sources: [...sources],
  };
}

/** Distinct medal categories published for a faculty/programme (olympiads). */
export function credentialOptions(rules: RuleLike[], q: Pick<SuggestQuery, "faculty" | "programme" | "qualification">): string[] {
  const names = rules
    .filter((r) => r.qualification === q.qualification && r.credentialKey !== "*" && inScope(r, q))
    .map((r) => r.credential);
  return [...new Set(names)].sort();
}

/** The intake year a student matriculating in `startYear` falls under, as the "2026-27" label. */
export { academicYearLabel } from "./normalize";
