export function resolveUnsubscribeToken(requestUrl, formToken = "") {
  let queryToken = "";
  try {
    queryToken = new URL(requestUrl).searchParams.get("token") ?? "";
  } catch {
    return "";
  }

  const fallbackToken = typeof formToken === "string" ? formToken : "";
  return (queryToken || fallbackToken).trim();
}

export function isValidUnsubscribeToken(token) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
}
