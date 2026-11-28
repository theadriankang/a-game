// What the pipeline reads: one entry per minor / second major. Adding a programme = add a line here, run
// `npm run programmes:extract -- --only <id>`, review the draft, promote it (docs/programmes-pipeline.md).
//
// `id` becomes the programme's id everywhere (planner nudges, database row), so pick it once and keep it:
// "minor-<subject>", "second-major-<subject>" or "focus-area-<subject>".

export type ProgrammeSource = {
  id: string;
  kind: "minor" | "second-major" | "specialisation";
  // Written onto the record as-is (the model is not asked for them, so it can't get them wrong).
  label: string;
  department: string;
  url: string;
  // Omit for a normal live fetch. `manual` names a file under data/programmes/manual/ that a person saved from a
  // normal browser, for pages behind bot protection (the fetcher never works around a challenge).
  locator?: { manual: string };
  // Extra guidance for the extractor when a page has a quirk it would otherwise misread. Say what the page
  // means, never what the answer is.
  hints?: string[];
};

const SOC = "NUS Computing";
const SOC_MINORS = "https://www.comp.nus.edu.sg/programmes/ug/minorc/";
const SOC_MAJORS = "https://www.comp.nus.edu.sg/programmes/ug/major/";

function focusArea(slug: string, name: string): ProgrammeSource {
  return {
    id: `focus-area-${slug}`,
    kind: "specialisation",
    label: `Focus Area: ${name}`,
    department: SOC,
    url: "https://comp.nus.edu.sg/programmes/ug/focus",
    hints: [
      `The page covers every CS focus area. Extract only the "${name}" section.`,
      "A focus area is satisfied by 3 courses from that area's Primaries, at least one at level 4000 or above. Only Primaries count toward it; Electives are just a guide to related courses.",
    ],
  };
}

// A programme whose page is behind bot protection: expects the page saved as a PDF at data/programmes/manual/<id>.pdf.
function handSaved(id: string, label: string, department: string, url: string, hints?: string[]): ProgrammeSource[] {
  return [{ id, kind: "minor", label, department, url, locator: { manual: `${id}.pdf` }, ...(hints ? { hints } : {}) }];
}

// Same, for a programme that shares a saved page with others or needs a differently-named file, and for second majors.
function saved(
  id: string,
  kind: ProgrammeSource["kind"],
  label: string,
  department: string,
  url: string,
  file: string,
  hints?: string[]
): ProgrammeSource {
  return { id, kind, label, department, url, locator: { manual: file }, ...(hints ? { hints } : {}) };
}

// The Centre for Language Studies runs one minor per language, all on one page. Each is its own programme because a
// student does one language: 20 units in it, including a Level 6 course.
const LANGUAGE_STUDIES: [slug: string, name: string][] = [
  ["arabic", "Arabic"],
  ["bahasa-indonesia", "Indonesian"],
  ["chinese", "Chinese"],
  ["french", "French"],
  ["german", "German"],
  ["hindi", "Hindi"],
  ["japanese", "Japanese"],
  ["korean", "Korean"],
  ["malay", "Malay"],
  ["spanish", "Spanish"],
  ["thai", "Thai"],
  ["vietnamese", "Vietnamese"],
];

function languageStudies(): ProgrammeSource[] {
  return LANGUAGE_STUDIES.map(([slug, name]) =>
    saved(
      `minor-language-studies-${slug}`,
      "minor",
      `Minor in ${name} Language Studies`,
      "Centre for Language Studies",
      "https://fass.nus.edu.sg/cls/minor-in-language-studies/",
      "minor-language-studies.pdf",
      [`The page covers the minor in all twelve languages. Extract only the Minor in ${name} Language Studies.`]
    )
  );
}


// NUS Business School's own second majors and minors, for BBA students. The page shows one programme at a time, so each
// is its own saved file.
const BBA_PROGRAMMES: [slug: string, name: string][] = [
  ["accountancy", "Accountancy"],
  ["applied-business-analytics", "Applied Business Analytics"],
  ["business-economics", "Business Economics"],
  ["finance", "Finance"],
  ["innovation-and-entrepreneurship", "Innovation & Entrepreneurship"],
  ["leadership-and-human-capital-management", "Leadership & Human Capital Management"],
  ["marketing", "Marketing"],
  ["operations-and-supply-chain-management", "Operations & Supply Chain Management"],
  ["real-estate", "Real Estate"],
];

function bbaProgrammes(): ProgrammeSource[] {
  return BBA_PROGRAMMES.flatMap(([slug, name]) => [
    saved(`second-major-bba-${slug}`, "second-major", `Second Major in ${name} (for BBA students)`, "NUS Business School",
      "https://bba.nus.edu.sg/second-majors-and-minors/", `second-major-bba-${slug}.pdf`,
      [`The page lists every BBA second major and minor; extract only the Second Major in ${name}, cohort 2023 onwards.`]),
    saved(`minor-bba-${slug}`, "minor", `Minor in ${name} (for BBA students)`, "NUS Business School",
      "https://bba.nus.edu.sg/second-majors-and-minors/", `minor-bba-${slug}.pdf`,
      [`The page lists every BBA second major and minor; extract only the Minor in ${name}, cohort 2023 onwards.`]),
  ]);
}


