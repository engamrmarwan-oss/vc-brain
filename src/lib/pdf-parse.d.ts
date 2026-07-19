// Deep import of pdf-parse's core function, bypassing its index.js which
// runs debug code when module.parent is undefined (breaks Next.js bundling).
declare module "pdf-parse/lib/pdf-parse.js" {
  import type { Options, Result } from "pdf-parse";
  export default function pdfParse(buffer: Buffer, options?: Options): Promise<Result>;
}
