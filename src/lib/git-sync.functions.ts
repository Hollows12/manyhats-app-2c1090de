import { createServerFn } from "@tanstack/react-start";

export type GitSyncErrorKind =
  | "missing_repo"
  | "invalid_repo_format"
  | "missing_deployed_sha"
  | "repo_not_found"
  | "branch_not_found"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "compare_failed"
  | "network"
  | "unknown";

export type GitSyncIssue = {
  kind: GitSyncErrorKind;
  severity: "error" | "warning";
  title: string;
  detail: string;
  remediation: string[];
  status?: number;
};

export type GitSyncStatus = {
  configured: boolean;
  repo?: string;
  branch?: string;
  deployedSha?: string;
  deployedShaSource?: string;
  hasToken: boolean;
  latestSha?: string;
  latestMessage?: string;
  latestAuthor?: string;
  latestCommitAt?: string;
  aheadBy?: number;
  behindBy?: number;
  htmlUrl?: string;
  checkedAt: string;
  issues: GitSyncIssue[];
  /** @deprecated use issues[0] */
  error?: string;
};

function pickDeployedSha(): { sha?: string; source?: string } {
  if (process.env.BUILD_COMMIT_SHA)
    return { sha: process.env.BUILD_COMMIT_SHA, source: "BUILD_COMMIT_SHA" };
  if (process.env.VERCEL_GIT_COMMIT_SHA)
    return {
      sha: process.env.VERCEL_GIT_COMMIT_SHA,
      source: "VERCEL_GIT_COMMIT_SHA",
    };
  if (process.env.CF_PAGES_COMMIT_SHA)
    return {
      sha: process.env.CF_PAGES_COMMIT_SHA,
      source: "CF_PAGES_COMMIT_SHA",
    };
  return {};
}

