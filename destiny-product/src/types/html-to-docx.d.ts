declare module "html-to-docx" {
  export default function htmlToDocx(
    html: string,
    headerHtml?: string | null,
    options?: Record<string, unknown>,
    footerHtml?: string | null,
  ): Promise<Buffer | Blob>;
}
