import "server-only";

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
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
const MONTHLY_COMPARE_GOLD = rgb(0.83, 0.63, 0.09);
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
    objectives: string;
    grammarTopics: string;
    monthlyMetrics: string;
    monthlyPentagram: string;
    monthlyPentagramNote: string;
    publishedReport: string;
    reviewRating: string;
    noObjectives: string;
    noGrammarTopics: string;
    noPublishedContent: string;
    completedQuizzes: string;
    sentenceTranslations: string;
    gapFillExercises: string;
    completedLessons: string;
    classroomSessions: string;
    classroomTime: string;
    appLearningTime: string;
    studentSpeakingTime: string;
    studentSpeakingShare: string;
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
    objectives: "Objectives",
    grammarTopics: "Grammar focus topics",
    monthlyMetrics: "Monthly Metrics",
    monthlyPentagram: "Monthly Pentagram",
    monthlyPentagramNote:
      "Current month compared with the previous month using the same snapped report targets.",
    publishedReport: "Published Report",
    reviewRating: "Tutor Review",
    noObjectives: "No objectives listed.",
    noGrammarTopics: "No grammar topics selected.",
    noPublishedContent: "No published report content available.",
    completedQuizzes: "Completed quizzes",
    sentenceTranslations: "Sentence translation exercises",
    gapFillExercises: "Gap fill exercises",
    completedLessons: "Completed lessons",
    classroomSessions: "Classroom sessions",
    classroomTime: "Classroom time",
    appLearningTime: "App learning time",
    studentSpeakingTime: "Student speaking time",
    studentSpeakingShare: "Student speaking share",
    newWords: "New mastery words",
    activeDays: "Active days in application",
    practicedWords: "Words reviewed this month",
    trackedWords: "Words in vocabulary tracker",
    averageScore: "Average quiz score",
    noTarget: "no target set",
    targetVs: "vs target",
    onTarget: "on target",
    above: "above",
    below: "below",
    sectionHeadings: ["Summary", "Focus Areas", "Next Steps"],
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
    objectives: "Цілі",
    grammarTopics: "Граматичні теми у фокусі",
    monthlyMetrics: "Метрики за місяць",
    monthlyPentagram: "Місячна пентаграма",
    monthlyPentagramNote:
      "Поточний місяць порівняно з попереднім за тими самими цілями, які були зафіксовані у звіті.",
    publishedReport: "Опублікований звіт",
    reviewRating: "Оцінка викладача",
    noObjectives: "Цілі ще не додані.",
    noGrammarTopics: "Граматичні теми ще не вибрані.",
    noPublishedContent: "Опублікований текст звіту ще відсутній.",
    completedQuizzes: "Завершені вікторини",
    sentenceTranslations: "Вправи на переклад речень",
    gapFillExercises: "Вправи на заповнення пропусків",
    completedLessons: "Завершені уроки",
    classroomSessions: "Сесії в classroom",
    classroomTime: "Час у classroom",
    appLearningTime: "Час навчання в застосунку",
    studentSpeakingTime: "Час мовлення студента",
    studentSpeakingShare: "Частка мовлення студента",
    newWords: "Нові засвоєні слова",
    activeDays: "Активні дні в застосунку",
    practicedWords: "Слова, повторені цього місяця",
    trackedWords: "Слова у словниковому трекері",
    averageScore: "Середній бал",
    noTarget: "ціль не задана",
    targetVs: "проти цілі",
    onTarget: "у межах цілі",
    above: "вище",
    below: "нижче",
    sectionHeadings: ["Підсумок", "Зони уваги", "Наступні кроки"],
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

