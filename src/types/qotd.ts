export type QotdClinicalDomain =
  | 'Cardiovascular'
  | 'Respiratory'
  | 'GI/Hepatobiliary'
  | 'Renal/Urinary'
  | 'Endocrine/Metabolic'
  | 'Neurology'
  | 'Hematology/Oncology/Immune'
  | 'Behavioral Health'
  | 'OB-GYN'
  | 'Pediatrics'
  | 'MSK/Skin/Surgery'
  | 'Critical Care/Toxicology';

export type QotdCompetency =
  | 'Diagnosis'
  | 'Management'
  | 'Prevention'
  | 'Communication'
  | 'Professionalism/Ethics'
  | 'Systems/Safety'
  | 'Biostats/Evidence';

export type QotdDifficulty = 'easy' | 'moderate' | 'moderate-hard';

export type QotdChoice = {
  id: string;
  label: string;
};

export type QotdAttemptRecord = {
  dateKey: string;
  questionId: string;
  selectedChoiceId: string;
  isCorrect: boolean;
  explanationShown: string;
  mnemonicShown: string;
  bpEarned: number;
  completedAtMs: number;
};

export type QuickQuizAttemptRecord = {
  questionId: string;
  dateKey: string;
  selectedChoiceId: string;
  isCorrect: boolean;
  explanationShown: string;
  mnemonicShown: string;
  bpEarned: number;
  completedAtMs: number;
};

export type QuestionOfTheDayItem = {
  id: string;
  domain: QotdClinicalDomain;
  competency: QotdCompetency;
  difficulty: QotdDifficulty;
  stem: string;
  choices: QotdChoice[];
  correctChoiceId: string;
  explanationsByChoice: Record<string, string>;
  mnemonic: string;
};
