import instituteHeaderBannerUrl from "../assets/header.png";

const FALLBACK_BANNER_WIDTH = 743;
const FALLBACK_BANNER_HEIGHT = 94;
const HEADER_ACCENT = [31, 41, 55];
const HEADER_META = [55, 65, 81];
const HEADER_RULE = [203, 213, 225];
let cachedHeaderImagePromise = null;

const loadHeaderAsPngDataUrl = (url) =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("PDF header image can only be loaded in browser."));
      return;
    }
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Unable to draw header image."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve({
        dataUrl: canvas.toDataURL("image/png"),
        width: canvas.width || FALLBACK_BANNER_WIDTH,
        height: canvas.height || FALLBACK_BANNER_HEIGHT
      });
    };
    image.onerror = () => reject(new Error("Unable to load header image."));
    image.src = url;
  });

const drawFallbackBanner = (doc, margin, y, width) => {
  const height = 68;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...HEADER_RULE);
  doc.roundedRect(margin, y, width, height, 6, 6, "FD");
  doc.setTextColor(...HEADER_ACCENT);
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.text("S. B. JAIN INSTITUTE OF TECHNOLOGY, MANAGEMENT & RESEARCH, NAGPUR", margin + 12, y + 28);
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text("Emerge as a Leading Institute for Developing Competent and Creative Professionals", margin + 12, y + 46);
  return height;
};

export const getPdfHeaderBannerUrl = () => instituteHeaderBannerUrl;

export const getPdfHeaderImageDataUrl = async () => {
  if (!cachedHeaderImagePromise) {
    cachedHeaderImagePromise = loadHeaderAsPngDataUrl(instituteHeaderBannerUrl).catch((err) => {
      cachedHeaderImagePromise = null;
      throw err;
    });
  }
  return cachedHeaderImagePromise;
};

export const drawPdfHeader = (doc, options = {}) => {
  const {
    margin = 32,
    title = "",
    subtitle = "",
    metadataLines = [],
    headerImageDataUrl = null,
    topPadding = 18,
    titleAlign = "left"
  } = options;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - (margin * 2);
  let cursorY = topPadding;

  if (headerImageDataUrl) {
    const imageData = typeof headerImageDataUrl === "string"
      ? {
        dataUrl: headerImageDataUrl,
        width: FALLBACK_BANNER_WIDTH,
        height: FALLBACK_BANNER_HEIGHT
      }
      : headerImageDataUrl;
    const sourceWidth = imageData?.width || FALLBACK_BANNER_WIDTH;
    const sourceHeight = imageData?.height || FALLBACK_BANNER_HEIGHT;
    const bannerHeight = Math.round((contentWidth / sourceWidth) * sourceHeight);
    doc.addImage(imageData.dataUrl, "PNG", margin, cursorY, contentWidth, bannerHeight, undefined, "FAST");
    cursorY += bannerHeight + 10;
  } else {
    const fallbackHeight = drawFallbackBanner(doc, margin, cursorY, contentWidth);
    cursorY += fallbackHeight + 10;
  }

  doc.setTextColor(...HEADER_ACCENT);
  if (title) {
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    if (titleAlign === "center") {
      doc.text(title, pageWidth / 2, cursorY, { align: "center" });
    } else if (titleAlign === "right") {
      doc.text(title, pageWidth - margin, cursorY, { align: "right" });
    } else {
      doc.text(title, margin, cursorY);
    }
    cursorY += 15;
  }

  if (subtitle) {
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.text(subtitle, margin, cursorY);
    cursorY += 12;
  }

  if (metadataLines.length > 0) {
    doc.setTextColor(...HEADER_META);
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    metadataLines.forEach((line) => {
      doc.text(String(line), margin, cursorY);
      cursorY += 11;
    });
  }

  doc.setDrawColor(...HEADER_RULE);
  doc.setLineWidth(0.8);
  doc.line(margin, cursorY + 2, pageWidth - margin, cursorY + 2);
  return cursorY + 14;
};
