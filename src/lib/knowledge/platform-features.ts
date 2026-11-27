import type { Role } from "@/types/roles";

export interface AppFeatureEntry {
  id: string;
  title: string;
  category: "schedule" | "exercises" | "vocabulary" | "classes" | "progress" | "billing" | "settings";
  roles: Role[];
  href: string;
  summary: string;
  howTo: string[];
  keywords: string[];
}

export const APP_FEATURE_REGISTRY: AppFeatureEntry[] = [
  // ─── 1. Lessons, Calendar & Google Meet ─────────────────────────
  {
    id: "lessons-calendar-meet",
    title: "Lesson Scheduling, Calendar & Google Meet",
    category: "schedule",
    roles: ["tutor", "student"],
    href: "/lessons",
    summary:
      "Manage monthly schedule, automated Google Calendar event synchronization, and instant 1-click Google Meet video room creation.",
    howTo: [
      "Open Schedule (/lessons) to view the monthly calendar.",
      "Tutors: click 'Add Lesson' to schedule single or recurring sessions with any connected student or as one-time lessons.",
      "Tutors: click 'Connect Google Calendar' in the sidebar to auto-generate Google Meet video links and sync invites directly to students' calendars.",
      "Students & Tutors: when a lesson is scheduled for today, click 'Join Google Meet' directly from the Dashboard banner or the Lessons calendar.",
    ],
    keywords: [
      "schedule",
      "calendar",
      "google meet",
      "meet",
      "video call",
      "lesson",
      "recurring",
      "gmeet",
      "invite",
      "attendee",
      "link",
      "календар",
      "розклад",
      "урок",
      "міт",
    ],
  },
  {
    id: "lesson-balances-and-pricing",
    title: "Student Lesson Balances & Prepaid Credits",
    category: "schedule",
    roles: ["tutor"],
    href: "/lessons/balance",
    summary:
      "Track prepaid lesson packages, individual hourly rates, log payments, and view real-time balance deductions upon completed lessons.",
    howTo: [
      "Go to Schedule (/lessons) -> click 'Lesson Balances' or open /lessons/balance.",
      "Set each student's lesson price (e.g. in UAH).",
      "Record payments when students purchase a lesson package (e.g. 5 or 10 lessons).",
      "Whenever a lesson is marked completed, the system automatically decrements their remaining lessons balance.",
    ],
    keywords: [
      "balance",
      "payment",
      "prepaid",
      "pricing",
      "credits",
      "uah",
      "package",
      "transactions",
      "баланс",
      "оплата",
      "вартість",
      "пакет",
    ],
  },

  // ─── 2. Quizzes & Interactive Practice ──────────────────────────
  {
    id: "quiz-creation",
    title: "AI Quiz & Exercise Generator",
    category: "exercises",
    roles: ["tutor", "student"],
    href: "/quizzes/new",
    summary:
      "Generate AI-powered language activities: Multiple Choice (MCQ), Gap-Fill exercises, Sentence Translation, Text Translation, Flashcards, and Discussion topics.",
    howTo: [
      "Open Quizzes (/quizzes) and click 'Create Quiz' or 'New Quiz'.",
      "Paste your vocabulary words or lesson notes, or use 'From Quiz' / library picker.",
      "Select your activity type (Gap-Fill, Sentence Translation, MCQ, Flashcards, etc.), CEFR level (A1–C2), and grammar focus.",
      "Click 'Generate' to create the tailored exercises instantly.",
    ],
    keywords: [
      "quiz",
      "create quiz",
      "gap-fill",
      "translation",
      "flashcards",
      "mcq",
      "discussion",
      "generator",
      "вікторина",
      "вправи",
      "тести",
      "створити",
    ],
  },
  {
    id: "mobile-student-exercise-launcher",
    title: "Mobile Quick Exercise Launcher (Screenshots & From Quiz)",
    category: "exercises",
    roles: ["student"],
    href: "/dashboard",
    summary:
      "On mobile devices, students can create custom Gap-Fill or Sentence Translation exercises on the fly by pasting words, attaching up to 3 textbook screenshots, or reusing terms from past quizzes.",
    howTo: [
      "On mobile, open the Dashboard (/dashboard).",
      "Tap 'Create Gap-Fill Exercise' or 'Create Sentence Translation'.",
      "Use 'Text / Images' tab to paste text or tap 'Add screenshot' to upload up to 3 textbook photos (up to 5MB each).",
      "Or switch to 'From Quiz' tab to pick specific words learned in previous sessions.",
      "Tap 'Generate' to start practicing right away.",
    ],
    keywords: [
      "mobile",
      "screenshot",
      "photo",
      "ocr",
      "camera",
      "gap-fill",
      "paste",
      "from quiz",
      "телефон",
      "скріншот",
      "фото",
    ],
  },
  {
    id: "exercise-ai-assistant",
    title: "AI Exercise Tutor (In-Exercise Assistant)",
    category: "exercises",
    roles: ["student", "tutor"],
    href: "/quizzes",
    summary:
      "A smart interactive tutor available during any exercise or review screen. Provides non-spoiling hints before answers are submitted, and thorough explanations after.",
    howTo: [
      "While playing any quiz or exercise, tap the floating 'Ask AI Tutor' button in the bottom right corner.",
      "Before submitting: AI operates in 'Hint Mode', guiding with grammar rules and clues without spoiling the exact answer.",
      "After submitting or in review: click 'Explain with AI' on any question card for a complete breakdown of why an answer is right or wrong, synonyms, and extra examples.",
    ],
    keywords: [
      "assistant",
      "ai tutor",
      "hint",
      "explain",
      "spoilers",
      "exercise help",
      "помічник",
      "підказка",
      "пояснення",
    ],
  },

  // ─── 3. Vocabulary & Spaced Repetition ──────────────────────────
  {
    id: "vocabulary-library",
    title: "Active & Passive Vocabulary Bank",
    category: "vocabulary",
    roles: ["tutor", "student"],
    href: "/vocabulary",
    summary:
      "Track every word encountered across lessons and reading materials. Categorized into Active production and Passive recognition.",
    howTo: [
      "Go to Vocabulary (/vocabulary).",
      "View all tracked words, CEFR levels, part-of-speech tags, and mastery statuses.",
      "Review due words that are ready for spaced-repetition practice.",
    ],
    keywords: [
      "vocabulary",
      "words",
      "active",
      "passive",
      "dictionary",
      "spaced repetition",
      "словник",
      "слова",
      "пасивний словник",
    ],
  },
  {
    id: "passive-vocabulary-import",
    title: "Passive Vocabulary Extraction from Text",
    category: "vocabulary",
    roles: ["tutor", "student"],
    href: "/passive-vocabulary",
    summary:
      "Paste any article, book excerpt, or video transcript to extract words you already recognize passively into your library.",
    howTo: [
      "Navigate to Passive Vocabulary (/passive-vocabulary or via Dashboard shortcut).",
      "Paste any foreign language text you understand when reading.",
      "AI identifies distinct vocabulary terms and adds them to your passive repertoire.",
    ],
    keywords: [
      "passive",
      "import",
      "extract",
      "text",
      "article",
      "reading",
      "імпорт",
      "пасивна лексика",
    ],
  },

  // ─── 4. Progress, Mastery & Analytics ───────────────────────────
  {
    id: "progress-and-hours",
    title: "CEFR Progress & Guided Hours Tracking",
    category: "progress",
    roles: ["student", "tutor"],
    href: "/progress",
    summary:
      "Visualizes total learning hours against Cambridge CEFR standards (approx. 200 guided hours per band), grammar coverage, and accuracy metrics.",
    howTo: [
      "Open Progress (/progress for students, or /results for tutors).",
      "View total study time tracked during quiz sessions and live lessons.",
      "Check your estimated progression across A1, A2, B1, B2, C1, and C2 milestones.",
    ],
    keywords: [
      "progress",
      "hours",
      "cefr",
      "cambridge",
      "stats",
      "analytics",
      "learning time",
      "прогрес",
      "години",
      "рівень",
      "статистика",
    ],
  },
  {
    id: "plans-and-monthly-reports",
    title: "Monthly Study Plans & Progress Reports",
    category: "progress",
    roles: ["tutor", "student"],
    href: "/progress",
    summary:
      "Inside the unified Progress hub (/results for tutors, /progress for students), tutors set monthly goals, track covered curriculum, and generate AI-assisted evaluation reports.",
    howTo: [
      "Open Progress (/results?tab=plan for tutors, or /progress?tab=plan for students).",
      "Select a connected student and configure their monthly plan, target goals, and unmastered grammar focus topics.",
      "Switch to the Reports tab (/results?tab=reports or /progress?tab=reports) to generate, publish, or download monthly PDF reports.",
    ],
    keywords: [
      "plan",
      "report",
      "monthly",
      "syllabus",
      "evaluation",
      "план",
      "звіт",
      "місячний звіт",
    ],
  },

  // ─── 5. Students & Classes Management ───────────────────────────
  {
    id: "student-management",
    title: "Student Roster & Invitations",
    category: "classes",
    roles: ["tutor"],
    href: "/students",
    summary:
      "Invite students via link/email, link student accounts, assign customized lesson rates, and monitor student profiles.",
    howTo: [
      "Open Students (/students).",
      "Click 'Invite Student' to generate a student connection link or send an invite.",
      "Once connected, customize their default lesson price, CEFR target, and learning settings.",
    ],
    keywords: [
      "students",
      "invite",
      "connect",
      "roster",
      "студенти",
      "запросити",
      "учні",
    ],
  },
  {
    id: "classes-and-groups",
    title: "Classes & Group Learning",
    category: "classes",
    roles: ["tutor", "student"],
    href: "/classes",
    summary:
      "Organize students into classes or cohorts for group assignments, announcements, and collaborative materials.",
    howTo: [
      "Open Classes (/classes).",
      "Create a class, add enrolled students, and publish assignments to the entire group at once.",
    ],
    keywords: [
      "classes",
      "groups",
      "cohorts",
      "speaking clubs",
      "класи",
      "групи",
    ],
  },

  // ─── 6. Customization & Settings ────────────────────────────────
  {
    id: "dashboard-customization",
    title: "Customizable Dashboard Cards",
    category: "settings",
    roles: ["tutor", "student"],
    href: "/dashboard",
    summary:
      "Personalize your home screen by showing, hiding, or rearranging quick-action cards that fit your daily workflow.",
    howTo: [
      "On the Dashboard (/dashboard), click 'Customize Dashboard' in the top action bar.",
      "Toggle cards on or off, or reorder widgets.",
      "Your preferences are saved automatically across devices.",
    ],
    keywords: [
      "customize",
      "dashboard",
      "cards",
      "layout",
      "widgets",
      "налаштування",
      "панель",
    ],
  },
  {
    id: "language-and-profile-settings",
    title: "App Language & Learning Preferences",
    category: "settings",
    roles: ["tutor", "student", "superadmin"],
    href: "/settings",
    summary:
      "Switch app interface language (English / Ukrainian), set your learning preferences, and update profile info.",
    howTo: [
      "Click your avatar in the top right header -> select 'Settings' (/settings).",
      "Switch between English and Ukrainian for the application UI.",
      "Update your display name, timezone, and study goals.",
    ],
    keywords: [
      "settings",
      "language",
      "ukrainian",
      "english",
      "profile",
      "timezone",
      "налаштування",
      "мова",
      "профіль",
    ],
  },
  {
    id: "tense-detector",
    title: "Interactive Tense Detector (Tutor Whiteboard)",
    category: "exercises",
    roles: ["tutor"],
    href: "/tense-detector",
    summary:
      "Interactive draggable timeline graph for tutors to demonstrate Past Perfect, Conditionals (1st/2nd/3rd/Mixed), Interrupted Continuous Actions, and Core Tenses live during lessons.",
    howTo: [
      "Open Tense Detector (/tense-detector) from the sidebar.",
      "Pick a topic module (Past Perfect & Sequence, Conditionals 3-2-1, Interrupted Action, or Core Tense Grid).",
      "Drag the color-coded ✕ markers along the timeline (or click any tick) to watch the arrows, tense formula, and all 3 example sentences update in real time.",
      "Toggle Presentation Mode for larger screen-share text or click Listen on any sentence.",
    ],
    keywords: [
      "tense detector",
      "timeline",
      "conditionals",
      "past perfect",
      "backshift",
      "grammar whiteboard",
      "continuous",
      "детектор часів",
      "часи",
      "умовні речення",
    ],
  },
  {
    id: "billing-and-usage",
    title: "AI Usage, Billing & Plans",
    category: "billing",
    roles: ["student", "tutor", "superadmin"],
    href: "/billing",
    summary:
      "Monitor monthly AI token consumption, active subscription tiers, and plan limits for quiz generation and audio TTS.",
    howTo: [
      "Go to Billing (/billing).",
      "View your current monthly AI usage breakdown across features.",
      "Manage or upgrade your subscription plan.",
    ],
    keywords: [
      "billing",
      "subscription",
      "plan",
      "ai calls",
      "tokens",
      "quota",
      "підписка",
      "тариф",
      "оплата",
    ],
  },
  {
    id: "admin-analytics-and-users",
    title: "Admin Analytics, Users & Grammar Rules",
    category: "settings",
    roles: ["superadmin"],
    href: "/analytics",
    summary:
      "Platform administration: view aggregate user statistics, user roles, and customize CEFR grammar topic definitions and system prompt overrides.",
    howTo: [
      "Open Analytics (/analytics) to view platform user activity.",
      "Open Users (/users) to manage roles and account statuses.",
      "Open Grammar Rules (/grammar-rules) to tune how AI tests specific grammar topics.",
    ],
    keywords: [
      "admin",
      "analytics",
      "users",
      "grammar rules",
      "адмін",
      "аналітика",
      "користувачі",
      "правила граматики",
    ],
  },
];

export function getFeaturesForRole(role: Role): AppFeatureEntry[] {
  return APP_FEATURE_REGISTRY.filter((entry) => entry.roles.includes(role));
}

export function searchPlatformFeatures(
  query: string,
  role: Role,
): AppFeatureEntry[] {
  const normalized = query.trim().toLowerCase();
  const available = getFeaturesForRole(role);

  if (!normalized) return available;

  return available.filter((feature) => {
    return (
      feature.title.toLowerCase().includes(normalized) ||
      feature.summary.toLowerCase().includes(normalized) ||
      feature.keywords.some((k) => k.toLowerCase().includes(normalized)) ||
      feature.howTo.some((h) => h.toLowerCase().includes(normalized))
    );
  });
}
