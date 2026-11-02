import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceDirectory = path.join(appDirectory, "src");
const frPath = path.join(sourceDirectory, "i18n", "fr.ts");
const enPath = path.join(sourceDirectory, "i18n", "en.ts");

function catalogKeys(source) {
  return [...source.matchAll(/^ {2}([A-Za-z_$][\w$]*):/gm)].map(
    (match) => match[1],
  );
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(fullPath);
      if (
        !/\.tsx?$/.test(entry.name) ||
        /\.(test|spec)\.tsx?$/.test(entry.name) ||
        fullPath === frPath ||
        fullPath === enPath
      )
        return [];
      return [fullPath];
    }),
  );
  return files.flat();
}

const [frSource, enSource] = await Promise.all([
  readFile(frPath, "utf8"),
  readFile(enPath, "utf8"),
]);
const frKeys = catalogKeys(frSource);
const enKeys = catalogKeys(enSource);
const duplicateKeys = frKeys.filter(
  (key, index) => frKeys.indexOf(key) !== index,
);
const missingInEnglish = frKeys.filter((key) => !enKeys.includes(key));
const missingInFrench = enKeys.filter((key) => !frKeys.includes(key));
const files = await sourceFiles(sourceDirectory);
const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
const references = new Set(
  frKeys.filter((key) =>
    sources.some(
      (source) =>
        source.includes(`"${key}"`) ||
        source.includes(`'${key}'`) ||
        source.includes(`\`${key}\``),
    ),
  ),
);
const unusedKeys = frKeys.filter((key) => {
  if (references.has(key)) return false;
  const baseKey = key.replace(/_(one|other|zero|few|many)$/, "");
  return baseKey === key || !references.has(baseKey);
});

if (
  duplicateKeys.length ||
  missingInEnglish.length ||
  missingInFrench.length ||
  unusedKeys.length
) {
  console.error("Translation catalog check failed.");
  if (duplicateKeys.length)
    console.error("Duplicate French keys:", duplicateKeys);
  if (missingInEnglish.length)
    console.error("Missing in English:", missingInEnglish);
  if (missingInFrench.length)
    console.error("Missing in French:", missingInFrench);
  if (unusedKeys.length) console.error("Unused translation keys:", unusedKeys);
  process.exitCode = 1;
} else {
  console.log(
    `Translation catalogs match: ${frKeys.length} keys, ${files.length} source files scanned, no unused keys.`,
  );
}
