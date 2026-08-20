import {
  allowedExerciseTypes,
  allowedTopics,
  allowedVocabularyChapters,
  allowedVocabularyLevels,
  createVocabularyScope,
  topicCatalog,
} from "../data/exerciseCatalog.js";
import {
  createExercise,
  createExercises,
  findRecentExercises,
} from "../repositories/exerciseRepository.js";
import { sequelize } from "../database/sequelize.js";
import { generateExerciseWithAi } from "./aiExerciseService.js";
import { attachVocabularyTargetsToExercises } from "./legacyVocabularyProgressService.js";
import { buildManualExercisePrompt } from "./manualExercisePromptService.js";
import { listPracticedVocabularyWords } from "./practiceSessionService.js";
import { AppError } from "../utils/AppError.js";
import { getVocabularyWord } from "../utils/vocabularyWords.js";

function normalizeExerciseRequest(params) {
  const legacyLevel = Number(params.vocabularyLevel);
  const legacyToChapter = { 1: 5, 2: 10, 3: 15, 4: 20 }[legacyLevel] || 5;

  return {
    topic: params.topic,
    vocabularyLevel: allowedVocabularyLevels.includes(legacyLevel) ? legacyLevel : 1,
    vocabularyChapterFrom: Number(params.vocabularyChapterFrom ?? 1),
    vocabularyChapterTo: Number(params.vocabularyChapterTo ?? legacyToChapter),
    exerciseType: params.exerciseType,
  };
}

function validateExerciseRequest({
  topic,
  vocabularyLevel,
  vocabularyChapterFrom,
  vocabularyChapterTo,
  exerciseType,
}) {
  if (!allowedTopics.includes(topic)) {
    throw new AppError("El tema solicitado no existe.", 400);
  }

  if (!allowedVocabularyLevels.includes(Number(vocabularyLevel))) {
    throw new AppError(
      "El nivel de vocabulario debe estar entre 1 y 4.",
      400,
    );
  }

  if (!allowedExerciseTypes.includes(exerciseType)) {
    throw new AppError("El tipo de ejercicio solicitado no existe.", 400);
  }

  if (
    !allowedVocabularyChapters.includes(vocabularyChapterFrom) ||
    !allowedVocabularyChapters.includes(vocabularyChapterTo) ||
    vocabularyChapterFrom > vocabularyChapterTo
  ) {
    throw new AppError(
      "El rango de vocabulario debe estar entre los capitulos 1 y 35.",
      400,
    );
  }

  if (topic === "vocabulary" && exerciseType === "fill_blank") {
    throw new AppError("Completar no esta disponible para vocabulario.", 400);
  }
}

function validateImportedExercise(exercise, exerciseType, index) {
  const position = index + 1;
  const hasRequiredStrings =
    typeof exercise.prompt === "string" &&
    typeof exercise.question === "string" &&
    typeof exercise.correctAnswer === "string" &&
    typeof exercise.explanation === "string";

  if (!hasRequiredStrings || !Array.isArray(exercise.options)) {
    throw new AppError(
      `El ejercicio ${position} no tiene el formato esperado.`,
      400,
    );
  }

  if (exerciseType === "multiple_choice" && exercise.options.length !== 4) {
    throw new AppError(
      `El ejercicio ${position} debe tener exactamente 4 opciones.`,
      400,
    );
  }

  if (
    exercise.options.length > 0 &&
    !exercise.options.includes(exercise.correctAnswer)
  ) {
    throw new AppError(
      `La respuesta correcta del ejercicio ${position} no aparece entre las opciones.`,
      400,
    );
  }
}

function validateVocabularyWords(exercises, exerciseType, practicedWords) {
  const practicedSet = new Set(practicedWords);
  const currentSet = new Set();

  exercises.forEach((exercise, index) => {
    const word = getVocabularyWord(exercise, exerciseType);

    if (!word.normalized) {
      throw new AppError(
        `No se pudo identificar la palabra latina del ejercicio ${index + 1}.`,
        400,
      );
    }

    if (currentSet.has(word.normalized)) {
      throw new AppError(
        `La palabra "${word.raw}" esta repetida dentro de la practica.`,
        400,
      );
    }

    if (practicedSet.has(word.normalized)) {
      throw new AppError(
        `La palabra "${word.raw}" ya fue practicada. Pidele a la IA otra palabra.`,
        400,
      );
    }

    currentSet.add(word.normalized);
  });
}

async function getPracticedWordsForTopic(topic) {
  return topic === "vocabulary" ? listPracticedVocabularyWords() : [];
}

