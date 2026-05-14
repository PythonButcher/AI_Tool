import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const PAGE = {
  width: 612,
  height: 792,
  marginX: 40,
  marginY: 42,
  footerY: 770,
  contentWidth: 532,
};

const COLORS = {
  ink: [24, 31, 42],
  muted: [93, 105, 126],
  border: [214, 222, 234],
  panel: [248, 250, 252],
  accent: [35, 90, 180],
};

export const sanitizePdfText = (value) => {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'string' ? value : String(value);
  return Array.from(raw.replace(/[‘’]/g, "'").replace(/[“”]/g, '"'))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code === 10 || code === 13 || (code >= 32 && code <= 126);
    })
    .join('')
    .replace(/[ \t]+/g, ' ')
    .trim();
};

export const formatPdfTimestamp = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return sanitizePdfText(value);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const pdfFileDate = () => new Date().toISOString().slice(0, 10);

export const readablePdfLabel = (key) => sanitizePdfText(key)
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

export const createAppPdf = ({ title, subtitle }) => {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  pdf.setProperties({
    title: sanitizePdfText(title),
    subject: 'AI Tool export',
    creator: 'AI Tool',
  });

  pdf.setFillColor(...COLORS.panel);
  pdf.rect(0, 0, PAGE.width, 82, 'F');
  pdf.setDrawColor(...COLORS.border);
  pdf.line(0, 82, PAGE.width, 82);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  pdf.setTextColor(...COLORS.ink);
  pdf.text(sanitizePdfText(title || 'Export'), PAGE.marginX, 38, {
    maxWidth: PAGE.contentWidth,
  });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.muted);
  const meta = `Generated ${formatPdfTimestamp()}${subtitle ? ` | ${sanitizePdfText(subtitle)}` : ''}`;
  pdf.text(meta, PAGE.marginX, 58, { maxWidth: PAGE.contentWidth });
  pdf.setTextColor(...COLORS.ink);

  return { pdf, y: 108 };
};

const addContentPage = (pdf) => {
  pdf.addPage();
  return PAGE.marginY;
};

export const ensurePdfRoom = (pdf, y, spaceNeeded = 18) => {
  if (y + spaceNeeded <= PAGE.footerY - 18) return y;
  return addContentPage(pdf);
};

export const writePdfHeading = (pdf, text, y) => {
  let nextY = ensurePdfRoom(pdf, y, 28);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12.5);
  pdf.setTextColor(...COLORS.ink);
  pdf.text(sanitizePdfText(text), PAGE.marginX, nextY);
  pdf.setDrawColor(...COLORS.border);
  pdf.line(PAGE.marginX, nextY + 7, PAGE.width - PAGE.marginX, nextY + 7);
  return nextY + 24;
};

export const writePdfParagraph = (pdf, text, y, options = {}) => {
  const safeText = sanitizePdfText(text);
  if (!safeText) return y;

  const indent = options.indent || 0;
  const fontSize = options.fontSize || 9.5;
  const lineHeight = options.lineHeight || 13;
  pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
  pdf.setFontSize(fontSize);
  pdf.setTextColor(...(options.muted ? COLORS.muted : COLORS.ink));

  const lines = pdf.splitTextToSize(safeText, PAGE.contentWidth - indent);
  let nextY = y;
  lines.forEach((line) => {
    nextY = ensurePdfRoom(pdf, nextY, lineHeight);
    pdf.text(line, PAGE.marginX + indent, nextY);
    nextY += lineHeight;
  });

  pdf.setTextColor(...COLORS.ink);
  return nextY;
};

export const writePdfKeyValues = (pdf, rows, y) => {
  let nextY = y;
  rows
    .filter((row) => row && sanitizePdfText(row.value))
    .forEach(({ label, value }) => {
      const valueLines = pdf.splitTextToSize(sanitizePdfText(value), PAGE.contentWidth - 126);
      nextY = ensurePdfRoom(pdf, nextY, Math.max(18, valueLines.length * 12));
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.2);
      pdf.setTextColor(...COLORS.muted);
      pdf.text(sanitizePdfText(label).toUpperCase(), PAGE.marginX, nextY);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(...COLORS.ink);
      pdf.text(valueLines, PAGE.marginX + 126, nextY, { lineHeightFactor: 1.25 });
      nextY += Math.max(15, valueLines.length * 12);
    });
  pdf.setTextColor(...COLORS.ink);
  return nextY + 2;
};

export const writePdfList = (pdf, items, y, emptyText = 'None shown.') => {
  const visibleItems = Array.isArray(items) ? items.filter((item) => sanitizePdfText(item)) : [];
  if (!visibleItems.length) return writePdfParagraph(pdf, emptyText, y, { muted: true });

  let nextY = y;
  visibleItems.forEach((item) => {
    nextY = writePdfParagraph(pdf, `- ${sanitizePdfText(item)}`, nextY, { indent: 8 });
  });
  return nextY;
};

export const writePdfCard = (pdf, { title, body, meta = [] }, y) => {
  const safeTitle = sanitizePdfText(title);
  const safeBody = sanitizePdfText(body);
  if (!safeTitle && !safeBody && !meta.length) return y;

  const titleLines = safeTitle ? pdf.splitTextToSize(safeTitle, PAGE.contentWidth - 24) : [];
  const bodyLines = safeBody ? pdf.splitTextToSize(safeBody, PAGE.contentWidth - 24) : [];
  const metaLines = meta
    .filter(({ value }) => sanitizePdfText(value))
    .flatMap(({ label, value }) => pdf.splitTextToSize(`${label}: ${sanitizePdfText(value)}`, PAGE.contentWidth - 24));
  const cardHeight = Math.max(42, 20 + (titleLines.length * 12) + (bodyLines.length * 12) + (metaLines.length * 11));

  let nextY = ensurePdfRoom(pdf, y, cardHeight + 8);
  const cardStartY = nextY;
  pdf.setFillColor(...COLORS.panel);
  pdf.setDrawColor(...COLORS.border);
  pdf.roundedRect(PAGE.marginX, nextY - 12, PAGE.contentWidth, cardHeight, 5, 5, 'FD');

  if (titleLines.length) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...COLORS.ink);
    pdf.text(titleLines, PAGE.marginX + 12, nextY + 2, { lineHeightFactor: 1.2 });
    nextY += titleLines.length * 12;
  }

  if (bodyLines.length) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(bodyLines, PAGE.marginX + 12, nextY + 4, { lineHeightFactor: 1.25 });
    nextY += 4 + bodyLines.length * 12;
  }

  if (metaLines.length) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...COLORS.ink);
    pdf.text(metaLines, PAGE.marginX + 12, nextY + 3, { lineHeightFactor: 1.2 });
  }

  pdf.setTextColor(...COLORS.ink);
  return cardStartY + cardHeight + 2;
};

export const addPdfImage = (pdf, image, y, { maxHeight = 320, label } = {}) => {
  if (!image) return y;
  let nextY = y;
  if (label) {
    nextY = writePdfParagraph(pdf, label, nextY, { bold: true });
  }

  const imageWidth = image.width || PAGE.contentWidth;
  const imageHeight = image.height || maxHeight;
  const ratio = Math.min(PAGE.contentWidth / imageWidth, maxHeight / imageHeight);
  const targetWidth = Math.max(1, imageWidth * ratio);
  const targetHeight = Math.max(1, imageHeight * ratio);

  if (nextY + targetHeight > PAGE.footerY - 24) {
    nextY = addContentPage(pdf);
  }

  const x = PAGE.marginX + (PAGE.contentWidth - targetWidth) / 2;
  pdf.addImage(image.dataUrl || image, 'PNG', x, nextY, targetWidth, targetHeight, undefined, 'FAST');
  return nextY + targetHeight + 18;
};

export const addPdfFooter = (pdf, footerLabel = 'AI Tool Export') => {
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(`${footerLabel} | Page ${i} of ${pageCount}`, PAGE.marginX, PAGE.footerY);
  }
  pdf.setTextColor(...COLORS.ink);
};

export const saveAppPdf = (pdf, fileName, footerLabel) => {
  addPdfFooter(pdf, footerLabel);
  pdf.save(`${fileName}_${pdfFileDate()}.pdf`);
};

const prepareCloneForPdf = (clone, { captureClassName, prepareClone } = {}) => {
  clone.classList.add('app-pdf-capture');
  if (captureClassName) {
    captureClassName.split(/\s+/).filter(Boolean).forEach((className) => clone.classList.add(className));
  }
  clone.style.height = 'auto';
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'visible';
  clone.style.transform = 'none';
  clone.style.transition = 'none';
  clone.style.animation = 'none';
  clone.querySelectorAll('button, [role="button"], .MuiTooltip-popper').forEach((node) => {
    if (node.closest('[data-pdf-keep="true"]')) return;
    node.setAttribute('data-pdf-hidden', 'true');
    node.style.display = 'none';
  });
  clone.querySelectorAll('[style]').forEach((node) => {
    node.style.maxHeight = node.style.maxHeight === '100%' ? 'none' : node.style.maxHeight;
    node.style.overflow = node.style.overflow === 'auto' || node.style.overflow === 'scroll' ? 'visible' : node.style.overflow;
  });
  if (typeof prepareClone === 'function') {
    prepareClone(clone);
  }
};

