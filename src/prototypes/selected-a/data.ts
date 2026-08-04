import courseIndexJson from "@/generated/public/course-index.json";
import m01DatasetJson from "@/generated/public/m01-dataset.json";
import m01YoutubeVideoMapJson from "@/generated/public/m01-youtube-video-map.json";
import m02DatasetJson from "@/generated/public/m02-dataset.json";
import m02YoutubeVideoMapJson from "@/generated/public/m02-youtube-video-map.json";
import m03DatasetJson from "@/generated/public/m03-dataset.json";
import m03YoutubeVideoMapJson from "@/generated/public/m03-youtube-video-map.json";
import m04DatasetJson from "@/generated/public/m04-dataset.json";
import m04YoutubeVideoMapJson from "@/generated/public/m04-youtube-video-map.json";
import m05DatasetJson from "@/generated/public/m05-dataset.json";
import m05YoutubeVideoMapJson from "@/generated/public/m05-youtube-video-map.json";
import m06DatasetJson from "@/generated/public/m06-dataset.json";
import m06YoutubeVideoMapJson from "@/generated/public/m06-youtube-video-map.json";
import m07DatasetJson from "@/generated/public/m07-dataset.json";
import m07YoutubeVideoMapJson from "@/generated/public/m07-youtube-video-map.json";
import m08DatasetJson from "@/generated/public/m08-dataset.json";
import m08YoutubeVideoMapJson from "@/generated/public/m08-youtube-video-map.json";
import q1 from "@/generated/public/quizzes/M01_L01.json";
import q2 from "@/generated/public/quizzes/M01_L02.json";
import q3 from "@/generated/public/quizzes/M01_L03.json";
import q4 from "@/generated/public/quizzes/M01_L04.json";
import q5 from "@/generated/public/quizzes/M01_L05.json";
import q6 from "@/generated/public/quizzes/M02_L01.json";
import q7 from "@/generated/public/quizzes/M02_L02.json";
import q8 from "@/generated/public/quizzes/M02_L03.json";
import q9 from "@/generated/public/quizzes/M02_L04.json";
import q10 from "@/generated/public/quizzes/M02_L05.json";
import q11 from "@/generated/public/quizzes/M03_L01.json";
import q12 from "@/generated/public/quizzes/M03_L02.json";
import q13 from "@/generated/public/quizzes/M03_L03.json";
import q14 from "@/generated/public/quizzes/M03_L04.json";
import q15 from "@/generated/public/quizzes/M03_L05.json";
import q16 from "@/generated/public/quizzes/M04_L01.json";
import q17 from "@/generated/public/quizzes/M04_L02.json";
import q18 from "@/generated/public/quizzes/M04_L03.json";
import q19 from "@/generated/public/quizzes/M04_L04.json";
import q20 from "@/generated/public/quizzes/M04_L05.json";
import q21 from "@/generated/public/quizzes/M05_L01.json";
import q22 from "@/generated/public/quizzes/M05_L02.json";
import q23 from "@/generated/public/quizzes/M05_L03.json";
import q24 from "@/generated/public/quizzes/M05_L04.json";
import q25 from "@/generated/public/quizzes/M05_L05.json";
import q26 from "@/generated/public/quizzes/M06_L01.json";
import q27 from "@/generated/public/quizzes/M06_L02.json";
import q28 from "@/generated/public/quizzes/M06_L03.json";
import q29 from "@/generated/public/quizzes/M06_L04.json";
import q30 from "@/generated/public/quizzes/M06_L05.json";
import q31 from "@/generated/public/quizzes/M07_L01.json";
import q32 from "@/generated/public/quizzes/M07_L02.json";
import q33 from "@/generated/public/quizzes/M07_L03.json";
import q34 from "@/generated/public/quizzes/M07_L04.json";
import q35 from "@/generated/public/quizzes/M07_L05.json";
import q36 from "@/generated/public/quizzes/M08_L01.json";
import q37 from "@/generated/public/quizzes/M08_L02.json";
import q38 from "@/generated/public/quizzes/M08_L03.json";
import q39 from "@/generated/public/quizzes/M08_L04.json";
import q40 from "@/generated/public/quizzes/M08_L05.json";
import { resolveLessonNextAction, type LessonNextAction } from "./lesson-navigation";

