import { normalizeAppLanguage, type AppLanguage } from "./app-language";

const EN_MESSAGES = {
  common: {
    saveChanges: "Save Changes",
    saving: "Saving...",
    saved: "Saved!",
    previous: "Previous",
    next: "Next",
    languageNames: {
      en: "English",
      uk: "Ukrainian",
    },
  },
  settings: {
    title: "Settings",
    description: "Manage your account settings and interface language.",
    appLanguageLabel: "App Language",
    appLanguageDescription:
      "Choose whether the app interface is shown in English or Ukrainian.",
    appLanguagePlaceholder: "Select an app language",
  },
  nav: {
    dashboard: "Dashboard",
    myQuizzes: "My Quizzes",
    myClasses: "My Classes",
    lessons: "Lessons",
    assignments: "Assignments",
    progress: "Progress",
    vocabMastery: "Vocab Mastery",
    feedback: "Feedback",
    myTutors: "My Tutors",
    classes: "Classes",
    review: "Review",
    myStudents: "My Students",
    history: "History",
    passiveVocabulary: "Passive Vocabulary",
    analytics: "Analytics",
    users: "Users",
    grammarRules: "Grammar Rules",
    plans: "Plans",
    billing: "Billing",
    settings: "Settings",
  },
  quizzes: {
    title: "My Quizzes",
    description: "View and manage your vocabulary quizzes.",
    reviewActivity: "Review Activity",
    newQuiz: "New Quiz",
    noQuizzesTitle: "No quizzes yet",
    noQuizzesDescription:
      "Create your first quiz by pasting vocabulary words and letting AI generate activities for you.",
    createFirstQuiz: "Create Your First Quiz",
    removeReviewsButton: "Remove Reviews",
  },
  assignments: {
    title: "Assignments",
    tutorDescription: "Manage quiz assignments for your classes.",
    studentDescription: "Quizzes assigned to you by your tutors.",
    noAssignmentsTitle: "No assignments yet",
    noAssignmentsTutorDescription:
      "Create your first assignment by selecting a class and quiz.",
    noAssignmentsStudentDescription:
      "Your tutors haven't assigned any quizzes yet. Check back later!",
    noClassesJoinedTitle: "No classes joined",
    noClassesJoinedDescription:
      "Join a class first to see assignments from your tutors.",
    goToClasses: "Go to Classes",
    pastDue: "Past due",
    due: "Due",
    created: "Created",
    classLabel: "Class",
    quizLabel: "Quiz",
    done: "Done",
    start: "Start",
    retry: "Retry",
    createAssignmentButton: "Create Assignment",
  },
  lessons: {
    title: "Lessons",
    scheduleDescription:
      "View lessons month by month and keep tutor and student sessions in one calendar.",
    performanceDescription:
      "Tutor-only teaching analytics based on completed lessons from your schedule.",
    scheduleTab: "Schedule",
    performanceTab: "Performance",
    tutorOnlyBadge: "Tutor only",
    performanceYearBadge: "Year performance",
  },
  progress: {
    title: "Progress",
    description:
      "Track your learning profile, vocabulary growth, and quiz performance.",
    noProgressTitle: "No progress data yet",
    noProgressDescription:
      "Complete some quizzes to start tracking your learning progress and see your improvement over time.",
    createQuiz: "Create a Quiz",
    openVocabMastery: "Open Vocab Mastery",
  },
  pagination: {
    showing: "Showing",
    of: "of",
    previous: "Previous",
    next: "Next",
    page: "Page",
  },
};

export type AppMessages = typeof EN_MESSAGES;