function formatHours(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }

  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours} h ${minutes} min`;
}

function formatStarRating(value: number | null) {
  if (value == null || !Number.isFinite(value) || value < 1) {
    return "No rating";
  }

  const rating = Math.max(1, Math.min(5, Math.round(value)));
  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
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

function getRadarPoint(
  centerX: number,
  centerY: number,
  radius: number,
  index: number,
  axisCount: number,
) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / axisCount;

  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
  };
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

  function drawWrappedTextBlock(
    text: string,
    x: number,
    y: number,
    width: number,
    {
      font = regularFont,
      fontSize = BODY_FONT_SIZE,
      color = TEXT_COLOR,
    }: {
      font?: PDFFont;
      fontSize?: number;
      color?: ReturnType<typeof rgb>;
    } = {},
  ) {
    let nextY = y;

    for (const line of wrapLine(text, width, font, fontSize)) {
      page.drawText(line, {
        x,
        y: nextY,
        size: fontSize,
        font,
        color,
      });
      nextY -= lineHeight(fontSize);
    }

    return nextY;
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
        value: formatNumber(report.metricsSnapshot.completedQuizzes, 0),
      },
      {
        label: copy.sentenceTranslations,
        value: formatMetricProgressValue(
          report.metricsSnapshot.completedSentenceTranslations,
          report.goalsSnapshot.monthlySentenceTranslationTarget,
        ),
      },
      {
        label: copy.gapFillExercises,
        value: formatMetricProgressValue(
          report.metricsSnapshot.completedGapFillExercises,
          report.goalsSnapshot.monthlyGapFillTarget,
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
        label: copy.classroomSessions,
        value: formatNumber(report.metricsSnapshot.classroomSessions, 0),
      },
      {
        label: copy.classroomTime,
        value: formatHours(report.metricsSnapshot.classroomHours),
      },
      {
        label: copy.appLearningTime,
        value: formatHours(report.metricsSnapshot.appLearningHours),
      },
      {
        label: copy.studentSpeakingTime,
        value: formatHours(report.metricsSnapshot.studentSpeakingHours),
      },
      {
        label: copy.studentSpeakingShare,
        value:
          report.metricsSnapshot.studentSpeakingShare == null
            ? "n/a"
            : formatPercentage(report.metricsSnapshot.studentSpeakingShare),
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
    const rows = Math.ceil(metrics.length / 2);

    ensureSpace(cardHeight * rows + gap * Math.max(rows - 1, 0) + 6);

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

    cursorY -= cardHeight * rows + gap * Math.max(rows - 1, 0) + 8;
  }

  function drawMonthlyPentagram(
    pentagram: NonNullable<StoredMonthlyReport["metricsSnapshot"]["monthlyPentagram"]>,
  ) {
    const panelHeight = 318;
    const panelY = cursorY - panelHeight;
    const chartX = PAGE_MARGIN + 18;
    const chartWidth = 270;
    const chartCenterX = chartX + chartWidth / 2;
    const chartCenterY = panelY + panelHeight / 2 - 6;
    const chartRadius = 86;
    const rightX = chartX + chartWidth + 24;
    const rightWidth = PAGE_MARGIN + CONTENT_WIDTH - rightX - 18;
    const currentLabel = formatMonthlyReportMonthLabel(
      pentagram.currentMonth.reportMonth,
      locale,
    );
    const previousLabel = formatMonthlyReportMonthLabel(
      pentagram.previousMonth.reportMonth,
      locale,
    );
    const axes = pentagram.currentMonth.axes;
    const axisCount = Math.max(axes.length, pentagram.previousMonth.axes.length, 0);

    ensureSpace(panelHeight + 8);

    page.drawRectangle({
      x: PAGE_MARGIN,
      y: panelY,
      width: CONTENT_WIDTH,
      height: panelHeight,
      color: BRAND_SURFACE,
      borderColor: PANEL_BORDER,
      borderWidth: 1,
    });

    if (axisCount > 0) {
      for (const ratio of [0.2, 0.4, 0.6, 0.8, 1]) {
        const gridPoints = Array.from({ length: axisCount }, (_, index) =>
          getRadarPoint(
            chartCenterX,
            chartCenterY,
            chartRadius * ratio,
            index,
            axisCount,
          ),
        );

        for (let index = 0; index < gridPoints.length; index += 1) {
          const point = gridPoints[index];
          const nextPoint = gridPoints[(index + 1) % gridPoints.length];

          page.drawLine({
            start: point,
            end: nextPoint,
            thickness: ratio === 1 ? 1.1 : 0.6,
            color: PANEL_BORDER,
          });
        }
      }

      for (let index = 0; index < axisCount; index += 1) {
        page.drawLine({
          start: { x: chartCenterX, y: chartCenterY },
          end: getRadarPoint(
            chartCenterX,
            chartCenterY,
            chartRadius,
            index,
            axisCount,
          ),
          thickness: 0.6,
          color: PANEL_BORDER,
        });
      }

      for (let index = 0; index < axisCount; index += 1) {
        const label =
          pentagram.currentMonth.axes[index]?.shortLabel ??
          pentagram.previousMonth.axes[index]?.shortLabel ??
          "";

        if (!label) {
          continue;
        }

        const labelPoint = getRadarPoint(
          chartCenterX,
          chartCenterY,
          chartRadius + 22,
          index,
          axisCount,
        );
        const labelWidth = boldFont.widthOfTextAtSize(label, 9);

        page.drawText(label, {
          x: labelPoint.x - labelWidth / 2,
          y: labelPoint.y - 4,
          size: 9,
          font: boldFont,
          color: MUTED_TEXT,
        });
      }

      const previousPoints = pentagram.previousMonth.chartData.map((item, index) =>
        getRadarPoint(
          chartCenterX,
          chartCenterY,
          chartRadius * (item.score / 100),
          index,
          axisCount,
        ),
      );
      const currentPoints = pentagram.currentMonth.chartData.map((item, index) =>
        getRadarPoint(
          chartCenterX,
          chartCenterY,
          chartRadius * (item.score / 100),
          index,
          axisCount,
        ),
      );

      for (let index = 0; index < previousPoints.length; index += 1) {
        page.drawLine({
          start: previousPoints[index],
          end: previousPoints[(index + 1) % previousPoints.length],
          thickness: 1.8,
          color: MONTHLY_COMPARE_GOLD,
        });
      }

      for (let index = 0; index < currentPoints.length; index += 1) {
        page.drawLine({
          start: currentPoints[index],
          end: currentPoints[(index + 1) % currentPoints.length],
          thickness: 2.4,
          color: BRAND_GREEN_DARK,
        });
      }
    }

    let rightY = panelY + panelHeight - 24;
    rightY =
      drawWrappedTextBlock(copy.monthlyPentagramNote, rightX, rightY, rightWidth, {
        fontSize: 10,
        color: MUTED_TEXT,
      }) - 10;

    page.drawRectangle({
      x: rightX,
      y: rightY - 3,
      width: 10,
      height: 10,
      color: BRAND_GREEN_DARK,
    });
    page.drawText(currentLabel, {
      x: rightX + 16,
      y: rightY,
      size: 10,
      font: boldFont,
      color: TEXT_COLOR,
    });
    rightY -= 18;

    page.drawRectangle({
      x: rightX,
      y: rightY - 3,
      width: 10,
      height: 10,
      color: MONTHLY_COMPARE_GOLD,
    });
    page.drawText(previousLabel, {
      x: rightX + 16,
      y: rightY,
      size: 10,
      font: regularFont,
      color: TEXT_COLOR,
    });
    rightY -= 24;

    const previousAxisMap = new Map(
      pentagram.previousMonth.axes.map((axis) => [axis.key, axis]),
    );

    for (const axis of pentagram.currentMonth.axes) {
      const previousAxis = previousAxisMap.get(axis.key);

      page.drawText(axis.label, {
        x: rightX,
        y: rightY,
        size: 10,
        font: boldFont,
        color: TEXT_COLOR,
      });

      const previousScore = `${previousAxis?.score ?? 0}`;
      const currentScore = `${axis.score}`;
      const currentWidth = boldFont.widthOfTextAtSize(currentScore, 11);
      const previousWidth = regularFont.widthOfTextAtSize(previousScore, 10);

      page.drawText(previousScore, {
        x: rightX + rightWidth - currentWidth - previousWidth - 16,
        y: rightY,
        size: 10,
        font: regularFont,
        color: MONTHLY_COMPARE_GOLD,
      });
      page.drawText("/", {
        x: rightX + rightWidth - currentWidth - 11,
        y: rightY,
        size: 10,
        font: regularFont,
        color: MUTED_TEXT,
      });
      page.drawText(currentScore, {
        x: rightX + rightWidth - currentWidth,
        y: rightY - 1,
        size: 11,
        font: boldFont,
        color: BRAND_GREEN_DARK,
      });

      rightY -= 20;
    }

    cursorY = panelY - 10;
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

  drawSectionTitle(copy.monthlyMetrics);
  drawMetricCardGrid();

  if (report.metricsSnapshot.monthlyPentagram) {
    drawSectionTitle(copy.monthlyPentagram);
    drawMonthlyPentagram(report.metricsSnapshot.monthlyPentagram);
  }

  drawSectionTitle(copy.publishedReport);
  drawParagraph(report.publishedContent || copy.noPublishedContent);

  if (report.reviewRating != null) {
    drawSectionTitle(copy.reviewRating);
    drawParagraph(formatStarRating(report.reviewRating), italicFont);
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