export type Status = "complete" | "in-progress" | "available" | "locked";
/** V3: lecture-materials merges transcript + slides. transcript/slides kept for legacy route compat. */
export type ItemId = "overview" | "vocabulary" | "video" | "lecture-materials" | "transcript" | "slides" | "practice" | "quiz" | "resources";
export interface Outcome { order:number; label:string; text:string; sourceText:string }
export interface TranscriptSection { id:string; order:number; text:string }
export interface VocabularyEntry { number:number; termEn:string; termRu:string; definition:string; contextExample:string; sourcePage:number; visualDescription:string|null }
export interface Lesson {
  code:string; titleRu:string; titleEn:string; moduleCode:string; orderInModule:number; objective:string;
  learningOutcomes:Outcome[];
  transcript:{canonicalFile:string; sections:TranscriptSection[]; sectionCount:number};
  vocabularyEntries:VocabularyEntry[]; deepDive:unknown;
  miniOutput:{title:{en:string;ru:string};purpose:string;status:string;estimatedTime:string;tools:string[];studentTask:string;orderedSteps:{order:number;text:string}[];ourExampleHeading?:string;selfCheck:string[]};
  resources:unknown[]; youtubeId:string|null; mediaStatus:{video:string;captions:string};
}
export interface ModuleSummary { code:string; titleRu:string; titleEn:string; order:number; lessonCodes:string[]; projectCode:string; goal:string; outcomes:Outcome[]; status:string }
export interface LessonSummary { code:string; moduleCode:string; orderInModule:number; globalOrder:number; titleRu:string; titleEn:string; objective:string; learningOutcomes:Outcome[]; status:string }
export interface ProjectSummary {
  code:string; moduleCode:string; order:number; titleRu:string; titleEn:string; objective:string;
  assessedOutcomes:Outcome[]; formatType:string; status:string;
  normalizedPublicContent?:{blocks:ProjectContentBlock[];blockCount:number};
}
export interface PublicQuiz { lessonCode:string; quizVersion:string; questions:{id:string;questionText:string;options:{id:string;text:string}[]}[] }
export interface ProjectContentBlock {
  order: number;
  type: "paragraph" | "table";
  style?: string;
  text?: string;
  rows?: string[][];
}
export interface YoutubeVideoMapping { youtubeId:string; youtubeUrl:string; visibility:"public" }

