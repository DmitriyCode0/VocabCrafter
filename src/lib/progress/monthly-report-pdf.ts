import "server-only";

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  getReportLanguageLabel,
  normalizeReportLanguage,
  type ReportLanguage,
} from "@/lib/progress/monthly-report-language";
import {
  formatMonthlyReportMonthLabel,
  type StoredMonthlyReport,
} from "@/lib/progress/monthly-reports";

interface MonthlyReportPdfInput {
  report: StoredMonthlyReport;
  studentName: string;
  tutorName: string;
  locale: string;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const BODY_FONT_SIZE = 11;
const LINE_HEIGHT_MULTIPLIER = 1.45;
const BRAND_GREEN = rgb(0.2, 0.55, 0.28);
const BRAND_GREEN_DARK = rgb(0.13, 0.37, 0.19);
const BRAND_SURFACE = rgb(0.95, 0.97, 0.93);
const PANEL_FILL = rgb(0.98, 0.96, 0.93);
const PANEL_BORDER = rgb(0.84, 0.77, 0.67);
const MUTED_FILL = rgb(0.95, 0.95, 0.92);
const TEXT_COLOR = rgb(0.18, 0.16, 0.15);
const MUTED_TEXT = rgb(0.4, 0.37, 0.35);

const PDF_FONT_PATHS = {
  regular: [
    path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf"),
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    "/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf",
    "/usr/share/fonts/noto/NotoSans-Regular.ttf",
  ],
  bold: [
    path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf"),
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    "/usr/share/fonts/opentype/noto/NotoSans-Bold.ttf",
    "/usr/share/fonts/noto/NotoSans-Bold.ttf",
  ],
  italic: [
    path.join(process.cwd(), "public", "fonts", "NotoSans-Italic.ttf"),
    "/System/Library/Fonts/Supplemental/Arial Italic.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Italic.ttf",
    "/usr/share/fonts/opentype/noto/NotoSans-Italic.ttf",
    "/usr/share/fonts/noto/NotoSans-Italic.ttf",
  ],
} as const;

async function readFirstAvailableFont(paths: readonly string[]) {
  for (const fontPath of paths) {
    try {
      await access(fontPath);
      return readFile(fontPath);
    } catch {
      continue;
    }
  }

  throw new Error(
    `Unable to find a Unicode-capable PDF font. Checked: ${paths.join(", ")}`,
  );
}

const fontBytesPromise = Promise.all([
  readFirstAvailableFont(PDF_FONT_PATHS.regular),
  readFirstAvailableFont(PDF_FONT_PATHS.bold),
  readFirstAvailableFont(PDF_FONT_PATHS.italic),
]);

const PDF_COPY: Record<
  ReportLanguage,
  {
    brandTag: string;
    reportLabel: string;
    month: string;
    student: string;
    tutor: string;
    published: string;
    planSnapshot: string;
    planTitle: string;
    goalSummary: string;
    objectives: string;
    grammarTopics: string;
    reportLanguage: string;
    targets: string;
    monthlyMetrics: string;
    publishedReport: string;
    tutorAddendum: string;
    noObjectives: string;
    noGrammarTopics: string;
    noPublishedContent: string;
    completedQuizzes: string;
    completedLessons: string;
    newWords: string;
    activeDays: string;
    practicedWords: string;
    trackedWords: string;
    averageScore: string;
    noTarget: string;
    targetVs: string;
    onTarget: string;
    above: string;
    below: string;
    sectionHeadings: string[];
  }
> = {
  en: {
    brandTag: "Learning Progress",
    reportLabel: "Monthly Progress Report",
    month: "Month",
    student: "Student",
    tutor: "Tutor",
    published: "Published",
    planSnapshot: "Plan Snapshot",
    planTitle: "Plan title",
    goalSummary: "Goal summary",
    objectives: "Objectives",
    grammarTopics: "Grammar focus topics",
    reportLanguage: "Report language",
    targets: "Targets",
    monthlyMetrics: "Monthly Metrics",
    publishedReport: "Published Report",
    tutorAddendum: "Tutor Addendum",
    noObjectives: "No objectives listed.",
    noGrammarTopics: "No grammar topics selected.",
    noPublishedContent: "No published report content available.",
    completedQuizzes: "Completed quizzes",
    completedLessons: "Completed lessons",
    newWords: "New mastery words",
    activeDays: "Active days",
    practicedWords: "Words practiced",
    trackedWords: "Tracked words",
    averageScore: "Average quiz score",
    noTarget: "no target set",
    targetVs: "vs target",
    onTarget: "on target",
    above: "above",
    below: "below",
    sectionHeadings: [
      "Summary",
      "Goal Check",
      "Highlights",
      "Focus Areas",
      "Next Steps",
    ],
  },
  uk: {
    brandTag: "Навчальний прогрес",
    reportLabel: "Щомісячний звіт про прогрес",
    month: "Місяць",
    student: "Студент",
    tutor: "Викладач",
    published: "Опубліковано",
    planSnapshot: "Знімок плану",
    planTitle: "Назва плану",
    goalSummary: "Підсумок цілі",
    objectives: "Цілі",
    grammarTopics: "Граматичні теми у фокусі",
    reportLanguage: "Мова звіту",
    targets: "Цільові орієнтири",
    monthlyMetrics: "Метрики за місяць",
    publishedReport: "Опублікований звіт",
    tutorAddendum: "Коментар викладача",
    noObjectives: "Цілі ще не додані.",
    noGrammarTopics: "Граматичні теми ще не вибрані.",
    noPublishedContent: "Опублікований текст звіту ще відсутній.",
    completedQuizzes: "Завершені вікторини",
    completedLessons: "Завершені уроки",
    newWords: "Нові засвоєні слова",
    activeDays: "Активні дні",
    practicedWords: "Практиковані слова",
    trackedWords: "Відстежувані слова",
    averageScore: "Середній бал",
    noTarget: "ціль не задана",
    targetVs: "проти цілі",
    onTarget: "у межах цілі",
    above: "вище",
    below: "нижче",
    sectionHeadings: [
      "Підсумок",
      "Перевірка цілей",
      "Ключові моменти",
      "Зони уваги",
      "Наступні кроки",
    ],
  },
};

function sanitizeFilenameSegment(value: string) {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return sanitized || "student";
}

function formatTargetLine(
  label: string,
  actual: number | null,
  target: number | null,
  copy: (typeof PDF_COPY)[ReportLanguage],
  formatter: (value: number) => string = (value) => formatNumber(value, 0),
) {
  const actualValue = actual == null ? "n/a" : formatter(actual);

  if (target == null) {
    return `${label}: ${actualValue} (${copy.noTarget})`;
  }

  const targetValue = formatter(target);

  if (actual == null) {
    return `${label}: ${actualValue} ${copy.targetVs} ${targetValue}`;
  }

  const delta = actual - target;

  if (delta === 0) {
    return `${label}: ${actualValue} ${copy.targetVs} ${targetValue} (${copy.onTarget})`;
  }

  const direction = delta > 0 ? copy.above : copy.below;
  return `${label}: ${actualValue} ${copy.targetVs} ${targetValue} (${formatter(Math.abs(delta))} ${direction})`;
}

function formatNumber(value: number, maximumFractionDigits = 1) {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value
    .toFixed(maximumFractionDigits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatPercentage(value: number) {
  return `${formatNumber(value)}%`;
}

function formatMetricProgressValue(
  actual: number | null,
  target: number | null,
  formatter: (value: number) => string = (value) => formatNumber(value, 0),
) {
  const actualValue = actual == null ? "n/a" : formatter(actual);

  if (target == null) {
    return actualValue;
  }

  return `${actualValue} / ${formatter(target)}`;
}

function wrapLine(
  text: string,
  width: number,
  font: PDFFont,
  fontSize: number,
) {
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let currentLine = "";

  function pushBrokenWord(word: string) {
    let segment = "";

    for (const character of word) {
      const candidate = `${segment}${character}`;

      if (font.widthOfTextAtSize(candidate, fontSize) <= width) {
        segment = candidate;
      } else {
        if (segment) {
          lines.push(segment);
        }
        segment = character;
      }
    }

    currentLine = segment;
  }

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, fontSize) <= width) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = "";
    }

