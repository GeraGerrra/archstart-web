"use client";

import { useEffect } from "react";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/client";

const LESSON_CODE_PATTERN = /^M0[1-8]_L0[1-5]$/u;
const STORED_ITEMS = new Set([
  "overview",
  "vocabulary",
  "video",
  "lecture-materials",
  "practice",
  "quiz",
]);

export interface LessonActivityRecorderProps {
  lessonCode: string;
  item: string;
}

export function LessonActivityRecorder({
  lessonCode,
  item,
}: LessonActivityRecorderProps) {
  useEffect(() => {
    const normalizedLessonCode = lessonCode.toUpperCase();
    if (!LESSON_CODE_PATTERN.test(normalizedLessonCode) || !STORED_ITEMS.has(item)) {
      return;
    }

    const client = createBrowserSupabaseClient();

    async function recordActivity(): Promise<void> {
      const { data: sessionResult } = await client.auth.getSession();
      if (!sessionResult.session) return;

      await client.rpc("record_lesson_activity", {
        p_lesson_code: normalizedLessonCode,
        p_last_item: item,
      });
    }

    void recordActivity();
  }, [item, lessonCode]);

  return null;
}
