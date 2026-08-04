export const SCHEMA_VERSION = "1.0.0";
export const CONTENT_VERSION = "phase01-source-2026-07-27";
export const QUIZ_VERSION = CONTENT_VERSION;

export const REQUIRED_GEN_FILES = Object.freeze({
  "Course Structure.txt": "COURSE_STRUCTURE",
  "Lessons Obj.txt": "LESSON_OBJECTIVES",
  "Modules Obj.txt": "MODULE_OBJECTIVES",
  "Projects Obj.txt": "PROJECT_OBJECTIVES",
  "Questions Lessons.txt": "QUIZ_SOURCE",
} as const);

export const EXPECTED_COUNTS = Object.freeze({
  modules: 8,
  lessons: 40,
  projects: 8,
  quizQuestions: 200,
  questionsPerLesson: 5,
});

export const LESSON_ASSET_ROLES = ["PRES", "SRPT", "VOCB", "MNOT", "PICE"] as const;
export const PROJECT_ASSET_ROLES = ["STUDENT_PAGE", "EXAMPLE_PPTX", "PREVIEW_IMAGE"] as const;
