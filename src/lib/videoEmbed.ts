/** URL para incorporar (iframe) uma gravação partilhada, ou null se o serviço não
 * permitir incorporar — nesse caso mostra-se só o botão para abrir. */
export function videoEmbedUrl(raw: string | null | undefined): string | null {
  const url = (raw || "").trim();
  if (!url) return null;
  // Google Drive: /file/d/<id>/view → /file/d/<id>/preview
  const gd = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/) || url.match(/drive\.google\.com\/open\?id=([^&#]+)/);
  if (gd) return `https://drive.google.com/file/d/${gd[1]}/preview`;
  // Loom: /share/<id> → /embed/<id>
  const loom = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;
  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  // OneDrive / SharePoint: só o código "Incorporar" (…/embed…) pode ir para iframe
  if (/(onedrive\.live\.com|sharepoint\.com)\/.*embed/i.test(url)) return url;
  return null;
}

/** Só aceita ligações http(s) — evita "javascript:" e afins. */
export const isSafeUrl = (url: string) => /^https?:\/\//i.test(url.trim());
