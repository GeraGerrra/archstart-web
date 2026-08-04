"use client";

import { useState } from "react";
import { CourseContentsDrawer } from "@/src/app-shell";
import { CourseTree } from "./CourseTree";
import { LessonHeader } from "./LessonHeader";
import { LessonPager } from "./LessonPager";
import type { LessonWorkspaceProps } from "./types";

export function LessonWorkspace({
  model,
  activeItemContent,
  completionContent,
  initialContentsOpen = false,
}: LessonWorkspaceProps) {
  const [contentsOpen, setContentsOpen] = useState(initialContentsOpen);

  return (
    <>
      <div className="asa-lesson-shell">
        <aside className="asa-lesson-shell__tree"><CourseTree model={model.courseTree} /></aside>
        <div className="asa-lesson-shell__main">
          <button type="button" className="asa-contents-button" onClick={() => setContentsOpen(true)}><span aria-hidden="true">{model.contents.triggerIcon}</span> {model.contents.triggerLabel} <small>{model.contents.triggerSummary}</small></button>
          <LessonHeader model={model.header} />
          {activeItemContent}
          <LessonPager model={model.pager} />
          {completionContent}
        </div>
      </div>
      <CourseContentsDrawer
        open={contentsOpen}
        eyebrow={model.contents.drawerEyebrow}
        title={model.contents.drawerTitle}
        ariaLabel={model.contents.drawerAriaLabel}
        closeLabel={model.contents.drawerCloseLabel}
        onClose={() => setContentsOpen(false)}
      >
        <CourseTree model={model.courseTree} onNavigate={() => setContentsOpen(false)} />
      </CourseContentsDrawer>
    </>
  );
}
