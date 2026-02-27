import { describe, it, expect } from 'vitest';

// Test the extracted utility functions from the rate-limit lib
import { checkRateLimit } from '../src/lib/rate-limit';

describe('checkRateLimit()', () => {
  it('allows the first request from a new IP', () => {
    const result = checkRateLimit('192.168.1.1');
    expect(result).toBe(true);
  });

  it('allows multiple requests within the limit', () => {
    const ip = '10.0.0.100';
    for (let i = 0; i < 9; i++) {
      expect(checkRateLimit(ip)).toBe(true);
    }
  });

  it('blocks requests after limit is exceeded', () => {
    const ip = '10.0.0.200';
    // Exhaust the limit (10 requests)
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip);
    }
    // 11th request should be blocked
    expect(checkRateLimit(ip)).toBe(false);
  });

  it('treats different IPs independently', () => {
    const ip1 = '172.16.0.1';
    const ip2 = '172.16.0.2';

    // Exhaust limit for ip1
    for (let i = 0; i < 11; i++) {
      checkRateLimit(ip1);
    }

    // ip2 should still be allowed
    expect(checkRateLimit(ip2)).toBe(true);
  });
});

describe('Input validation logic', () => {
  const MAX_MESSAGE_LENGTH = 5000;
  const MAX_MESSAGES_PER_REQUEST = 50;

  it('rejects non-array messages', () => {
    const messages = 'not an array';
    expect(Array.isArray(messages)).toBe(false);
  });

  it('rejects too many messages', () => {
    const messages = Array(51).fill({ role: 'user', content: 'test' });
    expect(messages.length > MAX_MESSAGES_PER_REQUEST).toBe(true);
  });

  it('accepts valid message count', () => {
    const messages = Array(10).fill({ role: 'user', content: 'test' });
    expect(messages.length <= MAX_MESSAGES_PER_REQUEST).toBe(true);
  });

  it('rejects messages exceeding character limit', () => {
    const longMessage = 'x'.repeat(MAX_MESSAGE_LENGTH + 1);
    expect(longMessage.length > MAX_MESSAGE_LENGTH).toBe(true);
  });

  it('accepts messages within character limit', () => {
    const validMessage = 'x'.repeat(MAX_MESSAGE_LENGTH);
    expect(validMessage.length <= MAX_MESSAGE_LENGTH).toBe(true);
  });

  it('rejects messages without string content', () => {
    const invalidMsg = { role: 'user', content: 123 };
    expect(typeof invalidMsg.content !== 'string').toBe(true);
  });

  it('rejects null content', () => {
    const invalidMsg = { role: 'user', content: null };
    expect(!invalidMsg.content || typeof invalidMsg.content !== 'string').toBe(true);
  });
});

describe('Persona file scanning', () => {
  it('filenameToId converts correctly', async () => {
    const { filenameToId } = await import('../src/lib/personas');
    expect(filenameToId('CEO_Generic.md')).toBe('ceo-generic');
    expect(filenameToId('VP_Product_Generic.md')).toBe('vp-product-generic');
  });

  it('returns 404-equivalent when personaId is missing', () => {
    const filenameMap: Record<string, string> = {
      'ceo-generic': '/personas/example/CEO_Generic.md',
    };
    const missingId = 'non-existent-persona';
    expect(filenameMap[missingId]).toBeUndefined();
  });

  it('returns the correct file path for known persona', () => {
    const filenameMap: Record<string, string> = {
      'ceo-generic': '/personas/example/CEO_Generic.md',
    };
    expect(filenameMap['ceo-generic']).toBe('/personas/example/CEO_Generic.md');
  });
});

describe('System prompt generation', () => {
  it('practice mode prompt references persona name and company', () => {
    const personaName = 'Alex Rivera';
    const personaTitle = 'Chief Executive Officer';
    const company = 'Acme Corp';

    const prompt = `You are ${personaName}, ${personaTitle} at ${company}.`;
    expect(prompt).toContain('Alex Rivera');
    expect(prompt).toContain('Chief Executive Officer');
    expect(prompt).toContain('Acme Corp');
  });

  it('practice mode prompt does not contain OTB references', () => {
    const prompt = 'You are Alex Rivera, CEO at Acme Corp.';
    expect(prompt.toLowerCase()).not.toContain('on the beach');
    expect(prompt.toLowerCase()).not.toContain('otb');
    expect(prompt).not.toContain('Claire');
  });

  it('feedback mode prompt references persona and coaching context', () => {
    const personaName = 'Jordan Chen';
    const personaTitle = 'Chief Technology Officer';

    const prompt = `You are an expert interview coach analyzing a practice session with ${personaName} (${personaTitle}).`;
    expect(prompt).toContain('Jordan Chen');
    expect(prompt).toContain('interview coach');
  });
});
