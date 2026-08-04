export interface LessonPrototypeAssets {
  vocabulary?: {
    pdf: string;
    pages: string[];
    pageWidth: number;
    pageHeight: number;
  };
  lectureMaterials?: {
    slides: string[];
    pdf?: string;
    slideWidth: number;
    slideHeight: number;
  };
  practiceExample?: {
    src: string;
    width: number;
    height: number;
    alt: string;
    caption?: string;
  };
}

export const PENDING_MATERIAL_MESSAGE = "Материал будет добавлен после публикации утверждённого файла.";

function lessonSlides(slug: string, count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `/prototype-assets/${slug}-slides/slide-${String(index + 1).padStart(2, "0")}.png`,
  );
}

function vocabularyPages(slug: string, count = 3): string[] {
  return Array.from({ length: count }, (_, pageIndex) => pageIndex + 1).map(
    (index) => `/prototype-assets/${slug}-vocabulary-page-${String(index).padStart(2, "0")}.png`,
  );
}

/**
 * Browser-facing visual assets approved for the active M01–M08 modules. Every entry
 * is lesson-specific; no lesson may borrow another lesson's files.
 */
export const LESSON_PROTOTYPE_ASSETS: Partial<Record<string, LessonPrototypeAssets>> = {
  M01_L01: {
    vocabulary: {
      pdf: "/prototype-assets/m01-l01-vocabulary.pdf",
      pages: [
        "/prototype-assets/m01-l01-vocabulary-page-01.png",
        "/prototype-assets/m01-l01-vocabulary-page-02.png",
        "/prototype-assets/m01-l01-vocabulary-page-03.png",
      ],
      pageWidth: 1241,
      pageHeight: 1755,
    },
    lectureMaterials: {
      slides: lessonSlides("m01-l01", 24),
      pdf: "/prototype-assets/m01-l01-presentation.pdf",
      slideWidth: 1920,
      slideHeight: 1080,
    },
    practiceExample: {
      src: "/prototype-assets/m01-l01-our-example.png",
      width: 2337,
      height: 1653,
      alt: "Пример пятислойной диаграммы архитектурного чтения",
      caption: "Один способ собрать 5-layer reading diagram",
    },
  },
  M01_L02: {
    vocabulary: {
      pdf: "/prototype-assets/m01-l02-vocabulary.pdf",
      pages: vocabularyPages("m01-l02"),
      pageWidth: 1241,
      pageHeight: 1755,
    },
    lectureMaterials: {
      slides: lessonSlides("m01-l02", 27),
      slideWidth: 1920,
      slideHeight: 1080,
    },
    practiceExample: {
      src: "/prototype-assets/m01-l02-our-example.png",
      width: 2337,
      height: 1653,
      alt: "Пример мини-брифа, сценария пользователя и диаграммы связей",
      caption: "Пример блока brief, user scenario and adjacency",
    },
  },
  M01_L03: {
    vocabulary: {
      pdf: "/prototype-assets/m01-l03-vocabulary.pdf",
      pages: vocabularyPages("m01-l03"),
      pageWidth: 1241,
      pageHeight: 1755,
    },
    lectureMaterials: {
      slides: lessonSlides("m01-l03", 27),
      slideWidth: 1920,
      slideHeight: 1080,
    },
    practiceExample: {
      src: "/prototype-assets/m01-l03-our-example.png",
      width: 2337,
      height: 1653,
      alt: "Пример аннотированного чтения плана, разреза и фасада",
      caption: "Пример drawing evidence sheet",
    },
  },
  M01_L04: {
    vocabulary: {
      pdf: "/prototype-assets/m01-l04-vocabulary.pdf",
      pages: vocabularyPages("m01-l04"),
      pageWidth: 1241,
      pageHeight: 1755,
    },
    lectureMaterials: {
      slides: lessonSlides("m01-l04", 28),
      slideWidth: 1920,
      slideHeight: 1080,
    },
    practiceExample: {
      src: "/prototype-assets/m01-l04-our-example.png",
      width: 2337,
      height: 1653,
      alt: "Пример диагностики масштаба, пропорции, ритма и иерархии",
      caption: "Пример scale and hierarchy diagnosis",
    },
  },
  M01_L05: {
    vocabulary: {
      pdf: "/prototype-assets/m01-l05-vocabulary.pdf",
      pages: vocabularyPages("m01-l05"),
      pageWidth: 1241,
      pageHeight: 1755,
    },
    lectureMaterials: {
      slides: lessonSlides("m01-l05", 29),
      slideWidth: 1920,
      slideHeight: 1080,
    },
    practiceExample: {
      src: "/prototype-assets/m01-l05-our-example.png",
      width: 2337,
      height: 1653,
      alt: "Пример концепции Quiet Edge и трёх проектных итераций",
      caption: "Пример concept and iteration block",
    },
  },
  M02_L01: {
    vocabulary: { pdf: "/prototype-assets/m02-l01-vocabulary.pdf", pages: vocabularyPages("m02-l01", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m02-l01", 29), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m02-l01-our-example.png", width: 2337, height: 1653, alt: "Пример карточки логики древней архитектуры", caption: "Пример Ancient Form Logic Card" },
  },
  M02_L02: {
    vocabulary: { pdf: "/prototype-assets/m02-l02-vocabulary.pdf", pages: vocabularyPages("m02-l02", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m02-l02", 30), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m02-l02-our-example.png", width: 2337, height: 1653, alt: "Пример сравнительной карточки климата, культуры и конструкции", caption: "Пример Climate / Culture / Structure Comparison Card" },
  },
  M02_L03: {
    vocabulary: { pdf: "/prototype-assets/m02-l03-vocabulary.pdf", pages: vocabularyPages("m02-l03", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m02-l03", 30), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m02-l03-our-example.png", width: 2337, height: 1653, alt: "Пример диаграммы оси, симметрии и власти", caption: "Пример Axis / Symmetry / Power Diagram" },
  },
  M02_L04: {
    vocabulary: { pdf: "/prototype-assets/m02-l04-vocabulary.pdf", pages: vocabularyPages("m02-l04", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m02-l04", 31), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m02-l04-our-example.png", width: 2337, height: 1653, alt: "Пример диаграммы индустриальной логики и модернизма", caption: "Пример Modernism / Industrial Logic Diagram" },
  },
  M02_L05: {
    vocabulary: { pdf: "/prototype-assets/m02-l05-vocabulary.pdf", pages: vocabularyPages("m02-l05", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m02-l05", 31), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m02-l05-our-example.png", width: 2337, height: 1653, alt: "Пример карты подходов современной архитектуры", caption: "Пример Contemporary Architecture Approach Map" },
  },
  M03_L01: {
    vocabulary: { pdf: "/prototype-assets/m03-l01-vocabulary.pdf", pages: vocabularyPages("m03-l01", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m03-l01", 30), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m03-l01-our-example.png", width: 2337, height: 1653, alt: "Пример послойной карты анализа участка", caption: "Пример Layered Site Analysis Map" },
  },
  M03_L02: {
    vocabulary: { pdf: "/prototype-assets/m03-l02-vocabulary.pdf", pages: vocabularyPages("m03-l02", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m03-l02", 30), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m03-l02-our-example.png", width: 2337, height: 1653, alt: "Пример разреза дневного света", caption: "Пример Daylight Section" },
  },
  M03_L03: {
    vocabulary: { pdf: "/prototype-assets/m03-l03-vocabulary.pdf", pages: vocabularyPages("m03-l03", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m03-l03", 31), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m03-l03-our-example.png", width: 2337, height: 1653, alt: "Пример плана движения воздуха и разреза эффекта тяги", caption: "Пример Airflow Plan + Stack Effect Section" },
  },
  M03_L04: {
    vocabulary: { pdf: "/prototype-assets/m03-l04-vocabulary.pdf", pages: vocabularyPages("m03-l04", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m03-l04", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m03-l04-our-example.png", width: 2337, height: 1653, alt: "Пример диагностики теплового комфорта", caption: "Пример Thermal Comfort Diagnosis Diagram" },
  },
  M03_L05: {
    vocabulary: { pdf: "/prototype-assets/m03-l05-vocabulary.pdf", pages: vocabularyPages("m03-l05", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m03-l05", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m03-l05-our-example.png", width: 2337, height: 1653, alt: "Пример стратегии стока воды и микроклимата", caption: "Пример Runoff + Microclimate Strategy Diagram" },
  },
  M04_L01: {
    vocabulary: { pdf: "/prototype-assets/m04-l01-vocabulary.pdf", pages: vocabularyPages("m04-l01", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m04-l01", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m04-l01-our-example.png", width: 2337, height: 1653, alt: "Пример диаграммы чтения пути нагрузки", caption: "Пример Load Path Reading Diagram" },
  },
  M04_L02: {
    vocabulary: { pdf: "/prototype-assets/m04-l02-vocabulary.pdf", pages: vocabularyPages("m04-l02", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m04-l02", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m04-l02-our-example.png", width: 2337, height: 1653, alt: "Пример структурного анатомического разреза", caption: "Пример Structural Anatomy Section" },
  },
  M04_L03: {
    vocabulary: { pdf: "/prototype-assets/m04-l03-vocabulary.pdf", pages: vocabularyPages("m04-l03", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m04-l03", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m04-l03-our-example.png", width: 2337, height: 1653, alt: "Пример карточки сравнения конструктивных систем", caption: "Пример Structural System Comparison Card" },
  },
  M04_L04: {
    vocabulary: { pdf: "/prototype-assets/m04-l04-vocabulary.pdf", pages: vocabularyPages("m04-l04", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m04-l04", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m04-l04-our-example.png", width: 2337, height: 1653, alt: "Пример диаграммы устойчивости высотного здания", caption: "Пример High-Rise Stability Diagram" },
  },
  M04_L05: {
    vocabulary: { pdf: "/prototype-assets/m04-l05-vocabulary.pdf", pages: vocabularyPages("m04-l05", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m04-l05", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m04-l05-our-example.png", width: 2337, height: 1653, alt: "Пример диаграммы последовательности строительства", caption: "Пример Construction Sequence Diagram" },
  },
  M05_L01: {
    vocabulary: { pdf: "/prototype-assets/m05-l01-vocabulary.pdf", pages: vocabularyPages("m05-l01", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m05-l01", 31), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m05-l01-our-example.png", width: 2337, height: 1653, alt: "Пример карточки роли и работы материала", caption: "Пример Material Role Card" },
  },
  M05_L02: {
    vocabulary: { pdf: "/prototype-assets/m05-l02-vocabulary.pdf", pages: vocabularyPages("m05-l02", 5), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m05-l02", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m05-l02-our-example.png", width: 2337, height: 1653, alt: "Пример сравнительной матрицы строительных материалов", caption: "Пример Material Comparison Matrix" },
  },
  M05_L03: {
    vocabulary: { pdf: "/prototype-assets/m05-l03-vocabulary.pdf", pages: vocabularyPages("m05-l03", 5), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m05-l03", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m05-l03-our-example.png", width: 2337, height: 1653, alt: "Пример послойного разреза оболочки здания", caption: "Пример Envelope Layer Section" },
  },
  M05_L04: {
    vocabulary: { pdf: "/prototype-assets/m05-l04-vocabulary.pdf", pages: vocabularyPages("m05-l04", 5), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m05-l04", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m05-l04-our-example.png", width: 2337, height: 1653, alt: "Пример сравнения отказа и исправления критического узла", caption: "Пример Critical Detail Failure/Fix Diagram" },
  },
  M05_L05: {
    vocabulary: { pdf: "/prototype-assets/m05-l05-vocabulary.pdf", pages: vocabularyPages("m05-l05", 5), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m05-l05", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m05-l05-our-example.png", width: 2337, height: 1653, alt: "Пример стратегии старения, обслуживания и повторного использования", caption: "Пример Aging + Maintenance + Reuse Strategy Diagram" },
  },
  M06_L01: {
    vocabulary: { pdf: "/prototype-assets/m06-l01-vocabulary.pdf", pages: vocabularyPages("m06-l01", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m06-l01", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m06-l01-our-example.png", width: 2337, height: 1653, alt: "Пример диаграммы диагностики устойчивости", caption: "Пример Sustainability Diagnosis Diagram" },
  },
  M06_L02: {
    vocabulary: { pdf: "/prototype-assets/m06-l02-vocabulary.pdf", pages: vocabularyPages("m06-l02", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m06-l02", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m06-l02-our-example.png", width: 2337, height: 1653, alt: "Пример учебной оценочной карты по логике LEED", caption: "Пример Mini LEED-Inspired Scorecard" },
  },
  M06_L03: {
    vocabulary: { pdf: "/prototype-assets/m06-l03-vocabulary.pdf", pages: vocabularyPages("m06-l03", 5), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m06-l03", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m06-l03-our-example.png", width: 2337, height: 1653, alt: "Пример временной линии воплощённого и эксплуатационного углерода", caption: "Пример Embodied vs Operational Carbon Timeline" },
  },
  M06_L04: {
    vocabulary: { pdf: "/prototype-assets/m06-l04-vocabulary.pdf", pages: vocabularyPages("m06-l04", 5), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m06-l04", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m06-l04-our-example.png", width: 2337, height: 1653, alt: "Пример разреза пассивной стратегии", caption: "Пример Passive Strategy Section" },
  },
  M06_L05: {
    vocabulary: { pdf: "/prototype-assets/m06-l05-vocabulary.pdf", pages: vocabularyPages("m06-l05", 5), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m06-l05", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m06-l05-our-example.png", width: 2337, height: 1653, alt: "Пример карты стратегии экологии участка", caption: "Пример Site Ecology Strategy Map" },
  },
  M07_L01: {
    vocabulary: { pdf: "/prototype-assets/m07-l01-vocabulary.pdf", pages: vocabularyPages("m07-l01", 5), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m07-l01", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m07-l01-our-example.png", width: 2337, height: 1653, alt: "Пример диаграммы диагностики архитектурного риска", caption: "Пример Risk Diagnosis Diagram" },
  },
  M07_L02: {
    vocabulary: { pdf: "/prototype-assets/m07-l02-vocabulary.pdf", pages: vocabularyPages("m07-l02", 5), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m07-l02", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m07-l02-our-example.png", width: 2337, height: 1653, alt: "Пример сравнения сейсмической уязвимости до и после", caption: "Пример Earthquake Before/After Upgrade" },
  },
  M07_L03: {
    vocabulary: { pdf: "/prototype-assets/m07-l03-vocabulary.pdf", pages: vocabularyPages("m07-l03", 5), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m07-l03", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m07-l03-our-example.png", width: 2337, height: 1653, alt: "Пример стратегии защиты здания от воды", caption: "Пример Flood + Drainage Strategy" },
  },
  M07_L04: {
    vocabulary: { pdf: "/prototype-assets/m07-l04-vocabulary.pdf", pages: vocabularyPages("m07-l04", 5), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m07-l04", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m07-l04-our-example.png", width: 2337, height: 1653, alt: "Пример схемы пожарной безопасности и эвакуации", caption: "Пример Fire Safety + Evacuation Diagram" },
  },
  M07_L05: {
    vocabulary: { pdf: "/prototype-assets/m07-l05-vocabulary.pdf", pages: vocabularyPages("m07-l05", 5), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m07-l05", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m07-l05-our-example.png", width: 2337, height: 1653, alt: "Пример адаптации здания к экстремальной жаре и ветру", caption: "Пример Heat + Wind Adaptation Strategy" },
  },
  M08_L01: {
    vocabulary: { pdf: "/prototype-assets/m08-l01-vocabulary.pdf", pages: vocabularyPages("m08-l01", 5), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m08-l01", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m08-l01-our-example.png", width: 2337, height: 1653, alt: "Пример карты выбора комплекта архитектурных чертежей", caption: "Пример Drawing Set Selection Map" },
  },
  M08_L02: {
    vocabulary: { pdf: "/prototype-assets/m08-l02-vocabulary.pdf", pages: vocabularyPages("m08-l02", 5), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m08-l02", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m08-l02-our-example.png", width: 2337, height: 1653, alt: "Пример схемы компоновки презентационного планшета", caption: "Пример Presentation Board Layout Plan" },
  },
  M08_L03: {
    vocabulary: { pdf: "/prototype-assets/m08-l03-vocabulary.pdf", pages: vocabularyPages("m08-l03", 5), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m08-l03", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m08-l03-our-example.png", width: 2337, height: 1653, alt: "Пример последовательности разворотов архитектурного портфолио", caption: "Пример Portfolio Spread Sequence" },
  },
  M08_L04: {
    vocabulary: { pdf: "/prototype-assets/m08-l04-vocabulary.pdf", pages: vocabularyPages("m08-l04", 5), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m08-l04", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m08-l04-our-example.png", width: 2337, height: 1653, alt: "Пример матрицы выбора способа архитектурной подачи", caption: "Пример Representation Choice Matrix" },
  },
  M08_L05: {
    vocabulary: { pdf: "/prototype-assets/m08-l05-vocabulary.pdf", pages: vocabularyPages("m08-l05", 4), pageWidth: 1241, pageHeight: 1755 },
    lectureMaterials: { slides: lessonSlides("m08-l05", 32), slideWidth: 1920, slideHeight: 1080 },
    practiceExample: { src: "/prototype-assets/m08-l05-our-example.png", width: 2337, height: 1653, alt: "Пример двухминутной защиты и самокритики проекта", caption: "Пример 2-Minute Project Defense Script" },
  },
};

export function getLessonPrototypeAssets(lessonCode: string): LessonPrototypeAssets | undefined {
  return LESSON_PROTOTYPE_ASSETS[lessonCode.toUpperCase()];
}