export const courseIndex = courseIndexJson as {
  course:{code:string;name:string;languageMode:string;moduleCount:number;lessonCount:number;projectCount:number;quizQuestionCount:number};
  modules:ModuleSummary[]; lessons:LessonSummary[]; projects:ProjectSummary[];
};
const m01 = m01DatasetJson as {module:ModuleSummary;lessons:Lesson[];project:ProjectSummary};
const m02 = m02DatasetJson as {module:ModuleSummary;lessons:Lesson[];project:ProjectSummary};
const m03 = m03DatasetJson as {module:ModuleSummary;lessons:Lesson[];project:ProjectSummary};
const m04 = m04DatasetJson as {module:ModuleSummary;lessons:Lesson[];project:ProjectSummary};
const m05 = m05DatasetJson as {module:ModuleSummary;lessons:Lesson[];project:ProjectSummary};
const m06 = m06DatasetJson as {module:ModuleSummary;lessons:Lesson[];project:ProjectSummary};
const m07 = m07DatasetJson as {module:ModuleSummary;lessons:Lesson[];project:ProjectSummary};
const m08 = m08DatasetJson as {module:ModuleSummary;lessons:Lesson[];project:ProjectSummary};
export const m01Module = m01.module;
export const m01Lessons = m01.lessons;
export const m01Project = m01.project;
export const m01YoutubeVideos = (m01YoutubeVideoMapJson as { videos:Record<string,YoutubeVideoMapping> }).videos;
export const m02Module = m02.module;
export const m02Lessons = m02.lessons;
export const m02Project = m02.project;
export const m02YoutubeVideos = (m02YoutubeVideoMapJson as { videos:Record<string,YoutubeVideoMapping> }).videos;
export const m03Module = m03.module;
export const m03Lessons = m03.lessons;
export const m03Project = m03.project;
export const m03YoutubeVideos = (m03YoutubeVideoMapJson as { videos:Record<string,YoutubeVideoMapping> }).videos;
export const m04Module = m04.module;
export const m04Lessons = m04.lessons;
export const m04Project = m04.project;
export const m04YoutubeVideos = (m04YoutubeVideoMapJson as { videos:Record<string,YoutubeVideoMapping> }).videos;
export const m05Module = m05.module;
export const m05Lessons = m05.lessons;
export const m05Project = m05.project;
export const m05YoutubeVideos = (m05YoutubeVideoMapJson as { videos:Record<string,YoutubeVideoMapping> }).videos;
export const m06Module = m06.module;
export const m06Lessons = m06.lessons;
export const m06Project = m06.project;
export const m06YoutubeVideos = (m06YoutubeVideoMapJson as { videos:Record<string,YoutubeVideoMapping> }).videos;
export const m07Module = m07.module;
export const m07Lessons = m07.lessons;
export const m07Project = m07.project;
export const m07YoutubeVideos = (m07YoutubeVideoMapJson as { videos:Record<string,YoutubeVideoMapping> }).videos;
export const m08Module = m08.module;
export const m08Lessons = m08.lessons;
export const m08Project = m08.project;
export const m08YoutubeVideos = (m08YoutubeVideoMapJson as { videos:Record<string,YoutubeVideoMapping> }).videos;
export const importedLessons = [...m01Lessons, ...m02Lessons, ...m03Lessons, ...m04Lessons, ...m05Lessons, ...m06Lessons, ...m07Lessons, ...m08Lessons];
export const importedModuleData:Record<string,{module:ModuleSummary;lessons:Lesson[];project:ProjectSummary;youtubeVideos:Record<string,YoutubeVideoMapping>}>= {
  M01:{module:m01Module,lessons:m01Lessons,project:m01Project,youtubeVideos:m01YoutubeVideos},
  M02:{module:m02Module,lessons:m02Lessons,project:m02Project,youtubeVideos:m02YoutubeVideos},
  M03:{module:m03Module,lessons:m03Lessons,project:m03Project,youtubeVideos:m03YoutubeVideos},
  M04:{module:m04Module,lessons:m04Lessons,project:m04Project,youtubeVideos:m04YoutubeVideos},
  M05:{module:m05Module,lessons:m05Lessons,project:m05Project,youtubeVideos:m05YoutubeVideos},
  M06:{module:m06Module,lessons:m06Lessons,project:m06Project,youtubeVideos:m06YoutubeVideos},
  M07:{module:m07Module,lessons:m07Lessons,project:m07Project,youtubeVideos:m07YoutubeVideos},
  M08:{module:m08Module,lessons:m08Lessons,project:m08Project,youtubeVideos:m08YoutubeVideos},
};
export const quizByLesson:Record<string,PublicQuiz>={
  M01_L01:q1 as PublicQuiz,M01_L02:q2 as PublicQuiz,M01_L03:q3 as PublicQuiz,M01_L04:q4 as PublicQuiz,M01_L05:q5 as PublicQuiz,
  M02_L01:q6 as PublicQuiz,M02_L02:q7 as PublicQuiz,M02_L03:q8 as PublicQuiz,M02_L04:q9 as PublicQuiz,M02_L05:q10 as PublicQuiz,
  M03_L01:q11 as PublicQuiz,M03_L02:q12 as PublicQuiz,M03_L03:q13 as PublicQuiz,M03_L04:q14 as PublicQuiz,M03_L05:q15 as PublicQuiz,
  M04_L01:q16 as PublicQuiz,M04_L02:q17 as PublicQuiz,M04_L03:q18 as PublicQuiz,M04_L04:q19 as PublicQuiz,M04_L05:q20 as PublicQuiz,
  M05_L01:q21 as PublicQuiz,M05_L02:q22 as PublicQuiz,M05_L03:q23 as PublicQuiz,M05_L04:q24 as PublicQuiz,M05_L05:q25 as PublicQuiz,
  M06_L01:q26 as PublicQuiz,M06_L02:q27 as PublicQuiz,M06_L03:q28 as PublicQuiz,M06_L04:q29 as PublicQuiz,M06_L05:q30 as PublicQuiz,
  M07_L01:q31 as PublicQuiz,M07_L02:q32 as PublicQuiz,M07_L03:q33 as PublicQuiz,M07_L04:q34 as PublicQuiz,M07_L05:q35 as PublicQuiz,
  M08_L01:q36 as PublicQuiz,M08_L02:q37 as PublicQuiz,M08_L03:q38 as PublicQuiz,M08_L04:q39 as PublicQuiz,M08_L05:q40 as PublicQuiz,
};
export const courseModules=courseIndex.modules;
export const courseLessons=courseIndex.lessons;
export const courseProjects=courseIndex.projects;

