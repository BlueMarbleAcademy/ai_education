import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  FileDown,
  Volume2,
  Pencil,
  Shuffle,
  Plus
} from 'lucide-react';
import { useLocation, Link, useParams } from 'react-router-dom';
import { useDeckData } from './hooks';
import FlashcardDifficultySelector from './FlashcardDifficultySelector';

const FlashcardStudyPage = () => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const location = useLocation();
  const { deckId } = useParams();

  const { getFlashcardByID, updateDeck } = useDeckData();

  const [deckTitle, setDeckTitle] = useState(location.state?.title || '');
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newDifficulty, setNewDifficulty] = useState(null);

  const MAX_QUESTION_LENGTH = 200;
  const MAX_ANSWER_LENGTH = 500;

  /* ---------------- NORMALIZE ---------------- */
  const normalizeCard = (card) => ({
    question: card.question ?? card.front ?? '',
    answer: card.answer ?? card.back ?? '',
    difficulty: card.difficulty ?? 'medium',
    important: card.important ?? false
  });

  /* ---------------- LOAD ---------------- */
  useEffect(() => {
    if (!deckId) return;

    setLoading(true);
    getFlashcardByID(deckId)
      .then((deck) => {
        setDeckTitle(deck.title);
        setFlashcards(deck.cards.map(normalizeCard));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [deckId]);

  /* ---------------- STUDY MODE ---------------- */
  const handleFlip = () => setFlipped((p) => !p);

  const handleNext = () => {
    setIndex((i) => (i + 1) % flashcards.length);
    setFlipped(false);
  };

  const speakCard = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const text = flipped
      ? flashcards[index].answer
      : flashcards[index].question;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    synth.speak(utterance);
  };

  const difficultyWeights = { easy: 1, medium: 2, hard: 3 };

  const smartShuffle = () => {
    const shuffled = [...flashcards].sort(
      (a, b) =>
        Math.random() * (1 / difficultyWeights[a.difficulty]) -
        Math.random() * (1 / difficultyWeights[b.difficulty])
    );
    setFlashcards(shuffled);
    setIndex(0);
    setFlipped(false);
  };

  /* ---------------- EDIT MODE ---------------- */
  const handleCardEdit = (i, field, value) => {
    const limit =
      field === 'question'
        ? MAX_QUESTION_LENGTH
        : field === 'answer'
        ? MAX_ANSWER_LENGTH
        : null;

    if (limit && value.length > limit) return;

    setFlashcards((prev) => {
      const updated = [...prev];
      updated[i] = { ...updated[i], [field]: value };
      return updated;
    });
  };

  const handleAddCard = () => {
    if (!newQuestion || !newAnswer || !newDifficulty) return;

    if (
      newQuestion.length > MAX_QUESTION_LENGTH ||
      newAnswer.length > MAX_ANSWER_LENGTH
    )
      return;

    setFlashcards((prev) => [
      ...prev,
      {
        question: newQuestion,
        answer: newAnswer,
        difficulty: newDifficulty,
        important: false
      }
    ]);

    setNewQuestion('');
    setNewAnswer('');
    setNewDifficulty(null);
  };

  const toggleEditMode = async () => {
    if (isEditing) {
      await updateDeck(deckTitle, deckId, flashcards);
    }
    setIsEditing((p) => !p);
  };

  /* ---------------- EXPORT ---------------- */
  const exportToJSON = () => {
    const blob = new Blob(
      [JSON.stringify({ title: deckTitle, cards: flashcards }, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deckTitle || 'flashcards'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------------- RENDER ---------------- */
  if (loading) {
    return <div className="text-center py-16">Loading flashcards…</div>;
  }

  if (!flashcards.length) {
    return <div className="text-center py-16">No flashcards available.</div>;
  }

  const currentCard = flashcards[index];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex justify-between mb-6">
        <Link to="/tools/flashcards" className="text-blue-600 flex items-center">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Link>

        <div className="flex gap-4">
          <button onClick={toggleEditMode} className="text-gray-600 flex items-center">
            <Pencil className="w-4 h-4 mr-1" />
            {isEditing ? 'Save Editor' : 'Edit Cards'}
          </button>

          <button onClick={exportToJSON} className="text-blue-600 flex items-center">
            <FileDown className="w-4 h-4 mr-1" />
            Export JSON
          </button>
        </div>
      </div>

      {!isEditing ? (
        <>
          {/* FLASHCARD DISPLAY FIXED WRAPPING */}
          <div
            className="h-64 bg-white rounded-lg shadow flex items-center justify-center text-2xl font-semibold cursor-pointer relative p-6 text-center break-words whitespace-pre-wrap overflow-y-auto"
            onClick={handleFlip}
          >
            <div className="max-w-full">
              {flipped ? currentCard.answer : currentCard.question}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                speakCard();
              }}
              className="absolute top-3 right-3"
            >
              <Volume2 />
            </button>
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={handleNext}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Next Card
            </button>

            <button
              onClick={smartShuffle}
              className="bg-purple-600 text-white px-4 py-2 rounded"
            >
              Smart Shuffle
            </button>

            <span className="text-gray-500">
              Card {index + 1} of {flashcards.length}
            </span>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {flashcards.map((card, i) => (
            <div key={i} className="bg-white p-4 rounded shadow">
              <p className="mb-2 font-medium">Card {i + 1}</p>

              <input
                value={card.question}
                maxLength={MAX_QUESTION_LENGTH}
                onChange={(e) => handleCardEdit(i, 'question', e.target.value)}
                className="w-full mb-1 border px-3 py-2 rounded"
              />
              <p className="text-xs text-gray-500 text-right mb-2">
                {card.question.length}/{MAX_QUESTION_LENGTH}
              </p>

              <textarea
                value={card.answer}
                maxLength={MAX_ANSWER_LENGTH}
                onChange={(e) => handleCardEdit(i, 'answer', e.target.value)}
                className="w-full mb-1 border px-3 py-2 rounded resize-none"
                rows={3}
              />
              <p className="text-xs text-gray-500 text-right mb-2">
                {card.answer.length}/{MAX_ANSWER_LENGTH}
              </p>

              <select
                value={card.difficulty}
                onChange={(e) => handleCardEdit(i, 'difficulty', e.target.value)}
                className="w-full border px-3 py-2 rounded"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          ))}

          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-medium mb-4">Add New Flashcard</h3>

            <input
              value={newQuestion}
              maxLength={MAX_QUESTION_LENGTH}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Question"
              className="w-full mb-1 border px-3 py-2 rounded"
            />
            <p className="text-xs text-gray-500 text-right mb-2">
              {newQuestion.length}/{MAX_QUESTION_LENGTH}
            </p>

            <textarea
              value={newAnswer}
              maxLength={MAX_ANSWER_LENGTH}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="Answer"
              className="w-full mb-1 border px-3 py-2 rounded resize-none"
              rows={3}
            />
            <p className="text-xs text-gray-500 text-right mb-2">
              {newAnswer.length}/{MAX_ANSWER_LENGTH}
            </p>

            <FlashcardDifficultySelector onSelect={setNewDifficulty} />

            <button
              onClick={handleAddCard}
              disabled={!newQuestion || !newAnswer || !newDifficulty}
              className="mt-3 bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Card
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlashcardStudyPage;