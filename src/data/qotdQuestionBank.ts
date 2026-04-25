import type { QuestionOfTheDayItem, QotdClinicalDomain, QotdCompetency, QotdDifficulty } from '../types/qotd';
import part1Raw from './usmle_step2_qbank_part1.md?raw';
import part2Raw from './usmle_step2_qbank_part2.md?raw';

const SOURCE = `${part1Raw}\n${part2Raw}`;

function cleanText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

function normalizeDomain(raw: string): QotdClinicalDomain {
  const text = raw.toLowerCase();
  if (text.includes('cardiovascular')) return 'Cardiovascular';
  if (text.includes('respiratory')) return 'Respiratory';
  if (text.includes('gastro') || text.includes('hepat')) return 'GI/Hepatobiliary';
  if (text.includes('renal') || text.includes('urinary')) return 'Renal/Urinary';
  if (text.includes('endocrine') || text.includes('metabolic')) return 'Endocrine/Metabolic';
  if (text.includes('nervous') || text.includes('special senses')) return 'Neurology';
  if (text.includes('blood') || text.includes('lymph') || text.includes('immune')) return 'Hematology/Oncology/Immune';
  if (text.includes('behavioral') || text.includes('social sciences')) return 'Behavioral Health';
  if (text.includes('pregnancy') || text.includes('puerperium') || text.includes('female reproductive')) return 'OB-GYN';
  if (text.includes('human development') || text.includes('pediatric')) return 'Pediatrics';
  if (text.includes('musculoskeletal') || text.includes('skin') || text.includes('surgery')) return 'MSK/Skin/Surgery';
  if (text.includes('critical care') || text.includes('trauma') || text.includes('toxicology') || text.includes('multisystem')) {
    return 'Critical Care/Toxicology';
  }
  return 'Critical Care/Toxicology';
}

function normalizeCompetency(raw: string): QotdCompetency {
  const text = raw.toLowerCase();
  if (text.includes('communication')) return 'Communication';
  if (text.includes('professionalism') || text.includes('legal/ethical') || text.includes('ethics')) return 'Professionalism/Ethics';
  if (text.includes('safety') || text.includes('system')) return 'Systems/Safety';
  if (text.includes('biostat') || text.includes('epidemiology') || text.includes('study design')) return 'Biostats/Evidence';
  if (text.includes('prevention') || text.includes('health maintenance')) return 'Prevention';
  if (text.includes('diagnosis') || text.includes('diagnostic') || text.includes('lab')) return 'Diagnosis';
  return 'Management';
}

function normalizeDifficulty(raw: string): QotdDifficulty {
  const text = raw.toLowerCase();
  if (text.includes('easy')) return 'easy';
  if (text.includes('hard')) return 'moderate-hard';
  return 'moderate';
}

