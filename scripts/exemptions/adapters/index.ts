import type { Adapter } from "../lib/types";
import { compPoly } from "./comp-poly";
import { compOlympiad } from "./comp-olympiad";
import { nursingPoly } from "./nursing-poly";
import { cdeDesign, cdeEng } from "./cde-poly";
import { bbaPolyUe, compPolyUe, fassPolyUe, scienceImo, sciencePolyUe } from "./rule-based";

export const ADAPTERS: Record<string, Adapter> = {
  "comp-poly": compPoly,
  "comp-olympiad": compOlympiad,
  "cde-eng": cdeEng,
  "cde-design": cdeDesign,
  "nursing-poly": nursingPoly,
  "science-poly-ue": sciencePolyUe,
  "fass-poly-ue": fassPolyUe,
  "bba-poly-ue": bbaPolyUe,
  "science-imo": scienceImo,
  "comp-poly-ue": compPolyUe,
};
