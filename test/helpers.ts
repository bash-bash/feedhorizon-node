import { FeedHorizon } from '../src/index.js';

export interface Call {
    url: URL;
    method: string;
    headers: Record<string, string>;
    body: unknown;
}

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> } | Error;

/** A client whose fetch answers from a queue and records every request. */
export function mockClient(replies: Reply[], options: ConstructorParameters<typeof FeedHorizon>[0] = {}) {
    const calls: Call[] = [];
    const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
        const raw = init?.body;
        calls.push({
            url: new URL(String(input)),
            method: init?.method ?? 'GET',
            headers,
            body: typeof raw === 'string' ? JSON.parse(raw) : raw,
        });
        const reply = replies.shift();
        if (!reply) throw new Error('No reply left');
        if (reply instanceof Error) throw reply;
        return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
            status: reply.status ?? 200,
            headers: { 'content-type': 'application/json', ...reply.headers },
        });
    };
    const client = new FeedHorizon({ apiKey: 'fh_test', maxRetries: 2, ...options, fetch: fetch as typeof globalThis.fetch });
    return { client, calls };
}

export const errorBody = (status: number, code: string, type = 'invalid_request_error') => ({
    status,
    body: { error: { type, code, message: `${code} happened`, docUrl: 'https://feedhorizon.com/docs/api/errors', requestId: 'req_123' } },
});
