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

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  const rawTitle = sanitizePdfText(title || 'Export');
  const titleLines = pdf.splitTextToSize(rawTitle, PAGE.contentWidth);
  const logicalTitle = titleLines[0] || 'Export';

  pdf.setProperties({
    title: logicalTitle,
    subject: 'AI Tool export',
    creator: 'AI Tool',
  });

  const titleHeight = titleLines.length * 20;
  const metaY = 38 + titleHeight;
  const headerHeight = metaY + 24;

  pdf.setFillColor(...COLORS.panel);
  pdf.rect(0, 0, PAGE.width, headerHeight, 'F');
  pdf.setDrawColor(...COLORS.border);
  pdf.line(0, headerHeight, PAGE.width, headerHeight);

  pdf.setTextColor(...COLORS.ink);
  pdf.text(titleLines, PAGE.marginX, 38, { lineHeightFactor: 1.15 });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.muted);
  const meta = `Generated ${formatPdfTimestamp()}${subtitle ? ` | ${sanitizePdfText(subtitle)}` : ''}`;
  pdf.text(meta, PAGE.marginX, metaY, { maxWidth: PAGE.contentWidth });
  pdf.setTextColor(...COLORS.ink);

  return { pdf, y: headerHeight + 26 };
};

const addContentPage = (pdf) => {
  pdf.addPage();
  return PAGE.marginY;
};

export const ensurePdfRoom = (pdf, y, spaceNeeded = 18, onPageAdd = null) => {
  if (y + spaceNeeded <= PAGE.footerY - 18) return y;
  let nextY = addContentPage(pdf);
  if (typeof onPageAdd === 'function') {
    nextY = onPageAdd(pdf, nextY);
  }
  return nextY;
};

export const measurePdfHeading = () => 24;

export const writePdfHeading = (pdf, text, y, onPageAdd = null) => {
  let nextY = ensurePdfRoom(pdf, y, 28, onPageAdd);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12.5);
  pdf.setTextColor(...COLORS.ink);
  pdf.text(sanitizePdfText(text), PAGE.marginX, nextY);
  pdf.setDrawColor(...COLORS.border);
  pdf.line(PAGE.marginX, nextY + 7, PAGE.width - PAGE.marginX, nextY + 7);
  return nextY + 24;
};

export const measurePdfParagraph = (pdf, text, options = {}) => {
  const safeText = sanitizePdfText(text);
  if (!safeText) return 0;
  const indent = options.indent || 0;
  const fontSize = options.fontSize || 9.5;
  const lineHeight = options.lineHeight || 13;
  pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
  pdf.setFontSize(fontSize);
  const lines = pdf.splitTextToSize(safeText, PAGE.contentWidth - indent);
  return lines.length * lineHeight;
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
    nextY = ensurePdfRoom(pdf, nextY, lineHeight, options.onPageAdd);
    pdf.text(line, PAGE.marginX + indent, nextY);
    nextY += lineHeight;
  });

  pdf.setTextColor(...COLORS.ink);
  return nextY;
};

export const measurePdfKeyValues = (pdf, rows) => {
  let height = 0;
  rows
    .filter((row) => row && sanitizePdfText(row.value))
    .forEach(({ label, value }) => {
      const safeLabel = sanitizePdfText(label).toUpperCase();
      const safeValue = sanitizePdfText(value);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.2);
      const labelLines = pdf.splitTextToSize(safeLabel, 116);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      const valueLines = pdf.splitTextToSize(safeValue, PAGE.contentWidth - 126);

      const labelHeight = labelLines.length * 11;
      const valueHeight = valueLines.length * 12;
      const rowHeight = Math.max(labelHeight, valueHeight);

      height += Math.max(15, rowHeight + 4);
    });
  return height > 0 ? height + 2 : 0;
};

export const writePdfKeyValues = (pdf, rows, y, options = {}) => {
  let nextY = y;
  rows
    .filter((row) => row && sanitizePdfText(row.value))
    .forEach(({ label, value }) => {
      const safeLabel = sanitizePdfText(label).toUpperCase();
      const safeValue = sanitizePdfText(value);

      const labelLines = pdf.splitTextToSize(safeLabel, 116);
      const valueLines = pdf.splitTextToSize(safeValue, PAGE.contentWidth - 126);

      const labelHeight = labelLines.length * 11;
      const valueHeight = valueLines.length * 12;
      const rowHeight = Math.max(labelHeight, valueHeight);

      nextY = ensurePdfRoom(pdf, nextY, Math.max(18, rowHeight + 4), options.onPageAdd);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.2);
      pdf.setTextColor(...COLORS.muted);
      pdf.text(labelLines, PAGE.marginX, nextY, { lineHeightFactor: 1.2 });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(...COLORS.ink);
      pdf.text(valueLines, PAGE.marginX + 126, nextY, { lineHeightFactor: 1.25 });

      nextY += Math.max(15, rowHeight + 4);
    });
  pdf.setTextColor(...COLORS.ink);
  return nextY + 2;
};

