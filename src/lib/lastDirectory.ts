const STORAGE_KEY = "watchdogs:last-directory";
const LEGACY_STORAGE_KEY = "civica:last-directory";

/** Guarda la última vista del directorio para conservar los filtros al volver. */
export function rememberDirectory(path: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, path);
  } catch {
    // sessionStorage puede no estar disponible en algunos navegadores.
  }
}

export function getLastDirectory(): string {
  try {
    return (
      sessionStorage.getItem(STORAGE_KEY) ||
      sessionStorage.getItem(LEGACY_STORAGE_KEY) ||
      "/"
    );
  } catch {
    return "/";
  }
}
