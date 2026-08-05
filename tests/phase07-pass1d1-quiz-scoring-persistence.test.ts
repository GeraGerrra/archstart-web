import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  QuizAttemptValidationError,
  scoreQuizAttempt,
} from "../src/server/quiz-scoring.ts";
import {
  resetQuizAnswerKeyCacheForTests,
} from "../src/server/quiz-answer-key-loader.ts";
import {
  resetPublicQuizCacheForTests,
} from "../src/server/public-quiz-loader.ts";

const root = process.cwd();
const answerPath = join(root, "generated/server/quiz-answer-keys.json");
const expectedAnswerAuthoritySha256 = "b64ab630fb495013750400208aeb56228628b61aff18edaf792793951db8c75d";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

test("accepted Quiz authority remains 40 lessons, 200 questions, five per lesson", async () => {
  const raw = readFileSync(answerPath);
  assert.equal(createHash("sha256").update(raw).digest("hex"), expectedAnswerAuthoritySha256);
  const answerFile = JSON.parse(raw.toString("utf8")) as {
    quizzes: Record<string, {
      lessonCode: string;
      quizVersion: string;
      answers: Array<{ questionId: string; correctOptionId: string }>;
    }>;
  };
  const quizFiles = readdirSync(join(root, "generated/public/quizzes"))
    .filter((name) => /^M0[1-8]_L0[1-5]\.json$/u.test(name))
    .sort();

  assert.equal(quizFiles.length, 40);
  assert.equal(Object.keys(answerFile.quizzes).length, 40);

  let totalQuestions = 0;
  for (const fileName of quizFiles) {
    const lessonCode = fileName.replace(/\.json$/u, "");
    const publicQuiz = readJson(join(root, "generated/public/quizzes", fileName)) as {
      lessonCode: string;
      quizVersion: string;
      questions: Array<{ id: string; options: Array<{ id: string }> }>;
    };
    const answerSet = answerFile.quizzes[lessonCode];
    assert.ok(answerSet);
    assert.equal(publicQuiz.lessonCode, lessonCode);
    assert.equal(answerSet.lessonCode, lessonCode);
    assert.equal(publicQuiz.quizVersion, answerSet.quizVersion);
    assert.equal(publicQuiz.questions.length, 5);
    assert.equal(answerSet.answers.length, 5);
    totalQuestions += publicQuiz.questions.length;

    const answerByQuestion = new Map(answerSet.answers.map((answer) => [answer.questionId, answer.correctOptionId]));
    const allCorrect = Object.fromEntries(publicQuiz.questions.map((question) => {
      const correctOptionId = answerByQuestion.get(question.id);
      assert.ok(correctOptionId);
      assert.ok(question.options.some((option) => option.id === correctOptionId));
      return [question.id, correctOptionId];
    }));
    const allWrong = Object.fromEntries(publicQuiz.questions.map((question) => {
      const correctOptionId = answerByQuestion.get(question.id);
      const wrongOption = question.options.find((option) => option.id !== correctOptionId);
      assert.ok(wrongOption);
      return [question.id, wrongOption.id];
    }));

    const correctScore = await scoreQuizAttempt({ lessonCode, selectedAnswers: allCorrect });
    const wrongScore = await scoreQuizAttempt({ lessonCode, selectedAnswers: allWrong });
    assert.equal(correctScore.score, 5);
    assert.equal(wrongScore.score, 0);
    assert.equal(correctScore.questionCount, 5);
    assert.equal(correctScore.answerKeySha256, expectedAnswerAuthoritySha256);
    assert.deepEqual(Object.keys(correctScore.selectedAnswers), publicQuiz.questions.map((question) => question.id));
  }

  assert.equal(totalQuestions, 200);
  resetQuizAnswerKeyCacheForTests();
  resetPublicQuizCacheForTests();
});

