import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Depois de uma nova publicação os ficheiros antigos (ex.: o do jsPDF) deixam de
// existir; uma aba aberta antes disso falharia ao carregá-los. Recarrega a página
// uma vez para ir buscar a versão nova (a marca evita ciclos de recarregamento).
window.addEventListener("vite:preloadError", (event) => {
  const KEY = "reload-after-chunk-error";
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* sem sessionStorage: recarrega na mesma */
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
