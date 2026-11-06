import { afterEach, describe, expect, it, vi } from 'vitest';
import FeedHorizon, {
    APIConnectionError,
    AuthenticationError,
    ConflictError,
    FeedHorizonError,
    InternalServerError,
    InvalidRequestError,
    NotFoundError,
    RateLimitError,
} from '../src/index.js';
import { errorBody, mockClient } from './helpers.js';

const post = { id: 'post_1', status: 'scheduled' };

afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
});

describe('requests', () => {
    it('creates a post with auth, JSON body and an idempotency key', async () => {
        const { client, calls } = mockClient([{ status: 201, body: { data: post } }]);
        const result = await client.posts.create({ profileId: 'prof_1', content: 'Hi', platforms: ['linkedin'], publishNow: true });

        expect(result).toEqual(post);
        const [call] = calls;
        expect(call!.method).toBe('POST');
        expect(call!.url.toString()).toBe('https://feedhorizon.com/api/v1/posts');
        expect(call!.headers.authorization).toBe('Bearer fh_test');
        expect(call!.headers['content-type']).toBe('application/json');
        expect(call!.headers['idempotency-key']).toMatch(/^sdk-[0-9a-f-]{36}$/);
        expect(call!.body).toEqual({ profileId: 'prof_1', content: 'Hi', platforms: ['linkedin'], publishNow: true });
    });

    it('uses a given idempotency key and sends none on GET', async () => {
        const { client, calls } = mockClient([{ body: { data: post } }, { body: { data: post } }]);
        await client.posts.publish('post_1', { idempotencyKey: 'mine' });
        await client.posts.get('post_1');
        expect(calls[0]!.headers['idempotency-key']).toBe('mine');
        expect(calls[0]!.url.pathname).toBe('/api/v1/posts/post_1/publish');
        expect(calls[1]!.headers['idempotency-key']).toBeUndefined();
    });

    it('drops undefined query values and encodes ids', async () => {
        const { client, calls } = mockClient([{ body: { data: [], nextCursor: null } }, { body: { data: post } }]);
        await client.posts.list({ profileId: 'prof_1', status: undefined, limit: 10 });
        await client.posts.get('a/b');
        expect(calls[0]!.url.search).toBe('?profileId=prof_1&limit=10');
        expect(calls[1]!.url.pathname).toBe('/api/v1/posts/a%2Fb');
    });

    it('reads the key and base URL from the environment', async () => {
        vi.stubEnv('FEEDHORIZON_API_KEY', 'fh_env');
        vi.stubEnv('FEEDHORIZON_BASE_URL', 'http://localhost:3000/api/v1/');
        const { client, calls } = mockClient([{ body: { data: { id: 'org_1' } } }], { apiKey: undefined });
        await client.me();
        expect(calls[0]!.headers.authorization).toBe('Bearer fh_env');
        expect(calls[0]!.url.toString()).toBe('http://localhost:3000/api/v1/me');
    });

    it('throws without an API key', () => {
        vi.stubEnv('FEEDHORIZON_API_KEY', '');
        expect(() => new FeedHorizon()).toThrow(FeedHorizonError);
    });

    it('reaches nested resources', async () => {
        const { client, calls } = mockClient([{ body: { data: { slots: [] } } }, { body: { data: { slots: [] } } }]);
        await client.profiles.queue.set('prof_1', { slots: [{ dayOfWeek: 1, time: '09:00' }], reshuffle: true });
        await client.profiles.queue.slots('prof_1', { count: 5, free: 'true' });
        expect(calls[0]!.method).toBe('PUT');
        expect(calls[0]!.url.pathname).toBe('/api/v1/profiles/prof_1/queue');
        expect(calls[1]!.url.search).toBe('?count=5&free=true');
    });
});

describe('errors', () => {
    it.each([
        [400, 'post_invalid', InvalidRequestError],
        [401, 'invalid_api_key', AuthenticationError],
        [404, 'resource_not_found', NotFoundError],
        [409, 'post_not_editable', ConflictError],
    ])('maps %i to its class', async (status, code, cls) => {
        const { client } = mockClient([errorBody(status, code)]);
        const error = await client.posts.get('post_1').catch((e) => e);
        expect(error).toBeInstanceOf(cls);
        expect(error.status).toBe(status);
        expect(error.code).toBe(code);
        expect(error.requestId).toBe('req_123');
    });

    it('exposes every problem of an invalid post', async () => {
        const body = errorBody(400, 'post_invalid');
        (body.body.error as Record<string, unknown>).details = [{ code: 'content_too_long', param: 'targets.1.content', message: 'too long' }];
        const { client } = mockClient([body]);
        const error = await client.posts.create({ profileId: 'prof_1', content: 'x' }).catch((e) => e);
        expect(error.details[0].code).toBe('content_too_long');
    });
});

