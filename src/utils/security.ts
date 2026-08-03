export function sanitizeSvg(rawSvg: string | undefined | null): string {
  if (!rawSvg) return "";
  const trimmed = rawSvg.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(trimmed, "image/svg+xml");

    const hasParserError = doc.getElementsByTagName("parsererror").length > 0;
    if (hasParserError) {
      return trimmed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    }

    const svgElement = doc.documentElement;
    if (svgElement.tagName.toLowerCase() !== "svg") {
      return "";
    }

    const cleanElement = (el: Element) => {
      const tagName = el.tagName.toLowerCase();
      if (tagName === "script" || tagName === "object" || tagName === "embed" || tagName === "iframe") {
        el.parentNode?.removeChild(el);
        return;
      }

      const attributes = Array.from(el.attributes);
      for (const attr of attributes) {
        const attrName = attr.name.toLowerCase();
        const attrVal = attr.value.toLowerCase().replace(/\s+/g, "");

        if (attrName.startsWith("on")) {
          el.removeAttribute(attr.name);
        }
        else if ((attrName === "href" || attrName === "xlink:href") && attrVal.includes("javascript:")) {
          el.removeAttribute(attr.name);
        }
      }

      const children = Array.from(el.children);
      for (const child of children) {
        cleanElement(child);
      }
    };

    cleanElement(svgElement);

    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  } catch (error) {
    console.error("SVG Sanitization failed, returning fallback:", error);
    return trimmed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                  .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, "")
                  .replace(/\s+on\w+\s*=\s*'[^']*'/gi, "");
  }
}