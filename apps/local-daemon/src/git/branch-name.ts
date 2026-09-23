import { runGit } from "./git-cli.js";

export function sanitizeBranchName(raw: string): string | null {
  const slug = raw
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/(^[-/.]+)|([-/.]+$)/g, "")
    .slice(0, 60)
    .replace(/(^[-/.]+)|([-/.]+$)/g, "");
  if (slug === "" || slug.startsWith("otomat/run")) return null;
  return slug;
}

export async function availableBranchName(
  repoPath: string,
  preferred: string,
  suffix: string,
): Promise<string> {
  const refs = (
    await runGit(["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"], {
      cwd: repoPath,
    })
  ).stdout;
  const taken = refs.split("\n").some((ref) => {
    const branch = ref.replace(/^refs\/(?:heads\/|remotes\/[^/]+\/)/, "");
    return branch === preferred || branch.startsWith(`${preferred}/`);
  });
  return taken ? `${preferred}-${suffix}` : preferred;
}
