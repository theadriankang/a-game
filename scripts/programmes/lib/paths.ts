import path from "node:path";

// Everything the programme pipeline reads or writes lives under data/programmes:
//   programmes.json   published data: reviewed in git, loaded into Postgres, bundled with the deploy
//   drafts/<id>.json  extractor output waiting for a person to review and promote
//   raw/              copies of the source pages/PDFs (git-ignored: this repo is public); only manifest.json is committed
//   manual/           pages a person saved from a browser for sources behind bot protection (git-ignored)
export const DATA_DIR = path.resolve(process.cwd(), "data/programmes");
export const PUBLISHED_FILE = path.join(DATA_DIR, "programmes.json");
export const DRAFTS_DIR = path.join(DATA_DIR, "drafts");
export const RAW_DIR = path.join(DATA_DIR, "raw");
export const MANUAL_DIR = path.join(DATA_DIR, "manual");
export const MANIFEST = path.join(RAW_DIR, "manifest.json");
