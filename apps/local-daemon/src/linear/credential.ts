export function takeLinearKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const apiKey = env.OTOMAT_LINEAR_API_KEY;
  delete env.OTOMAT_LINEAR_API_KEY;
  return apiKey === undefined || apiKey === "" ? null : apiKey;
}
