import { normalizeAppLanguage, type AppLanguage } from "./app-language";
import { formatPluralizedCount } from "./format";

const EN_MESSAGES = {
  common: {
    saveChanges: "Save Changes",
    saving: "Saving...",
    saved: "Saved!",
    save: "Save",
    back: "Back",
    cancel: "Cancel",
    remove: "Remove",
    removing: "Removing...",
    check: "Check",
    skip: "Skip",
    finish: "Finish",
    done: "Done",
    restart: "Restart",
    previous: "Previous",
    next: "Next",
    profile: "Profile",
    theme: "Theme",
    listen: "Listen",
    score: "Score",
    feedback: "Feedback",
    languageNames: {
      en: "English",
      uk: "Ukrainian",
    },
    roleNames: {
      student: "Student",
      tutor: "Tutor",
      superadmin: "Super Admin",
    },
    studyLanguageNames: {
      english: "English",
      spanish: "Spanish",
      ukrainian: "Ukrainian",
    },
  },
  settings: {
    title: "Settings",
    description: "Manage your account settings and interface language.",
    profileTitle: "Profile",
    profileDescription:
      "Update your personal information and study preferences.",
    fullNameLabel: "Full Name",
    fullNamePlaceholder: "Your full name",
    learningLanguageLabel: "Language You Are Learning",
    learningLanguagePlaceholder: "Select a learning language",
    sourceLanguageLabel: "Language You Learn From",
    sourceLanguagePlaceholder: "Select a source language",
    appLanguageLabel: "App Language",
    appLanguageDescription:
      "Choose whether the app interface is shown in English or Ukrainian.",
    appLanguagePlaceholder: "Select an app language",
    aiVoice: {
      label: "AI Voice",
      placeholder: "Select an AI voice",
      description: "Choose which Gemini voice is used for quiz audio playback.",
      previewTitle: (label: string) => `Preview ${label}`,
      previewFallbackBadge: "Voice sample",
      unsavedBadge: "Not saved yet",
      previewDescription: (language: string) =>
        `Hear how this voice sounds in ${language} before you save it.`,
      quickPreviewLabel: "Quick Preview",
      playPreview: "Play preview",
      previewNote:
        "Preview uses the selected voice immediately, even before saving. Each preview counts as a regular AI audio request.",
      voiceDescriptions: {
        Bright: "Bright",
        Upbeat: "Upbeat",
        Informative: "Informative",
        Firm: "Firm",
        Excitable: "Excitable",
        Youthful: "Youthful",
        Breezy: "Breezy",
        "Easy-going": "Easy-going",
        Breathy: "Breathy",
        Clear: "Clear",
        Smooth: "Smooth",
        Gravelly: "Gravelly",
        Soft: "Soft",
        Even: "Even",
        Mature: "Mature",
        Forward: "Forward",
        Friendly: "Friendly",
        Casual: "Casual",
        Gentle: "Gentle",
        Lively: "Lively",
        Knowledgeable: "Knowledgeable",
        Warm: "Warm",
      },
    },
    cefrLevelLabel: "Level (CEFR)",
    cefrLevelPlaceholder: "Select your level",
    cefrLevelDescription:
      "This determines quiz difficulty and available grammar topics. Spanish is currently limited to A1 for testing.",
    appearanceTitle: "Appearance",
    appearanceDescription:
      "Customize how VocabCrafter 2.0 looks on your device.",
    themeDescription: "Switch between light, dark, and system theme.",
  },
  header: {
    toggleMenu: "Toggle menu",
    navigation: "Navigation",
  },
  userMenu: {
    settings: "Settings",
    profile: "Profile",
    appLanguage: "App language",
    appLanguageUpdated: "App language updated",
    appLanguageUpdateFailed: "Failed to update app language",
    theme: "Theme",
    signOut: "Sign out",
  },
  nav: {
    dashboard: "Dashboard",
    myQuizzes: "My Quizzes",
    myClasses: "My Classes",
    lessons: "Lessons",
    assignments: "Assignments",
    progress: "Progress",
    plansAndReports: "Plans and reports",
    plan: "Plan",
    vocabMastery: "Vocab Mastery",
    feedback: "Feedback",
    myTutors: "My Tutors",
    classes: "Classes",
    review: "Review",
    myStudents: "My Students",
    results: "Results",
    history: "History",
    passiveVocabulary: "Passive Vocabulary",
    library: "Library",
    analytics: "Analytics",
    users: "Users",
    grammarRules: "Grammar Rules",
    plans: "Plans",
    billing: "Billing",
    settings: "Settings",
  },
  library: {
    title: "Library",
    grammarTab: "Grammar",
    dictionaryTab: "Dictionary",
    grammarDescription:
      "Browse the grammar topics currently available on the platform. This page is a read-only library for now.",
    dictionaryDescription:
      "Browse the shared dictionary built from passive vocabulary imports and future approved updates.",
    englishTopics: "English Topics",
    spanishTopics: "Spanish Topics",
    topicCount: (count: number) =>
      formatPluralizedCount("en", count, { one: "topic", other: "topics" }),
    futureDevelopment: "Reserved for future development",
    openArticle: "Open article",
    searchTopicsPlaceholder: "Search grammar topics",
    searchTopicsAriaLabel: "Search grammar topics",
    languageFilterLabel: "Language",
    levelFilterLabel: "Level",
    allLanguages: "All languages",
    allLevels: "All levels",
    noMatchingTopics: "No grammar topics match these filters.",
    editArticle: "Edit article",
    exitDeveloperMode: "Exit developer mode",
    developerModeTitle: "Developer mode",
    developerModeDescription:
      "Use the visual editor below to shape the article, then switch to raw JSON only when you need fine-grained control.",
    draftStatusLabel: "Draft content",
    publishedStatusLabel: "Published content",
    developerContentAvailable: "Available",
    developerContentMissing: "Not created yet",
    developerModeNextStep:
      "This editor now covers article structure, examples, and quiz content. Future iterations can add reordering and richer collaborative tools.",
    articleEditor: {
      heroTitle: "Shape the article visually",
      heroDescription:
        "Update the explanation, examples, and quiz through structured cards. JSON stays available for advanced edits.",
      visualTab: "Visual editor",
      jsonTab: "Raw JSON",
      statsSections: "Sections",
      statsExamples: "Examples",
      statsQuestions: "Quiz questions",
      overviewTitle: "Overview",
      overviewDescription:
        "Set the summary, formula, and note that frame the article.",
      summaryLabel: "Summary",
      noteLabel: "Note",
      sectionsTitle: "Explanation blocks",
      sectionsDescription:
        "Break the rule into clear chunks that the article can render as sections.",
      sectionLabel: "Section",
      sectionTitleLabel: "Section title",
      bulletLabel: "Bullet point",
      addSection: "Add section",
      addBullet: "Add bullet",
      examplesTitle: "Examples",
      examplesDescription:
        "Add sentence examples and optional notes for context.",
      exampleLabel: "Example",
      exampleSentenceLabel: "Sentence",
      exampleNoteLabel: "Note",
      addExample: "Add example",
      quizTitle: "Mini quiz builder",
      quizDescription:
        "Write one-question cards with answer options and explanations.",
      quizEmptyTitle: "No quiz yet",
      quizEmptyDescription:
        "Add a mini quiz when the article explanation is ready.",
      addQuiz: "Add quiz",
      removeQuiz: "Remove quiz",
      questionPromptLabel: "Question prompt",
      questionExplanationLabel: "Explanation",
      optionLabel: "Option",
      addQuestion: "Add question",
      addOption: "Add option",
      makeCorrect: "Mark correct",
      correctBadge: "Correct",
      jsonInvalid:
        "The JSON editor contains invalid content. Fix it before saving.",
    },
    editorJsonLabel: "Advanced JSON",
    editorJsonHelp:
      "Use this when you want to edit the raw article payload directly. The visual editor remains the default workflow.",
    saveDraft: "Save draft",
    publishArticle: "Publish article",
    resetEditor: "Reset editor",
    draftSaved: "Draft saved",
    articlePublished: "Article published",
    articleSaveFailed: "Failed to save article draft",
    articlePublishFailed: "Failed to publish article",
    backToGrammarLibrary: "Back to grammar library",
    formulaLabel: "Formula",
    customTopicBadge: "Custom",
    articleContentsTitle: "In this article",
    examplesTitle: "Examples",
    miniQuizTitle: "Mini quiz",
    explainAnswer: "Explain",
    checkAnswer: "Check answer",
    submitQuiz: "Submit",
    finishQuiz: "Finish quiz",
    resetQuiz: "Try again",
    correctAnswer: "Correct",
    correctOption: "Correct answer",
    tryAgain: "Not quite",
    questionLabel: "Question",
    answeredLabel: "Answered",
    scoreLabel: "Score",
    browseAllTopics: "Browse all topics",
    continueWithLevel: "Continue with this level",
    dictionaryPlaceholderTitle: "Dictionary workspace is next",
    dictionaryPlaceholderDescription:
      "The route shell is ready. The next step is wiring the shared passive dictionary browser and teacher suggestion workflow into this page.",
    dictionary: {
      allFilter: "All",
      unknownValue: "Unknown",
      pendingTutorSuggestionsTitle: "Pending tutor suggestions",
      pendingTutorSuggestionsDescription:
        "Review tutor-proposed dictionary updates before they touch the shared library.",
      noPendingTutorSuggestions:
        "No tutor suggestions are waiting for review right now.",
      suggestionCardTitle: (current: string, proposed: string) =>
        `${current} to ${proposed}`,
      suggestedBy: (name: string) => `Suggested by ${name}`,
      pendingStatus: "Pending",
      currentLabel: "Current",
      proposedLabel: "Proposed",
      noUkrainianTranslation: "No Ukrainian translation",
      cefrLabel: "CEFR",
      partOfSpeechLabel: "Part of speech",
      approveAction: "Approve",
      rejectAction: "Reject",
      approvedSuggestion: (term: string) => `Approved suggestion for ${term}`,
      rejectedSuggestion: (term: string) => `Rejected suggestion for ${term}`,
      approveSuggestionFailed: "Failed to approve suggestion",
      rejectSuggestionFailed: "Failed to reject suggestion",
      searchPlaceholder: "Search canonical terms",
      searchAriaLabel: "Search shared dictionary",
      searchAction: "Search",
      loadedItems: (count: number, query?: string) =>
        query
          ? `Loaded ${count} ${count === 1 ? "item" : "items"} for \"${query}\"`
          : `Loaded ${count} ${count === 1 ? "item" : "items"}`,
      retryLoadedNeedsReview: "Retry loaded needs review",
      repairingProgress: (completed: number, total: number) =>
        `Repairing ${completed}/${total}`,
      loadingItems: "Loading dictionary items...",
      loadingMoreItems: (count: number) =>
        `Loading ${count} more dictionary items...`,
      requestFailed: "The dictionary request failed. Try the search button again.",
      noFilteredItems:
        "No dictionary items match the current search and CEFR filter.",
      noItems: "No dictionary items yet.",
      termColumn: "Term",
      typeColumn: "Type",
      cefrColumn: "CEFR",
      statusColumn: "Status",
      updatedColumn: "Updated",
      actionsColumn: "Actions",
      pendingSuggestionBadge: "Pending suggestion",
      reEnrichAction: "Re-enrich",
      retryAiAction: "Retry AI",
      reEnrichedSuccess: (term: string) => `Re-enriched ${term}`,
      reEnrichedMerged: (term: string) =>
        `Re-enriched ${term} and merged it into the canonical lemma`,
      reEnrichFailed: "Failed to re-enrich passive vocabulary item",
      bulkRetrySuccess: (count: number) =>
        `Retried ${count} loaded ${count === 1 ? "item" : "items"}`,
      bulkRetryPartial: (successCount: number, failureCount: number) =>
        `Retried ${successCount} ${successCount === 1 ? "item" : "items"}; ${failureCount} still need review`,
      bulkRetryFailed: "None of the loaded items could be re-enriched",
      retryAction: "Retry",
      endOfList: "You've reached the end of the dictionary list.",
      suggestChangeAction: "Suggest Change",
      updateSuggestionAction: "Update Suggestion",
      suggestionDialogTitle: "Suggest dictionary change",
      suggestionDialogDescription:
        "Tutors can propose updates to the shared dictionary. A super admin must approve the suggestion before it changes the live library.",
      canonicalTermLabel: "Canonical term",
      ukrainianTranslationLabel: "Ukrainian translation",
      translationPlaceholder: "Add a concise Ukrainian dictionary equivalent",
      cefrLevelLabel: "CEFR level",
      additionalAttributesLabel: "Additional attributes JSON",
      noteLabel: "Why should this change be approved?",
      notePlaceholder: "Optional note for the super admin reviewer",
      submittingAction: "Submitting...",
      submitSuggestionAction: "Submit Suggestion",
      invalidAttributes: "Attributes must be a valid JSON object",
      updatedSuggestion: (term: string) => `Updated suggestion for ${term}`,
      submittedSuggestion: (term: string) => `Submitted suggestion for ${term}`,
      submitSuggestionFailed: "Failed to submit dictionary suggestion",
    },
  },
  quizzes: {
    title: "My Quizzes",
    description: "View and manage your vocabulary quizzes.",
    reviewActivity: "Review Activity",
    newQuiz: "New Quiz",
    typeLabels: {
      mcq: "Multiple Choice",
      flashcards: "Flashcards",
      gap_fill: "Fill in the Gap",
      translation: "Sentence Translation",
      text_translation: "Text Translation",
      discussion: "Live Discussion",
      matching: "Matching",
      translation_list: "Translation List",
    },
    card: {
      termCount: (count: number) =>
        `${count} ${count === 1 ? "term" : "terms"}`,
      deleteTitle: "Delete Quiz",
      deleteDescription: (title: string) =>
        `Are you sure you want to delete \"${title}\"? This action cannot be undone.`,
      deleteAction: "Delete",
      deleteAria: "Delete quiz",
      deleting: "Deleting...",
    },
    noQuizzesTitle: "No quizzes yet",
    noQuizzesDescription:
      "Create your first quiz by pasting vocabulary words and letting AI generate activities for you.",
    createFirstQuiz: "Create Your First Quiz",
    removeReviewsButton: "Remove Reviews",
    reviewRemoval: {
      title: "Remove Review Sessions",
      description: (count: number) =>
        `This will permanently delete ${formatPluralizedCount("en", count, { one: "saved review session", other: "saved review sessions" })} from My Quizzes, along with any attempts tied to ${count === 1 ? "it" : "them"}. This cannot be undone.`,
      emptyDescription: "There are no saved review sessions to remove.",
      success: (count: number) =>
        `Removed ${formatPluralizedCount("en", count, { one: "review session", other: "review sessions" })}.`,
      emptySuccess: "No review sessions to remove.",
      failed: "Failed to remove review sessions",
    },
  },
  createQuiz: {
    title: "Create New Quiz",
    steps: {
      input: "Input",
      edit: "Edit",
      activity: "Activity",
    },
    stepDescriptions: {
      input: "Add vocabulary words to get started.",
      edit: "Review and edit your parsed vocabulary list.",
      activity: "Choose an activity type for your quiz.",
    },
    addVocabularyTitle: "Add Vocabulary",
    tabs: {
      parseNew: "Parse New",
      savedWords: "Saved Words",
      fromQuiz: "From Quiz",
    },
    reviewTitle: "Review Vocabulary",
    reviewDescription:
      "Edit terms, fix translations, remove unwanted words, or add new ones.",
    saveToWordBank: "Save to Word Bank",
    saveWordBankTitle: "Save to Word Bank",
    saveWordBankDescription: (count: number) =>
      `Save these ${count} ${count === 1 ? "term" : "terms"} for reuse in future quizzes.`,
    bankNameLabel: "Bank Name",
    bankNamePlaceholder: "e.g., Unit 5 Vocabulary",
    chooseActivity: "Choose Activity",
    quizTitleLabel: "Quiz Title (optional)",
    quizTitlePlaceholder: "e.g., Unit 5 Vocabulary",
    activityLabels: {
      mcq: "Multiple Choice",
      flashcards: "Flashcards",
      gap_fill: "Fill in the Gap",
      translation: "Sentence Translation",
      text_translation: "Text Translation",
      discussion: "Live Discussion",
    },
    activityDescriptions: {
      mcq: "Answer multiple-choice questions with one correct option and three distractors.",
      flashcards: "Flip cards to memorize your terms and their meanings.",
      gap_fill: "Complete sentences with the correct vocabulary word.",
      translation:
        "Translate sentences using the vocabulary you are practicing.",
      text_translation:
        "Translate a short text and receive one overall full-text score.",
      discussion:
        "Generate CEFR-level prompts that naturally use your vocabulary for live speaking practice.",
    },
    difficultyLevel: "Difficulty Level",
    tutorDifficultyDescription: "Choose the CEFR difficulty for this quiz",
    studentDifficultyDescription:
      "Defaults to your profile level - override if needed",
    spanishLimitedNote: "Spanish is currently limited to A1.",
    cefrDescriptions: {
      A1: "Beginner",
      A2: "Elementary",
      B1: "Intermediate",
      B2: "Upper Intermediate",
      C1: "Advanced",
      C2: "Proficiency",
    },
    generateSelectedActivity: (activityLabel: string) =>
      `Generate ${activityLabel}`,
    generatingFlashcards: "Generating flashcards...",
    generatingQuiz: "Generating quiz...",
    fallbackActivityLabel: "Activity",
    defaultTitlePrefix: "Quiz",
    wordInput: {
      pasteVocabularyLabel: "Paste your vocabulary or notes",
      pasteHelper:
        "You can paste text directly, upload screenshots, or paste a screenshot from your clipboard.",
      addScreenshotsTitle: "Add screenshots",
      screenshotRules: (max: number, sizeMb: number) =>
        `PNG, JPEG, or WEBP. Up to ${max} screenshots, ${sizeMb} MB each.`,
      uploadScreenshots: "Upload Screenshots",
      screenshotLabel: (index: number) => `Screenshot ${index}`,
      removeScreenshot: "Remove screenshot",
      parsingVocabulary: "Parsing vocabulary...",
      parseWithAi: "Parse with AI",
      parseFailed: "Failed to parse words",
      attachLimitError: (max: number) =>
        `You can attach up to ${max} screenshots.`,
      invalidImageTypeError:
        "Only PNG, JPEG, and WEBP screenshots are supported.",
      screenshotSizeError: (sizeMb: number) =>
        `Each screenshot must be ${sizeMb} MB or smaller.`,
      screenshotReadError: "Failed to read screenshot",
      keepFirstScreenshots: (max: number) =>
        `Only the first ${max} screenshots were kept.`,
    },
    parsedWordList: {
      parsedCount: (count: number) =>
        `${count} ${count === 1 ? "term" : "terms"} parsed. Edit, remove, or add more below.`,
      addTermPlaceholder: "Add word...",
      addMeaningPlaceholder: "Add meaning...",
    },
    wordBankPicker: {
      loadFailed: "Failed to load saved word banks.",
      deleteFailed: "Failed to delete word bank.",
      emptyState:
        "No saved word banks yet. Parse new words and save them to create your first bank.",
      helperDescription: "Select a saved word bank to use its vocabulary.",
      bankMeta: (count: number, dateLabel: string) =>
        `${count} ${count === 1 ? "term" : "terms"} · ${dateLabel}`,
    },
    quizWordPicker: {
      loadFailed: "Failed to load quizzes.",
      emptyState:
        "No quizzes available yet. Create a quiz or complete an assigned quiz to reuse its vocabulary.",
      helperDescription:
        "Select one of your quizzes or a passed assignment quiz to reuse its vocabulary terms.",
      quizMeta: (count: number, dateLabel: string) =>
        `${count} ${count === 1 ? "term" : "terms"} · ${dateLabel}`,
      typeLabels: {
        flashcards: "Flashcards",
        gap_fill: "Gap Fill",
        translation: "Translation",
        mcq: "Multiple Choice",
        matching: "Matching",
        discussion: "Live Discussion",
        text_translation: "Text Translation",
        translation_list: "Translation List",
      },
    },
    grammarTopics: {
      title: "Grammar Focus",
      optional: "optional",
      selectedCount: (count: number) =>
        `${count} ${count === 1 ? "selected" : "selected"}`,
      description:
        "Select one grammar topic to focus on in the generated sentences.",
      clear: "Clear",
    },
  },
  quizSession: {
    header: {
      backToQuizzes: "Back",
    },
    unsupportedQuizType: (type: string) => `Unsupported quiz type: ${type}`,
    flashcardsResult: {
      title: "Flashcards Complete!",
      description: (known: number, total: number, percentage: number) =>
        `You knew ${known} of ${total} terms (${percentage}%).`,
      encouragementHigh: "Great job! You know most of these terms.",
      encouragementMedium: "Good progress! Keep practicing to improve.",
      encouragementLow: "Keep studying! Practice makes perfect.",
    },
    discussionResult: {
      title: "Live Discussion Complete!",
      description: (count: number) =>
        `You reviewed ${formatPluralizedCount("en", count, { one: "discussion prompt", other: "discussion prompts" })}.`,
      reopenPrompts: "Reopen Prompts",
    },
    results: {
      quizCompleteTitle: "Quiz Complete!",
      scored: (correct: number, total: number, percentage: number) =>
        `You scored ${correct} out of ${total} (${percentage}%)`,
      translationCompleteTitle: "Translation Complete!",
      averageScore: (score: number) => `Average score: ${score}/100`,
      textTranslationCompleteTitle: "Text Translation Complete!",
      scoreDescription: (score: number) => `Score: ${score}/100`,
      sentenceLabel: (index: number) => `Sentence ${index}`,
      yourAnswer: "Your answer",
      correctAnswer: "Correct",
      yourTranslation: "Your translation",
      referenceTranslation: (language: string) => `Reference (${language}):`,
      sourceSentence: (language: string) => `Source sentence (${language})`,
      sourceText: (language: string) => `Source text (${language})`,
      yourTranslationTitle: "Your translation",
    },
    mcq: {
      progress: (current: number, total: number) =>
        `Question ${current} of ${total}`,
      previousAria: "Previous question",
      nextAria: "Next question",
      score: (correct: number, completed: number) =>
        `Score: ${correct}/${completed}`,
      title: "Multiple choice",
      description: "Pick the best answer for this vocabulary question.",
      nextQuestion: "Next",
      reviewUnanswered:
        "Use the arrows to review unanswered questions before finishing.",
      correct: "Correct!",
      incorrect: (answer: string) =>
        `Not quite. The correct answer is: ${answer}`,
      selected: (answer: string) => `You selected ${answer}.`,
      skipped: "You skipped this question.",
    },
    gapFill: {
      progress: (current: number, total: number) =>
        `Question ${current} of ${total}`,
      previousAria: "Previous question",
      nextAria: "Next question",
      score: (correct: number, completed: number) =>
        `Score: ${correct}/${completed}`,
      title: "Fill in the blank",
      description: "Type the missing word to complete the sentence.",
      hint: (hint: string) => `Hint: ${hint}`,
      placeholder: "Type your answer...",
      nextQuestion: "Next",
      reviewUnanswered:
        "Use the arrows to review unanswered questions before finishing.",
      correct: "Correct!",
      incorrect: (answer: string) =>
        `Not quite. The correct answer is: ${answer}`,
    },
    translation: {
      progress: (current: number, total: number) =>
        `Sentence ${current} of ${total}`,
      previousAria: "Previous sentence",
      nextAria: "Next sentence",
      averageScore: (score: number) => `Avg Score: ${score}/100`,
      title: (language: string) => `Translate to ${language}`,
      grammarFocus: (topic: string) => `Grammar Focus: ${topic}`,
      placeholder: (language: string) =>
        `Type your ${language} translation... (Enter to submit, Shift+Enter for new line)`,
      evaluating: "Evaluating...",
      submit: "Submit Translation",
      showTranslation: "Show Translation (0/100)",
      retryEvaluation: "Retry Evaluation",
      evaluationFailed:
        "Could not evaluate your translation. Please try again.",
      referenceTranslation: (language: string) =>
        `Reference translation (${language}):`,
      hideLearningNote: "Hide learning note",
      revealLearningNote: "Reveal learning note",
      smallTranslation: "Small translation:",
      targetVocab: "Target vocab:",
      grammar: "Grammar:",
      nextSentence: "Next Sentence",
      viewResults: "View Results",
    },
    textTranslation: {
      progressLabel: "Passage translation",
      title: (language: string) => `Translate the text to ${language}`,
      placeholder: (language: string) =>
        `Write your ${language} translation here...`,
      evaluating: "Evaluating...",
      submit: "Submit Translation",
      retryEvaluation: "Retry Evaluation",
      evaluationFailed:
        "Could not evaluate your translation. Please try again.",
      referenceTranslation: (language: string) =>
        `Reference translation (${language}):`,
      viewResults: "View Results",
    },
    discussion: {
      title: "Live Discussion",
      agreeDisagree: "Agree / Disagree",
      openEnded: "Open-ended",
      targetVocab: (term: string) => `Target vocab: ${term}`,
      regenerating: "Regenerating...",
      regenerateQuestion: "Regenerate Question",
      noPrompts: "No discussion prompts were generated for this quiz.",
      finishSession: "Finish Session",
      missingTargetVocab:
        "Could not determine the target vocabulary for this prompt.",
      missingConfig:
        "This quiz is missing its generation config, so the prompt cannot be regenerated.",
      noRegeneratedPrompt: "No regenerated prompt was returned.",
      regenerateSuccess: (term: string) =>
        `Regenerated prompt for \"${term}\".`,
      regenerateFailed: "Failed to regenerate prompt",
      saveFailed: "Failed to save regenerated prompt",
    },
    flashcards: {
      progress: (current: number, total: number) =>
        `Card ${current} of ${total}`,
      remaining: (count: number) => `${count} remaining`,
      knowCount: (count: number) => `Know: ${count}`,
      learningCount: (count: number) => `Learning: ${count}`,
      frontAria: "Flashcard front. Press to reveal the translation.",
      backAria: "Flashcard back. Press to show the front.",
      stillLearning: "Still Learning",
      knowIt: "Know It",
      flipCard: "Flip Card",
      sessionCompleteTitle: "Session Complete!",
      sessionCompleteDescription: (
        known: number,
        total: number,
        learning: number,
      ) =>
        `You know ${known} of ${total} terms.${learning > 0 ? ` ${formatPluralizedCount("en", learning, { one: "term", other: "terms" })} still need practice.` : ""}`,
    },
  },
  dashboard: {
    welcomeBack: (name: string) => `Welcome back, ${name}`,
    roleDescriptions: {
      student: "Practice vocabulary, take quizzes, and track your progress.",
      tutor: "Manage your classes, assign quizzes, and review student work.",
      superadmin: "Monitor platform analytics and manage users.",
    },
    customize: {
      addCard: "Add Card",
      addCardsTitle: "Customize Dashboard",
      addCardsDescription:
        "Remove cards you do not need, bring them back any time, and drag unlocked cards into the order that fits your workflow.",
      hiddenCardDescription: "Add this card back to your dashboard.",
      addAction: "Add",
      cardOptions: "Card options",
      removeCard: "Remove card",
      lockCard: "Lock card",
      unlockCard: "Unlock card",
      dragToReorder: "Drag to reorder",
      noHiddenCards: "All available cards are already on your dashboard.",
    },
    student: {
      newQuizTitle: "New Quiz",
      newQuizDescription: "Generate a new AI-powered quiz",
      createQuizButton: "Create Quiz",
      reviewTitle: "Review Activity",
      reviewDescription: "Practice due and least known words",
      startReviewButton: "Start Review",
      passiveTitle: "Add Passive Recognition",
      passiveDescription: "Import words from text you already understand",
      passiveButton: "Add Passive Recognition",
      quizzesCreatedTitle: "Quizzes Created",
      remainingThisMonth: (count: number) => `${count} remaining this month`,
      unlimited: "Unlimited",
      dayStreakTitle: "Day Streak",
      consecutiveDays: (count: number) =>
        `${count} consecutive ${count === 1 ? "day" : "days"}`,
      totalWordsTitle: "Total Words Tracked",
      totalWordsDescription: "vocabulary terms in your library",
    },
    tutor: {
      newQuizTitle: "New Quiz",
      newQuizDescription: "Generate a new AI-powered quiz",
      createQuizButton: "Create Quiz",
      reviewTitle: "Review",
      reviewDescription: "Review student submissions",
      reviewButton: "Review Work",
      passiveTitle: "Import Passive Vocabulary",
      passiveDescriptionNone:
        "Connect a student first, then import text they already understand.",
      passiveDescriptionSingle:
        "Jump straight into passive-recognition import for your connected student.",
      passiveDescriptionMultiple:
        "Choose a connected student, then import text they already understand.",
      passiveButtonNone: "Connect Student First",
      passiveButtonSingle: "Import Passive Vocabulary",
      passiveButtonMultiple: "Choose Student",
      studentsTitle: "Students",
      enrolledStudents: "connected students",
      viewStudentsButton: "View Students",
      quizzesCreatedTitle: "Quizzes Created",
      remainingThisMonth: (count: number) => `${count} remaining this month`,
      unlimited: "Unlimited",
    },
    admin: {
      quizzesCreatedTitle: "Quizzes Created",
      createdThisMonth: (count: number) => `${count} created this month`,
      textRequestsTitle: "Text Requests",
      trackedInMonth: (month: string) => `tracked in ${month}`,
      ttsRequestsTitle: "TTS Requests",
      trackedCostTitle: "Tracked Cost",
      trackedRequestsInMonth: (count: number, month: string) =>
        `${count} tracked AI ${count === 1 ? "request" : "requests"} in ${month}`,
      totalUsersTitle: "Total Users",
      registeredUsers: "registered users",
      analyticsTitle: "Analytics",
      analyticsDescription: "Platform usage and metrics",
      viewAnalyticsButton: "View Analytics",
      usersTitle: "Users",
      usersDescription: "Manage platform users",
      manageUsersButton: "Manage Users",
    },
    guide: {
      buttonLabel: "How It Works",
      newBadge: "New",
      helperText: "One guided walkthrough for this dashboard.",
      closeGuide: "Close guide",
      close: "Close",
      back: "Back",
      next: "Next",
      finish: "Finish",
      stepOf: (step: number, total: number) => `Step ${step} of ${total}`,
      studentSteps: {
        newQuiz: {
          title: "New Quiz",
          description:
            "Open the quiz builder to generate a fresh AI activity set from your vocabulary list.",
        },
        reviewActivity: {
          title: "Review Activity",
          description:
            "Start a focused review round that queues overdue words first and then backfills with your weakest tracked words.",
        },
        quizzesCreated: {
          title: "Quizzes Created",
          description:
            "This mirrors your monthly quiz quota so you can see how many generations remain on your plan.",
        },
        dayStreak: {
          title: "Day Streak",
          description:
            "Your streak counts consecutive days with quiz activity and helps you track practice consistency.",
        },
        totalWords: {
          title: "Total Words Tracked",
          description:
            "This shows how many vocabulary terms are currently tracked in your learning library.",
        },
      },
      tutorSteps: {
        newQuiz: {
          title: "New Quiz Page",
          description:
            "Create AI-powered quiz sets that you can assign to classes or use for targeted practice.",
        },
        review: {
          title: "Review Page",
          description:
            "Inspect student attempts, score open-ended answers, and leave feedback where needed.",
        },
        students: {
          title: "Students Page",
          description:
            "Use this page to monitor your student roster and jump into individual learner context faster.",
        },
      },
      superadminSteps: {
        quizzesCreated: {
          title: "Quizzes Created",
          description:
            "This total tracks all quizzes ever generated on the platform, with the helper text showing how many were created this month.",
          hint: "Use Analytics when you want the creator-by-creator breakdown.",
        },
        textRequests: {
          title: "Text Requests",
          description:
            "This shows the current month's tracked text-generation requests using the same Gemini usage data and pricing basis as Billing.",
          hint: "Open Billing for token totals and the detailed pricing basis.",
        },
        ttsRequests: {
          title: "TTS Requests",
          description:
            "This card counts the current month's tracked text-to-speech requests and summarizes their estimated cost.",
          hint: "Billing shows the split between text input tokens and audio output tokens.",
        },
        trackedCost: {
          title: "Tracked Cost",
          description:
            "This combines the tracked text and TTS spend for the current month so you can see the platform's measured AI cost at a glance.",
          hint: "It only includes requests captured in ai_usage_events, not older legacy combined counters.",
        },
        totalUsers: {
          title: "Total Users",
          description:
            "This is the current number of registered users across the platform.",
          hint: "Use the Users page to inspect roles, onboarding state, and account changes.",
        },
      },
    },
  },
  assignments: {
    title: "Assignments",
    tutorDescription: "Manage quiz assignments for your classes.",
    studentDescription: "Quizzes assigned to you by your tutors.",
    reviewDescription: "Review student submissions and provide feedback.",
    assignmentsTab: "Assignments",
    reviewTab: "Review",
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
    balanceDescription:
      "Manage student lesson balances, top-ups, and lesson pricing in one place.",
    performanceDescription:
      "Tutor-only teaching analytics based on completed lessons from your schedule.",
    scheduleTab: "Schedule",
    balanceTab: "Balance",
    performanceTab: "Performance",
    tutorOnlyBadge: "Tutor only",
    performanceYearBadge: "Year performance",
  },
  progress: {
    title: "Progress",
    description:
      "Track your learning profile, vocabulary growth, and quiz performance.",
    overallTab: "Overall",
    monthlyTab: "Monthly",
    monthlyDescription:
      "Compare your completed quizzes and lessons across the last 30 days.",
    noProgressTitle: "No progress data yet",
    noProgressDescription:
      "Complete some quizzes to start tracking your learning progress and see your improvement over time.",
    noMonthlyActivityTitle: "No monthly activity yet",
    noMonthlyActivityDescription:
      "You do not have completed quizzes or lessons recorded in the last 30 days.",
    createQuiz: "Create a Quiz",
    openVocabMastery: "Open Vocab Mastery",
    completedQuizzes: "Completed quizzes",
    completedLessons: "Completed lessons",
    activeDays: "Active days",
    monthlyChartTitle: "Monthly activity mix",
    monthlyChartDescription: (startLabel: string, endLabel: string) =>
      `Completed quizzes and lessons from ${startLabel} to ${endLabel}.`,
  },
  studentFeedback: {
    title: "My Feedback",
    description: "Feedback from tutors on your quiz submissions",
    emptyTitle: "No feedback yet",
    emptyDescription:
      "Your tutors' feedback on your quiz submissions will appear here.",
    fromTutor: (name: string) => `From ${name}`,
    tutorFallback: "Tutor",
    quizFallback: "Quiz",
  },
  reviewPage: {
    title: "Review",
    description: "Review student submissions and provide feedback.",
    noClassesTitle: "No classes yet",
    noClassesDescription:
      "Create a class first so students can join and submit quiz attempts.",
    noStudentsTitle: "No students yet",
    noStudentsDescription:
      "Students will appear here once they join your classes and complete quizzes.",
    noQuizzesTitle: "No quizzes assigned",
    noQuizzesDescription:
      "Create assignments for your classes so student submissions appear here.",
    noSubmissionsTitle: "No submissions yet",
    noSubmissionsDescription:
      "Student quiz attempts will appear here once they start completing activities.",
    reviewed: "Reviewed",
    needsReview: "Needs Review",
    unknownStudent: "Unknown",
  },
  reviewDetail: {
    title: "Review Submission",
    backToReview: "Back to Review",
    unknownStudent: "Unknown Student",
    quizFallback: "Quiz",
    scoreBadge: (score: number) => `Score: ${score}%`,
    completedAt: (dateLabel: string) => `Completed ${dateLabel}`,
    rawScore: (score: number, maxScore: number) =>
      `Raw score: ${score} / ${maxScore}`,
    studentAnswers: "Student Answers",
    answerNumber: (index: number) => `Q${index}:`,
    answerLabel: "Answer",
    correctLabel: "Correct",
    correctBadge: "Correct",
    wrongBadge: "Wrong",
    flashcardKnown: (score: number, maxScore: number) =>
      `Flashcard session - ${score} of ${maxScore} cards marked as known.`,
    flashcardCompleted: "Flashcard session - completed.",
    previousFeedback: "Previous Feedback",
    tutorFallback: "Tutor",
    form: {
      title: "Leave Feedback",
      rating: "Rating (optional)",
      feedback: "Feedback",
      placeholder: "Write your feedback for the student...",
      submit: "Submit Feedback",
      submitting: "Submitting...",
      enterFeedback: "Please enter feedback",
      submitted: "Feedback submitted",
      submitFailed: "Failed to submit feedback",
    },
    translationResults: {
      title: "Translation Answers",
      currentOverall: (score: number) => `Current overall: ${score}/100`,
      itemLabel: "Translation item",
      save: "Save",
      saving: "Saving...",
      question: "Question",
      studentResponse: "Student Response",
      referenceAnswer: "Reference Answer",
      aiFeedback: "AI Feedback",
      updateSuccess: "Translation score updated",
      updateFailed: "Failed to update score",
    },
    gapFillResults: {
      title: "Gap Fill Answers",
      currentOverall: (score: number, maxScore: number) =>
        `Current overall: ${score}/${maxScore}`,
      itemLabel: "Gap-fill item",
      markCorrect: "Mark Correct",
      markWrong: "Mark Wrong",
      saving: "Saving...",
      updateSuccess: "Gap-fill result updated",
      updateFailed: "Failed to update gap-fill result",
    },
  },
  tutorProgressPage: {
    studentFallback: "Student",
    tutorFallback: "Tutor",
    backToStudents: "Back to My Students",
    tutorView: "Tutor Progress View",
    targetLabel: (level: string) => `Target ${level}`,
    description: (name: string) =>
      `Review ${name}'s computed learning profile, then curate your own coaching version of the radar metrics, AI suggestions, and progress comments.`,
    overviewDescription:
      "Review one connected student at a time with the same performance summary used in student progress reporting.",
    monthlyDescription:
      "Compare completed quizzes and lessons for one connected student across the last 30 days.",
    coachingDescription:
      "Curate tutor-specific radar adjustments, coaching notes, and progress reviews for one connected student.",
    overallTab: "Overall",
    monthlyTab: "Monthly",
    coachingTab: "Coaching",
    viewProgress: "View Progress",
    openCoachingWorkspace: "Open Coaching Workspace",
    openHistory: "Open History",
    monthlyPanelDescription: (name: string) =>
      `Track ${name}'s completed quizzes and lessons across the last 30 days.`,
    monthlyChartTitle: "Monthly activity mix",
    monthlyChartDescription: (startLabel: string, endLabel: string) =>
      `Completed quizzes and lessons from ${startLabel} to ${endLabel}.`,
    completedQuizzes: "Completed quizzes",
    completedLessons: "Completed lessons",
    activeDays: "Active days",
    noMonthlyActivityTitle: "No monthly activity yet",
    noMonthlyActivityDescription:
      "This student has no completed quizzes or lessons recorded in the last 30 days.",
    sourceLabel: (language: string) => `Source ${language}`,
    progressReviewsTitle: "Progress Reviews & Comments",
    progressReviewsDescription: (name: string) =>
      `Tutors can leave progress reviews, coaching notes, and comments about how ${name} is developing over time.`,
    noProgressReviews: "No progress reviews yet.",
    noRawDataTitle: "No raw progress data yet",
    noRawDataDescription:
      "This student has not built enough quiz or vocabulary history to populate the raw overview cards yet.",
    avgScore: "Avg Score",
    avgMastery: "Avg Mastery",
    outOfFive: "out of 5 mastery levels",
    dayStreak: "Day Streak",
    consecutiveDays: (count: number) =>
      formatPluralizedCount("en", count, {
        one: "consecutive day",
        other: "consecutive days",
      }),
    uniqueWords: "Unique Words",
    masteredWords: (count: number) =>
      formatPluralizedCount("en", count, {
        one: "mastered word",
        other: "mastered words",
      }),
    grammarTopics: "Grammar Topics",
    passiveEvidence: "Passive Evidence",
    passiveEvidenceDescription: "words and phrases tracked as recognition only",
    equivalentWords: "Equivalent Words",
    equivalentWordsDescription:
      "level-adjusted recognition-weighted total used in passive-vocabulary estimates",
    whatItMeans: "What It Means",
    passiveExplanation:
      "Equivalent words is the recognition-weighted single-word total used by passive-vocabulary estimates. Words at or below the student's current level count fully. Higher-level words count partially until the learner's overall profile catches up.",
    passiveVocabularyTitle: "Passive Vocabulary",
    passiveVocabularyDescription: (name: string) =>
      `Import passive-recognition evidence and review the latest library-tagged passive words on the dedicated passive-vocabulary page for ${name}.`,
    passiveItems: (count: number) =>
      `${count} ${formatPluralizedCount("en", count, { one: "passive item", other: "passive items" })}`,
    equivalentWordsBadge: (count: number) =>
      `${count} ${formatPluralizedCount("en", count, { one: "equivalent word", other: "equivalent words" })}`,
    openPassiveVocabulary: "Open Passive Vocabulary",
  },
  tutorPlansReportsPage: {
    title: "Plans and reports",
    description:
      "Manage one connected student's learning plan and monthly reports from a single workspace.",
    plansTab: "Plans",
    reportsTab: "Reports",
    plansDescription:
      "Review and update one connected student's learning plan.",
    reportsDescription:
      "Generate, edit, and export one connected student's monthly reports.",
    planPanelDescription: (name: string) =>
      `Review and update ${name}'s goals, grammar focus, and monthly targets.`,
    reportsPanelDescription: (name: string) =>
      `Generate, edit, and export ${name}'s monthly reports from one place.`,
    noStudentTitle: "No student selected",
    noStudentDescription:
      "Connect a student first, then choose them here to open their plans and reports workspace.",
    studentSpecificNotice:
      "Plans and reports is student-specific, so this page always shows one learner at a time.",
  },
  studentPlansReportsPage: {
    title: "Plans and reports",
    description:
      "Review the learning plans and monthly reports your tutors share with you.",
    plansDescription:
      "Review the goals, objectives, grammar focus, and monthly targets your tutors set for you.",
    reportsDescription:
      "Read and download the monthly reports your tutors publish for you.",
    noPlansTitle: "No plans available yet",
    noPlansDescription:
      "Your connected tutors can publish a plan for you once they set goals and objectives.",
    noReportsTitle: "No monthly reports yet",
    noReportsDescription:
      "Monthly reports will appear here after your tutor publishes them.",
  },
  adminUsers: {
    title: "Users",
    description: "Manage platform users, roles, and permissions.",
    summaryTitles: {
      students: "Students",
      tutors: "Tutors",
      admins: "Admins",
    },
    allUsers: (count: number) => `All Users (${count})`,
    noUsersFound: "No users found.",
    columns: {
      name: "Name",
      email: "Email",
      role: "Role",
      changeRole: "Change Role",
      articleEditor: "Article editor",
      cefr: "CEFR",
      quizzes: "Quizzes",
      attempts: "Attempts",
      onboarded: "Onboarded",
      joined: "Joined",
    },
    roleLabels: {
      student: "Student",
      tutor: "Tutor",
      superadmin: "Admin",
    },
    yes: "Yes",
    no: "No",
    roleUpdated: (role: string) => `Role updated to ${role}`,
    roleUpdateFailed: "Failed to update role",
    cefrUpdated: (level: string) => `CEFR updated to ${level}`,
    cefrUpdateFailed: "Failed to update CEFR level",
    articleEditorGranted: "Article editor access granted",
    articleEditorRevoked: "Article editor access revoked",
    articleEditorUpdateFailed: "Failed to update article editor access",
    articleEditorGrantedLabel: "Granted",
    articleEditorRevokedLabel: "Not granted",
  },
  tutorMastery: {
    title: "Student Vocab Mastery",
    description:
      "See how well your students know their vocabulary across all classes, including passive evidence imported from text they already understand.",
    noClassesTitle: "No classes yet",
    noClassesDescription:
      "Create a class and invite students to see their vocabulary mastery here.",
    noStudentsTitle: "No students enrolled",
    noStudentsDescription:
      "Your students will appear here once they join a class.",
    studentOverviewTitle: "Student Overview",
    studentOverviewDescription:
      "Student summaries load first. Expand a student to load their words. Equivalent words is the single-word total from passive evidence used in passive-vocabulary estimates.",
    unknownStudent: "Unknown",
    levelLabels: {
      new: "New",
      seen: "Seen",
      learning: "Learning",
      familiar: "Familiar",
      practiced: "Practiced",
      mastered: "Mastered",
    },
    cards: {
      noStudentsOnPage: "No students found on this page.",
      summaryLine: (totalWords: number, avgLevel: number) =>
        `${formatPluralizedCount("en", totalWords, { one: "word", other: "words" })} · avg level ${avgLevel}`,
      passiveSummary: (passiveEvidenceCount: number, equivalentWords: number) =>
        `${passiveEvidenceCount} passive evidence · ${formatPluralizedCount("en", equivalentWords, { one: "equivalent word", other: "equivalent words" })}`,
      activeSummary: (activeEvidenceCount: number, totalUses: number) =>
        `${formatPluralizedCount("en", activeEvidenceCount, { one: "active evidence word", other: "active evidence words" })} · ${totalUses} total uses`,
      showDetails: "Show details",
      hideDetails: "Hide details",
      noWordsYet: "No words yet",
      loadingDetails: "Loading details...",
      retry: "Retry",
      noWordsFound: "No words found.",
      masteryWordsTitle: "Mastery words",
      activeEvidenceTitle: "Active evidence",
      noActiveEvidence: "No active evidence yet.",
      wordsCount: (count: number) =>
        `${count} ${formatPluralizedCount("en", count, { one: "word", other: "words" })}`,
      deleteTitle: "Delete word for student",
      deleteDescription: (term: string) =>
        `${term} will be removed from this student's Vocab Mastery list.`,
      deleteSuccess: (term: string) =>
        `Deleted ${term} from the student's Vocab Mastery list`,
    },
  },
  plans: {
    title: "Plans",
    description:
      "Compare plan limits, understand how each quota works, and review what counts toward usage.",
    currentBadge: "Current",
    popularBadge: "Popular",
    freePrice: "Free",
    perMonth: "/ month",
    usageLabels: {
      aiCalls: "AI calls",
      reports: "Reports",
      quizzes: "Quizzes",
      attempts: "Attempts",
      wordBanks: "Word banks",
    },
    planNames: {
      free: "Free",
      pro: "Pro",
      premium: "Premium",
    },
    planDescriptions: {
      free: "Core practice tools for learners getting started.",
      pro: "Higher monthly limits for regular learners and tutors.",
      premium: "Generous AI capacity and open-ended practice limits.",
    },
    features: {
      aiCalls: (limit: string) => `${limit} AI calls / month`,
      reports: (limit: string) => `${limit} AI reports / month`,
      noReports: "No AI report generation",
      unlimitedQuizzesAttempts: "Unlimited quizzes & attempts",
      quizzes: (limit: string) => `Create up to ${limit} quizzes`,
      unlimitedQuizzes: "Unlimited quizzes",
      attempts: (limit: string) => `${limit} quiz attempts`,
      unlimitedAttempts: "Unlimited quiz attempts",
      wordBanks: (limit: string) => `${limit} word banks`,
      unlimitedWordBanks: "Unlimited word banks",
      extra: {
        allQuizTypes: "All quiz types",
        communitySupport: "Community support",
        priorityAiGeneration: "Priority AI generation",
        detailedAnalytics: "Detailed analytics",
        emailSupport: "Email support",
        customGrammarTopics: "Custom grammar topics",
        prioritySupport: "Priority support",
        earlyAccess: "Early access to new features",
      },
    },
    limitDetails: {
      price: {
        title: "Monthly Price",
        description:
          "The subscription amount charged per month for the plan. Free plans cost $0.",
        extra:
          "This page describes plan limits only. Actual payment collection can still be wired separately.",
      },
      aiCalls: {
        title: "AI Calls",
        description:
          "One AI call is one completed Gemini request made by the app.",
        extra:
          "This includes generating quizzes, parsing pasted vocabulary, evaluating translation answers, building Review Activity quizzes, and server-side text-to-speech generation. Replaying already cached audio in the browser does not consume a new AI call.",
      },
      reports: {
        title: "AI Reports",
        description:
          "How many long-form student progress reports can be generated in one calendar month.",
        extra:
          "These reports are intended to use a stronger model with larger prompts and better reasoning, so the limit is kept separate from regular AI calls.",
      },
      quizzes: {
        title: "Quizzes Created",
        description:
          "How many quizzes a user can create in one calendar month.",
        extra:
          "Saved Review Activity sessions count as quizzes because they are stored in the quizzes table.",
      },
      attempts: {
        title: "Quiz Attempts",
        description:
          "How many completed quiz submissions a user can make in one calendar month.",
        extra:
          "Opening a quiz does not count by itself. An attempt is counted when a completed submission is saved.",
      },
      wordBanks: {
        title: "Word Banks",
        description:
          "How many saved word-bank collections a user can keep at once.",
        extra:
          "Vocabulary imported directly into mastery is separate from word banks and does not count toward this limit.",
      },
    },
    howLimitsWorkTitle: "How Limits Work",
    howLimitsWorkDescription:
      "Hover the info icons on plan cards for quick definitions, or use the detailed breakdown below.",
    editor: {
      title: "Configure Plan Limits",
      description:
        "Update plan numbers here. Changes affect quota checks, dashboard limits, and plan comparison cards.",
      monthlyPrice: "Monthly price",
      aiCallsPerMonth: "AI calls / month",
      reportsPerMonth: "Reports / month",
      quizzesPerMonth: "Quizzes / month",
      attemptsPerMonth: "Attempts / month",
      wordBanks: "Word banks",
      reportsPlaceholder: "0 disables reports",
      unlimitedPlaceholder: "Leave blank for unlimited",
      helperText:
        "Leave quizzes, attempts, or word banks blank to keep them unlimited for this plan. Set reports to 0 to disable report generation.",
      save: "Save Limits",
      saving: "Saving...",
      saved: (plan: string) => `${plan} plan limits saved`,
      saveFailed: "Failed to save plan limits",
      required: (label: string) => `${label} is required`,
      wholeNumber: (label: string) =>
        `${label} must be a whole number of 0 or more`,
    },
  },
  billing: {
    title: "Billing & Usage",
    userDescription: "Your current plan and quota usage this month.",
    adminDescription: "Platform-wide usage metrics and AI cost tracking.",
    usageTab: "Usage",
    plansTab: "Plans",
    openPlans: "Open Plans",
    currentPlanTitle: (plan: string) => `${plan} Plan`,
    freeBadge: "Free",
    paidBadge: (price: number) => `$${price}/mo`,
    freePlanDescription:
      "You are on the Free tier - all core features included.",
    subscribedDescription: (plan: string) =>
      `You are subscribed to the ${plan} plan.`,
    usageTitles: {
      aiCalls: "AI Calls",
      quizzesCreated: "Quizzes Created",
      quizAttempts: "Quiz Attempts",
      wordBanks: "Word Banks",
      textRequests: "Text Requests",
      ttsRequests: "TTS Requests",
      trackedAiCost: "Tracked AI Cost",
      unallocatedCalls: "Unallocated Calls",
    },
    remaining: (count: string) => `${count} remaining`,
    remainingThisMonth: (count: string) => `${count} remaining this month`,
    unlimited: "Unlimited",
    platformDescriptions: {
      aiCalls: (month: string) => `${month} across all users`,
      quizzesCreated: (count: string) => `${count} created this month`,
      quizAttempts: (count: string) => `${count} completed this month`,
      wordBanks: "Currently saved across all users",
    },
    platformAiUsageTitle: "Platform AI Usage",
    platformAiUsageDescription: (
      textModel: string,
      ttsModel: string,
      month: string,
    ) =>
      `Paid-tier estimates for ${textModel} text generation and ${ttsModel} text-to-speech in ${month}`,
    loadFailedTitle: "Platform AI Usage",
    loadFailedDescription:
      "Unable to load Gemini paid-tier usage estimates right now.",
    textRequestsSummary: (cost: string, input: string, output: string) =>
      `${cost} approx. - ${input} input / ${output} output tokens`,
    ttsRequestsSummary: (cost: string, input: string, output: string) =>
      `${cost} approx. - ${input} text input / ${output} audio output tokens`,
    trackedCostSummary: (count: string, month: string) =>
      `${count} tracked requests in ${month}`,
    unallocatedCallsOld:
      "Older combined calls this month, excluded from the split estimates",
    unallocatedCallsNone: "No pre-tracking calls left unallocated this month",
    pricingBasisTitle: "Pricing Basis",
    pricingBasisDescription:
      "Official Google AI paid-tier pricing for the models currently used in this app",
    inputTokensPrice: (cost: string) => `${cost} per 1M input tokens`,
    outputTokensPrice: (cost: string) => `${cost} per 1M output tokens`,
    inputTextTokensPrice: (cost: string) => `${cost} per 1M input text tokens`,
    outputAudioTokensPrice: (cost: string) =>
      `${cost} per 1M output audio tokens`,
    estimationNote: (audioTokensPerSecond: number) =>
      `Text requests use Gemini response token metadata. If Gemini omits TTS audio token details, output audio is approximated from duration at ${audioTokensPerSecond} audio tokens per second.`,
    estimatedRequests: (count: number) =>
      `${count} tracked ${formatPluralizedCount("en", count, { one: "request uses", other: "requests use" })} fallback estimation this month.`,
    legacyCombinedCalls: (month: string, count: string) =>
      `Detailed text-vs-TTS tracking started after some ${month} AI usage had already been counted, so ${count} earlier combined calls cannot be split across the two model cards.`,
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
    save: "Зберегти",
    back: "Назад",
    cancel: "Скасувати",
    remove: "Видалити",
    removing: "Видаляємо...",
    check: "Перевірити",
    skip: "Пропустити",
    finish: "Завершити",
    done: "Готово",
    restart: "Почати спочатку",
    previous: "Назад",
    next: "Далі",
    profile: "Профіль",
    theme: "Тема",
    listen: "Слухати",
    score: "Оцінка",
    feedback: "Відгук",
    languageNames: {
      en: "Англійська",
      uk: "Українська",
    },
    roleNames: {
      student: "Студент",
      tutor: "Викладач",
      superadmin: "Суперадмін",
    },
    studyLanguageNames: {
      english: "Англійська",
      spanish: "Іспанська",
      ukrainian: "Українська",
    },
  },
  settings: {
    title: "Налаштування",
    description: "Керуйте налаштуваннями акаунта та мовою інтерфейсу.",
    profileTitle: "Профіль",
    profileDescription:
      "Оновіть особисту інформацію та навчальні налаштування.",
    fullNameLabel: "Повне ім'я",
    fullNamePlaceholder: "Ваше повне ім'я",
    learningLanguageLabel: "Мова, яку ви вивчаєте",
    learningLanguagePlaceholder: "Оберіть мову навчання",
    sourceLanguageLabel: "Мова, з якої ви вивчаєте",
    sourceLanguagePlaceholder: "Оберіть мову-джерело",
    appLanguageLabel: "Мова застосунку",
    appLanguageDescription:
      "Оберіть, якою мовою показувати інтерфейс: англійською чи українською.",
    appLanguagePlaceholder: "Оберіть мову застосунку",
    aiVoice: {
      label: "Голос AI",
      placeholder: "Оберіть голос AI",
      description: "Оберіть голос Gemini для відтворення аудіо у вікторинах.",
      previewTitle: (label: string) => `Прослухати ${label}`,
      previewFallbackBadge: "Зразок голосу",
      unsavedBadge: "Ще не збережено",
      previewDescription: (language: string) =>
        `Прослухайте, як цей голос звучить мовою ${language}, перш ніж зберегти його.`,
      quickPreviewLabel: "Швидкий приклад",
      playPreview: "Відтворити приклад",
      previewNote:
        "Попереднє прослуховування одразу використовує вибраний голос, навіть до збереження. Кожен приклад рахується як звичайний AI-запит на аудіо.",
      voiceDescriptions: {
        Bright: "Яскравий",
        Upbeat: "Жвавий",
        Informative: "Інформативний",
        Firm: "Упевнений",
        Excitable: "Енергійний",
        Youthful: "Молодий",
        Breezy: "Легкий",
        "Easy-going": "Невимушений",
        Breathy: "З придихом",
        Clear: "Чіткий",
        Smooth: "Плавний",
        Gravelly: "Хриплуватий",
        Soft: "М'який",
        Even: "Рівний",
        Mature: "Зрілий",
        Forward: "Сміливий",
        Friendly: "Дружній",
        Casual: "Невимушений",
        Gentle: "Ніжний",
        Lively: "Жвавий",
        Knowledgeable: "Компетентний",
        Warm: "Теплий",
      },
    },
    cefrLevelLabel: "Рівень (CEFR)",
    cefrLevelPlaceholder: "Оберіть свій рівень",
    cefrLevelDescription:
      "Це визначає складність вікторин і доступні граматичні теми. Іспанська наразі обмежена рівнем A1 для тестування.",
    appearanceTitle: "Вигляд",
    appearanceDescription:
      "Налаштуйте вигляд VocabCrafter 2.0 на своєму пристрої.",
    themeDescription: "Перемикайте світлу, темну або системну тему.",
  },
  header: {
    toggleMenu: "Відкрити меню",
    navigation: "Навігація",
  },
  userMenu: {
    settings: "Налаштування",
    profile: "Профіль",
    appLanguage: "Мова застосунку",
    appLanguageUpdated: "Мову застосунку оновлено",
    appLanguageUpdateFailed: "Не вдалося оновити мову застосунку",
    theme: "Тема",
    signOut: "Вийти",
  },
  nav: {
    dashboard: "Панель",
    myQuizzes: "Мої вікторини",
    myClasses: "Мої класи",
    lessons: "Уроки",
    assignments: "Завдання",
    progress: "Прогрес",
    plansAndReports: "Плани та звіти",
    plan: "План",
    vocabMastery: "Засвоєння слів",
    feedback: "Відгук",
    myTutors: "Мої викладачі",
    classes: "Класи",
    review: "Перевірка",
    myStudents: "Мої студенти",
    results: "Результати",
    history: "Історія",
    passiveVocabulary: "Пасивний словник",
    library: "Бібліотека",
    analytics: "Аналітика",
    users: "Користувачі",
    grammarRules: "Граматика",
    plans: "Тарифи",
    billing: "Оплата",
    settings: "Налаштування",
  },
  library: {
    title: "Бібліотека",
    grammarTab: "Граматика",
    dictionaryTab: "Словник",
    grammarDescription:
      "Переглядайте граматичні теми, які зараз доступні на платформі. Поки що це лише бібліотека для перегляду.",
    dictionaryDescription:
      "Переглядайте спільний словник, сформований із пасивного словника та майбутніх затверджених змін.",
    englishTopics: "Англійські теми",
    spanishTopics: "Іспанські теми",
    topicCount: (count: number) =>
      formatPluralizedCount("uk", count, { one: "тема", few: "теми", many: "тем" }),
    futureDevelopment: "Зарезервовано для майбутньої розробки",
    openArticle: "Відкрити статтю",
    searchTopicsPlaceholder: "Пошук граматичних тем",
    searchTopicsAriaLabel: "Пошук граматичних тем",
    languageFilterLabel: "Мова",
    levelFilterLabel: "Рівень",
    allLanguages: "Усі мови",
    allLevels: "Усі рівні",
    noMatchingTopics: "За цими фільтрами тем не знайдено.",
    editArticle: "Редагувати статтю",
    exitDeveloperMode: "Вийти з режиму розробника",
    developerModeTitle: "Режим розробника",
    developerModeDescription:
      "Редагуйте статтю у візуальному редакторі нижче, а до сирого JSON переходьте лише тоді, коли потрібне точне ручне налаштування.",
    draftStatusLabel: "Чернетка",
    publishedStatusLabel: "Опублікований вміст",
    developerContentAvailable: "Доступно",
    developerContentMissing: "Ще не створено",
    developerModeNextStep:
      "Цей редактор уже охоплює структуру статті, приклади та вміст вікторини. У наступних ітераціях можна додати переставлення блоків і багатші спільні сценарії редагування.",
    articleEditor: {
      heroTitle: "Формуйте статтю візуально",
      heroDescription:
        "Оновлюйте пояснення, приклади та вікторину через структуровані картки. JSON лишається доступним для просунутих змін.",
      visualTab: "Візуальний редактор",
      jsonTab: "Сирий JSON",
      statsSections: "Секції",
      statsExamples: "Приклади",
      statsQuestions: "Питання вікторини",
      overviewTitle: "Огляд",
      overviewDescription:
        "Задайте підсумок, формулу й примітку, які формують каркас статті.",
      summaryLabel: "Підсумок",
      noteLabel: "Примітка",
      sectionsTitle: "Блоки пояснення",
      sectionsDescription:
        "Розбийте правило на зрозумілі частини, які стаття відобразить як секції.",
      sectionLabel: "Секція",
      sectionTitleLabel: "Назва секції",
      bulletLabel: "Пункт",
      addSection: "Додати секцію",
      addBullet: "Додати пункт",
      examplesTitle: "Приклади",
      examplesDescription:
        "Додавайте речення-приклади й необов’язкові примітки для контексту.",
      exampleLabel: "Приклад",
      exampleSentenceLabel: "Речення",
      exampleNoteLabel: "Примітка",
      addExample: "Додати приклад",
      quizTitle: "Конструктор міні-вікторини",
      quizDescription:
        "Створюйте картки з одним питанням, варіантами відповіді та поясненнями.",
      quizEmptyTitle: "Вікторину ще не додано",
      quizEmptyDescription:
        "Додайте міні-вікторину, коли пояснення статті вже готове.",
      addQuiz: "Додати вікторину",
      removeQuiz: "Прибрати вікторину",
      questionPromptLabel: "Текст питання",
      questionExplanationLabel: "Пояснення",
      optionLabel: "Варіант",
      addQuestion: "Додати питання",
      addOption: "Додати варіант",
      makeCorrect: "Позначити правильним",
      correctBadge: "Правильно",
      jsonInvalid:
        "У JSON-редакторі є некоректний вміст. Виправте його перед збереженням.",
    },
    editorJsonLabel: "Розширений JSON",
    editorJsonHelp:
      "Використовуйте це, коли потрібно редагувати сирий payload статті напряму. Візуальний редактор залишається основним способом роботи.",
    saveDraft: "Зберегти чернетку",
    publishArticle: "Опублікувати статтю",
    resetEditor: "Скинути редактор",
    draftSaved: "Чернетку збережено",
    articlePublished: "Статтю опубліковано",
    articleSaveFailed: "Не вдалося зберегти чернетку статті",
    articlePublishFailed: "Не вдалося опублікувати статтю",
    backToGrammarLibrary: "Назад до граматичної бібліотеки",
    formulaLabel: "Формула",
    customTopicBadge: "Власна",
    articleContentsTitle: "У цій статті",
    examplesTitle: "Приклади",
    miniQuizTitle: "Міні-вікторина",
    explainAnswer: "Пояснити",
    checkAnswer: "Перевірити відповідь",
    submitQuiz: "Підтвердити",
    finishQuiz: "Завершити вікторину",
    resetQuiz: "Спробувати ще раз",
    correctAnswer: "Правильно",
    correctOption: "Правильна відповідь",
    tryAgain: "Поки ні",
    questionLabel: "Питання",
    answeredLabel: "Відповіді",
    scoreLabel: "Результат",
    browseAllTopics: "Переглянути всі теми",
    continueWithLevel: "Продовжити з цим рівнем",
    dictionaryPlaceholderTitle: "Робочий простір словника буде наступним",
    dictionaryPlaceholderDescription:
      "Каркас маршруту готовий. Далі сюди буде підключено перегляд спільного пасивного словника та потік пропозицій змін від викладачів.",
    dictionary: {
      allFilter: "Усі",
      unknownValue: "Невідомо",
      pendingTutorSuggestionsTitle: "Пропозиції викладачів на розгляді",
      pendingTutorSuggestionsDescription:
        "Переглядайте запропоновані викладачами зміни словника, перш ніж вони потраплять у спільну бібліотеку.",
      noPendingTutorSuggestions:
        "Зараз немає пропозицій викладачів, що очікують на розгляд.",
      suggestionCardTitle: (current: string, proposed: string) =>
        `${current} до ${proposed}`,
      suggestedBy: (name: string) => `Запропонував: ${name}`,
      pendingStatus: "Очікує",
      currentLabel: "Поточне",
      proposedLabel: "Запропоноване",
      noUkrainianTranslation: "Немає українського перекладу",
      cefrLabel: "CEFR",
      partOfSpeechLabel: "Частина мови",
      approveAction: "Затвердити",
      rejectAction: "Відхилити",
      approvedSuggestion: (term: string) => `Пропозицію для ${term} затверджено`,
      rejectedSuggestion: (term: string) => `Пропозицію для ${term} відхилено`,
      approveSuggestionFailed: "Не вдалося затвердити пропозицію",
      rejectSuggestionFailed: "Не вдалося відхилити пропозицію",
      searchPlaceholder: "Шукати канонічні форми",
      searchAriaLabel: "Пошук у спільному словнику",
      searchAction: "Пошук",
      loadedItems: (count: number, query?: string) =>
        query
          ? `Завантажено ${count} ${formatPluralizedCount("uk", count, { one: "елемент", few: "елементи", many: "елементів" })} для \"${query}\"`
          : `Завантажено ${count} ${formatPluralizedCount("uk", count, { one: "елемент", few: "елементи", many: "елементів" })}`,
      retryLoadedNeedsReview:
        "Повторити для завантажених елементів, що потребують перегляду",
      repairingProgress: (completed: number, total: number) =>
        `Оновлення ${completed}/${total}`,
      loadingItems: "Завантажуємо елементи словника...",
      loadingMoreItems: (count: number) =>
        `Завантажуємо ще ${count} елементів словника...`,
      requestFailed:
        "Не вдалося завантажити словник. Спробуйте натиснути пошук ще раз.",
      noFilteredItems:
        "Поточний пошук і фільтр CEFR не дали жодного елемента словника.",
      noItems: "У словнику ще немає елементів.",
      termColumn: "Термін",
      typeColumn: "Тип",
      cefrColumn: "CEFR",
      statusColumn: "Статус",
      updatedColumn: "Оновлено",
      actionsColumn: "Дії",
      pendingSuggestionBadge: "Є пропозиція",
      reEnrichAction: "Збагатити знову",
      retryAiAction: "Повторити AI",
      reEnrichedSuccess: (term: string) => `Повторно збагатили ${term}`,
      reEnrichedMerged: (term: string) =>
        `Повторно збагатили ${term} і об’єднали з канонічною лемою`,
      reEnrichFailed: "Не вдалося повторно збагатити елемент пасивного словника",
      bulkRetrySuccess: (count: number) =>
        `Повторно оброблено ${count} ${formatPluralizedCount("uk", count, { one: "елемент", few: "елементи", many: "елементів" })}`,
      bulkRetryPartial: (successCount: number, failureCount: number) =>
        `Повторно оброблено ${successCount} ${formatPluralizedCount("uk", successCount, { one: "елемент", few: "елементи", many: "елементів" })}; ще ${failureCount} потребують перегляду`,
      bulkRetryFailed: "Жоден із завантажених елементів не вдалося повторно збагатити",
      retryAction: "Повторити",
      endOfList: "Ви дійшли до кінця списку словника.",
      suggestChangeAction: "Запропонувати зміну",
      updateSuggestionAction: "Оновити пропозицію",
      suggestionDialogTitle: "Запропонувати зміну словника",
      suggestionDialogDescription:
        "Викладачі можуть пропонувати оновлення до спільного словника. Перш ніж зміна потрапить у живу бібліотеку, її має затвердити суперадміністратор.",
      canonicalTermLabel: "Канонічна форма",
      ukrainianTranslationLabel: "Український переклад",
      translationPlaceholder: "Додайте стислий український словниковий відповідник",
      cefrLevelLabel: "Рівень CEFR",
      additionalAttributesLabel: "JSON додаткових атрибутів",
      noteLabel: "Чому цю зміну варто затвердити?",
      notePlaceholder: "Необов’язкова примітка для суперадміністратора",
      submittingAction: "Надсилаємо...",
      submitSuggestionAction: "Надіслати пропозицію",
      invalidAttributes: "Атрибути мають бути коректним JSON-об’єктом",
      updatedSuggestion: (term: string) => `Пропозицію для ${term} оновлено`,
      submittedSuggestion: (term: string) => `Пропозицію для ${term} надіслано`,
      submitSuggestionFailed: "Не вдалося надіслати пропозицію до словника",
    },
  },
  quizzes: {
    title: "Мої вікторини",
    description: "Переглядайте та керуйте своїми словниковими вікторинами.",
    reviewActivity: "Повторення",
    newQuiz: "Нова вікторина",
    typeLabels: {
      mcq: "Тест",
      flashcards: "Картки",
      gap_fill: "Заповнення пропусків",
      translation: "Переклад речень",
      text_translation: "Переклад тексту",
      discussion: "Жива дискусія",
      matching: "Зіставлення",
      translation_list: "Список перекладів",
    },
    card: {
      termCount: (count: number) =>
        `${count} ${formatPluralizedCount("uk", count, { one: "слово", few: "слова", many: "слів" })}`,
      deleteTitle: "Видалити вікторину",
      deleteDescription: (title: string) =>
        `Ви впевнені, що хочете видалити \"${title}\"? Цю дію неможливо скасувати.`,
      deleteAction: "Видалити",
      deleteAria: "Видалити вікторину",
      deleting: "Видалення...",
    },
    noQuizzesTitle: "Поки немає вікторин",
    noQuizzesDescription:
      "Створіть першу вікторину, вставивши слова, а AI згенерує для вас вправи.",
    createFirstQuiz: "Створити першу вікторину",
    removeReviewsButton: "Видалити повторення",
    reviewRemoval: {
      title: "Видалити сесії повторення",
      description: (count: number) =>
        `Це назавжди видалить ${formatPluralizedCount("uk", count, { one: "збережену сесію повторення", few: "збережені сесії повторення", many: "збережених сесій повторення" })} з розділу \"Мої вікторини\" разом з усіма пов’язаними спробами. Цю дію неможливо скасувати.`,
      emptyDescription: "Немає збережених сесій повторення для видалення.",
      success: (count: number) =>
        `Видалено ${formatPluralizedCount("uk", count, { one: "сесію повторення", few: "сесії повторення", many: "сесій повторення" })}.`,
      emptySuccess: "Немає сесій повторення для видалення.",
      failed: "Не вдалося видалити сесії повторення",
    },
  },
  createQuiz: {
    title: "Створити вікторину",
    steps: {
      input: "Ввід",
      edit: "Редагування",
      activity: "Вправа",
    },
    stepDescriptions: {
      input: "Додайте слова або нотатки, щоб почати.",
      edit: "Перевірте та відредагуйте розпізнаний список слів.",
      activity: "Оберіть тип вправи для вікторини.",
    },
    addVocabularyTitle: "Додати слова",
    tabs: {
      parseNew: "Розпізнати нові",
      savedWords: "Збережені слова",
      fromQuiz: "Із вікторини",
    },
    reviewTitle: "Перевірити слова",
    reviewDescription:
      "Редагуйте слова, виправляйте переклади, видаляйте зайве або додавайте нові.",
    saveToWordBank: "Зберегти в банк слів",
    saveWordBankTitle: "Зберегти в банк слів",
    saveWordBankDescription: (count: number) =>
      `Збережіть ці ${count} ${count === 1 ? "слово" : count >= 2 && count <= 4 ? "слова" : "слів"} для повторного використання у майбутніх вікторинах.`,
    bankNameLabel: "Назва банку",
    bankNamePlaceholder: "наприклад, Лексика розділу 5",
    chooseActivity: "Обрати вправу",
    quizTitleLabel: "Назва вікторини (необов’язково)",
    quizTitlePlaceholder: "наприклад, Лексика розділу 5",
    activityLabels: {
      mcq: "Тест",
      flashcards: "Картки",
      gap_fill: "Заповнення пропусків",
      translation: "Переклад речень",
      text_translation: "Переклад тексту",
      discussion: "Жива дискусія",
    },
    activityDescriptions: {
      mcq: "Відповідайте на запитання з одним правильним і трьома хибними варіантами.",
      flashcards:
        "Перегортайте картки, щоб запам’ятовувати слова та їхні значення.",
      gap_fill: "Заповнюйте пропуски правильним словом із вашої лексики.",
      translation:
        "Перекладайте речення, використовуючи лексику, яку ви вивчаєте.",
      text_translation:
        "Перекладіть короткий текст і отримайте одну загальну оцінку за весь уривок.",
      discussion:
        "Згенеруйте підказки рівня CEFR, які природно використовують вашу лексику для живої розмовної практики.",
    },
    difficultyLevel: "Рівень складності",
    tutorDifficultyDescription: "Оберіть рівень CEFR для цієї вікторини",
    studentDifficultyDescription:
      "За замовчуванням використовується рівень з профілю, але його можна змінити",
    spanishLimitedNote: "Іспанська мова наразі обмежена рівнем A1.",
    cefrDescriptions: {
      A1: "Початковий",
      A2: "Елементарний",
      B1: "Середній",
      B2: "Вище середнього",
      C1: "Просунутий",
      C2: "Вільне володіння",
    },
    generateSelectedActivity: (activityLabel: string) =>
      `Згенерувати: ${activityLabel}`,
    generatingFlashcards: "Генеруємо картки...",
    generatingQuiz: "Генеруємо вікторину...",
    fallbackActivityLabel: "Вправа",
    defaultTitlePrefix: "Вікторина",
    wordInput: {
      pasteVocabularyLabel: "Вставте свою лексику або нотатки",
      pasteHelper:
        "Можна вставити текст напряму, завантажити скриншоти або вставити скриншот із буфера обміну.",
      addScreenshotsTitle: "Додати скриншоти",
      screenshotRules: (max: number, sizeMb: number) =>
        `PNG, JPEG або WEBP. До ${max} скриншотів, по ${sizeMb} МБ кожен.`,
      uploadScreenshots: "Завантажити скриншоти",
      screenshotLabel: (index: number) => `Скриншот ${index}`,
      removeScreenshot: "Видалити скриншот",
      parsingVocabulary: "Розпізнаємо лексику...",
      parseWithAi: "Розпізнати через AI",
      parseFailed: "Не вдалося розпізнати слова",
      attachLimitError: (max: number) =>
        `Можна додати не більше ${max} скриншотів.`,
      invalidImageTypeError: "Підтримуються лише скриншоти PNG, JPEG і WEBP.",
      screenshotSizeError: (sizeMb: number) =>
        `Кожен скриншот має бути не більшим за ${sizeMb} МБ.`,
      screenshotReadError: "Не вдалося прочитати скриншот",
      keepFirstScreenshots: (max: number) =>
        `Збережено лише перші ${max} скриншотів.`,
    },
    parsedWordList: {
      parsedCount: (count: number) =>
        `Розпізнано ${formatPluralizedCount("uk", count, { one: "слово", few: "слова", many: "слів" })}. Нижче можна відредагувати, видалити або додати ще.`,
      addTermPlaceholder: "Додати слово...",
      addMeaningPlaceholder: "Додати значення...",
    },
    wordBankPicker: {
      loadFailed: "Не вдалося завантажити збережені банки слів.",
      deleteFailed: "Не вдалося видалити банк слів.",
      emptyState:
        "Поки немає збережених банків слів. Розпізнайте нові слова та збережіть їх, щоб створити перший банк.",
      helperDescription:
        "Оберіть збережений банк слів, щоб використати його лексику.",
      bankMeta: (count: number, dateLabel: string) =>
        `${formatPluralizedCount("uk", count, { one: "слово", few: "слова", many: "слів" })} · ${dateLabel}`,
    },
    quizWordPicker: {
      loadFailed: "Не вдалося завантажити вікторини.",
      emptyState:
        "Поки немає доступних вікторин. Створіть вікторину або завершіть призначену, щоб повторно використати її лексику.",
      helperDescription:
        "Оберіть одну зі своїх вікторин або призначену вікторину, яку вже пройдено, щоб повторно використати її лексику.",
      quizMeta: (count: number, dateLabel: string) =>
        `${formatPluralizedCount("uk", count, { one: "слово", few: "слова", many: "слів" })} · ${dateLabel}`,
      typeLabels: {
        flashcards: "Картки",
        gap_fill: "Заповнення пропусків",
        translation: "Переклад",
        mcq: "Тест",
        matching: "Співставлення",
        discussion: "Жива дискусія",
        text_translation: "Переклад тексту",
        translation_list: "Список перекладу",
      },
    },
    grammarTopics: {
      title: "Граматичний фокус",
      optional: "необов’язково",
      selectedCount: (count: number) =>
        formatPluralizedCount("uk", count, {
          one: "обрано",
          few: "обрано",
          many: "обрано",
        }),
      description:
        "Оберіть одну граматичну тему, на якій слід зосередитися в згенерованих реченнях.",
      clear: "Очистити",
    },
  },
  quizSession: {
    header: {
      backToQuizzes: "Назад",
    },
    unsupportedQuizType: (type: string) =>
      `Непідтримуваний тип вікторини: ${type}`,
    flashcardsResult: {
      title: "Картки завершено!",
      description: (known: number, total: number, percentage: number) =>
        `Ви знали ${known} із ${total} слів (${percentage}%).`,
      encouragementHigh: "Чудова робота! Ви знаєте більшість цих слів.",
      encouragementMedium:
        "Хороший прогрес! Продовжуйте практикуватися, щоб покращити результат.",
      encouragementLow: "Продовжуйте вчитися! Практика дає результат.",
    },
    discussionResult: {
      title: "Живу дискусію завершено!",
      description: (count: number) =>
        `Ви переглянули ${formatPluralizedCount("uk", count, { one: "дискусійний промпт", few: "дискусійні промпти", many: "дискусійних промптів" })}.`,
      reopenPrompts: "Відкрити промпти знову",
    },
    results: {
      quizCompleteTitle: "Вікторину завершено!",
      scored: (correct: number, total: number, percentage: number) =>
        `Ваш результат: ${correct} із ${total} (${percentage}%)`,
      translationCompleteTitle: "Переклад завершено!",
      averageScore: (score: number) => `Середня оцінка: ${score}/100`,
      textTranslationCompleteTitle: "Переклад тексту завершено!",
      scoreDescription: (score: number) => `Оцінка: ${score}/100`,
      sentenceLabel: (index: number) => `Речення ${index}`,
      yourAnswer: "Ваша відповідь",
      correctAnswer: "Правильна відповідь",
      yourTranslation: "Ваш переклад",
      referenceTranslation: (language: string) =>
        `Еталонний переклад (${language}):`,
      sourceSentence: (language: string) => `Речення-джерело (${language})`,
      sourceText: (language: string) => `Текст-джерело (${language})`,
      yourTranslationTitle: "Ваш переклад",
    },
    mcq: {
      progress: (current: number, total: number) =>
        `Запитання ${current} з ${total}`,
      previousAria: "Попереднє запитання",
      nextAria: "Наступне запитання",
      score: (correct: number, completed: number) =>
        `Рахунок: ${correct}/${completed}`,
      title: "Тест",
      description: "Оберіть найкращу відповідь на це словникове запитання.",
      nextQuestion: "Далі",
      reviewUnanswered:
        "Скористайтеся стрілками, щоб переглянути запитання без відповіді перед завершенням.",
      correct: "Правильно!",
      incorrect: (answer: string) =>
        `Не зовсім. Правильна відповідь: ${answer}`,
      selected: (answer: string) => `Ви обрали ${answer}.`,
      skipped: "Ви пропустили це запитання.",
    },
    gapFill: {
      progress: (current: number, total: number) =>
        `Запитання ${current} з ${total}`,
      previousAria: "Попереднє запитання",
      nextAria: "Наступне запитання",
      score: (correct: number, completed: number) =>
        `Рахунок: ${correct}/${completed}`,
      title: "Заповнення пропуску",
      description: "Впишіть пропущене слово, щоб завершити речення.",
      hint: (hint: string) => `Підказка: ${hint}`,
      placeholder: "Введіть свою відповідь...",
      nextQuestion: "Далі",
      reviewUnanswered:
        "Скористайтеся стрілками, щоб переглянути запитання без відповіді перед завершенням.",
      correct: "Правильно!",
      incorrect: (answer: string) =>
        `Не зовсім. Правильна відповідь: ${answer}`,
    },
    translation: {
      progress: (current: number, total: number) =>
        `Речення ${current} з ${total}`,
      previousAria: "Попереднє речення",
      nextAria: "Наступне речення",
      averageScore: (score: number) => `Сер. оцінка: ${score}/100`,
      title: (language: string) => `Перекладіть на ${language}`,
      grammarFocus: (topic: string) => `Граматичний фокус: ${topic}`,
      placeholder: (language: string) =>
        `Введіть свій переклад ${language}... (Enter для надсилання, Shift+Enter для нового рядка)`,
      evaluating: "Оцінюємо...",
      submit: "Надіслати переклад",
      showTranslation: "Показати переклад (0/100)",
      retryEvaluation: "Спробувати оцінити ще раз",
      evaluationFailed: "Не вдалося оцінити ваш переклад. Спробуйте ще раз.",
      referenceTranslation: (language: string) =>
        `Еталонний переклад (${language}):`,
      hideLearningNote: "Сховати навчальну нотатку",
      revealLearningNote: "Показати навчальну нотатку",
      smallTranslation: "Малий переклад:",
      targetVocab: "Цільова лексика:",
      grammar: "Граматика:",
      nextSentence: "Наступне речення",
      viewResults: "Переглянути результати",
    },
    textTranslation: {
      progressLabel: "Переклад уривка",
      title: (language: string) => `Перекладіть текст на ${language}`,
      placeholder: (language: string) =>
        `Напишіть свій переклад ${language} тут...`,
      evaluating: "Оцінюємо...",
      submit: "Надіслати переклад",
      retryEvaluation: "Спробувати оцінити ще раз",
      evaluationFailed: "Не вдалося оцінити ваш переклад. Спробуйте ще раз.",
      referenceTranslation: (language: string) =>
        `Еталонний переклад (${language}):`,
      viewResults: "Переглянути результати",
    },
    discussion: {
      title: "Жива дискусія",
      agreeDisagree: "Погодься / Запереч",
      openEnded: "Відкрите запитання",
      targetVocab: (term: string) => `Цільова лексика: ${term}`,
      regenerating: "Генеруємо заново...",
      regenerateQuestion: "Згенерувати запитання знову",
      noPrompts: "Для цієї вікторини не було згенеровано дискусійних промптів.",
      finishSession: "Завершити сесію",
      missingTargetVocab:
        "Не вдалося визначити цільову лексику для цього промпту.",
      missingConfig:
        "У цієї вікторини відсутня конфігурація генерації, тому промпт не можна згенерувати повторно.",
      noRegeneratedPrompt: "Не отримано повторно згенерований промпт.",
      regenerateSuccess: (term: string) =>
        `Промпт для \"${term}\" згенеровано повторно.`,
      regenerateFailed: "Не вдалося повторно згенерувати промпт",
      saveFailed: "Не вдалося зберегти повторно згенерований промпт",
    },
    flashcards: {
      progress: (current: number, total: number) =>
        `Картка ${current} з ${total}`,
      remaining: (count: number) => `Залишилося ${count}`,
      knowCount: (count: number) => `Знаю: ${count}`,
      learningCount: (count: number) => `Вивчаю: ${count}`,
      frontAria: "Лицьова сторона картки. Натисніть, щоб побачити переклад.",
      backAria:
        "Зворотна сторона картки. Натисніть, щоб повернутися на лицьову.",
      stillLearning: "Ще вивчаю",
      knowIt: "Знаю",
      flipCard: "Перевернути картку",
      sessionCompleteTitle: "Сесію завершено!",
      sessionCompleteDescription: (
        known: number,
        total: number,
        learning: number,
      ) =>
        `Ви знаєте ${known} із ${total} слів.${learning > 0 ? ` Ще ${formatPluralizedCount("uk", learning, { one: "слово", few: "слова", many: "слів" })} потребують практики.` : ""}`,
    },
  },
  dashboard: {
    welcomeBack: (name: string) => `З поверненням, ${name}`,
    roleDescriptions: {
      student:
        "Практикуйте лексику, проходьте вікторини та відстежуйте свій прогрес.",
      tutor:
        "Керуйте своїми класами, призначайте вікторини та перевіряйте роботу студентів.",
      superadmin: "Відстежуйте аналітику платформи та керуйте користувачами.",
    },
    customize: {
      addCard: "Додати картку",
      addCardsTitle: "Налаштувати панель",
      addCardsDescription:
        "Прибирайте непотрібні картки, повертайте їх у будь-який момент і перетягуйте розблоковані картки в тому порядку, який підходить вашому робочому процесу.",
      hiddenCardDescription: "Повернути цю картку на вашу панель.",
      addAction: "Додати",
      cardOptions: "Параметри картки",
      removeCard: "Прибрати картку",
      lockCard: "Закріпити картку",
      unlockCard: "Розблокувати картку",
      dragToReorder: "Перетягніть, щоб змінити порядок",
      noHiddenCards: "Усі доступні картки вже додані на вашу панель.",
    },
    student: {
      newQuizTitle: "Нова вікторина",
      newQuizDescription: "Згенерувати нову вікторину за допомогою AI",
      createQuizButton: "Створити вікторину",
      reviewTitle: "Повторення",
      reviewDescription:
        "Практикуйте слова, що вже час повторити, та найскладніші для вас слова",
      startReviewButton: "Почати повторення",
      passiveTitle: "Додати пасивне розпізнавання",
      passiveDescription: "Імпортуйте слова з тексту, який ви вже розумієте",
      passiveButton: "Додати пасивне розпізнавання",
      quizzesCreatedTitle: "Створено вікторин",
      remainingThisMonth: (count: number) => `Цього місяця залишилося ${count}`,
      unlimited: "Без ліміту",
      dayStreakTitle: "Серія днів",
      consecutiveDays: (count: number) =>
        `${formatPluralizedCount("uk", count, { one: "день", few: "дні", many: "днів" })} поспіль`,
      totalWordsTitle: "Усього слів у відстеженні",
      totalWordsDescription: "слів у вашій навчальній бібліотеці",
    },
    tutor: {
      newQuizTitle: "Нова вікторина",
      newQuizDescription: "Згенерувати нову вікторину за допомогою AI",
      createQuizButton: "Створити вікторину",
      reviewTitle: "Перевірка",
      reviewDescription: "Переглядайте відповіді студентів",
      reviewButton: "Перевірити роботу",
      passiveTitle: "Імпорт пасивного словника",
      passiveDescriptionNone:
        "Спершу під’єднайте студента, а потім імпортуйте текст, який він уже розуміє.",
      passiveDescriptionSingle:
        "Одразу перейдіть до імпорту пасивного розпізнавання для під’єднаного студента.",
      passiveDescriptionMultiple:
        "Оберіть під’єднаного студента, а потім імпортуйте текст, який він уже розуміє.",
      passiveButtonNone: "Спершу під’єднайте студента",
      passiveButtonSingle: "Імпортувати пасивний словник",
      passiveButtonMultiple: "Обрати студента",
      studentsTitle: "Студенти",
      enrolledStudents: "під’єднаних студентів",
      viewStudentsButton: "Переглянути студентів",
      quizzesCreatedTitle: "Створено вікторин",
      remainingThisMonth: (count: number) => `Цього місяця залишилося ${count}`,
      unlimited: "Без ліміту",
    },
    admin: {
      quizzesCreatedTitle: "Створено вікторин",
      createdThisMonth: (count: number) => `Цього місяця створено ${count}`,
      textRequestsTitle: "Текстові запити",
      trackedInMonth: (month: string) => `відстежено у ${month}`,
      ttsRequestsTitle: "Запити TTS",
      trackedCostTitle: "Відстежена вартість",
      trackedRequestsInMonth: (count: number, month: string) =>
        `${formatPluralizedCount("uk", count, { one: "AI-запит", few: "AI-запити", many: "AI-запитів" })} відстежено у ${month}`,
      totalUsersTitle: "Усього користувачів",
      registeredUsers: "зареєстрованих користувачів",
      analyticsTitle: "Аналітика",
      analyticsDescription: "Використання платформи та метрики",
      viewAnalyticsButton: "Переглянути аналітику",
      usersTitle: "Користувачі",
      usersDescription: "Керуйте користувачами платформи",
      manageUsersButton: "Керувати користувачами",
    },
    guide: {
      buttonLabel: "Як це працює",
      newBadge: "Нове",
      helperText: "Одна коротка екскурсія для цієї панелі.",
      closeGuide: "Закрити підказку",
      close: "Закрити",
      back: "Назад",
      next: "Далі",
      finish: "Завершити",
      stepOf: (step: number, total: number) => `Крок ${step} з ${total}`,
      studentSteps: {
        newQuiz: {
          title: "Нова вікторина",
          description:
            "Відкрийте конструктор вікторин, щоб згенерувати новий набір вправ на основі вашого списку слів.",
        },
        reviewActivity: {
          title: "Повторення",
          description:
            "Запустіть цілеспрямоване повторення, яке спочатку підтягує прострочені слова, а потім додає найслабші слова за вашою статистикою.",
        },
        quizzesCreated: {
          title: "Створено вікторин",
          description:
            "Цей блок показує ваш місячний ліміт вікторин, щоб ви бачили, скільки генерацій ще залишилося у вашому плані.",
        },
        dayStreak: {
          title: "Серія днів",
          description:
            "Серія рахує послідовні дні з активністю у вікторинах і допомагає відстежувати сталість практики.",
        },
        totalWords: {
          title: "Усього слів у відстеженні",
          description:
            "Тут показано, скільки слів зараз відстежується у вашій навчальній бібліотеці.",
        },
      },
      tutorSteps: {
        newQuiz: {
          title: "Сторінка нової вікторини",
          description:
            "Створюйте AI-вікторини, які можна призначати класам або використовувати для цільової практики.",
        },
        review: {
          title: "Сторінка перевірки",
          description:
            "Переглядайте спроби студентів, оцінюйте відкриті відповіді та залишайте фідбек, коли це потрібно.",
        },
        students: {
          title: "Сторінка студентів",
          description:
            "Використовуйте цю сторінку, щоб стежити за своїми студентами та швидше переходити до контексту окремого учня.",
        },
      },
      superadminSteps: {
        quizzesCreated: {
          title: "Створено вікторин",
          description:
            "Ця загальна цифра показує всі вікторини, які будь-коли були створені на платформі, а допоміжний текст нижче - скільки створено цього місяця.",
          hint: "Відкрийте Аналітику, якщо потрібен розподіл по окремих авторах.",
        },
        textRequests: {
          title: "Текстові запити",
          description:
            "Тут показано відстежені текстові запити за поточний місяць на основі тих самих даних використання Gemini та правил ціноутворення, що й у Billing.",
          hint: "Відкрийте Billing, щоб переглянути кількість токенів і детальну модель ціноутворення.",
        },
        ttsRequests: {
          title: "Запити TTS",
          description:
            "Ця картка показує кількість відстежених запитів text-to-speech за поточний місяць і їхню орієнтовну вартість.",
          hint: "У Billing видно розподіл між текстовими токенами та токенами аудіовиходу.",
        },
        trackedCost: {
          title: "Відстежена вартість",
          description:
            "Тут сумується відстежена вартість текстових запитів і TTS за поточний місяць, щоб ви бачили реальні AI-витрати платформи одним поглядом.",
          hint: "Сюди входять лише запити, записані в ai_usage_events, а не старі комбіновані лічильники.",
        },
        totalUsers: {
          title: "Усього користувачів",
          description:
            "Це поточна кількість зареєстрованих користувачів на платформі.",
          hint: "На сторінці Користувачі можна перевірити ролі, стан онбордингу та зміни акаунтів.",
        },
      },
    },
  },
  assignments: {
    title: "Завдання",
    tutorDescription: "Керуйте призначеними вікторинами для своїх класів.",
    studentDescription: "Вікторини, які вам призначили викладачі.",
    reviewDescription: "Переглядайте роботи студентів і залишайте відгук.",
    assignmentsTab: "Завдання",
    reviewTab: "Перевірка",
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
    balanceDescription:
      "Керуйте балансами учнів, поповненнями та вартістю уроків в одному місці.",
    performanceDescription:
      "Аналітика викладання для викладача на основі завершених уроків із вашого розкладу.",
    scheduleTab: "Розклад",
    balanceTab: "Баланс",
    performanceTab: "Ефективність",
    tutorOnlyBadge: "Лише для викладача",
    performanceYearBadge: "Статистика року",
  },
  progress: {
    title: "Прогрес",
    description:
      "Відстежуйте свій навчальний профіль, зростання словникового запасу та результати вікторин.",
    overallTab: "Загалом",
    monthlyTab: "Щомісяця",
    monthlyDescription:
      "Порівнюйте свої завершені вікторини та уроки за останні 30 днів.",
    noProgressTitle: "Поки немає даних про прогрес",
    noProgressDescription:
      "Пройдіть кілька вікторин, щоб почати відстежувати свій прогрес і бачити покращення з часом.",
    noMonthlyActivityTitle: "Ще немає місячної активності",
    noMonthlyActivityDescription:
      "За останні 30 днів у вас немає завершених вікторин або уроків.",
    createQuiz: "Створити вікторину",
    openVocabMastery: "Відкрити засвоєння слів",
    completedQuizzes: "Завершені вікторини",
    completedLessons: "Завершені уроки",
    activeDays: "Активні дні",
    monthlyChartTitle: "Місячна структура активності",
    monthlyChartDescription: (startLabel: string, endLabel: string) =>
      `Завершені вікторини та уроки з ${startLabel} до ${endLabel}.`,
  },
  studentFeedback: {
    title: "Мій відгук",
    description: "Відгуки від викладачів про ваші спроби у вікторинах",
    emptyTitle: "Поки немає відгуків",
    emptyDescription:
      "Тут з'являтимуться відгуки ваших викладачів про ваші спроби у вікторинах.",
    fromTutor: (name: string) => `Від ${name}`,
    tutorFallback: "Викладач",
    quizFallback: "Вікторина",
  },
  reviewPage: {
    title: "Перевірка",
    description: "Переглядайте роботи студентів і залишайте відгук.",
    noClassesTitle: "Поки немає класів",
    noClassesDescription:
      "Спочатку створіть клас, щоб студенти могли приєднатися та надсилати спроби вікторин.",
    noStudentsTitle: "Поки немає студентів",
    noStudentsDescription:
      "Студенти з'являться тут, коли приєднаються до ваших класів і завершать вікторини.",
    noQuizzesTitle: "Немає призначених вікторин",
    noQuizzesDescription:
      "Створіть завдання для своїх класів, щоб тут з'явилися студентські спроби.",
    noSubmissionsTitle: "Поки немає робіт",
    noSubmissionsDescription:
      "Спроби студентів з'являться тут, щойно вони почнуть завершувати вправи.",
    reviewed: "Перевірено",
    needsReview: "Потребує перевірки",
    unknownStudent: "Невідомо",
  },
  reviewDetail: {
    title: "Перевірка роботи",
    backToReview: "Назад до перевірки",
    unknownStudent: "Невідомий студент",
    quizFallback: "Вікторина",
    scoreBadge: (score: number) => `Результат: ${score}%`,
    completedAt: (dateLabel: string) => `Завершено ${dateLabel}`,
    rawScore: (score: number, maxScore: number) =>
      `Сирий бал: ${score} / ${maxScore}`,
    studentAnswers: "Відповіді студента",
    answerNumber: (index: number) => `П${index}:`,
    answerLabel: "Відповідь",
    correctLabel: "Правильно",
    correctBadge: "Правильно",
    wrongBadge: "Неправильно",
    flashcardKnown: (score: number, maxScore: number) =>
      `Сесію карток завершено - ${score} із ${maxScore} карток позначено як відомі.`,
    flashcardCompleted: "Сесію карток завершено.",
    previousFeedback: "Попередній відгук",
    tutorFallback: "Викладач",
    form: {
      title: "Залишити відгук",
      rating: "Оцінка (необов'язково)",
      feedback: "Відгук",
      placeholder: "Напишіть свій відгук для студента...",
      submit: "Надіслати відгук",
      submitting: "Надсилання...",
      enterFeedback: "Будь ласка, введіть відгук",
      submitted: "Відгук надіслано",
      submitFailed: "Не вдалося надіслати відгук",
    },
    translationResults: {
      title: "Відповіді на переклад",
      currentOverall: (score: number) =>
        `Поточна загальна оцінка: ${score}/100`,
      itemLabel: "Елемент перекладу",
      save: "Зберегти",
      saving: "Збереження...",
      question: "Запитання",
      studentResponse: "Відповідь студента",
      referenceAnswer: "Еталонна відповідь",
      aiFeedback: "Відгук AI",
      updateSuccess: "Оцінку перекладу оновлено",
      updateFailed: "Не вдалося оновити оцінку",
    },
    gapFillResults: {
      title: "Відповіді на заповнення пропусків",
      currentOverall: (score: number, maxScore: number) =>
        `Поточний результат: ${score}/${maxScore}`,
      itemLabel: "Елемент із пропуском",
      markCorrect: "Позначити правильно",
      markWrong: "Позначити неправильно",
      saving: "Збереження...",
      updateSuccess: "Результат заповнення пропуску оновлено",
      updateFailed: "Не вдалося оновити результат заповнення пропуску",
    },
  },
  tutorProgressPage: {
    studentFallback: "Студент",
    tutorFallback: "Викладач",
    backToStudents: "Назад до моїх студентів",
    tutorView: "Перегляд прогресу викладачем",
    targetLabel: (level: string) => `Ціль ${level}`,
    description: (name: string) =>
      `Перегляньте обчислений навчальний профіль ${name}, а потім сформуйте власну викладацьку версію радарних метрик, AI-підказок і коментарів до прогресу.`,
    overviewDescription:
      "Переглядайте одного під’єднаного студента за раз, використовуючи той самий підсумок успішності, що й у студентському прогресі.",
    monthlyDescription:
      "Порівнюйте завершені вікторини та уроки одного під’єднаного студента за останні 30 днів.",
    coachingDescription:
      "Формуйте викладацькі коригування радара, нотатки для коучингу та огляди прогресу для одного під’єднаного студента.",
    overallTab: "Загалом",
    monthlyTab: "Щомісяця",
    coachingTab: "Коучинг",
    viewProgress: "Переглянути прогрес",
    openCoachingWorkspace: "Відкрити простір коучингу",
    openHistory: "Відкрити історію",
    monthlyPanelDescription: (name: string) =>
      `Переглядайте завершені вікторини та уроки ${name} за останні 30 днів.`,
    monthlyChartTitle: "Місячна структура активності",
    monthlyChartDescription: (startLabel: string, endLabel: string) =>
      `Завершені вікторини та уроки з ${startLabel} до ${endLabel}.`,
    completedQuizzes: "Завершені вікторини",
    completedLessons: "Завершені уроки",
    activeDays: "Активні дні",
    noMonthlyActivityTitle: "Ще немає місячної активності",
    noMonthlyActivityDescription:
      "У цього студента немає завершених вікторин або уроків за останні 30 днів.",
    sourceLabel: (language: string) => `Мова-джерело: ${language}`,
    progressReviewsTitle: "Огляди прогресу та коментарі",
    progressReviewsDescription: (name: string) =>
      `Викладачі можуть залишати огляди прогресу, нотатки та коментарі про те, як ${name} розвивається з часом.`,
    noProgressReviews: "Поки немає оглядів прогресу.",
    noRawDataTitle: "Поки немає сирих даних про прогрес",
    noRawDataDescription:
      "У цього студента ще недостатньо історії вікторин або словникової практики, щоб заповнити картки сирого огляду.",
    avgScore: "Сер. бал",
    avgMastery: "Сер. засвоєння",
    outOfFive: "із 5 рівнів засвоєння",
    dayStreak: "Серія днів",
    consecutiveDays: (count: number) =>
      formatPluralizedCount("uk", count, {
        one: "день поспіль",
        few: "дні поспіль",
        many: "днів поспіль",
      }),
    uniqueWords: "Унікальні слова",
    masteredWords: (count: number) =>
      formatPluralizedCount("uk", count, {
        one: "засвоєне слово",
        few: "засвоєні слова",
        many: "засвоєних слів",
      }),
    grammarTopics: "Граматичні теми",
    passiveEvidence: "Пасивне свідчення",
    passiveEvidenceDescription:
      "слів і фраз, що відстежуються лише як розпізнавання",
    equivalentWords: "Еквівалентні слова",
    equivalentWordsDescription:
      "скоригований за рівнем загальний показник розпізнавання, зважений на слова, який використовується в оцінках пасивного словника",
    whatItMeans: "Що це означає",
    passiveExplanation:
      "Еквівалентні слова - це зважена на розпізнавання сума одиночних слів, яка використовується в оцінках пасивного словника. Слова на рівні студента або нижче зараховуються повністю. Слова вищого рівня зараховуються частково, доки загальний профіль учня не наздожене їх.",
    passiveVocabularyTitle: "Пасивний словник",
    passiveVocabularyDescription: (name: string) =>
      `Імпортуйте свідчення пасивного розпізнавання та перегляньте останні пасивні слова, позначені як library, на окремій сторінці пасивного словника для ${name}.`,
    passiveItems: (count: number) =>
      `${count} ${formatPluralizedCount("uk", count, { one: "пасивний елемент", few: "пасивні елементи", many: "пасивних елементів" })}`,
    equivalentWordsBadge: (count: number) =>
      `${count} ${formatPluralizedCount("uk", count, { one: "еквівалентне слово", few: "еквівалентні слова", many: "еквівалентних слів" })}`,
    openPassiveVocabulary: "Відкрити пасивний словник",
  },
  tutorPlansReportsPage: {
    title: "Плани та звіти",
    description:
      "Керуйте навчальним планом і щомісячними звітами одного під’єднаного студента з єдиного простору.",
    plansTab: "Плани",
    reportsTab: "Звіти",
    plansDescription:
      "Переглядайте та оновлюйте навчальний план одного під’єднаного студента.",
    reportsDescription:
      "Створюйте, редагуйте та експортуйте щомісячні звіти одного під’єднаного студента.",
    planPanelDescription: (name: string) =>
      `Переглядайте та оновлюйте цілі, граматичний фокус і щомісячні орієнтири для ${name}.`,
    reportsPanelDescription: (name: string) =>
      `Створюйте, редагуйте та експортуйте щомісячні звіти для ${name} в одному місці.`,
    noStudentTitle: "Студента не вибрано",
    noStudentDescription:
      "Спочатку під’єднайте студента, а потім виберіть його тут, щоб відкрити простір планів і звітів.",
    studentSpecificNotice:
      "Плани та звіти прив’язані до конкретного студента, тому ця сторінка завжди показує одного учня за раз.",
  },
  studentPlansReportsPage: {
    title: "Плани та звіти",
    description:
      "Переглядайте навчальні плани й щомісячні звіти, якими з вами діляться викладачі.",
    plansDescription:
      "Переглядайте цілі, завдання, граматичний фокус і щомісячні орієнтири, які для вас встановили викладачі.",
    reportsDescription:
      "Читайте й завантажуйте щомісячні звіти, які для вас публікують викладачі.",
    noPlansTitle: "Поки немає планів",
    noPlansDescription:
      "Ваші викладачі зможуть опублікувати план для вас після того, як визначать цілі та завдання.",
    noReportsTitle: "Поки немає щомісячних звітів",
    noReportsDescription:
      "Щомісячні звіти з’являться тут після того, як викладач опублікує їх для вас.",
  },
  adminUsers: {
    title: "Користувачі",
    description: "Керуйте користувачами платформи, ролями та дозволами.",
    summaryTitles: {
      students: "Студенти",
      tutors: "Викладачі",
      admins: "Адміністратори",
    },
    allUsers: (count: number) => `Усі користувачі (${count})`,
    noUsersFound: "Користувачів не знайдено.",
    columns: {
      name: "Ім'я",
      email: "Ел. пошта",
      role: "Роль",
      changeRole: "Змінити роль",
      articleEditor: "Редактор статей",
      cefr: "CEFR",
      quizzes: "Вікторини",
      attempts: "Спроби",
      onboarded: "Онбординг",
      joined: "Приєднався",
    },
    roleLabels: {
      student: "Студент",
      tutor: "Викладач",
      superadmin: "Адміністратор",
    },
    yes: "Так",
    no: "Ні",
    roleUpdated: (role: string) => `Роль оновлено на ${role}`,
    roleUpdateFailed: "Не вдалося оновити роль",
    cefrUpdated: (level: string) => `Рівень CEFR оновлено до ${level}`,
    cefrUpdateFailed: "Не вдалося оновити рівень CEFR",
    articleEditorGranted: "Доступ до редагування статей надано",
    articleEditorRevoked: "Доступ до редагування статей відкликано",
    articleEditorUpdateFailed: "Не вдалося оновити доступ до редагування статей",
    articleEditorGrantedLabel: "Надано",
    articleEditorRevokedLabel: "Не надано",
  },
  tutorMastery: {
    title: "Засвоєння слів студентами",
    description:
      "Переглядайте, наскільки добре ваші студенти знають лексику в усіх класах, включно з пасивними свідченнями, імпортованими з текстів, які вони вже розуміють.",
    noClassesTitle: "Поки немає класів",
    noClassesDescription:
      "Створіть клас і запросіть студентів, щоб побачити тут їхнє засвоєння слів.",
    noStudentsTitle: "Немає зарахованих студентів",
    noStudentsDescription:
      "Ваші студенти з'являться тут, щойно приєднаються до класу.",
    studentOverviewTitle: "Огляд студентів",
    studentOverviewDescription:
      "Спочатку завантажуються короткі зведення по студентах. Розгорніть студента, щоб завантажити його слова. Еквівалентні слова - це сума одиночних слів із пасивних свідчень, яка використовується в оцінках пасивного словника.",
    unknownStudent: "Невідомо",
    levelLabels: {
      new: "Нове",
      seen: "Бачив",
      learning: "Вивчає",
      familiar: "Знайоме",
      practiced: "Практиковане",
      mastered: "Засвоєне",
    },
    cards: {
      noStudentsOnPage: "На цій сторінці студентів не знайдено.",
      summaryLine: (totalWords: number, avgLevel: number) =>
        `${formatPluralizedCount("uk", totalWords, { one: "слово", few: "слова", many: "слів" })} · сер. рівень ${avgLevel}`,
      passiveSummary: (passiveEvidenceCount: number, equivalentWords: number) =>
        `${formatPluralizedCount("uk", passiveEvidenceCount, { one: "пасивне свідчення", few: "пасивні свідчення", many: "пасивних свідчень" })} · ${formatPluralizedCount("uk", equivalentWords, { one: "еквівалентне слово", few: "еквівалентні слова", many: "еквівалентних слів" })}`,
      activeSummary: (activeEvidenceCount: number, totalUses: number) =>
        `${formatPluralizedCount("uk", activeEvidenceCount, { one: "слово активного свідчення", few: "слова активного свідчення", many: "слів активного свідчення" })} · ${totalUses} використань`,
      showDetails: "Показати деталі",
      hideDetails: "Сховати деталі",
      noWordsYet: "Поки немає слів",
      loadingDetails: "Завантаження деталей...",
      retry: "Спробувати ще раз",
      noWordsFound: "Слів не знайдено.",
      masteryWordsTitle: "Слова засвоєння",
      activeEvidenceTitle: "Активне свідчення",
      noActiveEvidence: "Активного свідчення поки немає.",
      wordsCount: (count: number) =>
        `${count} ${formatPluralizedCount("uk", count, { one: "слово", few: "слова", many: "слів" })}`,
      deleteTitle: "Видалити слово для студента",
      deleteDescription: (term: string) =>
        `${term} буде видалено зі списку засвоєння слів цього студента.`,
      deleteSuccess: (term: string) =>
        `${term} видалено зі списку засвоєння слів студента`,
    },
  },
  plans: {
    title: "Тарифи",
    description:
      "Порівняйте ліміти тарифів, зрозумійте, як працює кожна квота, і перегляньте, що враховується у використанні.",
    currentBadge: "Поточний",
    popularBadge: "Популярний",
    freePrice: "Безкоштовно",
    perMonth: "/ місяць",
    usageLabels: {
      aiCalls: "AI-запити",
      reports: "Звіти",
      quizzes: "Вікторини",
      attempts: "Спроби",
      wordBanks: "Банки слів",
    },
    planNames: {
      free: "Безкоштовний",
      pro: "Pro",
      premium: "Premium",
    },
    planDescriptions: {
      free: "Базові інструменти практики для тих, хто тільки починає.",
      pro: "Вищі місячні ліміти для регулярних учнів і викладачів.",
      premium: "Щедра AI-ємність і відкриті ліміти для практики.",
    },
    features: {
      aiCalls: (limit: string) => `${limit} AI-запитів / місяць`,
      reports: (limit: string) => `${limit} AI-звітів / місяць`,
      noReports: "Без генерації AI-звітів",
      unlimitedQuizzesAttempts: "Необмежені вікторини та спроби",
      quizzes: (limit: string) => `Створення до ${limit} вікторин`,
      unlimitedQuizzes: "Необмежені вікторини",
      attempts: (limit: string) => `${limit} спроб вікторин`,
      unlimitedAttempts: "Необмежені спроби вікторин",
      wordBanks: (limit: string) => `${limit} банків слів`,
      unlimitedWordBanks: "Необмежені банки слів",
      extra: {
        allQuizTypes: "Усі типи вікторин",
        communitySupport: "Підтримка спільноти",
        priorityAiGeneration: "Пріоритетна AI-генерація",
        detailedAnalytics: "Детальна аналітика",
        emailSupport: "Підтримка електронною поштою",
        customGrammarTopics: "Власні граматичні теми",
        prioritySupport: "Пріоритетна підтримка",
        earlyAccess: "Ранній доступ до нових функцій",
      },
    },
    limitDetails: {
      price: {
        title: "Місячна ціна",
        description:
          "Сума підписки, що стягується щомісяця за тариф. Безкоштовні тарифи коштують $0.",
        extra:
          "Ця сторінка описує лише ліміти тарифу. Реальне списання платежів можна підключити окремо.",
      },
      aiCalls: {
        title: "AI-запити",
        description:
          "Один AI-запит - це один завершений Gemini-запит, виконаний застосунком.",
        extra:
          "Сюди входить генерація вікторин, розбір вставленої лексики, оцінювання перекладів, створення вікторин для повторення та серверне text-to-speech. Повторне відтворення вже кешованого аудіо в браузері не витрачає новий AI-запит.",
      },
      reports: {
        title: "AI-звіти",
        description:
          "Скільки розгорнутих звітів про прогрес студента можна згенерувати за один календарний місяць.",
        extra:
          "Ці звіти розраховані на сильнішу модель із більшими промптами та кращим міркуванням, тому ліміт відокремлено від звичайних AI-запитів.",
      },
      quizzes: {
        title: "Створені вікторини",
        description:
          "Скільки вікторин користувач може створити за один календарний місяць.",
        extra:
          "Збережені сесії повторення враховуються як вікторини, оскільки вони зберігаються в таблиці quizzes.",
      },
      attempts: {
        title: "Спроби вікторин",
        description:
          "Скільки завершених надсилань вікторин користувач може зробити за один календарний місяць.",
        extra:
          "Відкриття вікторини саме по собі не рахується. Спроба зараховується, коли збережено завершене надсилання.",
      },
      wordBanks: {
        title: "Банки слів",
        description:
          "Скільки збережених колекцій банків слів користувач може зберігати одночасно.",
        extra:
          "Слова, імпортовані безпосередньо в засвоєння, відокремлені від банків слів і не входять до цього ліміту.",
      },
    },
    howLimitsWorkTitle: "Як працюють ліміти",
    howLimitsWorkDescription:
      "Наведіть курсор на іконки інформації в картках тарифів для швидких пояснень або скористайтеся детальним описом нижче.",
    editor: {
      title: "Налаштування лімітів тарифів",
      description:
        "Оновлюйте цифри тарифів тут. Зміни впливають на перевірки квот, ліміти на панелі та картки порівняння тарифів.",
      monthlyPrice: "Місячна ціна",
      aiCallsPerMonth: "AI-запити / місяць",
      reportsPerMonth: "Звіти / місяць",
      quizzesPerMonth: "Вікторини / місяць",
      attemptsPerMonth: "Спроби / місяць",
      wordBanks: "Банки слів",
      reportsPlaceholder: "0 вимикає звіти",
      unlimitedPlaceholder: "Залиште порожнім для безліміту",
      helperText:
        "Залиште поля для вікторин, спроб або банків слів порожніми, щоб зберегти для цього тарифу безліміт. Встановіть для звітів 0, щоб вимкнути їх генерацію.",
      save: "Зберегти ліміти",
      saving: "Збереження...",
      saved: (plan: string) => `Ліміти тарифу ${plan} збережено`,
      saveFailed: "Не вдалося зберегти ліміти тарифу",
      required: (label: string) => `Поле \"${label}\" є обов'язковим`,
      wholeNumber: (label: string) =>
        `Поле \"${label}\" має бути цілим числом від 0 і більше`,
    },
  },
  billing: {
    title: "Оплата та використання",
    userDescription: "Ваш поточний тариф і використання квот цього місяця.",
    adminDescription:
      "Платформені метрики використання та відстеження AI-витрат.",
    usageTab: "Використання",
    plansTab: "Тарифи",
    openPlans: "Відкрити тарифи",
    currentPlanTitle: (plan: string) => `Тариф ${plan}`,
    freeBadge: "Безкоштовно",
    paidBadge: (price: number) => `$${price}/міс`,
    freePlanDescription:
      "Ви користуєтеся безкоштовним тарифом - усі основні можливості вже доступні.",
    subscribedDescription: (plan: string) => `У вас активний тариф ${plan}.`,
    usageTitles: {
      aiCalls: "AI-запити",
      quizzesCreated: "Створені вікторини",
      quizAttempts: "Спроби вікторин",
      wordBanks: "Банки слів",
      textRequests: "Текстові запити",
      ttsRequests: "TTS-запити",
      trackedAiCost: "Відстежена AI-вартість",
      unallocatedCalls: "Нерозподілені запити",
    },
    remaining: (count: string) => `${count} залишилось`,
    remainingThisMonth: (count: string) => `${count} залишилось цього місяця`,
    unlimited: "Безліміт",
    platformDescriptions: {
      aiCalls: (month: string) => `${month} по всіх користувачах`,
      quizzesCreated: (count: string) => `${count} створено цього місяця`,
      quizAttempts: (count: string) => `${count} завершено цього місяця`,
      wordBanks: "Наразі збережено по всіх користувачах",
    },
    platformAiUsageTitle: "Платформене використання AI",
    platformAiUsageDescription: (
      textModel: string,
      ttsModel: string,
      month: string,
    ) =>
      `Оцінки paid-tier для текстової генерації ${textModel} і text-to-speech ${ttsModel} у ${month}`,
    loadFailedTitle: "Платформене використання AI",
    loadFailedDescription:
      "Зараз не вдалося завантажити оцінки використання Gemini paid-tier.",
    textRequestsSummary: (cost: string, input: string, output: string) =>
      `${cost} приблизно - ${input} вхідних / ${output} вихідних токенів`,
    ttsRequestsSummary: (cost: string, input: string, output: string) =>
      `${cost} приблизно - ${input} текстових вхідних / ${output} аудіовихідних токенів`,
    trackedCostSummary: (count: string, month: string) =>
      `${count} відстежених запитів у ${month}`,
    unallocatedCallsOld:
      "Старі об'єднані запити цього місяця виключено з розділених оцінок",
    unallocatedCallsNone:
      "Цього місяця не залишилося нерозподілених запитів до початку відстеження",
    pricingBasisTitle: "Основа ціноутворення",
    pricingBasisDescription:
      "Офіційні ціни Google AI paid-tier для моделей, які зараз використовуються в цьому застосунку",
    inputTokensPrice: (cost: string) => `${cost} за 1 млн вхідних токенів`,
    outputTokensPrice: (cost: string) => `${cost} за 1 млн вихідних токенів`,
    inputTextTokensPrice: (cost: string) =>
      `${cost} за 1 млн вхідних текстових токенів`,
    outputAudioTokensPrice: (cost: string) =>
      `${cost} за 1 млн вихідних аудіотокенів`,
    estimationNote: (audioTokensPerSecond: number) =>
      `Текстові запити використовують метадані токенів відповіді Gemini. Якщо Gemini не повертає деталі про аудіотокени TTS, вихідні аудіотокени оцінюються за тривалістю з розрахунку ${audioTokensPerSecond} аудіотокенів на секунду.`,
    estimatedRequests: (count: number) =>
      `${count} ${formatPluralizedCount("uk", count, { one: "відстежений запит використовує", few: "відстежені запити використовують", many: "відстежених запитів використовують" })} резервну оцінку цього місяця.`,
    legacyCombinedCalls: (month: string, count: string) =>
      `Детальне відстеження поділу text-vs-TTS почалося після того, як частину AI-використання в ${month} уже було враховано, тому ${count} ранніх об'єднаних запитів неможливо розділити між двома картками моделей.`,
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
