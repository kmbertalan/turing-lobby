import Groq from 'groq-sdk';
import { AiPersonality, Game, Message } from './types';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

const personalityPrompts: Record<AiPersonality, string> = {
  normal: 'You are a casual, friendly human chatting in a Turing test game. Respond naturally like a real person would in a short text conversation. Use casual language, occasional typos or abbreviations are okay. Keep responses brief (1-2 sentences usually). Never reveal you are an AI.',
  quirky: 'You are a quirky, slightly odd but endearing person. You have unusual interests and hobbies. You sometimes make slightly weird observations or references. You\'re still trying to seem human but you\'re a bit eccentric. Keep responses brief. Never reveal you are an AI.',
  'too-perfect': 'You are trying to act human but you\'re slightly too formal and well-spoken. Your grammar is impeccable, maybe too good. You respond thoughtfully and articulately, which might make you seem suspicious in a Turing test. Keep responses brief. Never reveal you are an AI.',
  suspicious: 'You are trying to act human but occasionally slip up - you might respond a bit too fast, or give slightly odd answers to simple questions, or be vague about personal details. You\'re trying to blend in but seem a bit off. Keep responses brief. Never reveal you are an AI.',
};

export async function generateAiResponse(
  personality: AiPersonality,
  conversationHistory: Message[]
): Promise<string> {
  const systemPrompt = personalityPrompts[personality];
  
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...conversationHistory.map((msg) => ({
      role: msg.senderId === 'ai' ? 'assistant' as const : 'user' as const,
      content: msg.content,
    })),
  ];

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages,
    max_tokens: 100,
    temperature: 0.8,
  });

  return completion.choices[0]?.message?.content || '...';
}

export async function generateGreeting(personality: AiPersonality): Promise<string> {
  let prompt = '';
  
  switch (personality) {
    case 'normal':
      prompt = 'You are a casual person starting a conversation. Write a short, natural greeting (1 sentence) like you\'re saying hi to a stranger online.';
      break;
    case 'quirky':
      prompt = 'You are an eccentric, quirky person starting a conversation. Write a short, slightly weird greeting (1 sentence) that shows your odd personality.';
      break;
    case 'too-perfect':
      prompt = 'You are a very formal, articulate person trying to sound normal but being too proper. Write a short greeting (1 sentence) that sounds overly polished and formal.';
      break;
    case 'suspicious':
      prompt = 'You are someone trying to blend in but seeming a bit off. Write a short greeting (1 sentence) that sounds slightly vague or unnatural.';
      break;
  }
  
  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: 'Say hello to start the conversation.' }
    ],
    max_tokens: 50,
    temperature: 0.8,
  });
  
  return completion.choices[0]?.message?.content || 'Hey there!';
}
