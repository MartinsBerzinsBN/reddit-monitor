// verify.js
import db from "../server/lib/sqlite.js";

const count = db.prepare("SELECT count(*) as c FROM vec_opportunities").get();
console.log("Total Vectors stored:", count.c);

// Try a dummy search
const zeroVector = new Float32Array(1536).fill(0);
const result = db
  .prepare(
    `
  SELECT rowid, distance 
  FROM vec_opportunities 
  WHERE embedding MATCH ? 
  AND k = 1
`,
  )
  .get(JSON.stringify(Array.from(zeroVector)));

console.log("Test Search Result:", result);

// Threshold strict/loose diagnostic
const SAMPLE_SIZE = 300;
const THRESHOLDS = [0.15, 0.3, 0.5, 0.65, 0.75, 0.8];

const rowIds = db
  .prepare(`SELECT rowid FROM vec_opportunities ORDER BY rowid DESC LIMIT ?`)
  .all(SAMPLE_SIZE)
  .map((r) => r.rowid);

if (rowIds.length < 2) {
  console.log("Not enough vectors for threshold diagnostics.");
  process.exit(0);
}

const nearestStmt = db.prepare(`
  SELECT rowid, distance
  FROM vec_opportunities
  WHERE embedding MATCH (SELECT embedding FROM vec_opportunities WHERE rowid = ?)
  AND k = 2
`);

const nearestDistances = [];

for (const rowId of rowIds) {
  const neighbors = nearestStmt.all(rowId);
  const nearestOther = neighbors.find((r) => r.rowid !== rowId);
  if (nearestOther?.distance != null) {
    nearestDistances.push(Number(nearestOther.distance));
  }
}

if (!nearestDistances.length) {
  console.log("No nearest-neighbor distances collected.");
  process.exit(0);
}

nearestDistances.sort((a, b) => a - b);

function percentile(sorted, p) {
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * sorted.length)),
  );
  return sorted[idx];
}

console.log("\nNearest-neighbor distance stats:");
console.log("samples:", nearestDistances.length);
console.log("p50:", percentile(nearestDistances, 50));
console.log("p75:", percentile(nearestDistances, 75));
console.log("p90:", percentile(nearestDistances, 90));
console.log("p95:", percentile(nearestDistances, 95));

console.log("\nThreshold sweep (join existing cluster rate):");
for (const threshold of THRESHOLDS) {
  const matched = nearestDistances.filter((d) => d <= threshold).length;
  const rate = ((matched / nearestDistances.length) * 100).toFixed(1);
  console.log(
    `threshold=${threshold} -> ${matched}/${nearestDistances.length} (${rate}%)`,
  );
}
