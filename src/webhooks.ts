import { WebhookVerificationError } from './errors.js';
import type { WebhookEvent } from './types.js';

/** What `POST /webhooks/{id}/test` delivers. */
export interface WebhookTestEvent {
    id: string;
    event: 'webhook.test';
    timestamp: string;
    data: Record<string, unknown>;
}

export interface VerifyWebhookParams {
    /** The raw request body, exactly as received. Parsing and re-serializing the JSON breaks the signature. */
    payload: string | ArrayBuffer | ArrayBufferView;
    /** The `X-Webhook-Signature` header: `t=<unix seconds>,v1=<hex>`. */
    signature: string | null | undefined;
    /** The endpoint's signing secret (`whsec_…`). */
    secret: string;
    /** Reject deliveries whose timestamp is further than this from now. Default 300 seconds. */
    toleranceSeconds?: number;
    /** For tests: the current time in Unix seconds. */
    now?: number;
}

const encoder = new TextEncoder();

function toText(payload: VerifyWebhookParams['payload']): string {
    if (typeof payload === 'string') return payload;
    const bytes = payload instanceof ArrayBuffer ? new Uint8Array(payload) : new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
    return new TextDecoder().decode(bytes);
}

function toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

/** Computes the signature FeedHorizon would send for this body and time. Useful in tests. */
export async function signWebhookPayload(payload: string, secret: string, timestamp: number): Promise<string> {
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`));
    return `t=${timestamp},v1=${toHex(mac)}`;
}

/**
 * Checks the `X-Webhook-Signature` of a delivery. Throws `WebhookVerificationError`
 * when it is missing, wrong or older than `toleranceSeconds`.
 */
export async function verifyWebhook(params: VerifyWebhookParams): Promise<void> {
    const { signature, secret, toleranceSeconds = 300 } = params;
    if (!signature) throw new WebhookVerificationError('Missing X-Webhook-Signature header');
    if (!secret) throw new WebhookVerificationError('Missing webhook secret');

    let timestamp: number | undefined;
    const candidates: string[] = [];
    for (const part of signature.split(',')) {
        const [key, value] = part.trim().split('=', 2);
        if (key === 't') timestamp = Number(value);
        else if (key === 'v1' && value) candidates.push(value);
    }
    if (!timestamp || !Number.isFinite(timestamp) || candidates.length === 0) {
        throw new WebhookVerificationError('Malformed X-Webhook-Signature header');
    }
    const now = params.now ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
        throw new WebhookVerificationError('Webhook timestamp is outside the tolerance; possible replay');
    }

    const expected = (await signWebhookPayload(toText(params.payload), secret, timestamp)).split('v1=')[1]!;
    if (!candidates.some((candidate) => timingSafeEqual(candidate, expected))) {
        throw new WebhookVerificationError('Webhook signature does not match');
    }
}

/**
 * Verifies a delivery and returns the parsed event. Narrow it with `switch (event.event)`.
 *
 * ```ts
 * const event = await constructWebhookEvent({ payload: rawBody, signature: req.headers['x-webhook-signature'], secret });
 * if (event.event === 'post.target.failed') console.log(event.data.error?.code);
 * ```
 */
export async function constructWebhookEvent(params: VerifyWebhookParams): Promise<WebhookEvent | WebhookTestEvent> {
    await verifyWebhook(params);
    try {
        return JSON.parse(toText(params.payload)) as WebhookEvent | WebhookTestEvent;
    } catch (error) {
        throw new WebhookVerificationError('Webhook body is not valid JSON');
    }
}