const UK_MESSAGES: AppMessages = {
  common: {
    saveChanges: "Зберегти зміни",
    saving: "Збереження...",
    saved: "Збережено!",
    previous: "Назад",
    next: "Далі",
    languageNames: {
      en: "Англійська",
      uk: "Українська",
    },
  },
  settings: {
    title: "Налаштування",
    description: "Керуйте налаштуваннями акаунта та мовою інтерфейсу.",
    appLanguageLabel: "Мова застосунку",
    appLanguageDescription:
      "Оберіть, якою мовою показувати інтерфейс: англійською чи українською.",
    appLanguagePlaceholder: "Оберіть мову застосунку",
  },
  nav: {
    dashboard: "Панель",
    myQuizzes: "Мої вікторини",
    myClasses: "Мої класи",
    lessons: "Уроки",
    assignments: "Завдання",
    progress: "Прогрес",
    vocabMastery: "Засвоєння слів",
    feedback: "Відгук",
    myTutors: "Мої викладачі",
    classes: "Класи",
    review: "Перевірка",
    myStudents: "Мої студенти",
    history: "Історія",
    passiveVocabulary: "Пасивний словник",
    analytics: "Аналітика",
    users: "Користувачі",
    grammarRules: "Граматика",
    plans: "Тарифи",
    billing: "Оплата",
    settings: "Налаштування",
  },
  quizzes: {
    title: "Мої вікторини",
    description: "Переглядайте та керуйте своїми словниковими вікторинами.",
    reviewActivity: "Повторення",
    newQuiz: "Нова вікторина",
    noQuizzesTitle: "Поки немає вікторин",
    noQuizzesDescription:
      "Створіть першу вікторину, вставивши слова, а AI згенерує для вас вправи.",
    createFirstQuiz: "Створити першу вікторину",
    removeReviewsButton: "Видалити повторення",
  },
  assignments: {
    title: "Завдання",
    tutorDescription: "Керуйте призначеними вікторинами для своїх класів.",
    studentDescription: "Вікторини, які вам призначили викладачі.",
    noAssignmentsTitle: "Поки немає завдань",
    noAssignmentsTutorDescription:
      "Створіть перше завдання, обравши клас і вікторину.",
    noAssignmentsStudentDescription:
      "Ваші викладачі ще не призначили жодної вікторини. Загляньте пізніше!",
    noClassesJoinedTitle: "Ви ще не приєдналися до жодного класу",
    noClassesJoinedDescription:
      "Спочатку приєднайтеся до класу, щоб бачити завдання від викладачів.",
    goToClasses: "Перейти до класів",
    pastDue: "Прострочено",
    due: "До",
    created: "Створено",
    classLabel: "Клас",
    quizLabel: "Вікторина",
    done: "Виконано",
    start: "Почати",
    retry: "Спробувати ще раз",
    createAssignmentButton: "Створити завдання",
  },
  lessons: {
    title: "Уроки",
    scheduleDescription:
      "Переглядайте уроки помісячно та тримайте заняття викладача й студента в одному календарі.",
    performanceDescription:
      "Аналітика викладання для викладача на основі завершених уроків із вашого розкладу.",
    scheduleTab: "Розклад",
    performanceTab: "Ефективність",
    tutorOnlyBadge: "Лише для викладача",
    performanceYearBadge: "Статистика року",
  },
  progress: {
    title: "Прогрес",
    description:
      "Відстежуйте свій навчальний профіль, зростання словникового запасу та результати вікторин.",
    noProgressTitle: "Поки немає даних про прогрес",
    noProgressDescription:
      "Пройдіть кілька вікторин, щоб почати відстежувати свій прогрес і бачити покращення з часом.",
    createQuiz: "Створити вікторину",
    openVocabMastery: "Відкрити засвоєння слів",
  },
  pagination: {
    showing: "Показано",
    of: "із",
    previous: "Назад",
    next: "Далі",
    page: "Сторінка",
  },
};

const APP_MESSAGES: Record<AppLanguage, AppMessages> = {
  en: EN_MESSAGES,
  uk: UK_MESSAGES,
};

export function getAppMessages(appLanguage: unknown): AppMessages {
  return APP_MESSAGES[normalizeAppLanguage(appLanguage)];
}