// Fifth round of saved pages (2026-11-28): the remaining minors. [id, kind, label, department, url, hint]
const FIFTH_ROUND: [string, ProgrammeSource["kind"], string, string, string, string?][] = [
  ["minor-astronomy", "minor", "Minor in Astronomy", "Physics", "https://www.physics.nus.edu.sg/student/minor-in-astronomy/"],
  ["minor-bioinformatics", "minor", "Minor in Bioinformatics", "Biological Sciences", "https://www.dbs.nus.edu.sg/lifesciences/minor-in-bioinformatics/", "Extract the requirements for cohorts AY2019/20 onwards."],
  ["minor-botany", "minor", "Minor in Botany", "Biological Sciences", "https://www.dbs.nus.edu.sg/lifesciences/minor-in-botany/", "Extract the requirements for cohorts AY2021/22 onwards."],
  ["minor-meteorology-and-climate-science", "minor", "Minor in Meteorology and Climate Science", "Physics", "https://www.physics.nus.edu.sg/student/minor-in-meteorology-and-climate-science/", "Extract the criteria for cohorts AY2026/27 onwards."],
  ["minor-nanoscience", "minor", "Minor in Nanoscience", "Physics & Chemistry", "https://www.physics.nus.edu.sg/student/minor-in-nanoscience/", "Extract the criteria for cohorts AY2026/27 onwards."],
  ["minor-physics", "minor", "Minor in Physics", "Physics", "https://www.physics.nus.edu.sg/student/minor-in-physics/"],
  ["minor-physics-in-technology", "minor", "Minor in Physics in Technology", "Physics", "https://www.physics.nus.edu.sg/student/physics-in-technology-minor/", "The page is in three tabs (overview, essential, elective); only AY2021/22 to AY2024/25 cohorts may read it."],
  ["minor-medical-physics", "minor", "Minor in Medical Physics", "Physics", "https://www.physics.nus.edu.sg/student/minor-in-medical-physics/"],
  ["minor-nutrition", "minor", "Minor in Nutrition", "Food Science & Technology", "https://www.fst.nus.edu.sg/education/undergraduate-programme/", "Extract the structure for students matriculated AY2021/22 onwards."],
  ["minor-pharmaceutical-science", "minor", "Minor in Pharmaceutical Science", "Pharmacy & Pharmaceutical Sciences", "https://pharmacy.nus.edu.sg/study/undergraduate/minor-in-pharmaceutical-science/", "Extract the non-laboratory-based version."],
  ["minor-forensic-science", "minor", "Minor in Forensic Science", "Biological Sciences & Chemistry", "https://www.dbs.nus.edu.sg/lifesciences/forensic-science/", "The page covers the second major and the minor; extract the minor for cohorts AY2021/22 onwards."],
  ["second-major-forensic-science", "second-major", "Second Major in Forensic Science", "Biological Sciences & Chemistry", "https://www.dbs.nus.edu.sg/lifesciences/forensic-science/", "The page covers the second major and the minor; extract the second major for cohorts AY2022/23 onwards."],
  ["minor-biomedical-engineering", "minor", "Minor in Biomedical Engineering", "Biomedical Engineering", "https://cde.nus.edu.sg/bme/minor-in-biomedical-engineering/"],
  ["minor-electrical-engineering", "minor", "Minor in Electrical Engineering", "Electrical & Computer Engineering", "https://cde.nus.edu.sg/ece/minor-in-electrical-engineering/"],
  ["minor-hydrogen-and-low-carbon-technology", "minor", "Minor in Hydrogen and Low Carbon Technology", "Chemical & Biomolecular Engineering", "https://cde.nus.edu.sg/chbe/undergraduate/beng-che/minor-in-hydrogen-and-low-carbon-technology/"],
  ["minor-mechanical-engineering", "minor", "Minor in Mechanical Engineering", "Mechanical Engineering", "https://cde.nus.edu.sg/me/undergraduate/minor-mechanical-engineering/"],
  ["minor-sustainability-solutions", "minor", "Minor in Sustainability Solutions", "Civil & Environmental Engineering", "https://cde.nus.edu.sg/cee/undergraduate/minor-in-sustainability-solutions/"],
  ["minor-architectural-studies", "minor", "Minor in Architectural Studies", "Architecture", "https://cde.nus.edu.sg/arch/", "Extract the open minor for cohort AY2021/22 onwards."],
  ["minor-landscape-architectural-studies", "minor", "Minor in Landscape Architectural Studies", "Architecture", "https://cde.nus.edu.sg/arch/programmes/bachelor-of-landscape-architecture/minor-in-landscape-architectural-studies/", "Extract the requirements for cohort AY2021/22 onwards."],
  ["minor-biomedical-informatics", "minor", "Minor in Biomedical Informatics", "Biomedical Informatics", "https://medicine.nus.edu.sg/dbmi/education-3/minor-in-biomedical-informatics/"],
  ["minor-music-and-society", "minor", "Minor in Music and Society", "Yong Siew Toh Conservatory of Music", "https://www.ystmusic.nus.edu.sg/", "The page covers three Conservatory minors; extract Music and Society."],
  ["minor-performing-arts-cfa-groups", "minor", "Minor in Performing Arts (through NUS Centre for the Arts groups)", "Yong Siew Toh Conservatory of Music", "https://www.ystmusic.nus.edu.sg/", "The page covers three Conservatory minors; extract Performing Arts through the NUS Centre for the Arts credit-bearing groups."],
  ["minor-performing-arts-individual", "minor", "Minor in Performing Arts (through an individual performing arts area)", "Yong Siew Toh Conservatory of Music", "https://www.ystmusic.nus.edu.sg/", "The page covers three Conservatory minors; extract Performing Arts through an individual performing arts area."],
  ["minor-community-development-and-leadership", "minor", "Minor in Community Development and Leadership", "Chua Thian Poh Community Leadership Centre", "https://ctpclc.nus.edu.sg/minor-programme", "Extract cohort AY2026/27 and after."],
  ["minor-english-studies", "minor", "Minor in English Studies", "English, Linguistics & Theatre Studies", "https://fass.nus.edu.sg/elts/english-studies/", "Extract cohort 2024 onwards."],
  ["minor-film-studies", "minor", "Minor in Film Studies", "English, Linguistics & Theatre Studies", "https://fass.nus.edu.sg/elts/film-studies/", "Extract cohort 2024 onwards."],
  ["minor-japanese-studies", "minor", "Minor in Japanese Studies", "Japanese Studies", "https://fass.nus.edu.sg/jps/minor/", "Extract cohort 2021 onwards. The JS-recognised courses are on a second saved page."],
  ["minor-english-literature", "minor", "Minor in English Literature", "English, Linguistics & Theatre Studies", "https://fass.nus.edu.sg/elts/minor-in-english-literature/", "Extract cohort 2021 onwards."],
  ["minor-theatre-and-performance-studies", "minor", "Minor in Theatre and Performance Studies", "English, Linguistics & Theatre Studies", "https://fass.nus.edu.sg/elts/minor-in-theatre-and-performance-studies/", "Extract cohort 2021 onwards."],
  ["minor-religious-studies", "minor", "Minor in Religious Studies", "Office of Programmes", "https://fass.nus.edu.sg/oop/mdm/religious-studies/requirements/", "The course list is on a second saved page."],
  ["minor-health-and-social-sciences", "minor", "Minor in Health and Social Sciences", "Office of Programmes", "https://fass.nus.edu.sg/oop/mdm/health-social-sciences/requirements/", "Discontinued for cohort 2025 onwards; the course list is on a second saved page."],
  ["minor-criminal-justice", "minor", "Minor in Criminal Justice", "Sociology & Anthropology", "https://fass.nus.edu.sg/socanth/minor-in-criminal-justice/", "Each basket's course list is a separate saved page."],
  ["minor-gender-studies", "minor", "Minor in Gender Studies", "Sociology & Anthropology", "https://fass.nus.edu.sg/socanth/minor-in-gender-studies-mdm/", "Each track's course list is a separate saved page."],
  ["minor-health-wellbeing-and-society", "minor", "Minor in Health, Well-being and Society", "Sociology & Anthropology", "https://fass.nus.edu.sg/socanth/minor-in-health-well-being-and-society-mdm/", "Each category's course list is a separate saved page."],
  ["minor-art-history", "minor", "Minor in Art History (cohorts 2026 onwards)", "History", "https://fass.nus.edu.sg/hist/art-history-requirements/", "Extract the cohort 2026 and after requirements."],
  ["minor-art-history-2021-2025", "minor", "Minor in Art History (cohorts 2021 to 2025)", "History", "https://fass.nus.edu.sg/hist/art-history-requirements/", "Extract the cohort 2021-2025 requirements."],
  ["minor-global-studies", "minor", "Minor in Global Studies", "Political Science", "https://fass.nus.edu.sg/globalstudies/faqs/", "The requirements are in the programme FAQ."],
  ["minor-chinese-media", "minor", "Minor in Chinese Media", "Chinese Studies", "https://fass.nus.edu.sg/cs/minor/", "The two category course lists are on the department's recognised courses page."],
];

