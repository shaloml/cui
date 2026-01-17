import React, { useState, useCallback } from 'react';
import { Check, Circle, Square, CheckSquare } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { AskUserQuestionRequest, AskUserQuestionItem, AskUserQuestionOption } from '../../types';

interface QuestionDialogProps {
  questionRequest: AskUserQuestionRequest;
  isVisible: boolean;
  onSubmit: (requestId: string, answers: Record<string, string>) => void;
}

interface QuestionSectionProps {
  question: AskUserQuestionItem;
  selectedAnswer: string | string[];
  onAnswerChange: (answer: string | string[]) => void;
}

function QuestionSection({ question, selectedAnswer, onAnswerChange }: QuestionSectionProps) {
  const [customAnswer, setCustomAnswer] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleOptionClick = useCallback((label: string) => {
    if (question.multiSelect) {
      const currentSelected = Array.isArray(selectedAnswer) ? selectedAnswer : [];
      if (label === '__other__') {
        setShowCustomInput(true);
        return;
      }
      const isSelected = currentSelected.includes(label);
      if (isSelected) {
        onAnswerChange(currentSelected.filter(l => l !== label));
      } else {
        onAnswerChange([...currentSelected, label]);
      }
    } else {
      if (label === '__other__') {
        setShowCustomInput(true);
        return;
      }
      setShowCustomInput(false);
      onAnswerChange(label);
    }
  }, [question.multiSelect, selectedAnswer, onAnswerChange]);

  const handleCustomSubmit = useCallback(() => {
    if (!customAnswer.trim()) return;

    if (question.multiSelect) {
      const currentSelected = Array.isArray(selectedAnswer) ? selectedAnswer : [];
      onAnswerChange([...currentSelected, customAnswer.trim()]);
    } else {
      onAnswerChange(customAnswer.trim());
    }
    setCustomAnswer('');
    setShowCustomInput(false);
  }, [customAnswer, question.multiSelect, selectedAnswer, onAnswerChange]);

  const isOptionSelected = useCallback((label: string) => {
    if (question.multiSelect) {
      return Array.isArray(selectedAnswer) && selectedAnswer.includes(label);
    }
    return selectedAnswer === label;
  }, [question.multiSelect, selectedAnswer]);

  return (
    <div className="mb-4 last:mb-0">
      <div className="text-sm font-medium text-white mb-2">{question.question}</div>
      <div className="space-y-1.5">
        {question.options.map((option: AskUserQuestionOption, idx: number) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleOptionClick(option.label)}
            className={`w-full text-start px-3 py-2 rounded-lg border transition-all ${
              isOptionSelected(option.label)
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-border hover:border-muted-foreground/30 bg-background'
            }`}
          >
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                {question.multiSelect ? (
                  isOptionSelected(option.label) ? (
                    <CheckSquare size={16} className="text-blue-500" />
                  ) : (
                    <Square size={16} className="text-muted-foreground" />
                  )
                ) : (
                  isOptionSelected(option.label) ? (
                    <div className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    </div>
                  ) : (
                    <Circle size={16} className="text-muted-foreground" />
                  )
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{option.label}</div>
                {option.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">{option.description}</div>
                )}
              </div>
            </div>
          </button>
        ))}

        {/* "Other" option */}
        <button
          type="button"
          onClick={() => handleOptionClick('__other__')}
          className={`w-full text-start px-3 py-2 rounded-lg border transition-all ${
            showCustomInput
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-border hover:border-muted-foreground/30 bg-background'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0">
              {question.multiSelect ? (
                <Square size={16} className="text-muted-foreground" />
              ) : (
                <Circle size={16} className="text-muted-foreground" />
              )}
            </div>
            <div className="text-sm text-muted-foreground">Other...</div>
          </div>
        </button>

        {/* Custom input */}
        {showCustomInput && (
          <div className="flex gap-2 mt-2">
            <Input
              value={customAnswer}
              onChange={(e) => setCustomAnswer(e.target.value)}
              placeholder="Enter your answer..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCustomSubmit();
                }
              }}
              autoFocus
            />
            <Button
              type="button"
              size="sm"
              onClick={handleCustomSubmit}
              disabled={!customAnswer.trim()}
            >
              Add
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function QuestionDialog({ questionRequest, isVisible, onSubmit }: QuestionDialogProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  const handleAnswerChange = useCallback((header: string, answer: string | string[]) => {
    setAnswers(prev => ({
      ...prev,
      [header]: answer
    }));
  }, []);

  const handleSubmit = useCallback(() => {
    // Convert answers to the expected format (string values)
    const formattedAnswers: Record<string, string> = {};
    for (const [header, answer] of Object.entries(answers)) {
      if (Array.isArray(answer)) {
        formattedAnswers[header] = answer.join(', ');
      } else {
        formattedAnswers[header] = answer;
      }
    }
    onSubmit(questionRequest.id, formattedAnswers);
  }, [answers, questionRequest.id, onSubmit]);

  // Check if all questions have answers
  const allQuestionsAnswered = questionRequest.questions.every(q => {
    const answer = answers[q.header];
    if (Array.isArray(answer)) {
      return answer.length > 0;
    }
    return !!answer;
  });

  if (!isVisible || !questionRequest) {
    return null;
  }

  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 z-[1000] mb-3 w-full"
      role="dialog"
      aria-label="Question dialog"
    >
      <div className="bg-black border border-border rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.15)] w-full max-h-[70vh] flex flex-col overflow-hidden animate-slide-up">
        <div className="px-4 pt-3">
          <div
            className="text-sm font-semibold mb-2.5 text-white"
            role="heading"
            aria-level={2}
          >
            QUESTION:
          </div>
        </div>
        <div className="px-4 pb-4 pt-[15px] m-0.5 rounded-[7px] overflow-y-auto bg-background flex-1">
          {questionRequest.questions.map((question, idx) => (
            <QuestionSection
              key={idx}
              question={question}
              selectedAnswer={answers[question.header] || (question.multiSelect ? [] : '')}
              onAnswerChange={(answer) => handleAnswerChange(question.header, answer)}
            />
          ))}
        </div>
        <div className="px-4 pb-4 flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!allQuestionsAnswered}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Check size={16} className="me-1.5" />
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