function serializeExercise(exercise) {
  return {
    id: exercise.id,
    topic: exercise.topic,
    topicLabel: topicCatalog[exercise.topic].label,
    vocabularyLevel: exercise.vocabularyLevel,
    vocabularyChapterFrom: exercise.vocabularyChapterFrom,
    vocabularyChapterTo: exercise.vocabularyChapterTo,
    vocabularyScope: createVocabularyScope(
      exercise.vocabularyChapterFrom,
      exercise.vocabularyChapterTo,
    ),
    exerciseType: exercise.exerciseType,
    prompt: exercise.prompt,
    question: exercise.question,
    options: exercise.options,
    correctAnswer: exercise.correctAnswer,
    explanation: exercise.explanation,
    source: exercise.source,
    targetVocabularyIds: exercise.targetVocabularyIds || [],
  };
}

export async function generateExercise(params) {
  const normalizedParams = normalizeExerciseRequest(params);

  validateExerciseRequest(normalizedParams);
  const excludedVocabularyWords = await getPracticedWordsForTopic(
    normalizedParams.topic,
  );

  const vocabularyScope = createVocabularyScope(
    normalizedParams.vocabularyChapterFrom,
    normalizedParams.vocabularyChapterTo,
  );

  const generatedExercise = await generateExerciseWithAi({
    ...normalizedParams,
    topicLabel: topicCatalog[normalizedParams.topic].promptLabel,
    vocabularyScope,
    excludedVocabularyWords,
  });

  if (normalizedParams.topic === "vocabulary") {
    validateVocabularyWords(
      [generatedExercise],
      normalizedParams.exerciseType,
      excludedVocabularyWords,
    );
  }

  const exercise = await sequelize.transaction(async (transaction) => {
    let targetVocabularyIds = [];
    if (normalizedParams.topic === "vocabulary") {
      const [target] = await attachVocabularyTargetsToExercises(
        [generatedExercise],
        {
          exerciseType: normalizedParams.exerciseType,
          chapterFrom: normalizedParams.vocabularyChapterFrom,
          chapterTo: normalizedParams.vocabularyChapterTo,
          transaction,
        },
      );
      targetVocabularyIds = [target.vocabulary.id];
    }

    return createExercise(
      {
        ...normalizedParams,
        ...generatedExercise,
        targetVocabularyIds,
      },
      { transaction },
    );
  });

  return serializeExercise(exercise);
}

export async function createManualPrompt(params) {
  const normalizedParams = normalizeExerciseRequest(params);
  validateExerciseRequest(normalizedParams);
  const excludedVocabularyWords = await getPracticedWordsForTopic(
    normalizedParams.topic,
  );
  const vocabularyScope = createVocabularyScope(
    normalizedParams.vocabularyChapterFrom,
    normalizedParams.vocabularyChapterTo,
  );

  return {
    ...normalizedParams,
    topicLabel: topicCatalog[normalizedParams.topic].label,
    vocabularyScope,
    prompt: buildManualExercisePrompt({
      ...normalizedParams,
      topicLabel: topicCatalog[normalizedParams.topic].promptLabel,
      vocabularyScope,
      excludedVocabularyWords,
    }),
  };
}

export async function importManualExercises(params) {
  const normalizedParams = normalizeExerciseRequest(params);
  validateExerciseRequest(normalizedParams);
  const excludedVocabularyWords = await getPracticedWordsForTopic(
    normalizedParams.topic,
  );

  if (!Array.isArray(params.exercises) || params.exercises.length === 0) {
    throw new AppError("Debes enviar al menos un ejercicio para importar.", 400);
  }

  params.exercises.forEach((exercise, index) => {
    validateImportedExercise(exercise, normalizedParams.exerciseType, index);
  });

  if (normalizedParams.topic === "vocabulary") {
    validateVocabularyWords(
      params.exercises,
      normalizedParams.exerciseType,
      excludedVocabularyWords,
    );
  }

  const exercises = await sequelize.transaction(async (transaction) => {
    const targets =
      normalizedParams.topic === "vocabulary"
        ? await attachVocabularyTargetsToExercises(params.exercises, {
            exerciseType: normalizedParams.exerciseType,
            chapterFrom: normalizedParams.vocabularyChapterFrom,
            chapterTo: normalizedParams.vocabularyChapterTo,
            transaction,
          })
        : [];

    return createExercises(
      params.exercises.map((exercise, index) => ({
        ...normalizedParams,
        prompt: exercise.prompt.trim(),
        question: exercise.question.trim(),
        options: exercise.options,
        correctAnswer: exercise.correctAnswer.trim(),
        explanation: exercise.explanation.trim(),
        source: "manual_chatgpt",
        targetVocabularyIds:
          normalizedParams.topic === "vocabulary"
            ? [targets[index].vocabulary.id]
            : [],
      })),
      { transaction },
    );
  });

  return exercises.map(serializeExercise);
}

export async function listExercises() {
  return findRecentExercises();
}
