/** Deteta o erro típico do Vite quando um módulo carregado com `import()`
 * dinâmico (ex.: exceljs, usado para ler/gerar Excel) já não existe no
 * servidor — aconteceu um novo deploy entretanto e o separador do browser
 * ainda tinha a versão antiga da app aberta, a apontar para ficheiros que já
 * foram substituídos. Recarregar a página resolve, porque busca o
 * HTML/chunks atuais. */
export const isStaleChunkError = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(msg);
};

/** Avisa o utilizador e recarrega a página — usar no catch de qualquer
 * import() dinâmico que possa falhar por a app ter sido atualizada. */
export const recoverFromStaleChunk = (notify: (message: string) => void) => {
  notify("A aplicação foi atualizada — a recarregar a página...");
  setTimeout(() => window.location.reload(), 1200);
};
