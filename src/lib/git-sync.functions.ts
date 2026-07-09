import { createServerFn } from "@tanstack/react-start";

export type GitSyncStatus = {
  configured: boolean;
  repo?: string;
  branch?: string;
  deployedSha?: string;
  latestSha?: string;
  latestMessage?: string;
  latestAuthor?: string;
  latestCommitAt?: string;
  aheadBy?: number;
  behindBy?: number;
  htmlUrl?: string;
  checkedAt: string;
  error?: string;
};

export const getGitSyncStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<GitSyncStatus> => {
    const checkedAt = new Date().toISOString();
    const repo = process.env.GITHUB_REPO; // "owner/name"
    const branch = process.env.GITHUB_BRANCH || "main";
    const deployedSha =
      process.env.BUILD_COMMIT_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.CF_PAGES_COMMIT_SHA ||
      undefined;

    if (!repo || !repo.includes("/")) {
      return {
        configured: false,
        checkedAt,
        error:
          "Set GITHUB_REPO (format: owner/name) in project secrets to enable sync status.",
      };
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "lovable-git-sync",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    try {
      // Latest commit on branch
      const latestRes = await fetch(
        `https://api.github.com/repos/${repo}/commits/${branch}`,
        { headers },
      );
      if (!latestRes.ok) {
        return {
          configured: true,
          repo,
          branch,
          deployedSha,
          checkedAt,
          error: `GitHub API ${latestRes.status}: ${await latestRes.text()}`,
        };
      }
      const latest = await latestRes.json();

      let aheadBy: number | undefined;
      let behindBy: number | undefined;
      if (deployedSha && deployedSha !== latest.sha) {
        const cmpRes = await fetch(
          `https://api.github.com/repos/${repo}/compare/${deployedSha}...${latest.sha}`,
          { headers },
        );
        if (cmpRes.ok) {
          const cmp = await cmpRes.json();
          aheadBy = cmp.ahead_by;
          behindBy = cmp.behind_by;
        }
      } else if (deployedSha === latest.sha) {
        aheadBy = 0;
        behindBy = 0;
      }

      return {
        configured: true,
        repo,
        branch,
        deployedSha,
        latestSha: latest.sha,
        latestMessage: latest.commit?.message?.split("\n")[0],
        latestAuthor:
          latest.commit?.author?.name || latest.author?.login || "unknown",
        latestCommitAt: latest.commit?.author?.date,
        aheadBy,
        behindBy,
        htmlUrl: latest.html_url,
        checkedAt,
      };
    } catch (e: any) {
      return {
        configured: true,
        repo,
        branch,
        deployedSha,
        checkedAt,
        error: e?.message ?? String(e),
      };
    }
  },
);