    if (font.widthOfTextAtSize(word, fontSize) <= width) {
      currentLine = word;
    } else {
      pushBrokenWord(word);
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

export function getMonthlyReportPdfFilename(
  report: StoredMonthlyReport,
  studentName: string,
) {
  return `monthly-report-${report.reportMonth}-${sanitizeFilenameSegment(studentName)}.pdf`;
}

export async function buildMonthlyReportPdf({
  report,
  studentName,
  tutorName,
  locale,
}: MonthlyReportPdfInput) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regularFontBytes, boldFontBytes, italicFontBytes] =
    await fontBytesPromise;
  const regularFont = await pdf.embedFont(regularFontBytes);
  const boldFont = await pdf.embedFont(boldFontBytes);
  const italicFont = await pdf.embedFont(italicFontBytes);
  const pages: PDFPage[] = [];
  const reportLanguage = normalizeReportLanguage(
    report.goalsSnapshot.reportLanguage,
  );
  const copy = PDF_COPY[reportLanguage];
  const monthLabel = formatMonthlyReportMonthLabel(report.reportMonth, locale);
  const publishedAtLabel = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(report.publishedAt || report.generatedAt));

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - PAGE_MARGIN;
  pages.push(page);

  function lineHeight(fontSize: number) {
    return fontSize * LINE_HEIGHT_MULTIPLIER;
  }

  function addPage() {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = PAGE_HEIGHT - PAGE_MARGIN;
    pages.push(page);
  }

  function ensureSpace(requiredHeight: number) {
    if (cursorY - requiredHeight < PAGE_MARGIN) {
      addPage();
    }
  }

  function drawWrappedText(
    text: string,
    x: number,
    width: number,
    {
      font = regularFont,
      fontSize = BODY_FONT_SIZE,
      color = TEXT_COLOR,
      afterGap = 0,
    }: {
      font?: PDFFont;
      fontSize?: number;
      color?: ReturnType<typeof rgb>;
      afterGap?: number;
    } = {},
  ) {
    const lines = wrapLine(text, width, font, fontSize);
    ensureSpace(lines.length * lineHeight(fontSize) + afterGap);

    for (const line of lines) {
      page.drawText(line, {
        x,
        y: cursorY,
        size: fontSize,
        font,
        color,
      });
      cursorY -= lineHeight(fontSize);
    }

    cursorY -= afterGap;
  }

  function drawParagraph(text: string, font: PDFFont = regularFont) {
    const sectionHeadingSet = new Set(copy.sectionHeadings);

    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();

      if (!line) {
        cursorY -= 6;
        continue;
      }

      if (sectionHeadingSet.has(line)) {
        drawWrappedText(line, PAGE_MARGIN, CONTENT_WIDTH, {
          font: boldFont,
          fontSize: 13,
          color: BRAND_GREEN_DARK,
          afterGap: 3,
        });
        continue;
      }

      if (line.startsWith("- ")) {
        const bulletLines = wrapLine(
          line.slice(2),
          CONTENT_WIDTH - 18,
          font,
          BODY_FONT_SIZE,
        );
        ensureSpace(bulletLines.length * lineHeight(BODY_FONT_SIZE) + 2);
        page.drawText("•", {
          x: PAGE_MARGIN,
          y: cursorY,
          size: BODY_FONT_SIZE,
          font: boldFont,
          color: BRAND_GREEN_DARK,
        });

        for (const bulletLine of bulletLines) {
          page.drawText(bulletLine, {
            x: PAGE_MARGIN + 14,
            y: cursorY,
            size: BODY_FONT_SIZE,
            font,
            color: TEXT_COLOR,
          });
          cursorY -= lineHeight(BODY_FONT_SIZE);
        }
        cursorY -= 2;
        continue;
      }

      drawWrappedText(line, PAGE_MARGIN, CONTENT_WIDTH, { font, afterGap: 2 });
    }
  }

  function drawSectionTitle(title: string) {
    ensureSpace(28);
    cursorY -= 4;
    page.drawText(title.toUpperCase(), {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 10,
      font: boldFont,
      color: BRAND_GREEN_DARK,
    });
    const labelWidth = boldFont.widthOfTextAtSize(title.toUpperCase(), 10);
    page.drawRectangle({
      x: PAGE_MARGIN + labelWidth + 10,
      y: cursorY + 4,
      width: Math.max(0, CONTENT_WIDTH - labelWidth - 10),
      height: 1.2,
      color: PANEL_BORDER,
    });
    cursorY -= 18;
  }

  function drawMetaCardGrid() {
    const items = [
      { label: copy.month, value: monthLabel },
      { label: copy.student, value: studentName },
      { label: copy.tutor, value: tutorName },
      { label: copy.published, value: publishedAtLabel },
    ];
    const gap = 12;
    const cardWidth = (CONTENT_WIDTH - gap) / 2;
    const cardHeight = 58;

    ensureSpace(cardHeight * 2 + gap + 8);

    for (const [index, item] of items.entries()) {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = PAGE_MARGIN + col * (cardWidth + gap);
      const y = cursorY - row * (cardHeight + gap) - cardHeight;

      page.drawRectangle({
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        color: BRAND_SURFACE,
        borderColor: PANEL_BORDER,
        borderWidth: 1,
      });

      page.drawText(item.label, {
        x: x + 12,
        y: y + cardHeight - 18,
        size: 9,
        font: boldFont,
        color: MUTED_TEXT,
      });

      const valueLines = wrapLine(item.value, cardWidth - 24, regularFont, 12);
      let valueY = y + cardHeight - 34;
      for (const line of valueLines.slice(0, 2)) {
        page.drawText(line, {
          x: x + 12,
          y: valueY,
          size: 12,
          font: regularFont,
          color: TEXT_COLOR,
        });
        valueY -= lineHeight(12);
      }
    }

    cursorY -= cardHeight * 2 + gap + 8;
  }

  function drawMetricCardGrid() {
    const metrics = [
      {
        label: copy.completedQuizzes,
        value: formatMetricProgressValue(
          report.metricsSnapshot.completedQuizzes,
          report.goalsSnapshot.monthlyQuizTarget,
        ),
      },
      {
        label: copy.completedLessons,
        value: formatMetricProgressValue(
          report.metricsSnapshot.completedLessons,
          report.goalsSnapshot.monthlyCompletedLessonsTarget,
        ),
      },
      {
        label: copy.newWords,
        value: formatMetricProgressValue(
          report.metricsSnapshot.newMasteryWords,
          report.goalsSnapshot.monthlyNewMasteryWordsTarget,
        ),
      },
      { label: copy.activeDays, value: `${report.metricsSnapshot.activeDays}` },
      {
        label: copy.practicedWords,
        value: `${report.metricsSnapshot.practicedWords}`,
      },
      {
        label: copy.averageScore,
        value: formatMetricProgressValue(
          report.metricsSnapshot.averageScore,
          report.goalsSnapshot.monthlyAverageScoreTarget,
          formatPercentage,
        ),
      },
    ];
    const gap = 12;
    const cardWidth = (CONTENT_WIDTH - gap) / 2;
    const cardHeight = 66;

    ensureSpace(cardHeight * 3 + gap * 2 + 6);

    for (const [index, metric] of metrics.entries()) {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = PAGE_MARGIN + col * (cardWidth + gap);
      const y = cursorY - row * (cardHeight + gap) - cardHeight;

      page.drawRectangle({
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        color: PANEL_FILL,
        borderColor: PANEL_BORDER,
        borderWidth: 1,
      });
      page.drawRectangle({
        x,
        y: y + cardHeight - 4,
        width: cardWidth,
        height: 4,
        color: BRAND_GREEN,
      });
      page.drawText(metric.label, {
        x: x + 12,
        y: y + cardHeight - 22,
        size: 9,
        font: boldFont,
        color: MUTED_TEXT,
      });
      page.drawText(metric.value, {
        x: x + 12,
        y: y + 18,
        size: 22,
        font: boldFont,
        color: TEXT_COLOR,
      });
    }

    cursorY -= cardHeight * 3 + gap * 2 + 6;
  }

  function drawBulletItems(items: string[]) {
    for (const item of items) {
      drawParagraph(`- ${item}`);
    }
  }

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 132,
    width: PAGE_WIDTH,
    height: 132,
    color: BRAND_GREEN,
  });
  page.drawText("VocabCrafter 2.0", {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 36,
    size: 12,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  page.drawText(copy.brandTag, {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 54,
    size: 10,
    font: regularFont,
    color: rgb(0.92, 0.97, 0.92),
  });
  page.drawText(copy.reportLabel, {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 82,
    size: 24,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  page.drawText(report.title, {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 108,
    size: 14,
    font: regularFont,
    color: rgb(0.92, 0.97, 0.92),
  });

  cursorY = PAGE_HEIGHT - 160;
  drawMetaCardGrid();

  drawSectionTitle(copy.planSnapshot);

  if (report.goalsSnapshot.planTitle) {
    drawWrappedText(
      `${copy.planTitle}: ${report.goalsSnapshot.planTitle}`,
      PAGE_MARGIN,
      CONTENT_WIDTH,
      {
        font: boldFont,
        fontSize: 12,
        afterGap: 4,
      },
    );
  }

  if (report.goalsSnapshot.goalSummary) {
    drawWrappedText(copy.goalSummary, PAGE_MARGIN, CONTENT_WIDTH, {
      font: boldFont,
      fontSize: 11,
      color: MUTED_TEXT,
      afterGap: 2,
    });
    drawParagraph(report.goalsSnapshot.goalSummary);
  }

  drawWrappedText(copy.objectives, PAGE_MARGIN, CONTENT_WIDTH, {
    font: boldFont,
    fontSize: 11,
    color: MUTED_TEXT,
    afterGap: 2,
  });
  if (report.goalsSnapshot.objectives.length > 0) {
    drawBulletItems(report.goalsSnapshot.objectives);
  } else {
    drawParagraph(copy.noObjectives);
  }

  drawWrappedText(copy.grammarTopics, PAGE_MARGIN, CONTENT_WIDTH, {
    font: boldFont,
    fontSize: 11,
    color: MUTED_TEXT,
    afterGap: 2,
  });
  if (report.goalsSnapshot.grammarTopicKeys.length > 0) {
    drawBulletItems(report.goalsSnapshot.grammarTopicKeys);
  } else {
    drawParagraph(copy.noGrammarTopics);
  }

  drawWrappedText(copy.reportLanguage, PAGE_MARGIN, CONTENT_WIDTH, {
    font: boldFont,
    fontSize: 11,
    color: MUTED_TEXT,
    afterGap: 2,
  });
  drawParagraph(getReportLanguageLabel(report.goalsSnapshot.reportLanguage));

  drawWrappedText(copy.targets, PAGE_MARGIN, CONTENT_WIDTH, {
    font: boldFont,
    fontSize: 11,
    color: MUTED_TEXT,
    afterGap: 2,
  });
  drawBulletItems([
    formatTargetLine(
      copy.completedQuizzes,
      report.metricsSnapshot.completedQuizzes,
      report.goalsSnapshot.monthlyQuizTarget,
      copy,
    ),
    formatTargetLine(
      copy.completedLessons,
      report.metricsSnapshot.completedLessons,
      report.goalsSnapshot.monthlyCompletedLessonsTarget,
      copy,
    ),
    formatTargetLine(
      copy.newWords,
      report.metricsSnapshot.newMasteryWords,
      report.goalsSnapshot.monthlyNewMasteryWordsTarget,
      copy,
    ),
    formatTargetLine(
      copy.averageScore,
      report.metricsSnapshot.averageScore,
      report.goalsSnapshot.monthlyAverageScoreTarget,
      copy,
      formatPercentage,
    ),
  ]);

  drawSectionTitle(copy.monthlyMetrics);
  drawMetricCardGrid();

  drawSectionTitle(copy.publishedReport);
  drawParagraph(report.publishedContent || copy.noPublishedContent);

  if (report.tutorAddendum) {
    drawSectionTitle(copy.tutorAddendum);
    drawParagraph(report.tutorAddendum, italicFont);
  }

  const pageCount = pages.length;

  for (const [pageIndex, pdfPage] of pages.entries()) {
    pdfPage.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: 16,
      color: MUTED_FILL,
    });
    const pageLabel = `${pageIndex + 1} / ${pageCount}`;
    const labelWidth = regularFont.widthOfTextAtSize(pageLabel, 9);
    pdfPage.drawText("VocabCrafter 2.0", {
      x: PAGE_MARGIN,
      y: 5,
      size: 9,
      font: boldFont,
      color: BRAND_GREEN_DARK,
    });
    pdfPage.drawText(pageLabel, {
      x: PAGE_WIDTH - PAGE_MARGIN - labelWidth,
      y: 5,
      size: 9,
      font: regularFont,
      color: MUTED_TEXT,
    });
  }

  return pdf.save();
}
