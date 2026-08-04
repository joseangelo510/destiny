import { directoryProfileMatches } from "./recommendations";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function verifyDirectoryProfile(directoryKey: string, profileUrl: string, fetcher: Fetcher = fetch) {
  let current = profileUrl;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    if (!directoryProfileMatches(directoryKey, current)) throw new Error("The directory redirected to an unexpected host.");
    const response = await fetcher(current, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "DestinyProfileMonitor/1.0" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) return { reachable: false, httpStatus: response.status, resolvedUrl: current };
      current = new URL(location, current).toString();
      continue;
    }
    return { reachable: response.status >= 200 && response.status < 400, httpStatus: response.status, resolvedUrl: current };
  }
  throw new Error("The directory profile redirected too many times.");
}