export const measurePdfList = (pdf, items, emptyText = 'None shown.') => {
  const visibleItems = Array.isArray(items) ? items.filter((item) => sanitizePdfText(item)) : [];
  if (!visibleItems.length) return measurePdfParagraph(pdf, emptyText, { muted: true });

  let height = 0;
  visibleItems.forEach((item) => {
    height += measurePdfParagraph(pdf, `- ${sanitizePdfText(item)}`, { indent: 8 });
  });
  return height;
};

export const writePdfList = (pdf, items, y, emptyText = 'None shown.', options = {}) => {
  const visibleItems = Array.isArray(items) ? items.filter((item) => sanitizePdfText(item)) : [];
  if (!visibleItems.length) return writePdfParagraph(pdf, emptyText, y, { muted: true, onPageAdd: options.onPageAdd });

  let nextY = y;
  visibleItems.forEach((item) => {
    nextY = writePdfParagraph(pdf, `- ${sanitizePdfText(item)}`, nextY, { indent: 8, onPageAdd: options.onPageAdd });
  });
  return nextY;
};

export const measurePdfCard = (pdf, { title, body, meta = [] }) => {
  const safeTitle = sanitizePdfText(title);
  const rawBody = sanitizePdfText(body);
  const safeBody = (safeTitle && safeTitle.toLowerCase() === rawBody.toLowerCase()) ? '' : rawBody;

  if (!safeTitle && !safeBody && !meta.length) return 0;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  const titleLines = safeTitle ? pdf.splitTextToSize(safeTitle, PAGE.contentWidth - 24) : [];

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const bodyLines = safeBody ? pdf.splitTextToSize(safeBody, PAGE.contentWidth - 24) : [];

  pdf.setFontSize(8.5);
  const metaLines = meta
    .filter(({ value }) => sanitizePdfText(value))
    .flatMap(({ label, value }) => pdf.splitTextToSize(`${label}: ${sanitizePdfText(value)}`, PAGE.contentWidth - 24));

  const cardHeight = Math.max(42, 20 + (titleLines.length * 12) + (bodyLines.length * 12) + (metaLines.length * 11));
  return cardHeight + 8;
};

export const writePdfCard = (pdf, { title, body, meta = [] }, y, options = {}) => {
  const safeTitle = sanitizePdfText(title);
  const rawBody = sanitizePdfText(body);
  const safeBody = (safeTitle && safeTitle.toLowerCase() === rawBody.toLowerCase()) ? '' : rawBody;

  if (!safeTitle && !safeBody && !meta.length) return y;

  const titleLines = safeTitle ? pdf.splitTextToSize(safeTitle, PAGE.contentWidth - 24) : [];
  const bodyLines = safeBody ? pdf.splitTextToSize(safeBody, PAGE.contentWidth - 24) : [];
  const metaLines = meta
    .filter(({ value }) => sanitizePdfText(value))
    .flatMap(({ label, value }) => pdf.splitTextToSize(`${label}: ${sanitizePdfText(value)}`, PAGE.contentWidth - 24));
  const cardHeight = Math.max(42, 20 + (titleLines.length * 12) + (bodyLines.length * 12) + (metaLines.length * 11));

  let nextY = ensurePdfRoom(pdf, y, cardHeight + 8, options.onPageAdd);
  const cardStartY = nextY;

  pdf.setFillColor(...COLORS.panel);
  pdf.setDrawColor(...COLORS.border);
  pdf.roundedRect(PAGE.marginX, cardStartY, PAGE.contentWidth, cardHeight, 5, 5, 'FD');

  nextY = cardStartY + 14;

  if (titleLines.length) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...COLORS.ink);
    pdf.text(titleLines, PAGE.marginX + 12, nextY, { lineHeightFactor: 1.2 });
    nextY += titleLines.length * 12;
  }

  if (bodyLines.length) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...COLORS.muted);
    const bodyPadding = titleLines.length ? 2 : 0;
    pdf.text(bodyLines, PAGE.marginX + 12, nextY + bodyPadding, { lineHeightFactor: 1.25 });
    nextY += bodyPadding + bodyLines.length * 12;
  }

  if (metaLines.length) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...COLORS.ink);
    const metaPadding = (titleLines.length || bodyLines.length) ? 2 : 0;
    pdf.text(metaLines, PAGE.marginX + 12, nextY + metaPadding, { lineHeightFactor: 1.2 });
  }

  pdf.setTextColor(...COLORS.ink);
  return cardStartY + cardHeight + 8;
};

export const measurePdfImage = (pdf, image, { maxHeight = 320, label } = {}) => {
  if (!image) return 0;
  let height = 0;
  if (label) {
    height += measurePdfParagraph(pdf, label, { bold: true });
  }

  const imageWidth = image.width || PAGE.contentWidth;
  const imageHeight = image.height || maxHeight;
  const ratio = Math.min(PAGE.contentWidth / imageWidth, maxHeight / imageHeight);
  const targetHeight = Math.max(1, imageHeight * ratio);

  return height + targetHeight + 18;
};

