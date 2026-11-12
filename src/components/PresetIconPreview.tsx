import React from "react";
import { sanitizeSvg } from "../utils/security";

interface PresetIconPreviewProps {
  src: string;
  alt?: string;
  fallback: string;
}

export const PresetIconPreview: React.FC<PresetIconPreviewProps> = ({ src, alt = "preset", fallback }) => {
  const imageSource = src || fallback;
  let svgText = "";
  if (imageSource.startsWith("data:image/svg+xml")) {
    if (imageSource.includes(";base64,")) {
      try {
        svgText = atob(imageSource.split(";base64,")[1]);
      } catch {
        svgText = "";
      }
    } else if (imageSource.includes(",")) {
      svgText = decodeURIComponent(imageSource.split(",")[1]);
    }
  } else if (imageSource.startsWith("<svg")) {
    svgText = imageSource;
  }

  if (svgText && svgText.includes("<svg")) {
    const isDefaultKey = svgText.includes("m22.7 19-9.1 9.1");
    if (isDefaultKey) {
      svgText = svgText
        .replace(/fill\s*=\s*(["'])#?ffffff\1/gi, 'fill="currentColor"')
        .replace(/fill\s*:\s*#ffffff/gi, "fill:currentColor");
    } else if (!svgText.includes("fill=")) {
      svgText = svgText.replace("<svg", '<svg fill="#ffffff"');
    } else {
      svgText = svgText.replace(/fill="currentColor"/g, 'fill="#ffffff"').replace(/fill='currentColor'/g, "fill='#ffffff'");
    }
    return (
      <div
        dangerouslySetInnerHTML={{ __html: sanitizeSvg(svgText) }}
        style={{ width: "100%", height: "100%", color: "currentColor", fill: "currentColor", display: "flex", alignItems: "center", justifyContent: "center" }}
      />
    );
  }

  return <img src={imageSource} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
};