function parseQuestionBlocks(source: string): string[] {
  const matches = source.match(/### Question \d+[\s\S]*?(?=\n### Question \d+|\n## End of Question Bank|$)/g);
  return matches ?? [];
}

function extractOrThrow(block: string, regex: RegExp, label: string): string {
  const match = block.match(regex);
  if (!match?.[1]) {
    throw new Error(`Failed to parse ${label} in question block.`);
  }
  return cleanText(match[1]);
}

function makeQuestion(item: QuestionOfTheDayItem): QuestionOfTheDayItem {
  if (item.choices.length < 4) {
    throw new Error(`QOTD ${item.id} must have at least 4 choices.`);
  }
  const choiceIds = new Set(item.choices.map((c) => c.id));
  if (!choiceIds.has(item.correctChoiceId)) {
    throw new Error(`QOTD ${item.id} has invalid correctChoiceId.`);
  }
  for (const c of item.choices) {
    if (!item.explanationsByChoice[c.id]) {
      throw new Error(`QOTD ${item.id} missing explanation for choice ${c.id}.`);
    }
  }
  return item;
}

function parseIncorrectExplanations(chunk: string): Record<string, string> {
  const lines = cleanText(chunk).split('\n');
  const byChoice: Record<string, string> = {};
  let currentChoiceId: string | null = null;
  let currentExplanationLines: string[] = [];

  const flushCurrent = () => {
    if (!currentChoiceId) return;
    const fullExplanation = cleanText(currentExplanationLines.join('\n'));
    if (fullExplanation) {
      byChoice[currentChoiceId] = fullExplanation;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const bulletStart = line.match(/^\s*-\s+\*\*([A-E](?:\/[A-E])*)(?:[^*]|\*(?!\*))*\*\*:?[\t ]*(.*)$/);
    if (bulletStart) {
      flushCurrent();
      currentChoiceId = bulletStart[1];
      currentExplanationLines = [bulletStart[2] ?? ''];
      continue;
    }
    if (currentChoiceId) {
      currentExplanationLines.push(line);
    }
  }

  flushCurrent();
  for (const [choiceId, explanation] of Object.entries({ ...byChoice })) {
    if (!choiceId.includes('/')) continue;
    const ids = choiceId.split('/').map((id) => id.trim());
    for (const id of ids) {
      if (!byChoice[id]) {
        byChoice[id] = explanation;
      }
    }
    delete byChoice[choiceId];
  }
  return byChoice;
}

function parseQuestionBlock(block: string, index: number): QuestionOfTheDayItem {
  const bodyWithoutHeading = block.replace(/^### Question \d+\s*\n+/m, '');
  const dividerIndex = bodyWithoutHeading.search(/\n\n---/m);
  const bodyBeforeMetadata = dividerIndex >= 0 ? bodyWithoutHeading.slice(0, dividerIndex) : bodyWithoutHeading;
  const firstChoiceIndex = bodyBeforeMetadata.search(/^[A-E]\)\s+/m);
  if (firstChoiceIndex < 0) {
    throw new Error(`QOTD qotd-${String(index + 1).padStart(3, '0')} is missing choices.`);
  }
  const preChoices = cleanText(bodyBeforeMetadata.slice(0, firstChoiceIndex));
  const boldPromptAtEndMatch = preChoices.match(/\n\n\*\*[\s\S]*?\*\*\s*$/m);
  const scenarioStem =
    boldPromptAtEndMatch && typeof boldPromptAtEndMatch.index === 'number'
      ? cleanText(preChoices.slice(0, boldPromptAtEndMatch.index))
      : preChoices;
  const promptLine = boldPromptAtEndMatch
    ? cleanText(boldPromptAtEndMatch[0]).replace(/^\*\*|\*\*$/g, '')
    : '';
  const stem = cleanText([scenarioStem, promptLine].filter(Boolean).join('\n\n'));
  const choicesChunk = cleanText(bodyBeforeMetadata.slice(firstChoiceIndex));
  const choiceMatches = [...choicesChunk.matchAll(/^([A-E])\)\s+(.+)$/gm)];
  if (choiceMatches.length < 4) {
    throw new Error(`QOTD qotd-${String(index + 1).padStart(3, '0')} has fewer than 4 choices.`);
  }
  const choices = choiceMatches.map((m) => ({ id: m[1], label: cleanText(m[2]) }));

  const domainRaw = extractOrThrow(block, /\*\*Domain:\*\*\s+([^\n]+)/, 'domain');
  const competencyRaw = extractOrThrow(block, /\*\*Competency:\*\*\s+([^\n]+)/, 'competency');
  const difficultyRaw = extractOrThrow(block, /\*\*Difficulty:\*\*\s+([^\n]+)/, 'difficulty');
  const correctChoiceId = extractOrThrow(block, /\*\*✅ Correct Answer:\s+([A-E])\s+—/m, 'correct answer');
  const whyCorrect = extractOrThrow(block, /\*Why it's correct:\*\s+([\s\S]*?)\n\n\*\*🧠 Mnemonic:/m, 'correct explanation');
  const mnemonic = extractOrThrow(block, /\*\*🧠 Mnemonic:\s+([\s\S]*?)\*\*/m, 'mnemonic').replace(/^"+|"+$/g, '');
  const wrongChunk = extractOrThrow(
    block,
    /\*\*❌ Incorrect Answer Explanations:\*\*\n\n([\s\S]*?)(?=\n\n---|\s*$)/,
    'incorrect explanations',
  );
  const explanationsByChoice: Record<string, string> = {
    [correctChoiceId]: whyCorrect,
  };
  const parsedIncorrect = parseIncorrectExplanations(wrongChunk);
  for (const [choiceId, explanation] of Object.entries(parsedIncorrect)) {
    explanationsByChoice[choiceId] = explanation;
  }

  for (const choice of choices) {
    if (!explanationsByChoice[choice.id]) {
      explanationsByChoice[choice.id] =
        choice.id === correctChoiceId
          ? whyCorrect
          : `This answer is incorrect. The correct answer is ${correctChoiceId}. ${whyCorrect}`;
    }
  }

  return makeQuestion({
    id: `qotd-${String(index + 1).padStart(3, '0')}`,
    domain: normalizeDomain(domainRaw),
    competency: normalizeCompetency(competencyRaw),
    difficulty: normalizeDifficulty(difficultyRaw),
    stem,
    choices,
    correctChoiceId,
    explanationsByChoice,
    mnemonic: cleanText(mnemonic),
  });
}

function parseQuestionBank(source: string): QuestionOfTheDayItem[] {
  const blocks = parseQuestionBlocks(source);
  return blocks.map((block, idx) => parseQuestionBlock(block, idx));
}

export const QOTD_QUESTION_BANK: QuestionOfTheDayItem[] = parseQuestionBank(SOURCE);
export const QOTD_BANK_SIZE = QOTD_QUESTION_BANK.length;
