/** What the operator typed, resolved to the two facts Otomat verifies: which repository, and which number. */
export interface PullRequestReference {
  /** Null when only a number was given; the issue's own repository then answers for it. */
  repository: string | null;
  number: number;
}

const BARE_NUMBER = /^#?(\d+)$/;
const OWNER_NUMBER = /^([\w.-]+\/[\w.-]+)#(\d+)$/;
const URL_PATH = /^\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)(?:\/.*)?$/;

function fromUrl(raw: string): PullRequestReference | null {
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (url.hostname.toLowerCase() !== "github.com") return null;
    const match = URL_PATH.exec(url.pathname);
    if (!match?.[1] || !match[2]) return null;
    return { repository: match[1], number: Number(match[2]) };
  } catch {
    return null;
  }
}

/** Accepts `12`, `#12`, `owner/name#12` and a github.com pull-request URL; anything else is refused rather than guessed at. */
export function parsePullRequestReference(raw: string): PullRequestReference | null {
  const value = raw.trim();
  const bare = BARE_NUMBER.exec(value);
  if (bare?.[1]) return { repository: null, number: Number(bare[1]) };
  const qualified = OWNER_NUMBER.exec(value);
  if (qualified?.[1] && qualified[2]) {
    return { repository: qualified[1], number: Number(qualified[2]) };
  }
  return fromUrl(value);
}