test("server scorer rejects incomplete, extra, and non-option submissions", async () => {
  const publicQuiz = readJson(join(root, "generated/public/quizzes/M01_L01.json")) as {
    questions: Array<{ id: string; options: Array<{ id: string }> }>;
  };
  const incomplete = Object.fromEntries(publicQuiz.questions.slice(0, 4).map((question) => [question.id, question.options[0]!.id]));
  await assert.rejects(
    scoreQuizAttempt({ lessonCode: "M01_L01", selectedAnswers: incomplete }),
    QuizAttemptValidationError,
  );

  const invalidOption = Object.fromEntries(publicQuiz.questions.map((question) => [question.id, `${question.id}_OPT_INVALID`]));
  await assert.rejects(
    scoreQuizAttempt({ lessonCode: "M01_L01", selectedAnswers: invalidOption }),
    QuizAttemptValidationError,
  );

  const extra = {
    ...Object.fromEntries(publicQuiz.questions.map((question) => [question.id, question.options[0]!.id])),
    EXTRA_QUESTION: "EXTRA_OPTION",
  };
  await assert.rejects(
    scoreQuizAttempt({ lessonCode: "M01_L01", selectedAnswers: extra }),
    QuizAttemptValidationError,
  );
});

test("secret client is server-only and uses a non-public Supabase secret variable", () => {
  const source = readFileSync(join(root, "src/lib/supabase/admin.ts"), "utf8");
  assert.match(source, /import "server-only"/u);
  assert.match(source, /SUPABASE_SECRET_KEY/u);
  assert.match(source, /sb_secret_/u);
  assert.match(source, /persistSession:\s*false/u);
  assert.match(source, /autoRefreshToken:\s*false/u);
  assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_SECRET/u);
});

test("server action authenticates before scoring and accepts no client-owned score or identity", () => {
  const source = readFileSync(join(root, "src/server/quiz-attempt-action.ts"), "utf8");
  const claimsPosition = source.indexOf(
    "await sessionClient.auth.getClaims()",
  );
  const authGuardPosition = source.indexOf(
    "if (claimsError || !userId)",
  );
  const scoringPosition = source.indexOf(
    "await scoreQuizAttempt(input)",
  );
  const secretPosition = source.indexOf(
    "const secretClient = createSecretSupabaseClient()",
  );

  assert.ok(claimsPosition >= 0);
  assert.ok(authGuardPosition > claimsPosition);
  assert.ok(scoringPosition > authGuardPosition);
  assert.ok(secretPosition > scoringPosition);
  assert.match(source, /user_id:\s*userId/u);
  assert.match(source, /score:\s*scored\.score/u);
  assert.match(source, /answer_key_sha256:\s*scored\.answerKeySha256/u);
  assert.doesNotMatch(source, /input\.(?:score|userId|answerKeySha256)/u);
  assert.doesNotMatch(source, /correctOptionId|explanation/u);
});

test("browser-facing Quiz source receives only an opaque action result", () => {
  const shell = readFileSync(join(root, "src/quiz/QuizShell.tsx"), "utf8");
  const types = readFileSync(join(root, "src/quiz/types.ts"), "utf8");
  const selectedA = readFileSync(join(root, "src/prototypes/selected-a/SelectedAPrototype.tsx"), "utf8");
  assert.match(shell, /submitAction/u);
  assert.match(shell, /selectedAnswers/u);
  assert.match(types, /QuizSubmissionAction/u);
  assert.match(selectedA, /quizSubmitAction/u);
  for (const source of [shell, types, selectedA]) {
    assert.doesNotMatch(source, /correctOptionId|correctAnswer|canonicalExplanation|quiz-answer-keys/u);
    assert.doesNotMatch(source, /SUPABASE_SECRET_KEY|sb_secret_/u);
  }
});

test("Next production tracing explicitly includes server and public Quiz authorities", () => {
  const source = readFileSync(join(root, "next.config.ts"), "utf8");
  assert.match(source, /outputFileTracingIncludes/u);
  assert.match(source, /generated\/server\/quiz-answer-keys\.json/u);
  assert.match(source, /generated\/public\/quizzes/u);
});
