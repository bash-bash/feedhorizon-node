import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { WebhookVerificationError, constructWebhookEvent, signWebhookPayload, verifyWebhook } from '../src/index.js';

const secret = 'whsec_test';
const payload = JSON.stringify({ id: 'evt_1', event: 'post.target.failed', timestamp: '2026-11-10T08:00:00.000Z', data: { postId: 'post_1' } });
const t = 1_800_000_000;
// The server's algorithm (feedwave src/lib/webhooks.ts): hex HMAC-SHA256 of "<t>.<body>".
const header = `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')}`;

describe('webhooks', () => {
    it('signs like the server', async () => {
        expect(await signWebhookPayload(payload, secret, t)).toBe(header);
    });

    it('accepts a valid delivery and parses it', async () => {
        const event = await constructWebhookEvent({ payload, signature: header, secret, now: t + 10 });
        expect(event.event).toBe('post.target.failed');
        await expect(verifyWebhook({ payload: Buffer.from(payload), signature: header, secret, now: t })).resolves.toBeUndefined();
    });

    it.each([
        ['a changed body', { payload: payload.replace('post_1', 'post_2') }],
        ['a wrong secret', { secret: 'whsec_other' }],
        ['an old timestamp', { now: t + 301 }],
        ['a missing header', { signature: undefined }],
        ['a malformed header', { signature: 'v1=abc' }],
    ])('rejects %s', async (_, override) => {
        await expect(verifyWebhook({ payload, signature: header, secret, now: t, ...override })).rejects.toBeInstanceOf(WebhookVerificationError);
    });
});
