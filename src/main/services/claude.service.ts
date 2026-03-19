import Anthropic from '@anthropic-ai/sdk';
import { getStore } from '../store';
import type { EmailClassification, Equipment } from '../../shared/models';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;

  const store = getStore();
  const apiKey = store.get('anthropicApiKey');
  if (!apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  client = new Anthropic({ apiKey });
  return client;
}

export async function testAnthropicConnection(): Promise<boolean> {
  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Reply with just "connected" and nothing else.' }],
    });
    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return text.toLowerCase().includes('connected');
  } catch {
    return false;
  }
}

export async function classifyEmail(
  subject: string,
  body: string,
  vendorName?: string
): Promise<{
  classification: EmailClassification;
  summary: string;
  actionNeeded: string;
}> {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: `You are an email analyst for a conference operations team. Classify vendor emails into exactly one category:

1. auto_response - Out-of-office replies, delivery receipts, automated confirmations
2. non_answer - Vague responses like "I'll get back to you", "Let me check", "Thanks for reaching out" with no substantive information
3. substantive - Contains actual information: pricing, availability, delivery dates, specifications, confirmations, or denials
4. needs_attention - Contains problems: price increases, cancellations, delays, can't fulfill order, questions requiring decisions

Return ONLY valid JSON: {"classification": "...", "summary": "one sentence summary", "action_needed": "what to do next or 'none'"}`,
    messages: [
      {
        role: 'user',
        content: `${vendorName ? `Vendor: ${vendorName}\n` : ''}Subject: ${subject}\n\nBody:\n${body}`,
      },
    ],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    return JSON.parse(text);
  } catch {
    return {
      classification: 'needs_attention',
      summary: 'Could not classify - please review manually',
      actionNeeded: 'Manual review required',
    };
  }
}

export async function composeEmailDraft(
  vendorName: string,
  vendorEmail: string,
  threadHistory: Array<{ direction: string; subject: string; bodyPreview: string }>,
  relevantEquipment: Equipment[],
  intent: string
): Promise<{ subject: string; body: string; reasoning: string }> {
  const anthropic = getClient();

  const equipmentContext = relevantEquipment
    .map(
      (e) =>
        `- ${e.name}: need ${e.quantityNeeded}, confirmed ${e.quantityConfirmed}, status: ${e.status}`
    )
    .join('\n');

  const threadContext = threadHistory
    .map((e) => `[${e.direction}] ${e.subject}: ${e.bodyPreview}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: `You are drafting a professional email for a conference operations manager. Keep it concise (<150 words), professional but warm, and include specific quantities/dates from the context. End with a clear ask or confirmation.

Return ONLY valid JSON: {"subject": "...", "body": "...", "reasoning": "why you drafted it this way"}`,
    messages: [
      {
        role: 'user',
        content: `Vendor: ${vendorName} (${vendorEmail})

Equipment context:
${equipmentContext || 'No specific equipment linked'}

Previous thread:
${threadContext || 'No previous emails'}

Intent: ${intent}`,
      },
    ],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    return JSON.parse(text);
  } catch {
    return {
      subject: `Re: ${threadHistory[0]?.subject || 'Conference Equipment'}`,
      body: 'Could not auto-compose. Please write manually.',
      reasoning: 'AI composition failed',
    };
  }
}

export async function runEscalationReview(
  equipment: Equipment[],
  recentEmails: Array<{ vendorName: string; summary: string; sentAt: string }>
): Promise<
  Array<{
    type: string;
    description: string;
    recommendation: string;
  }>
> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: `You are reviewing conference operations status. Flag anything needing human attention. Consider:
1. Vendors who haven't responded in >48 hours
2. Equipment still unconfirmed
3. Quantity mismatches (needed vs confirmed)
4. Any communications that seem problematic

Return ONLY a valid JSON array: [{"type": "vendor_unresponsive|quantity_mismatch|email_needs_review", "description": "...", "recommendation": "..."}]
Return an empty array [] if everything looks fine.`,
    messages: [
      {
        role: 'user',
        content: `Equipment status:
${equipment.map((e) => `- ${e.name}: need ${e.quantityNeeded}, confirmed ${e.quantityConfirmed}, status: ${e.status}`).join('\n')}

Recent vendor emails (last 24h):
${recentEmails.map((e) => `- ${e.vendorName} (${e.sentAt}): ${e.summary}`).join('\n') || 'No recent emails'}`,
      },
    ],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '[]';
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

export function resetClient(): void {
  client = null;
}

export function isAnthropicConfigured(): boolean {
  const store = getStore();
  return !!store.get('anthropicApiKey');
}
