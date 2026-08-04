import Link from "next/link";
import { courseIndex, m01Lesson, m01Module } from "@/src/prototypes/content";
import { prototypePath } from "@/src/prototypes/directions";

export default function PrototypeReviewPage() {
  return (
    <main className="review-page">
      <header className="review-header">
        <div className="review-wordmark" aria-label="ARCH.START"><span aria-hidden="true" /></div>
        <div><span>PHASE 02 / SELECTED DIRECTION</span><Link href="/prototype/a/home">Open selected A workspace</Link></div>
      </header>

      <section className="review-intro" aria-labelledby="review-title">
        <span className="prototype-kicker">GOVERNING DECISION</span>
        <h1 id="review-title">A — Studio Precision selected for the learning workspace.</h1>
        <p>
          The core Russian learning product now uses a separate Course Overview, module branches and focused learning-item routes.
          The evidence remains grounded in {courseIndex.course.moduleCount} modules, {courseIndex.course.lessonCount} lessons,
          M01 «{m01Module.titleRu}» and M01_L01 «{m01Lesson.titleRu}».
        </p>
      </section>

      <section className="review-directions" aria-label="Selected direction and design history">
        <article className="review-direction review-direction--a">
          <div className="review-direction__label">A</div>
          <div className="review-direction__header"><span>SELECTED / LEARNING WORKSPACE</span><h2>Studio Precision</h2><p>Calm, precise, route-aware and designed for long learning sessions.</p></div>
          <p>Direction A is rebuilt around the actual lesson hierarchy rather than one continuous lesson page.</p>
          <div className="review-link-grid">
            <Link href="/prototype/a/home">Public Home</Link>
            <Link href="/prototype/a/course">Course Overview</Link>
            <Link href="/prototype/a/dashboard">Dashboard</Link>
            <Link href="/prototype/a/course/m01?lesson=M01_L01">Module Overview</Link>
            <Link href="/prototype/a/course/m01/l01/overview">Lesson Overview</Link>
            <Link href="/prototype/a/course/m01/l01/vocabulary">Vocabulary PDF</Link>
            <Link href="/prototype/a/course/m01/l01/practice">Practice</Link>
            <Link href="/prototype/a/course/m01/l01/quiz">Quiz</Link>
          </div>
        </article>

        <article className="review-direction review-direction--b">
          <div className="review-direction__label">B</div>
          <div className="review-direction__header"><span>DESIGN HISTORY ONLY</span><h2>Calm Architectural Workspace</h2><p>Preserved as evidence from the three-direction comparison.</p></div>
          <p>It is not merged into the selected learning workspace.</p>
          <div className="review-link-grid">
            <Link href={prototypePath("b", "home")}>Historical Home</Link>
            <Link href={prototypePath("b", "dashboard")}>Historical Dashboard</Link>
            <Link href={prototypePath("b", "module")}>Historical Module</Link>
            <Link href={prototypePath("b", "lesson")}>Historical Lesson</Link>
          </div>
        </article>

        <article className="review-direction review-direction--c">
          <div className="review-direction__label">C</div>
          <div className="review-direction__header"><span>DESIGN HISTORY / FUTURE EN REFERENCE</span><h2>Architectural Editorial Workspace</h2><p>Retained as possible evidence for the later English documentary area.</p></div>
          <p>It is not used in the Russian core lesson interface.</p>
          <div className="review-link-grid">
            <Link href={prototypePath("c", "home")}>Historical Home</Link>
            <Link href={prototypePath("c", "dashboard")}>Historical Dashboard</Link>
            <Link href={prototypePath("c", "module")}>Historical Module</Link>
            <Link href={prototypePath("c", "lesson")}>Historical Lesson</Link>
          </div>
        </article>
      </section>

      <section className="review-differences" aria-labelledby="review-ia-title">
        <div><span className="prototype-kicker">FINAL LEARNING IA</span><h2 id="review-ia-title">One selected visual language, seven focused lesson items.</h2></div>
        <div className="review-difference-grid">
          <article><strong>COURSE</strong><p>Whole-course structure and clearly marked demonstration progress.</p></article>
          <article><strong>MODULE</strong><p>Five expandable lesson branches followed by the module project.</p></article>
          <article><strong>LESSON</strong><p>Overview, Vocabulary, Video, Transcript, Slides, Practice and Quiz open separately.</p></article>
        </div>
      </section>

      <section className="review-recommendation" aria-labelledby="review-stop-title">
        <span className="prototype-kicker">PHASE BOUNDARY</span>
        <h2 id="review-stop-title">Direction A is selected. Phase 03 has not started.</h2>
        <p>B and C remain unchanged design-history evidence. No authentication, persistent progress, certificates or full M02–M08 import was added.</p>
      </section>
    </main>
  );
}
