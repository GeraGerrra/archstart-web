"use client";

import { useState } from "react";

interface QuizQuestion {
  id: string;
  questionText: string;
  options: Array<{ id: string; text: string }>;
}

interface QuizShellProps {
  lessonCode: string;
  questions: QuizQuestion[];
}

export function QuizShell({ lessonCode, questions }: QuizShellProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const activeQuestion = questions[activeIndex] ?? questions[0];

  if (!activeQuestion) {
    return null;
  }

  const selectedOption = selections[activeQuestion.id];

  return (
    <div className="quiz-shell">
      <div className="quiz-shell__header">
        <div>
          <span className="prototype-kicker">QUIZ SHELL / NO ANSWERS</span>
          <h3>{lessonCode}</h3>
        </div>
        <p aria-live="polite">
          Вопрос {activeIndex + 1} из {questions.length}
        </p>
      </div>

      <div className="quiz-shell__progress" aria-hidden="true">
        <span style={{ width: `${((activeIndex + 1) / questions.length) * 100}%` }} />
      </div>

      <fieldset>
        <legend>{activeQuestion.questionText}</legend>
        <div className="quiz-shell__options">
          {activeQuestion.options.map((option, optionIndex) => (
            <label key={option.id} className={selectedOption === option.id ? "is-selected" : ""}>
              <input
                type="radio"
                name={activeQuestion.id}
                value={option.id}
                checked={selectedOption === option.id}
                onChange={() =>
                  setSelections((current) => ({ ...current, [activeQuestion.id]: option.id }))
                }
              />
              <span className="quiz-shell__option-code" aria-hidden="true">
                {String.fromCharCode(65 + optionIndex)}
              </span>
              <span>{option.text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="quiz-shell__footer">
        <p>
          Выбрано: {Object.keys(selections).length} из {questions.length}. Проверка ответов и объяснения в прототип не включены.
        </p>
        <div>
          <button
            type="button"
            className="prototype-button prototype-button--line"
            disabled={activeIndex === 0}
            onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
          >
            Назад
          </button>
          <button
            type="button"
            className="prototype-button prototype-button--dark"
            disabled={activeIndex === questions.length - 1}
            onClick={() => setActiveIndex((index) => Math.min(questions.length - 1, index + 1))}
          >
            Далее
          </button>
        </div>
      </div>
    </div>
  );
}