describe('retries', () => {
    it('retries 5xx with the same idempotency key', async () => {
        vi.useFakeTimers();
        const { client, calls } = mockClient([errorBody(500, 'internal_error', 'api_error'), { status: 201, body: { data: post } }]);
        const promise = client.posts.create({ profileId: 'prof_1', content: 'Hi' });
        await vi.runAllTimersAsync();
        await expect(promise).resolves.toEqual(post);
        expect(calls).toHaveLength(2);
        expect(calls[0]!.headers['idempotency-key']).toBe(calls[1]!.headers['idempotency-key']);
    });

    it('waits Retry-After on 429 and gives up after maxRetries', async () => {
        vi.useFakeTimers();
        const limited = { ...errorBody(429, 'rate_limited', 'rate_limit_error'), headers: { 'retry-after': '3' } };
        const { client, calls } = mockClient([limited, limited, limited]);
        const promise = client.posts.get('post_1').catch((e) => e);
        await vi.advanceTimersByTimeAsync(2999);
        expect(calls).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(calls).toHaveLength(2);
        await vi.runAllTimersAsync();
        const error = await promise;
        expect(error).toBeInstanceOf(RateLimitError);
        expect(error.retryAfter).toBe(3);
        expect(calls).toHaveLength(3);
    });

    it('does not retry 4xx', async () => {
        const { client, calls } = mockClient([errorBody(409, 'post_not_editable', 'conflict_error')]);
        await expect(client.posts.update('post_1', { content: 'x' })).rejects.toBeInstanceOf(ConflictError);
        expect(calls).toHaveLength(1);
    });

    it('retries network errors, then throws APIConnectionError', async () => {
        vi.useFakeTimers();
        const { client, calls } = mockClient([new TypeError('fetch failed'), new TypeError('fetch failed')], { maxRetries: 1 });
        const promise = client.me().catch((e) => e);
        await vi.runAllTimersAsync();
        expect(await promise).toBeInstanceOf(APIConnectionError);
        expect(calls).toHaveLength(2);
    });

    it('maxRetries 0 turns retries off', async () => {
        const { client, calls } = mockClient([errorBody(503, 'internal_error', 'api_error')], { maxRetries: 0 });
        await expect(client.me()).rejects.toBeInstanceOf(InternalServerError);
        expect(calls).toHaveLength(1);
    });
});

describe('pagination', () => {
    it('awaits one page or iterates all', async () => {
        const pages = [
            { body: { data: [{ id: 'post_1' }, { id: 'post_2' }], nextCursor: 'c2' } },
            { body: { data: [{ id: 'post_3' }], nextCursor: null } },
        ];
        const first = mockClient([pages[0]!]);
        const page = await first.client.posts.list({ limit: 2 });
        expect(page.data).toHaveLength(2);
        expect(page.hasNextPage()).toBe(true);

        const all = mockClient([...pages]);
        const ids: string[] = [];
        for await (const p of all.client.posts.list({ limit: 2 })) ids.push(p.id);
        expect(ids).toEqual(['post_1', 'post_2', 'post_3']);
        expect(all.calls[1]!.url.search).toBe('?limit=2&cursor=c2');
    });
});

describe('media', () => {
    it('uploads in two steps', async () => {
        const created = {
            id: 'med_1',
            url: 'https://cdn/x.png',
            filename: 'x.png',
            mimeType: 'image/png',
            sizeBytes: 3,
            createdAt: '2026-11-10T08:00:00.000Z',
            upload: { url: 'https://storage/put', method: 'PUT', headers: { 'content-type': 'image/png' }, expiresAt: '2026-11-10T10:00:00.000Z' },
        };
        const { client, calls } = mockClient([{ status: 201, body: { data: created } }, { status: 200 }]);
        const media = await client.media.upload({ file: new Uint8Array([1, 2, 3]), filename: 'x.png', mimeType: 'image/png' });

        expect(calls[0]!.body).toEqual({ filename: 'x.png', mimeType: 'image/png', sizeBytes: 3 });
        expect(calls[1]!.method).toBe('PUT');
        expect(calls[1]!.url.toString()).toBe('https://storage/put');
        expect(calls[1]!.headers['content-type']).toBe('image/png');
        expect(media.id).toBe('med_1');
        expect('upload' in media).toBe(false);
    });
});
