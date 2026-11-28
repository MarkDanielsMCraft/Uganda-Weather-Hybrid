const IGNORED_TAG_NAMES = new Set([
  "svg",
  "canvas",
  "script",
  "style",
  "noscript",
  "input",
  "select",
  "textarea",
  "iframe",
  "audio",
  "video",
]);

const BLOCK_TAG_NAMES = new Set([
  "p",
  "div",
  "section",
  "article",
  "header",
  "footer",
  "aside",
  "main",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "blockquote",
  "pre",
  "form",
  "details",
  "summary",
  "button",
]);

function shouldIgnoreElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (IGNORED_TAG_NAMES.has(tag)) return true;
  if (el.hasAttribute("data-no-narrate")) return true;
  if (el.hasAttribute("hidden")) return true;
  if (el.getAttribute("aria-hidden") === "true") return true;
  if (el.classList?.contains("sr-only")) return true;
  return false;
}

function finalizeSentenceBlock(raw: string): string {
  const collapsed = raw
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?°%])/g, "$1")
    .trim();
  if (!collapsed) return "";
  // Skip placeholder-only or missing-metric dash rows (such as "Altimita —")
  if (/^[—–-]+$/.test(collapsed)) return "";
  if (collapsed.length < 48 && /\s[—–]$/.test(collapsed)) return "";
  return collapsed;
}

function ensureTrailingPause(block: string): string {
  if (/[.!?…:;]$/.test(block)) return block;
  return `${block}.`;
}

/**
 * Extracts readable visible prose in screen order from a mounted card or modal
 * container, skipping visual-only charts, pickers, SVGs, and raw code lines
 * marked with `data-no-narrate`, while preserving spaces between adjacent
 * inline elements (`0<span>Wansi</span>` -> `"0 Wansi"`, `<span>hPa</span>1014`
 * -> `"hPa 1014"`).
 */
export function extractReadableCardText(
  root: Element | null | undefined,
  heading?: string | null,
): string {
  const blocks: string[] = [];
  const pushBlock = (raw: string) => {
    const cleaned = finalizeSentenceBlock(raw);
    if (!cleaned) return;
    const prev = blocks[blocks.length - 1];
    if (prev && prev.toLowerCase() === cleaned.toLowerCase()) return;
    blocks.push(cleaned);
  };

  if (heading) {
    pushBlock(heading);
  }
  if (!root) {
    return blocks.map(ensureTrailingPause).join(" ");
  }

  let inlineBuffer = "";
  const flushInline = () => {
    if (!inlineBuffer) return;
    pushBlock(inlineBuffer);
    inlineBuffer = "";
  };

  const appendInlineBoundarySpace = () => {
    if (inlineBuffer.length > 0 && !/\s$/.test(inlineBuffer)) {
      inlineBuffer += " ";
    }
  };

  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      inlineBuffer += node.nodeValue ?? "";
      return;
    }
    if (node.nodeType !== 1) return;

    const el = node as Element;
    if (shouldIgnoreElement(el)) return;

    const tag = el.tagName.toLowerCase();
    const isBlock = BLOCK_TAG_NAMES.has(tag);

    if (isBlock) {
      flushInline();
      for (let i = 0; i < el.childNodes.length; i += 1) {
        walk(el.childNodes[i]!);
      }
      flushInline();
      return;
    }

    appendInlineBoundarySpace();
    for (let i = 0; i < el.childNodes.length; i += 1) {
      walk(el.childNodes[i]!);
    }
    appendInlineBoundarySpace();
  };

  for (let i = 0; i < root.childNodes.length; i += 1) {
    walk(root.childNodes[i]!);
  }
  flushInline();

  return blocks.map(ensureTrailingPause).join(" ");
}
