import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";

const failures = [];
const warnings = [];
const baseArg = process.argv.find((arg) => arg.startsWith("--base="));
const base = baseArg?.slice("--base=".length);

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function trackedFiles() {
  return git(["ls-files", "-z"]).split("\0").filter(Boolean);
}

function changedMigrations() {
  if (!base) return [];
  try {
    return git(["diff", "--name-only", `${base}...HEAD`, "--", "supabase/migrations/*.sql"])
      .split("\n")
      .filter(Boolean);
  } catch {
    warnings.push(`Could not resolve migration diff against ${base}`);
    return [];
  }
}

const policy = readFileSync("SECURITY.md", "utf8");
for (const heading of [
  "## System and Scope",
  "## Threat Model and Trust Boundaries",
  "## Security Invariants",
  "## Reportable Findings and Severity Context",
  "## Out of Scope and Accepted Risk",
  "## Known Limitations and Release Restrictions",
]) {
  if (!policy.includes(heading)) failures.push(`SECURITY.md is missing: ${heading}`);
}

const forbiddenTrackedEnv = trackedFiles().filter(
  (file) =>
    existsSync(file) &&
    /(^|\/)\.env(?:\..+)?$/.test(file) &&
    !/\.env\.(example|sample|template)$/.test(file),
);
if (forbiddenTrackedEnv.length) {
  failures.push(`Secret-bearing env files are tracked: ${forbiddenTrackedEnv.join(", ")}`);
}

const secretPatterns = [
  {
    name: "private key",
    regex: new RegExp("-----BEGIN " + "(?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
  },
  { name: "OpenAI project key", regex: /sk-proj-[A-Za-z0-9_-]{20,}/ },
  { name: "Supabase secret key", regex: /sb_secret_[A-Za-z0-9_-]{20,}/ },
  { name: "GitHub token", regex: /github_pat_[A-Za-z0-9_]{20,}/ },
];

for (const file of trackedFiles()) {
  let size;
  try {
    size = statSync(file).size;
  } catch {
    continue;
  }
  if (size > 1_000_000 || file.endsWith("package-lock.json")) continue;
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const pattern of secretPatterns) {
    if (pattern.regex.test(content)) failures.push(`${file}: possible committed ${pattern.name}`);
  }
  if (
    /VITE_(?:OPENAI_API_KEY|LOVABLE_API_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY)/.test(
      content,
    )
  ) {
    failures.push(`${file}: privileged secret uses a browser-exposed VITE_ variable`);
  }
}

for (const file of changedMigrations()) {
  const sql = readFileSync(file, "utf8");
  if (/SECURITY\s+DEFINER/i.test(sql)) {
    if (!/SET\s+search_path\s*=\s*''/i.test(sql)) {
      failures.push(`${file}: SECURITY DEFINER requires an empty search_path`);
    }
    if (!/REVOKE\s+(?:ALL|EXECUTE).*\b(?:PUBLIC|anon|authenticated)\b/is.test(sql)) {
      failures.push(`${file}: SECURITY DEFINER requires explicit untrusted-role revocation`);
    }
  }

  const createdTables = [
    ...sql.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?([a-zA-Z0-9_]+)/gi),
  ].map((match) => match[1]);
  for (const table of createdTables) {
    const rls = new RegExp(
      `ALTER\\s+TABLE\\s+(?:public\\.)?${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
      "i",
    );
    if (!rls.test(sql))
      failures.push(`${file}: new table ${table} does not enable RLS in the same migration`);
  }
}

for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log("Security policy, secret exposure, and changed-migration gates passed.");
