// OCR de PDFs sem camada de texto (ex.: "2ª via" do Bankinter, extratos digitalizados).
// Cada página é desenhada num canvas pelo PDF.js e lida pelo Tesseract (português) no navegador;
// as imagens não saem do computador (só o modelo de língua é descarregado na 1.ª utilização).
import { createWorker, PSM } from "tesseract.js";

interface PdfPageLike {
  getViewport(opts: { scale: number }): { width: number; height: number };
  render(opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
}
interface PdfLike {
  numPages: number;
  getPage(n: number): Promise<PdfPageLike>;
}

const ESCALA = 3; // ~215 dpi numa A4: bom compromisso entre precisão e tempo

export async function ocrPdfPages(
  pdf: PdfLike,
  onProgress?: (pagina: number, total: number) => void,
): Promise<string> {
  const worker = await createWorker("por");
  try {
    // Bloco único: mantém cada linha da tabela inteira (data … descritivo … valor … saldo).
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const textos: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress?.(i, pdf.numPages);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: ESCALA });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível para OCR");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const { data } = await worker.recognize(canvas);
      textos.push(data.text);
      canvas.width = 0;
      canvas.height = 0;
    }
    return textos
      .join("\n")
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  } finally {
    await worker.terminate();
  }
}