export const exportElementToPdf = async ({
  element,
  title,
  subtitle,
  fileName = 'app_export',
  footerLabel = 'AI Tool Export',
  backgroundColor = '#ffffff',
  captureClassName,
  prepareClone,
}) => {
  if (!element) return false;

  try {
    element.setAttribute('data-pdf-capture-source', 'true');
    const { pdf, y: startY } = createAppPdf({ title, subtitle });
    const canvas = await html2canvas(element, {
      backgroundColor,
      scale: Math.min(2, window.devicePixelRatio || 1.5),
      useCORS: true,
      logging: false,
      windowWidth: Math.max(element.scrollWidth, element.clientWidth),
      windowHeight: Math.max(element.scrollHeight, element.clientHeight),
      onclone: (clonedDocument) => {
        const clonedElement = clonedDocument.body.querySelector('[data-pdf-capture-source="true"]');
        if (clonedElement) prepareCloneForPdf(clonedElement, { captureClassName, prepareClone });
      },
    });

    const imageWidth = PAGE.contentWidth;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;
    const pageContentHeight = PAGE.footerY - startY - 18;
    const pageCanvasHeight = (pageContentHeight * canvas.width) / imageWidth;

    let sourceY = 0;
    let pageIndex = 0;
    while (sourceY < canvas.height) {
      if (pageIndex > 0) pdf.addPage();
      const destinationY = pageIndex === 0 ? startY : PAGE.marginY;
      const destinationHeight = pageIndex === 0 ? pageContentHeight : PAGE.footerY - PAGE.marginY - 18;
      const sliceHeight = Math.min(
        canvas.height - sourceY,
        pageIndex === 0 ? pageCanvasHeight : ((destinationHeight * canvas.width) / imageWidth)
      );

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeight;
      const context = sliceCanvas.getContext('2d');
      context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      const sliceData = sliceCanvas.toDataURL('image/png', 1);
      const slicePdfHeight = (sliceHeight * imageWidth) / canvas.width;
      pdf.addImage(sliceData, 'PNG', PAGE.marginX, destinationY, imageWidth, slicePdfHeight, undefined, 'FAST');

      sourceY += sliceHeight;
      pageIndex += 1;
    }

    if (imageHeight <= 0) {
      writePdfParagraph(pdf, 'No visible content was available to export.', startY, { muted: true });
    }

    saveAppPdf(pdf, fileName, footerLabel);
    element.removeAttribute('data-pdf-capture-source');
    return true;
  } catch (error) {
    console.error('PDF DOM export failed.', error);
    element.removeAttribute('data-pdf-capture-source');
    return false;
  }
};

export const exportStructuredPdf = ({
  title,
  subtitle,
  fileName = 'app_export',
  footerLabel = 'AI Tool Export',
  sections = [],
}) => {
  const { pdf, y: startY } = createAppPdf({ title, subtitle });
  let y = startY;

  sections.forEach((section) => {
    if (!section) return;
    y = writePdfHeading(pdf, section.title, y);

    if (section.body) {
      y = writePdfParagraph(pdf, section.body, y);
    }

    if (section.keyValues) {
      y = writePdfKeyValues(pdf, section.keyValues, y);
    }

    if (section.items) {
      y = writePdfList(pdf, section.items, y, section.emptyText);
    }

    if (section.cards) {
      if (section.cards.length) {
        section.cards.forEach((card) => {
          y = writePdfCard(pdf, card, y);
        });
      } else if (section.emptyText) {
        y = writePdfParagraph(pdf, section.emptyText, y, { muted: true });
      }
    }

    if (section.images) {
      section.images.forEach((image) => {
        y = addPdfImage(pdf, image, y, { label: image.label, maxHeight: image.maxHeight });
      });
    }

    y += 8;
  });

  saveAppPdf(pdf, fileName, footerLabel);
};

export const exportChartToPdf = ({ chart, title = 'Chart Export', subtitle, fileName = 'chart_export' }) => {
  if (!chart) return;
  const base64Image = chart.toBase64Image();
  exportStructuredPdf({
    title,
    subtitle,
    fileName,
    footerLabel: 'Chart Export',
    sections: [
      {
        title: 'Visible Chart',
        body: 'This export preserves the rendered chart visible in the current chart window.',
        images: [{ dataUrl: base64Image, width: chart.width, height: chart.height, maxHeight: 430 }],
      },
    ],
  });
};

export const captureVisibleChartImages = (root = document) => {
  const canvases = Array.from(root.querySelectorAll('canvas'));
  return canvases
    .filter((canvas) => canvas.width > 10 && canvas.height > 10)
    .filter((canvas) => {
      const styles = window.getComputedStyle(canvas);
      return styles.display !== 'none' && styles.visibility !== 'hidden';
    })
    .map((canvas, index) => {
      try {
        const frame = canvas.closest('.window-frame, .chart-wrapper, .section-container');
        const title = sanitizePdfText(
          frame?.querySelector('.header-title, .chart-title, .section-title, h1, h2, h3, h4, h5')?.textContent ||
          `Chart ${index + 1}`
        );
        return {
          label: title,
          dataUrl: canvas.toDataURL('image/png', 1),
          width: canvas.width,
          height: canvas.height,
          maxHeight: 330,
        };
      } catch (error) {
        console.warn('Failed to capture visible chart canvas.', error);
        return null;
      }
    })
    .filter(Boolean);
};