export const addPdfImage = (pdf, image, y, options = {}) => {
  const maxHeight = options.maxHeight || 320;
  const label = options.label;
  if (!image) return y;

  let nextY = y;
  if (label) {
    nextY = writePdfParagraph(pdf, label, nextY, { bold: true, onPageAdd: options.onPageAdd });
  }

  const imageWidth = image.width || PAGE.contentWidth;
  const imageHeight = image.height || maxHeight;
  const ratio = Math.min(PAGE.contentWidth / imageWidth, maxHeight / imageHeight);
  const targetWidth = Math.max(1, imageWidth * ratio);
  const targetHeight = Math.max(1, imageHeight * ratio);

  if (nextY + targetHeight > PAGE.footerY - 24) {
    nextY = addContentPage(pdf);
    if (typeof options.onPageAdd === 'function') {
      nextY = options.onPageAdd(pdf, nextY);
    }
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

    const hasItems = Array.isArray(section.items) && section.items.some(i => sanitizePdfText(i));
    const hasCards = Array.isArray(section.cards) && section.cards.length > 0;

    // 1. Measure total section height
    let sectionHeight = measurePdfHeading(pdf, section.title);
    if (section.body) sectionHeight += measurePdfParagraph(pdf, section.body);
    if (section.keyValues) sectionHeight += measurePdfKeyValues(pdf, section.keyValues);
    if (hasItems) sectionHeight += measurePdfList(pdf, section.items, null);
    if (hasCards) {
      section.cards.forEach((card) => {
        sectionHeight += measurePdfCard(pdf, card);
      });
    }
    if (!hasItems && !hasCards && section.emptyText && (section.items || section.cards)) {
      sectionHeight += measurePdfParagraph(pdf, section.emptyText);
    }
    if (section.images) {
      section.images.forEach((image) => {
        sectionHeight += measurePdfImage(pdf, image, { label: image.label, maxHeight: image.maxHeight });
      });
    }
    sectionHeight += 8;

    const usablePageHeight = PAGE.footerY - PAGE.marginY - 18;
    const remainingSpace = PAGE.footerY - y - 18;

    // 2. Section Pagination
    if (sectionHeight <= usablePageHeight && sectionHeight > remainingSpace) {
      // The section fits cleanly on one page, but not here.
      pdf.addPage();
      y = PAGE.marginY;
    } else if (sectionHeight > usablePageHeight) {
      // The section will span multiple pages. Ensure at least the heading + first block fit.
      let firstBlockHeight = measurePdfHeading(pdf, section.title);
      if (section.body) {
        firstBlockHeight += measurePdfParagraph(pdf, section.body);
      } else if (section.keyValues && section.keyValues.length > 0) {
        firstBlockHeight += measurePdfKeyValues(pdf, section.keyValues);
      } else if (hasCards) {
        firstBlockHeight += measurePdfCard(pdf, section.cards[0]);
      } else if (hasItems) {
        firstBlockHeight += measurePdfParagraph(pdf, `- ${sanitizePdfText(section.items[0])}`);
      } else if (!hasItems && !hasCards && section.emptyText) {
        firstBlockHeight += measurePdfParagraph(pdf, section.emptyText);
      }

      if (firstBlockHeight > remainingSpace && firstBlockHeight <= usablePageHeight) {
        pdf.addPage();
        y = PAGE.marginY;
      }
    }

    // 3. Render section with continuation hooks
    y = writePdfHeading(pdf, section.title, y); // Heading itself does not use onPageAdd

    const onPageAdd = (pdfObj, currentY) => {
      pdfObj.setFont('helvetica', 'bold');
      pdfObj.setFontSize(12.5);
      pdfObj.setTextColor(...COLORS.ink);
      pdfObj.text(`${sanitizePdfText(section.title)} (continued)`, PAGE.marginX, currentY);
      pdfObj.setDrawColor(...COLORS.border);
      pdfObj.line(PAGE.marginX, currentY + 7, PAGE.width - PAGE.marginX, currentY + 7);
      return currentY + 24;
    };

    if (section.body) {
      y = writePdfParagraph(pdf, section.body, y, { onPageAdd });
    }

    if (section.keyValues) {
      y = writePdfKeyValues(pdf, section.keyValues, y, { onPageAdd });
    }

    if (hasItems) {
      y = writePdfList(pdf, section.items, y, null, { onPageAdd });
    }

    if (hasCards) {
      section.cards.forEach((card) => {
        y = writePdfCard(pdf, card, y, { onPageAdd });
      });
    }

    if (!hasItems && !hasCards && section.emptyText && (section.items || section.cards)) {
      y = writePdfParagraph(pdf, section.emptyText, y, { muted: true, onPageAdd });
    }

    if (section.images) {
      section.images.forEach((image) => {
        y = addPdfImage(pdf, image, y, { label: image.label, maxHeight: image.maxHeight, onPageAdd });
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
