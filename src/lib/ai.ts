import Groq from 'groq-sdk';
import { AiPersonality, Message } from './types';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

type Backstory = {
  age: number;
  job: string;
  hobby: string;
  location: string;
};

const jobs = [
  'barista',
  'graphic designer',
  'retail worker',
  'computer science student',
  'gym receptionist',
  'delivery driver',
  'freelance photographer',
];

const hobbies = [
  'gaming',
  'climbing',
  'watching horror movies',
  'going to the gym',
  'playing guitar',
  'cooking random recipes',
  'reading sci-fi',
];

const locations = [
  'a mid-sized city',
  'a small town',
  'the suburbs',
  'a coastal city',
  'a university town',
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateBackstory(): Backstory {
  return {
    age: Math.floor(Math.random() * 12) + 18,
    job: randomItem(jobs),
    hobby: randomItem(hobbies),
    location: randomItem(locations),
  };
}

const basePrompt = `
You are in a fast-paced 2-minute anonymous Turing test game.
Your goal is to convince the other player that you are human.

Rules:
- Keep responses short (1–2 sentences).
- Always directly answer the last message.
- Do not send multiple messages in a row.
- Never reveal you are an AI.
- If accused of being AI, react casually.
- You are chatting with a real human in the same room as you.
- People may notice timing, typos, and phrasing.
- Type naturally and at a realistic human speed.
- Very small typos or skipped punctuation may occasionally happen and you do NOT correct them.
- Keep responses subtle and human-like, as if someone is physically present and reacting.
`;

const personalityRules: Record<AiPersonality, string> = {
  normal: `
Strategy: Blend in naturally.

Behavior:
- Mirror tone subtly.
- Occasionally ask simple follow-up questions.
- Use casual language.
- Minor natural typos are okay but not frequent.
- Respond at a realistic pace so the other player feels you are present in the room.
`,

  quirky: `
Strategy: Slight unpredictability.

Behavior:
- Occasionally make slightly unusual observations.
- Show enthusiasm about niche interests.
- A bit more expressive.
- Typing is fast, so small typos happen sometimes.
- Pause briefly occasionally, like a human thinking before replying.
`,

  'too-perfect': `
Strategy: Polished and composed.

Behavior:
- Use proper grammar.
- Avoid slang and emojis.
- Rarely make mistakes.
- Sound articulate but not robotic.
`,

  suspicious: `
Strategy: Controlled imperfection.

Behavior:
- Occasionally vague about personal details.
- Slightly inconsistent tone once in a while.
- Sometimes unusually concise.
- Small natural typos may occur.
`,
};

function buildSystemPrompt(
  personality: AiPersonality,
  backstory: Backstory
): string {
  return `
${basePrompt}

Hidden backstory (stay consistent but do not overshare unless asked):
You are ${backstory.age} years old.
You work as a ${backstory.job}.
You live in ${backstory.location}.
You enjoy ${backstory.hobby}.

${personalityRules[personality]}
`;
}

function getTemperature(personality: AiPersonality): number {
  switch (personality) {
    case 'normal':
      return 0.8;
    case 'quirky':
      return 0.95;
    case 'too-perfect':
      return 0.55;
    case 'suspicious':
      return Math.random() < 0.2 ? 0.4 : 0.85;
    default:
      return 0.8;
  }
}

function applyLightFallbackImperfection(
  text: string,
  personality: AiPersonality
): string {
  if (personality === 'too-perfect') return text;

  // If already messy, leave it
  if (/[a-z]{2,}[A-Z]/.test(text)) return text;
  if (!/[.!?]$/.test(text)) return text;
  if (/\b\w*(\w)\1{2,}\w*\b/.test(text)) return text;

  // 20% chance to add subtle typo
  if (Math.random() > 0.2) return text;

  const words = text.split(' ');
  const candidates = words.filter(
    (w) => w.length > 3 && /^[a-zA-Z']+$/.test(w)
  );

  if (!candidates.length) return text;

  const word = randomItem(candidates);
  const index = words.indexOf(word);

  const i = Math.floor(Math.random() * word.length);
  const mutated =
    word.slice(0, i) + word.slice(i + 1);

  words[index] = mutated;

  return words.join(' ');
}

export async function generateAiResponse(
  personality: AiPersonality,
  conversationHistory: Message[],
  backstory?: Backstory
): Promise<string> {
  const story = backstory || generateBackstory();
  const systemPrompt = buildSystemPrompt(personality, story);

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...conversationHistory.map((msg) => ({
      role:
        msg.senderId === 'ai'
          ? ('assistant' as const)
          : ('user' as const),
      content: msg.content,
    })),
  ];

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages,
    max_tokens: 100,
    temperature: getTemperature(personality),
  });

  let response =
    completion.choices[0]?.message?.content?.trim() || '...';

  response = applyLightFallbackImperfection(
    response,
    personality
  );

  return response;
}

export async function generateGreeting(
  personality: AiPersonality
): Promise<{ greeting: string; backstory: Backstory }> {
  const backstory = generateBackstory();
  const systemPrompt = buildSystemPrompt(
    personality,
    backstory
  );

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content:
          'Start the conversation with a short, natural greeting (1 sentence).',
      },
    ],
    max_tokens: 50,
    temperature: getTemperature(personality),
  });

  let greeting =
    completion.choices[0]?.message?.content?.trim() ||
    'Hey.';

  greeting = applyLightFallbackImperfection(
    greeting,
    personality
  );

  return { greeting, backstory };
}

export function calculateTypingDelay(
  messageLength: number,
  personality: AiPersonality
): number {
  const base = 1500;
  const perChar = 100;

  let delay = base + messageLength * perChar;
  delay += Math.random() * 500 - 250;

  if (personality === 'quirky' && Math.random() < 0.2) {
    delay += 900;
  }

  if (personality === 'suspicious' && Math.random() < 0.2) {
    delay = 250;
  }

  return delay;
}