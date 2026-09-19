/**
 * Fetch a URL and save the response as a file, surfacing failures to the caller.
 *
 * An `<a download href="/api/...">` cannot tell you when the request failed: to the
 * browser a 404 or 500 with a JSON body is just another downloadable file, so the
 * user ends up with a broken file and no message at all.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败（HTTP ${res.status}）`);

  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("下载失败（返回内容不是图片）");
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Deferred: revoking in the same tick can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