/**
 * V3 ITEMS: transcript + slides merged into lecture-materials.
 * Legacy itemIds transcript/slides are kept in the ItemId union for backward route compat
 * but are NOT present here — use itemIs() which also accepts them as legacy aliases.
 */
export const ITEMS:readonly {id:ItemId;ru:string;en:string;summary:string}[]=[
  {id:"overview",ru:"Обзор",en:"Overview",summary:"Цель, результаты и маршрут урока."},
  {id:"vocabulary",ru:"Словарь",en:"Vocabulary",summary:"Визуальный PDF словаря."},
  {id:"video",ru:"Видео",en:"Video",summary:"Основная видеолекция."},
  {id:"lecture-materials",ru:"Слайды и транскрипт",en:"Slides & Transcript",summary:"Слайды и транскрипт в едином просмотрщике."},
  {id:"practice",ru:"Практика",en:"Practice",summary:"Mini-output, пример и самопроверка."},
  {id:"quiz",ru:"Квиз",en:"Quiz",summary:"Пять вопросов урока."},
  {id:"resources",ru:"Материалы",en:"Resources",summary:"Дополнительные одобренные материалы."},
];

/** Legacy item IDs that redirect to lecture-materials but remain valid item route tokens. */
export const LEGACY_ITEM_IDS: ReadonlySet<string> = new Set(["transcript", "slides"]);

export const progress:Record<string,{status:Status;done:number;project:boolean;label:string}>={
  M01:{status:"in-progress",done:2,project:false,label:"В процессе"},
  M02:{status:"available",done:0,project:false,label:"Доступен"},
  M03:{status:"available",done:0,project:false,label:"Доступен"},
  M04:{status:"complete",done:5,project:true,label:"Завершён"},
  M05:{status:"available",done:0,project:false,label:"Доступен"},
  M06:{status:"available",done:0,project:false,label:"Доступен"},
  M07:{status:"available",done:0,project:false,label:"Доступен"},
  M08:{status:"available",done:0,project:false,label:"Доступен"},
};
export const totals={lessons:Object.values(progress).reduce((a,v)=>a+v.done,0),modules:Object.values(progress).filter(v=>v.status==="complete").length,projects:Object.values(progress).filter(v=>v.project).length};
export const itemsFor=(lesson:{resources:unknown[]})=>lesson.resources.length?ITEMS:ITEMS.filter(x=>x.id!=="resources");
export const moduleLessons=(code:string)=>courseLessons.filter(x=>x.moduleCode===code).sort((a,b)=>a.orderInModule-b.orderInModule);
export const moduleProject=(code:string)=>courseProjects.find(x=>x.moduleCode===code);
export const getLesson=(code:string)=>importedLessons.find(x=>x.code===code.toUpperCase());
export const getImportedModuleData=(code:string)=>importedModuleData[code.toUpperCase()];
export const getModule=(code:string)=>courseModules.find(x=>x.code===code.toUpperCase());
export const slugLesson=(code:string)=>`l${code.slice(-2).toLowerCase()}`;
export const codeLesson=(module:string,slug:string)=>`${module.toUpperCase()}_L${slug.replace(/^l/i,"").padStart(2,"0")}`;
export const pathHome="/prototype/a/home";
export const pathCourse="/prototype/a/course";
export const pathDashboard="/prototype/a/dashboard";
export const pathModule=(code:string)=>`/prototype/a/course/${code.toLowerCase()}`;
export const pathProject=(code:string)=>`${pathModule(code)}/project`;
export const pathItem=(module:string,lesson:string,item:ItemId)=>`${pathModule(module)}/${slugLesson(lesson)}/${item}`;
export type { LessonNextAction } from "./lesson-navigation";
export const nextActionForLesson=(lesson:Pick<Lesson,"code"|"moduleCode">):LessonNextAction=>resolveLessonNextAction({
  moduleCode:lesson.moduleCode,
  lessonCode:lesson.code,
  orderedLessonCodes:(importedModuleData[lesson.moduleCode]?.lessons ?? []).sort((a,b)=>a.orderInModule-b.orderInModule).map((entry)=>entry.code),
});
/** Accepts V3 ITEMS ids plus legacy transcript/slides aliases. */
export const itemIs=(v:string):v is ItemId=>ITEMS.some(x=>x.id===v)||LEGACY_ITEM_IDS.has(v);
export const primaryAudience="Старшеклассники и студенты первых курсов, которые начинают изучать архитектуру.";
export const moduleCompletionMessage="Пространство прочитано.";
export const lessonCompletionMessage="Следующий урок доступен.";