function fifthRound(): ProgrammeSource[] {
  return FIFTH_ROUND.map(([id, kind, label, department, url, hint]) => saved(id, kind, label, department, url, `${id}.pdf`, hint ? [hint] : undefined));
}


// Sixth round of saved pages (2026-11-28): the remaining second majors. [id, kind, label, department, url, hint]
const SIXTH_ROUND: [string, ProgrammeSource["kind"], string, string, string, string?][] = [
  ["second-major-artificial-intelligence", "second-major", "Second Major in Artificial Intelligence", "NUS Computing", "https://www.comp.nus.edu.sg/programmes/ug/major/ai-secmajor/", "Extract the structure for cohorts 2026/27 onwards."],
  ["second-major-systems-engineering", "second-major", "Second Major in Systems Engineering", "Industrial Systems Engineering & Management", "https://cde.nus.edu.sg/isem/", "The saved page is the course-requirements sheet for cohorts AY2022/23 onwards (updated 21 April 2026)."],
  ["second-major-sustainable-urban-development", "second-major", "Second Major in Sustainable Urban Development", "Civil & Environmental Engineering", "https://cde.nus.edu.sg/cee/undergraduate/second-major-in-sustainable-urban-development/"],
  ["second-major-data-analytics", "second-major", "Second Major in Data Analytics", "Data Science & Statistics", "https://www.stat.nus.edu.sg/", "The saved page is the requirements sheet for cohorts AY2021/22 and after (updated February 2026)."],
  ["second-major-chemistry", "second-major", "Second Major in Chemistry", "Chemistry", "https://chemistry.nus.edu.sg/", "The saved page is the course structure sheet dated January 2021."],
  ["second-major-physics", "second-major", "Second Major in Physics", "Physics", "https://www.physics.nus.edu.sg/student/second-major-in-physics/", "The page's four requirement sections were saved as four copies."],
  ["second-major-quantitative-finance", "second-major", "Second Major in Quantitative Finance (admitted AY2023/24 or after)", "Mathematics", "https://www.math.nus.edu.sg/", "The saved page is the requirements sheet for students admitted AY2023/24 or after (updated October 2025)."],
  ["second-major-quantitative-finance-2021-2022", "second-major", "Second Major in Quantitative Finance (admitted AY2021/22 to AY2022/23)", "Mathematics", "https://www.math.nus.edu.sg/", "The saved page is the requirements sheet for students admitted AY2021/22 or after, with three level 3000/4000 courses."],
  ["second-major-food-science", "second-major", "Second Major in Food Science", "Food Science & Technology", "https://www.fst.nus.edu.sg/education/undergraduate-programme/", "Extract the structure for students matriculated AY2021/22 onwards."],
  ["second-major-nutrition", "second-major", "Second Major in Nutrition", "Food Science & Technology", "https://www.fst.nus.edu.sg/education/undergraduate-programme/"],
  ["second-major-pharmaceutical-science", "second-major", "Second Major in Pharmaceutical Science", "Pharmacy & Pharmaceutical Sciences", "https://pharmacy.nus.edu.sg/study/undergraduate/second-major-in-pharmaceutical-science/", "Extract the non-laboratory-based version."],
  ["second-major-marine-and-freshwater-ecology", "second-major", "Second Major in Marine & Freshwater Ecology", "Biological Sciences & Geography", "https://www.dbs.nus.edu.sg/lifesciences/marine-freshwater-aquatic-ecology/", "The page covers the minor and the second major; extract the second major for cohorts AY2024/25 onwards."],
  ["second-major-music-and-society", "second-major", "Second Major in Music and Society", "Yong Siew Toh Conservatory of Music", "https://www.ystmusic.nus.edu.sg/", "The Conservatory's second majors are on one page; extract Music and Society."],
  ["second-major-music-collaboration-and-production", "second-major", "Second Major in Music, Collaboration and Production", "Yong Siew Toh Conservatory of Music", "https://www.ystmusic.nus.edu.sg/", "Extract Music, Collaboration & Production."],
  ["second-major-performing-arts-cfa-groups", "second-major", "Second Major in Performing Arts (through NUS Centre for the Arts groups)", "Yong Siew Toh Conservatory of Music", "https://www.ystmusic.nus.edu.sg/", "Extract Performing Arts through the NUS Centre for the Arts credit-bearing groups."],
  ["second-major-performing-arts-individual", "second-major", "Second Major in Performing Arts (through an individual performing arts area)", "Yong Siew Toh Conservatory of Music", "https://www.ystmusic.nus.edu.sg/", "Extract Performing Arts through an individual performing arts area."],
  ["second-major-audio-arts-and-sciences", "second-major", "Second Major in Audio Arts and Sciences", "Yong Siew Toh Conservatory of Music", "https://www.ystmusic.nus.edu.sg/", "Extract Audio Arts and Sciences."],
];

