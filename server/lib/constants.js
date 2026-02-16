export const DEFAULT_POLL_INTERVAL_MINUTES = 15;
export const DEFAULT_REDDIT_TIMEOUT_MS = 15000;
export const DEFAULT_REDDIT_MAX_RETRIES = 4;
export const DEFAULT_CLUSTER_DISTANCE_THRESHOLD = 0.65;
export const DEFAULT_USER_AGENT = "market-validator/1.0";

export const DEFAULT_SUBREDDITS = [
  // General Business Operations (High volume of real problems)
  "smallbusiness",
  "entrepreneur",
  "agency", // Agencies have high budget and lots of manual reporting/client work

  // Niche Professionals (Where specific B2B SaaS ideas live)
  "sales", // CRM, outreach, and admin fatigue
  "marketing", // Analytics, reporting, and content workflow pains
  "realestate", // Property management and lead gen issues
  "msp", // Managed Service Providers (Goldmine for IT/monitoring tools)

  // The "Hackers" (People trying to fix things manually)
  "excel", // If they are doing it in Excel, it should be a SaaS
  "sysadmin", // Enterprise tooling complaints
];

export const DEFAULT_HEURISTIC_PATTERNS = [
  // Direct requests for solutions
  "alternative to",
  "wish there was a app",
  "wish there was a tool",
  "is there a software",
  "recommend a tool",

  // Signals of Manual Labor / Inefficiency (The best SaaS triggers)
  "spend hours",
  "wasting time",
  "manually copying",
  "manual entry",
  "data entry",
  "spreadsheet", // "I'm using a spreadsheet for X" = Opportunity
  "google sheets",

  // Emotional Signals
  "hate using",
  "clunky",
  "too expensive",
  "nightmare to",
  "overwhelming",
  "struggling with",
];
