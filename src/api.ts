export async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers:
      options.body instanceof FormData
        ? options.headers
        : { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    let message = "De gegevens konden niet worden geladen.";
    try {
      message = (await response.json()).error ?? message;
    } catch {
      /* non-JSON server response */
    }
    throw new Error(message);
  }
  return response.json();
}
