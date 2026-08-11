/**
 * fix-thumn-boundaries.mjs
 * Corrects thumn_number in quran-data.json (Warsh riwaya)
 * using real Qalun thumn boundaries as a relative pattern per hizb.
 *
 * Usage:
 *   npm install quran-meta
 *   node fix-thumn-boundaries.mjs quran-data.json quran-data-fixed.json
 */

import fs from "node:fs";
import { QuranRiwaya } from "quran-meta";

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error("Usage: node fix-thumn-boundaries.mjs <input.json> <output.json>");
  process.exit(1);
}

const warshData = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
warshData.sort((a, b) => a.id - b.id);

const qalun = QuranRiwaya.qalun();

const qalunAyahList = [];
for (let ayahId = 1; ayahId <= 6214; ayahId++) {
  const meta = qalun.getAyahMeta(ayahId);
  qalunAyahList.push(meta);
}

function buildRelativeThumnBoundaries(list, hizbKey, thumnKey) {
  const byHizb = new Map();
  for (const row of list) {
    const h = row[hizbKey];
    if (!byHizb.has(h)) byHizb.set(h, []);
    byHizb.get(h).push(row);
  }
  const pattern = new Map();
  for (const [h, rows] of byHizb) {
    const counts = new Array(8).fill(0);
    for (const r of rows) {
      counts[r[thumnKey] - 1] += 1;
    }
    pattern.set(h, counts);
  }
  return pattern;
}

const qalunPattern = buildRelativeThumnBoundaries(qalunAyahList, "hizb", "thumunAlHizbId");

const byHizbWarsh = new Map();
for (const row of warshData) {
  const h = row.hizb_number;
  if (!byHizbWarsh.has(h)) byHizbWarsh.set(h, []);
  byHizbWarsh.get(h).push(row);
}

let totalThumn = 0;
for (const [hizbNum, rows] of byHizbWarsh) {
  const counts = qalunPattern.get(hizbNum);
  if (!counts) {
    console.warn(`Warning: no qalun pattern for hizb ${hizbNum}, using equal split fallback`);
  }
  const totalAyahInHizb = rows.length;
  const totalAyahInQalunHizb = counts ? counts.reduce((a, b) => a + b, 0) : totalAyahInHizb;

  const scaledCounts = counts
    ? counts.map((c) => Math.round((c / totalAyahInQalunHizb) * totalAyahInHizb))
    : new Array(8).fill(Math.ceil(totalAyahInHizb / 8));

  let diff = totalAyahInHizb - scaledCounts.reduce((a, b) => a + b, 0);
  let i = scaledCounts.length - 1;
  while (diff !== 0 && i >= 0) {
    if (diff > 0) { scaledCounts[i]++; diff--; }
    else if (scaledCounts[i] > 1) { scaledCounts[i]--; diff++; }
    i = i === 0 ? scaledCounts.length - 1 : i - 1;
  }

  let idx = 0;
  for (let t = 0; t < 8; t++) {
    const globalThumn = (hizbNum - 1) * 8 + t + 1;
    for (let k = 0; k < scaledCounts[t] && idx < rows.length; k++, idx++) {
      rows[idx].thumn_number = globalThumn;
    }
    totalThumn = Math.max(totalThumn, globalThumn);
  }
}

fs.writeFileSync(outputPath, JSON.stringify(warshData, null, 2), "utf-8");
console.log(`Done. Total thumn count: ${totalThumn}. Output: ${outputPath}`);
console.log("Note: this is an approximation based on the Qalun pattern, not verified Warsh boundaries.");