function sixthRound(): ProgrammeSource[] {
  return SIXTH_ROUND.map(([id, kind, label, department, url, hint]) => saved(id, kind, label, department, url, `${id}.pdf`, hint ? [hint] : undefined));
}

export const SOURCES: ProgrammeSource[] = [
  {
    id: "minor-ai",
    kind: "minor",
    label: "Minor in Artificial Intelligence",
    department: "NUS Computing",
    url: "https://www.comp.nus.edu.sg/programmes/ug/minorc/minor-in-ai",
  },
  {
    id: "minor-statistics",
    kind: "minor",
    label: "Minor in Statistics",
    department: "Data Science & Statistics",
    url: "https://www.stat.nus.edu.sg/wp-content/uploads/sites/8/2026/07/STMIN-AY21-22-after_updated-July-2026.pdf",
  },
  {
    id: "minor-mathematics",
    kind: "minor",
    label: "Minor in Mathematics",
    department: "Mathematics",
    url: "https://www.math.nus.edu.sg/wp-content/uploads/sites/4/2026/07/MAmin_2122_14102025.pdf",
  },
  {
    id: "second-major-statistics",
    kind: "second-major",
    label: "Second Major in Statistics",
    department: "Data Science & Statistics",
    url: "https://www.stat.nus.edu.sg/wp-content/uploads/sites/8/2026/07/ST2MJ-AY21-22-after_updated-July-2026.pdf",
  },
  {
    id: "second-major-mathematics",
    kind: "second-major",
    label: "Second Major in Mathematics",
    department: "Mathematics",
    url: "https://www.math.nus.edu.sg/wp-content/uploads/sites/4/2026/07/MA2_2122_14102025.pdf",
  },

  // --- School of Computing: minors for non-computing students (same page template as the AI minor above) ---
  { id: "minor-business-analytics", kind: "minor", label: "Minor in Business Analytics", department: SOC, url: `${SOC_MINORS}ba-minor` },
  { id: "minor-business-ai-systems", kind: "minor", label: "Minor in Business Artificial Intelligence Systems", department: SOC, url: `${SOC_MINORS}minor-in-bais/` },
  { id: "minor-computer-science", kind: "minor", label: "Minor in Computer Science", department: SOC, url: `${SOC_MINORS}cs-minor` },
  { id: "minor-information-systems", kind: "minor", label: "Minor in Information Systems", department: SOC, url: `${SOC_MINORS}is-minor` },
  { id: "minor-information-security", kind: "minor", label: "Minor in Information Security", department: SOC, url: `${SOC_MINORS}isc-minor/` },

  // --- School of Computing: second majors for non-computing students ---
  { id: "second-major-business-analytics", kind: "second-major", label: "Second Major in Business Analytics", department: SOC, url: `${SOC_MAJORS}ba-secmajor/` },
  { id: "second-major-computer-science", kind: "second-major", label: "Second Major in Computer Science", department: SOC, url: `${SOC_MAJORS}cs-secmajor/` },
  { id: "second-major-information-security", kind: "second-major", label: "Second Major in Information Security", department: SOC, url: `${SOC_MAJORS}isc/` },

  // --- BComp (Computer Science) focus areas: one page covers all eleven, so they share one stored copy ---
  focusArea("algorithms-theory", "Algorithms & Theory"),
  focusArea("artificial-intelligence", "Artificial Intelligence"),
  focusArea("computer-graphics-games", "Computer Graphics and Games"),
  focusArea("computer-security", "Computer Security"),
  focusArea("database-systems", "Database Systems"),
  focusArea("human-computer-interaction", "Human-Computer Interaction"),
  focusArea("multimedia-information-retrieval", "Multimedia Information Retrieval"),
  focusArea("networking-distributed-systems", "Networking and Distributed Systems"),
  focusArea("parallel-computing", "Parallel Computing"),
  focusArea("programming-languages", "Programming Languages"),
  focusArea("software-engineering", "Software Engineering"),

  // --- Other faculties' minors ---
  // Readable without a challenge:
  { id: "minor-data-analytics", kind: "minor", label: "Minor in Data Analytics", department: "Data Science & Statistics",
    url: "https://www.stat.nus.edu.sg/wp-content/uploads/sites/8/2025/10/18062025-DAMIN-AY19-20-after_29-Jan-2024.pdf" },

  // Readable live: PDFs on CDE's own file host (the pages that describe them are protected).
  { id: "minor-ai-data-science-for-materials", kind: "minor", label: "Minor in AI and Data Science for Materials", department: "Materials Science & Engineering",
    url: "https://cde.nus.edu.sg/mse/wp-content/uploads/sites/4/2026/07/Minor_AIDataSciForMat.pdf" },

  // Most of these were saved on 2026-11-28 and are published. Three still have no record because the page that was
  // saved didn't carry the requirements (Public Health, Management, Entrepreneurship): docs/programmes-pipeline.md
  // says what to re-save.
  // Behind bot protection, so they wait for a page saved as a PDF from a normal browser into data/programmes/manual/
  // (the fetcher never works around a challenge). `npm run programmes:extract -- --fetch-only` lists which are still missing.
  // SoC's list still links the old address (cde.nus.edu.sg/ece/minor-in-artificial-intelligence/), which no longer exists:
  // CDE now runs this as "Second Major / Minor in Applied AI (Design and Engineering)" on one page.
  ...handSaved("minor-applied-ai-design-and-engineering", "Minor in Applied Artificial Intelligence (Design and Engineering)", "Electrical & Computer Engineering", "https://cde.nus.edu.sg/ece/second-major-or-minor-in-ai/"),
  ...handSaved("minor-cities", "Minor in Cities", "NUS Cities", "https://cde.nus.edu.sg/nuscities/undergraduate/"),
  ...handSaved("minor-data-engineering", "Minor in Data Engineering", "Electrical & Computer Engineering", "https://cde.nus.edu.sg/ece/undergraduate/electrical-engineering/specialisations-and-minor/data-engineering/"),
  { id: "second-major-computing-design-and-engineering", kind: "second-major", label: "Second Major in Computing (Design and Engineering)", department: "Electrical & Computer Engineering",
    url: "https://cde.nus.edu.sg/ece/second-major-in-computing-design-and-engineering", locator: { manual: "second-major-computing-design-and-engineering.pdf" },
    hints: ["The page covers the second major and the minor in Computing (Design and Engineering). Extract the second major."] },
  ...handSaved("minor-economics", "Minor in Economics", "Economics", "https://fass.nus.edu.sg/ecs/students-matriculated-in-academic-year-2021-22-minor-in-econs/"),
  ...handSaved("minor-english-language-and-linguistics", "Minor in English Language and Linguistics", "English Language & Translation Studies", "https://fass.nus.edu.sg/elts/minor-in-english-language-and-linguistics/"),
  ...handSaved("minor-entrepreneurship", "Minor in Entrepreneurship", "NUS Business School", "https://bba.nus.edu.sg/second-major-minors-for-non-bba-students/", ["The page is for non-BBA students; extract the Minor in Entrepreneurship for cohort 2023 onwards."]),
  ...handSaved("minor-geographical-information-systems", "Minor in Geographical Information Systems", "Geography", "https://fass.nus.edu.sg/geog/minor-programmes/"),
  ...handSaved("minor-human-services", "Minor in Human Services", "Social Work", "https://fass.nus.edu.sg/swk/entry-graduation-requirement-undergraduate/", ["The page covers the Social Work department's programmes. Extract only the Minor in Human Services."]),
  ...handSaved("minor-infrastructure-management-and-finance", "Minor in Infrastructure Management and Finance", "Built Environment", "https://cde.nus.edu.sg/dbe/undergraduate/minor-in-infrastructure-management-and-finance/"),
  ...handSaved("minor-innovation-and-design", "Minor in Innovation & Design", "Engineering Design & Innovation Centre", "https://cde.nus.edu.sg/edic/idp/minor/idp-minor-cohort-2025-2026/"),
  ...handSaved("minor-integrative-health", "Minor in Integrative Health", "Yong Loo Lin School of Medicine", "https://medicine.nus.edu.sg/current-students/integrative-health-minor-mih/curriculum-mih/"),
  ...handSaved("minor-interactive-media-development", "Minor in Interactive Media Development", "Communications & New Media", "https://fass.nus.edu.sg/cnm/undergraduate-minor-imd/"),
  ...handSaved("minor-language-science", "Minor in Language Science", "English Language & Translation Studies", "https://fass.nus.edu.sg/elts/language-science/"),
  ...languageStudies(),
  ...handSaved("minor-management", "Minor in Management", "NUS Business School", "https://bba.nus.edu.sg/second-major-minors-for-non-bba-students/", ["The page is for non-BBA students and covers the second major and the minor in Management; extract the minor for cohort 2023 onwards."]),
  ...handSaved("minor-management-of-technology", "Minor in Management of Technology", "Industrial Systems Engineering & Management", "https://cde.nus.edu.sg/isem/undergraduate/minors/minor-in-management-of-technology/"),
  ...handSaved("minor-philosophy", "Minor in Philosophy", "Philosophy", "https://fass.nus.edu.sg/philo/overview/academic-requirements/"),
  ...handSaved("minor-political-science", "Minor in Political Science", "Political Science", "https://fass.nus.edu.sg/pol/graduation-requirements-cohort-2021-onwards/"),
  ...handSaved("minor-project-management", "Minor in Project Management", "Built Environment", "https://cde.nus.edu.sg/dbe/undergraduate/minor-in-project-management/"),
  ...handSaved("minor-psychology", "Minor in Psychology", "Psychology", "https://fass.nus.edu.sg/psy/minor-2/"),
  ...handSaved("minor-public-health", "Minor in Public Health", "Saw Swee Hock School of Public Health", "https://sph.nus.edu.sg/education/minor-in-public-health/curriculum/", ["Extract the requirements for students admitted from AY2024/25 onwards."]),
  ...handSaved("minor-quantitative-finance", "Minor in Quantitative Finance", "Mathematics", "https://www.math.nus.edu.sg/ug/majmin/minors/qfmin/"),
  ...handSaved("minor-sociology", "Minor in Sociology", "Sociology & Anthropology", "https://fass.nus.edu.sg/socanth/minor-sociology/"),
  ...handSaved("minor-systems-engineering", "Minor in Systems Engineering", "Industrial Systems Engineering & Management", "https://cde.nus.edu.sg/isem/undergraduate/minors/minor-in-systems-engineering/"),
  ...handSaved("minor-visual-communication-design", "Minor in Visual Communication Design", "Industrial Design", "https://cde.nus.edu.sg/dd/undergraduate/minor-visual-communication/"),
  ...handSaved("minor-visual-cultures", "Minor in Visual Cultures", "Communications & New Media", "https://fass.nus.edu.sg/cnm/undergraduate-minors/undergraduate-minor-visual-cultures/"),

  // Added when the pages were saved (the page covers more than one programme, or there was no minor to start from).
  saved("second-major-applied-ai-design-and-engineering", "second-major", "Second Major in Applied AI (Design and Engineering)", "Electrical & Computer Engineering",
    "https://cde.nus.edu.sg/ece/second-major-or-minor-in-ai/", "minor-applied-ai-design-and-engineering.pdf",
    ["The page covers the second major and the minor in Applied AI (Design and Engineering). Extract the second major."]),
  saved("minor-computing-design-and-engineering", "minor", "Minor in Computing (Design and Engineering)", "Electrical & Computer Engineering",
    "https://cde.nus.edu.sg/ece/second-major-in-computing-design-and-engineering/", "second-major-computing-design-and-engineering.pdf",
    ["The page covers the second major and the minor in Computing (Design and Engineering). Extract the minor."]),
  saved("second-major-innovation-and-design", "second-major", "Second Major in Innovation & Design", "Engineering Design & Innovation Centre",
    "https://cde.nus.edu.sg/edic/idp/second-major/idp-second-major-cohort-ay2024-2025/", "second-major-innovation-and-design.pdf"),
  saved("minor-aquatic-ecology", "minor", "Minor in Aquatic Ecology", "Biological Sciences & Geography",
    "https://fass.nus.edu.sg/geog/minor-programmes/", "minor-aquatic-ecology.pdf",
    ["The page covers Geography's minors. Extract only the Minor in Aquatic Ecology (cohort AY2021/22 onwards)."]),
  saved("minor-anthropology", "minor", "Minor in Anthropology", "Sociology & Anthropology",
    "https://fass.nus.edu.sg/socanth/minor-anthropology/", "minor-anthropology.pdf"),
  saved("second-major-philosophy", "second-major", "Second Major in Philosophy", "Philosophy",
    "https://fass.nus.edu.sg/philo/overview/academic-requirements/", "second-major-philosophy.pdf",
    ["The page covers the major, second major and minor by cohort. Extract the second major for cohort 2021 onwards."]),
  saved("second-major-political-science", "second-major", "Second Major in Political Science", "Political Science",
    "https://fass.nus.edu.sg/pol/graduation-requirements-cohort-2021-onwards/", "second-major-political-science.pdf",
    ["The page covers the major, second major and minor. Extract the second major."]),
  saved("second-major-social-work", "second-major", "Second Major in Social Work", "Social Work",
    "https://fass.nus.edu.sg/swk/entry-graduation-requirement-undergraduate/", "minor-human-services.pdf",
    ["The page covers the Social Work department's programmes. Extract only the Second Major (admitted from AY2021/22)."]),

  // Second round of saved pages (2026-11-28).
  // English, Linguistics and Theatre Studies
  saved("second-major-english-literature", "second-major", "Second Major in English Literature", "English, Linguistics & Theatre Studies",
    "https://fass.nus.edu.sg/elts/second-major-in-english-literature/", "second-major-english-literature.pdf",
    ["The page gives the second major by cohort. Extract cohort 2021 onwards."]),
  saved("second-major-english-language-and-linguistics", "second-major", "Second Major in English Language and Linguistics", "English, Linguistics & Theatre Studies",
    "https://fass.nus.edu.sg/elts/second-major-in-english-language-and-linguistics/", "second-major-english-language-and-linguistics.pdf",
    ["The page gives the second major by cohort. Extract cohort 2024 onwards."]),
  saved("minor-human-ai-systems", "minor", "Minor in Human-AI Systems", "English, Linguistics & Theatre Studies",
    "https://fass.nus.edu.sg/elts/human-ai-systems/", "minor-human-ai-systems.pdf"),
  // Sociology and Anthropology
  saved("second-major-sociology", "second-major", "Second Major in Sociology", "Sociology & Anthropology",
    "https://fass.nus.edu.sg/socanth/second-major-sociology/", "second-major-sociology.pdf",
    ["The page gives the second major by cohort. Extract cohort 2021 onwards."]),
  saved("second-major-anthropology", "second-major", "Second Major in Anthropology", "Sociology & Anthropology",
    "https://fass.nus.edu.sg/socanth/second-major-anthropology/", "second-major-anthropology.pdf"),
  // Economics
  saved("second-major-economics", "second-major", "Second Major in Economics", "Economics",
    "https://fass.nus.edu.sg/ecs/academic-year-2021-22-and-after-2/", "second-major-economics.pdf",
    ["Extract the second major for students matriculated in AY2021/22 and after."]),
  // Communications and New Media
  saved("second-major-communications-and-new-media", "second-major", "Second Major in Communications and New Media", "Communications & New Media",
    "https://fass.nus.edu.sg/cnm/undergraduate-major/", "second-major-communications-and-new-media.pdf",
    ["The page covers the single major and the second major for cohort 2025. Extract the second major."]),
  saved("minor-communications-and-new-media", "minor", "Minor in Communications and New Media", "Communications & New Media",
    "https://fass.nus.edu.sg/cnm/undergraduate-minor-cnm/", "minor-communications-and-new-media.pdf",
    ["Extract the minor for cohort 2021 onwards."]),
  saved("minor-cultural-studies", "minor", "Minor in Cultural Studies", "Communications & New Media",
    "https://fass.nus.edu.sg/cnm/undergraduate-minor-cultural-studies/", "minor-cultural-studies.pdf",
    ["The list of recognised courses is on four more saved pages (levels 1000 to 4000)."]),
  // Chinese Studies: each programme is a tab of two pages (cohorts 2026 onwards, and 2021 to 2025)
  saved("minor-chinese-languages-and-cultures", "minor", "Minor in Chinese Languages and Cultures (cohorts 2026 onwards)", "Chinese Studies",
    "https://fass.nus.edu.sg/cs/minor/", "minor-chinese-languages-and-cultures.pdf"),
  saved("minor-chinese-studies-bilingual", "minor", "Minor in Chinese Studies (Bilingual) (cohorts 2026 onwards)", "Chinese Studies",
    "https://fass.nus.edu.sg/cs/minor/", "minor-chinese-studies-bilingual.pdf"),
  saved("minor-chinese-language", "minor", "Minor in Chinese Language (cohorts 2021 to 2025)", "Chinese Studies",
    "https://fass.nus.edu.sg/cs/minor/", "minor-chinese-language.pdf",
    ["This is not the Centre for Language Studies' Minor in Chinese Language Studies; students must already know Chinese."]),
  saved("minor-chinese-studies", "minor", "Minor in Chinese Studies (cohorts 2021 to 2025)", "Chinese Studies",
    "https://fass.nus.edu.sg/cs/minor/", "minor-chinese-studies.pdf"),
  saved("minor-chinese-translation", "minor", "Minor in Chinese Translation", "Chinese Studies",
    "https://fass.nus.edu.sg/cs/minor/", "minor-chinese-translation.pdf", ["Extract the cohort 2026 onwards structure."]),
  saved("minor-interpreting", "minor", "Minor in Interpreting", "Chinese Studies",
    "https://fass.nus.edu.sg/cs/minor/", "minor-interpreting.pdf", ["Extract the cohort 2026 onwards structure."]),
  saved("second-major-chinese-languages-and-cultures", "second-major", "Second Major in Chinese Languages and Cultures (cohorts 2026 onwards)", "Chinese Studies",
    "https://fass.nus.edu.sg/cs/second-major/", "second-major-chinese-languages-and-cultures.pdf"),
  saved("second-major-chinese-studies-bilingual", "second-major", "Second Major in Chinese Studies (Bilingual) (cohorts 2026 onwards)", "Chinese Studies",
    "https://fass.nus.edu.sg/cs/second-major/", "second-major-chinese-studies-bilingual.pdf"),
  saved("second-major-chinese-language", "second-major", "Second Major in Chinese Language (cohorts 2021 to 2025)", "Chinese Studies",
    "https://fass.nus.edu.sg/cs/second-major/", "second-major-chinese-language.pdf"),
  saved("second-major-chinese-studies", "second-major", "Second Major in Chinese Studies (cohorts 2021 to 2025)", "Chinese Studies",
    "https://fass.nus.edu.sg/cs/second-major/", "second-major-chinese-studies.pdf"),
  // Other FASS and cross-faculty minors
  saved("minor-science-technology-and-society", "minor", "Minor in Science, Technology & Society", "Office of Programmes",
    "https://fass.nus.edu.sg/oop/mdm/science-technology-society/requirements/", "minor-science-technology-and-society.pdf",
    ["The list of recognised courses is on a second saved page (Courses Offered)."]),
  saved("minor-urban-studies", "minor", "Minor in Urban Studies", "Geography & Real Estate",
    "https://fass.nus.edu.sg/geog/minor-programmes/", "minor-urban-studies.pdf", ["Extract the Urban Studies minor for cohort AY2024 onwards."]),
  saved("minor-geosciences", "minor", "Minor in Geosciences", "Geography & Science",
    "https://fass.nus.edu.sg/geog/minor-programmes/", "minor-geosciences.pdf", ["Extract the Geosciences minor for cohort AY2021 onwards."]),
  saved("minor-environmental-sustainability", "minor", "Minor in Environmental Sustainability", "Biological Sciences",
    "https://fass.nus.edu.sg/geog/minor-programmes/", "minor-environmental-sustainability.pdf", ["Extract the Environmental Sustainability minor for cohorts AY2021/22 onwards."]),
  saved("specialisation-sustainable-finance", "specialisation", "Specialisation in Sustainable Finance", "NUS Business School",
    "https://bba.nus.edu.sg/curriculum-ay2026-2027-onwards/", "specialisation-sustainable-finance.pdf"),

  // Third round of saved pages (2026-11-28): History, Southeast Asian, Malay, South Asian and Japanese Studies,
  // Psychology, Geography, Theatre and Asian Studies.
  saved("second-major-history", "second-major", "Second Major in History", "History",
    "https://fass.nus.edu.sg/hist/history-requirements/", "second-major-history.pdf", ["Extract the second major for cohort 2021 and after."]),
  saved("minor-history", "minor", "Minor in History", "History",
    "https://fass.nus.edu.sg/hist/history-requirements/", "minor-history.pdf", ["Extract the minor for cohort 2023 and after."]),
  saved("second-major-southeast-asian-studies", "second-major", "Second Major in Southeast Asian Studies", "Southeast Asian Studies",
    "https://fass.nus.edu.sg/sea/second-major/", "second-major-southeast-asian-studies.pdf", ["Extract cohort 2021 onwards."]),
  saved("minor-southeast-asian-studies", "minor", "Minor in Southeast Asian Studies", "Southeast Asian Studies",
    "https://fass.nus.edu.sg/sea/minor/", "minor-southeast-asian-studies.pdf", ["Extract cohort 2021 onwards."]),
  saved("minor-southeast-asian-arts-and-heritage", "minor", "Minor in Southeast Asian Arts and Heritage", "Southeast Asian Studies",
    "https://fass.nus.edu.sg/sea/minor-in-southeast-asian-arts-and-heritage/", "minor-southeast-asian-arts-and-heritage.pdf"),
  saved("second-major-malay-studies", "second-major", "Second Major in Malay Studies", "Malay Studies",
    "https://fass.nus.edu.sg/mls/second-major/", "second-major-malay-studies.pdf", ["Extract cohort 2021 onwards."]),
  saved("minor-malay-studies", "minor", "Minor in Malay Studies", "Malay Studies",
    "https://fass.nus.edu.sg/mls/minor/", "minor-malay-studies.pdf", ["Extract cohort 2021 onwards."]),
  saved("second-major-south-asian-studies", "second-major", "Second Major in South Asian Studies", "South Asian Studies",
    "https://fass.nus.edu.sg/sas/second-major/", "second-major-south-asian-studies.pdf", ["Extract cohort 2021 onwards."]),
  saved("minor-india-studies", "minor", "Minor in India Studies", "South Asian Studies",
    "https://fass.nus.edu.sg/sas/minor/", "minor-india-studies.pdf", ["Extract cohort 2021 onwards."]),
  saved("second-major-japanese-studies", "second-major", "Second Major in Japanese Studies", "Japanese Studies",
    "https://fass.nus.edu.sg/jps/second-major/", "second-major-japanese-studies.pdf",
    ["Extract cohort 2021 onwards. The JS-recognised courses are on a second saved page (Recognised Modules)."]),
  saved("second-major-psychology", "second-major", "Second Major in Psychology", "Psychology",
    "https://fass.nus.edu.sg/psy/second-major/", "second-major-psychology.pdf", ["Extract cohort 2021 onwards."]),
  saved("second-major-geography", "second-major", "Second Major in Geography (cohorts 2026 onwards)", "Geography",
    "https://fass.nus.edu.sg/geog/second-major/", "second-major-geography.pdf", ["Extract the cohort 2026 onwards structure."]),
  saved("second-major-geography-2021-2025", "second-major", "Second Major in Geography (cohorts 2021 to 2025)", "Geography",
    "https://fass.nus.edu.sg/geog/second-major/", "second-major-geography.pdf", ["Extract the cohort 2021-2025 structure."]),
  saved("second-major-environmental-science-for-sustainability", "second-major", "Second Major in Environmental Science for Sustainability", "Geography",
    "https://fass.nus.edu.sg/geog/ess-major/", "second-major-environmental-science-for-sustainability.pdf"),
  saved("second-major-theatre-and-performance-studies", "second-major", "Second Major in Theatre and Performance Studies", "English, Linguistics & Theatre Studies",
    "https://fass.nus.edu.sg/elts/second-major-in-theatre-studies/", "second-major-theatre-and-performance-studies.pdf", ["Extract cohort 2023 onwards."]),
  saved("minor-asian-studies", "minor", "Minor in Asian Studies", "Southeast Asian Studies",
    "https://fass.nus.edu.sg/sea/minor-in-asian-studies/", "minor-asian-studies.pdf",
    ["A multidisciplinary minor shared by five departments; the recognised courses are listed by department."]),

  // Fourth round of saved pages (2026-11-28): BBA second majors and minors, Management, and Public Health.
  ...bbaProgrammes(),
  saved("second-major-management", "second-major", "Second Major in Management (for non-BBA students)", "NUS Business School",
    "https://bba.nus.edu.sg/second-major-minors-for-non-bba-students/", "minor-management.pdf",
    ["The page is for non-BBA students and covers the second major and the minor in Management; extract the second major for cohort 2023 onwards."]),
  ...fifthRound(),
  ...sixthRound(),
  saved("specialisation-advanced-electronics", "specialisation", "Specialisation in Advanced Electronics", "Electrical & Computer Engineering",
    "https://cde.nus.edu.sg/ece/undergraduate/electrical-engineering/specialisations-and-minor/", "specialisation-advanced-electronics.pdf"),
  saved("specialisation-industry-4-0", "specialisation", "Specialisation in Industry 4.0", "Electrical & Computer Engineering", "https://cde.nus.edu.sg/ece/undergraduate/electrical-engineering/specialisations-and-minor/", "specialisation-industry-4-0.pdf"),
  saved("specialisation-internet-of-things", "specialisation", "Specialisation in Internet of Things", "Electrical & Computer Engineering", "https://cde.nus.edu.sg/ece/undergraduate/electrical-engineering/specialisations-and-minor/", "specialisation-internet-of-things.pdf"),
  saved("specialisation-esp-nano", "specialisation", "Specialisation in Nanoscience and Technology (Engineering Science, cohorts 2025 onwards)", "Engineering Science Programme", "https://cde.nus.edu.sg/esp/undergraduate/b-eng-engineering-science/specialisation/ay2025-cohort/", "specialisation-esp-nano.pdf"),
  saved("specialisation-esp-nano-2021-2024", "specialisation", "Specialisation in Nanoscience and Technology (Engineering Science, cohorts 2021 to 2024)", "Engineering Science Programme", "https://cde.nus.edu.sg/esp/undergraduate/b-eng-engineering-science/specialisation/", "specialisation-esp-nano-2021-2024.pdf"),
  saved("specialisation-esp-energy", "specialisation", "Specialisation in Energy Science and Technology (Engineering Science, cohorts 2025 onwards)", "Engineering Science Programme", "https://cde.nus.edu.sg/esp/undergraduate/b-eng-engineering-science/specialisation/ay2025-cohort/", "specialisation-esp-energy.pdf"),
  saved("specialisation-esp-energy-2021-2024", "specialisation", "Specialisation in Energy Science and Technology (Engineering Science, cohorts 2021 to 2024)", "Engineering Science Programme", "https://cde.nus.edu.sg/esp/undergraduate/b-eng-engineering-science/specialisation/", "specialisation-esp-energy-2021-2024.pdf"),
  saved("specialisation-esp-computational", "specialisation", "Specialisation in Computational Engineering Science (Engineering Science, cohorts 2025 onwards)", "Engineering Science Programme", "https://cde.nus.edu.sg/esp/undergraduate/b-eng-engineering-science/specialisation/ay2025-cohort/", "specialisation-esp-computational.pdf"),
  saved("specialisation-esp-computational-2021-2024", "specialisation", "Specialisation in Computational Engineering Science (Engineering Science, cohorts 2021 to 2024)", "Engineering Science Programme", "https://cde.nus.edu.sg/esp/undergraduate/b-eng-engineering-science/specialisation/", "specialisation-esp-computational-2021-2024.pdf"),
  saved("specialisation-esp-medicine", "specialisation", "Specialisation in Engineering Science in Medicine (Engineering Science, cohorts 2025 onwards)", "Engineering Science Programme", "https://cde.nus.edu.sg/esp/undergraduate/b-eng-engineering-science/specialisation/ay2025-cohort/", "specialisation-esp-medicine.pdf"),
  saved("specialisation-esp-medicine-2021-2024", "specialisation", "Specialisation in Engineering Science in Medicine (Engineering Science, cohorts 2021 to 2024)", "Engineering Science Programme", "https://cde.nus.edu.sg/esp/undergraduate/b-eng-engineering-science/specialisation/", "specialisation-esp-medicine-2021-2024.pdf"),
  saved("second-major-public-health", "second-major", "Second Major in Public Health", "Saw Swee Hock School of Public Health",
    "https://sph.nus.edu.sg/education/second-major-in-public-health/curriculum/", "second-major-public-health.pdf",
    ["Extract the requirements for students admitted from AY2024/25 onwards."]),
];


