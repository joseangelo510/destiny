export type WordPressConnectionInput = {
  siteUrl: string;
  username: string;
  applicationPassword: string;
};

export function prepareWordPressConnection(input: WordPressConnectionInput) {
  const username = input.username.trim();
  const applicationPassword = input.applicationPassword.replace(/\s+/g, "");
  if (!username || username.includes(":")) throw new Error("Enter a valid WordPress username or email.");
  if (applicationPassword.length < 8) throw new Error("Enter the WordPress Application Password.");

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.siteUrl.trim()) ? input.siteUrl.trim() : `https://${input.siteUrl.trim()}`);
  } catch {
    throw new Error("Enter a valid WordPress website URL.");
  }
  if (url.protocol !== "https:") throw new Error("WordPress connections require HTTPS.");
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
  const siteUrl = url.toString().replace(/\/$/, "");
  return {
    siteUrl,
    endpoint: `${siteUrl}/wp-json/wp/v2/users/me?context=edit`,
    authorization: `Basic ${btoa(`${username}:${applicationPassword}`)}`,
  };
}
