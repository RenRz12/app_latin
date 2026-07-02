import {
  allowedExerciseTypes,
  allowedTopics,
  allowedVocabularyLevels,
  topicCatalog,
  vocabularyScopesByLevel,
} from "../data/exerciseCatalog.js";
import {
  createExercise,
  createExercises,
  findRecentExercises,
} from "../repositories/exerciseRepository.js";
import { generateExerciseWithAi } from "./aiExerciseService.js";
import { buildManualExercisePrompt } from "./manualExercisePromptService.js";
import { AppError } from "../utils/AppError.js";

function normalizeExerciseRequest(params) {
  return {
    topic: params.topic,
    vocabularyLevel: Number(params.vocabularyLevel),
    exerciseType: params.exerciseType,
  };
}

function validateExerciseRequest({ topic, vocabularyLevel, exerciseType }) {
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

function serializeExercise(exercise) {
  return {
    id: exercise.id,
    topic: exercise.topic,
    topicLabel: topicCatalog[exercise.topic].label,
    vocabularyLevel: exercise.vocabularyLevel,
    vocabularyScope: vocabularyScopesByLevel[exercise.vocabularyLevel],
    exerciseType: exercise.exerciseType,
    prompt: exercise.prompt,
    question: exercise.question,
    options: exercise.options,
    correctAnswer: exercise.correctAnswer,
    explanation: exercise.explanation,
    source: exercise.source,
  };
}

export async function generateExercise(params) {
  const normalizedParams = normalizeExerciseRequest(params);

  validateExerciseRequest(normalizedParams);

  const generatedExercise = await generateExerciseWithAi({
    ...normalizedParams,
    topicLabel: topicCatalog[normalizedParams.topic].promptLabel,
    vocabularyScope: vocabularyScopesByLevel[normalizedParams.vocabularyLevel],
  });

  const exercise = await createExercise({
    ...normalizedParams,
    ...generatedExercise,
  });

  return serializeExercise(exercise);
}

export function createManualPrompt(params) {
  const normalizedParams = normalizeExerciseRequest(params);
  validateExerciseRequest(normalizedParams);

  return {
    ...normalizedParams,
    topicLabel: topicCatalog[normalizedParams.topic].label,
    vocabularyScope: vocabularyScopesByLevel[normalizedParams.vocabularyLevel],
    prompt: buildManualExercisePrompt({
      ...normalizedParams,
      topicLabel: topicCatalog[normalizedParams.topic].promptLabel,
      vocabularyScope: vocabularyScopesByLevel[normalizedParams.vocabularyLevel],
    }),
  };
}

export async function importManualExercises(params) {
  const normalizedParams = normalizeExerciseRequest(params);
  validateExerciseRequest(normalizedParams);

  if (!Array.isArray(params.exercises) || params.exercises.length === 0) {
    throw new AppError("Debes enviar al menos un ejercicio para importar.", 400);
  }

  params.exercises.forEach((exercise, index) => {
    validateImportedExercise(exercise, normalizedParams.exerciseType, index);
  });

  const exercises = await createExercises(
    params.exercises.map((exercise) => ({
      ...normalizedParams,
      prompt: exercise.prompt.trim(),
      question: exercise.question.trim(),
      options: exercise.options,
      correctAnswer: exercise.correctAnswer.trim(),
      explanation: exercise.explanation.trim(),
      source: "manual_chatgpt",
    })),
  );

  return exercises.map(serializeExercise);
}

export async function listExercises() {
  return findRecentExercises();
}
