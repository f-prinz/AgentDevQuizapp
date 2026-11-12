import * as QRCodeModule from "react-qr-code";
import type { QRCodeProps } from "react-qr-code";

// BUG-2: react-qr-code ist reines CJS — je nach Interop (Vite-Dev vs. Vitest)
// liefert der Import ein verschachteltes Namespace-Objekt statt der Komponente
// ({ default: { QRCode } }, { QRCode } oder die Funktion direkt).
// .default-Ketten auspacken; landet das in einem Objekt ohne weitere
// .default-Ebene, liegt die Komponente als Funktionswert darin (QRCode-Key).
export function resolveComponent<T>(mod: unknown): T {
  let resolved: unknown = mod;
  while (resolved !== null && typeof resolved === "object" && "default" in resolved) {
    resolved = (resolved as { default: unknown }).default;
  }
  if (resolved !== null && typeof resolved === "object") {
    const component = Object.values(resolved).find(value => typeof value === "function");
    if (component) resolved = component;
  }
  return resolved as T;
}

export const QRCode = resolveComponent<React.ComponentType<QRCodeProps>>(QRCodeModule);

export const KIND_LABEL: Record<string, string> = { quiz: "Quiz", sorting: "Sortieren", estimation: "Schätzen" };