export const getGitSyncStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<GitSyncStatus> => {
    const checkedAt = new Date().toISOString();
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const { sha: deployedSha, source: deployedShaSource } = pickDeployedSha();
    const hasToken = Boolean(process.env.GITHUB_TOKEN);
    const issues: GitSyncIssue[] = [];

    if (!repo) {
      return {
        configured: false,
        branch,
        deployedSha,
        deployedShaSource,
        hasToken,
        checkedAt,
        issues: [
          {
            kind: "missing_repo",
            severity: "error",
            title: "GITHUB_REPO secret is not set",
            detail:
              "Without a repository the page has nothing to compare against.",
            remediation: [
              "Open project Secrets and add GITHUB_REPO with the value owner/name (e.g. acme/website).",
              "Optionally set GITHUB_BRANCH (defaults to main).",
              "For private repos, also add GITHUB_TOKEN with a fine-grained PAT that has Contents: Read.",
            ],
          },
        ],
        error: "GITHUB_REPO is not set.",
      };
    }

    if (!repo.includes("/") || repo.split("/").length !== 2) {
      return {
        configured: false,
        repo,
        branch,
        deployedSha,
        deployedShaSource,
        hasToken,
        checkedAt,
        issues: [
          {
            kind: "invalid_repo_format",
            severity: "error",
            title: "GITHUB_REPO is malformed",
            detail: `Expected format owner/name — got "${repo}".`,
            remediation: [
              "Update the GITHUB_REPO secret to the format owner/name (no URL, no trailing slash).",
              "Example: acme/website",
            ],
          },
        ],
        error: "GITHUB_REPO must be in owner/name format.",
      };
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "lovable-git-sync",
    };
    if (hasToken) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    let latest: any;
    try {
      const latestRes = await fetch(
        `https://api.github.com/repos/${repo}/commits/${branch}`,
        { headers },
      );

      if (!latestRes.ok) {
        const body = await latestRes.text();
        const status = latestRes.status;
        const rateRemaining = latestRes.headers.get("x-ratelimit-remaining");
        const rateReset = latestRes.headers.get("x-ratelimit-reset");
        const issue = classifyGitHubError(status, body, {
          repo,
          branch,
          hasToken,
          rateRemaining,
          rateReset,
        });
        return {
          configured: true,
          repo,
          branch,
          deployedSha,
          deployedShaSource,
          hasToken,
          checkedAt,
          issues: [issue],
          error: `${issue.title}: ${issue.detail}`,
        };
      }
      latest = await latestRes.json();
    } catch (e: any) {
      const detail = e?.message ?? String(e);
      return {
        configured: true,
        repo,
        branch,
        deployedSha,
        deployedShaSource,
        hasToken,
        checkedAt,
        issues: [
          {
            kind: "network",
            severity: "error",
            title: "Could not reach api.github.com",
            detail,
            remediation: [
              "Check outbound network access from the deployment environment.",
              "Retry in a minute — GitHub may be experiencing an incident (https://www.githubstatus.com).",
            ],
          },
        ],
        error: detail,
      };
    }

    let aheadBy: number | undefined;
    let behindBy: number | undefined;

    if (!deployedSha) {
      issues.push({
        kind: "missing_deployed_sha",
        severity: "warning",
        title: "Deployed commit SHA is unknown",
        detail:
          "Ahead/behind counts cannot be calculated without the SHA of the running build.",
        remediation: [
          "Set BUILD_COMMIT_SHA at build time to the git SHA being deployed.",
          "On Vercel this is auto-populated as VERCEL_GIT_COMMIT_SHA; on Cloudflare Pages as CF_PAGES_COMMIT_SHA.",
        ],
      });
    } else if (deployedSha === latest.sha) {
      aheadBy = 0;
      behindBy = 0;
    } else {
      try {
        const cmpRes = await fetch(
          `https://api.github.com/repos/${repo}/compare/${deployedSha}...${latest.sha}`,
          { headers },
        );
        if (cmpRes.ok) {
          const cmp = await cmpRes.json();
          aheadBy = cmp.ahead_by;
          behindBy = cmp.behind_by;
        } else {
          const body = await cmpRes.text();
          issues.push({
            kind: "compare_failed",
            severity: "warning",
            title: `Compare failed (HTTP ${cmpRes.status})`,
            detail:
              cmpRes.status === 404
                ? `GitHub could not find one of the commits (deployed=${deployedSha.slice(0, 7)}, latest=${latest.sha.slice(0, 7)}). It may have been force-pushed or belong to a different repo.`
                : truncate(body, 240),
            remediation:
              cmpRes.status === 404
                ? [
                    "Verify BUILD_COMMIT_SHA is the SHA that was actually deployed.",
                    "Confirm GITHUB_REPO points to the same repo that produced the build.",
                  ]
                : [
                    "Retry — the GitHub API may recover on its own.",
                    "If the error persists, check token permissions for the target repo.",
                  ],
            status: cmpRes.status,
          });
        }
      } catch (e: any) {
        issues.push({
          kind: "compare_failed",
          severity: "warning",
          title: "Compare request failed",
          detail: e?.message ?? String(e),
          remediation: ["Retry in a minute."],
        });
      }
    }

    return {
      configured: true,
      repo,
      branch,
      deployedSha,
      deployedShaSource,
      hasToken,
      latestSha: latest.sha,
      latestMessage: latest.commit?.message?.split("\n")[0],
      latestAuthor:
        latest.commit?.author?.name || latest.author?.login || "unknown",
      latestCommitAt: latest.commit?.author?.date,
      aheadBy,
      behindBy,
      htmlUrl: latest.html_url,
      checkedAt,
      issues,
    };
  },
);

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function classifyGitHubError(
  status: number,
  body: string,
  ctx: {
    repo: string;
    branch: string;
    hasToken: boolean;
    rateRemaining: string | null;
    rateReset: string | null;
  },
): GitSyncIssue {
  const short = truncate(body, 240);

  if (status === 401) {
    return {
      kind: "unauthorized",
      severity: "error",
      title: "GITHUB_TOKEN is invalid or expired",
      detail:
        "GitHub rejected the token with 401 Unauthorized. The token may have been revoked, expired, or mistyped.",
      remediation: [
        "Generate a new fine-grained personal access token at https://github.com/settings/tokens.",
        "Grant it Repository access to the target repo with Contents: Read permission.",
        "Update the GITHUB_TOKEN secret in this project (do not commit it).",
      ],
      status,
    };
  }

  if (status === 403) {
    if (ctx.rateRemaining === "0") {
      const resetIn = ctx.rateReset
        ? Math.max(0, Number(ctx.rateReset) * 1000 - Date.now())
        : null;
      return {
        kind: "rate_limited",
        severity: "error",
        title: "GitHub API rate limit reached",
        detail: resetIn
          ? `Wait ~${Math.ceil(resetIn / 60000)} minute(s) for the limit to reset.`
          : "The unauthenticated rate limit is 60 requests/hour per IP.",
        remediation: [
          "Add a GITHUB_TOKEN secret to raise the limit to 5,000 requests/hour.",
          "Reduce the refresh frequency if this recurs.",
        ],
        status,
      };
    }
    return {
      kind: "forbidden",
      severity: "error",
      title: "GitHub returned 403 Forbidden",
      detail: ctx.hasToken
        ? `Token lacks permission for ${ctx.repo}. Body: ${short}`
        : `Anonymous access denied. Body: ${short}`,
      remediation: ctx.hasToken
        ? [
            "Confirm the token's Repository access includes this repo.",
            "For fine-grained tokens, grant Contents: Read.",
            "For classic tokens on a private repo, grant the repo scope.",
          ]
        : [
            "The repo may be private — add a GITHUB_TOKEN secret with Contents: Read.",
          ],
      status,
    };
  }

  if (status === 404) {
    return {
      kind: "repo_not_found",
      severity: "error",
      title: `Repository or branch not found: ${ctx.repo}@${ctx.branch}`,
      detail: ctx.hasToken
        ? "GitHub returned 404. The token cannot see this repo, or the branch does not exist."
        : "GitHub returned 404. The repo may be private, misspelled, or the branch does not exist.",
      remediation: [
        `Verify GITHUB_REPO is exactly "owner/name" (currently "${ctx.repo}").`,
        `Verify GITHUB_BRANCH exists on the remote (currently "${ctx.branch}").`,
        ctx.hasToken
          ? "Ensure the token has access to this specific repository."
          : "If the repo is private, add a GITHUB_TOKEN secret with Contents: Read.",
      ],
      status,
    };
  }

  if (status >= 500) {
    return {
      kind: "unknown",
      severity: "error",
      title: `GitHub API error ${status}`,
      detail: `Upstream issue. Body: ${short}`,
      remediation: [
        "Retry in a minute.",
        "Check https://www.githubstatus.com for ongoing incidents.",
      ],
      status,
    };
  }

  return {
    kind: "unknown",
    severity: "error",
    title: `GitHub API error ${status}`,
    detail: short,
    remediation: [
      "Retry — this may be transient.",
      "If it persists, verify GITHUB_REPO, GITHUB_BRANCH, and GITHUB_TOKEN.",
    ],
    status,
  };
}
