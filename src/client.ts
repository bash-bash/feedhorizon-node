import { APIConnectionError, APIError, APITimeoutError, FeedHorizonError } from './errors.js';
import { Page, PagePromise } from './pagination.js';
import { Accounts } from './resources/accounts.js';
import { ApiKeys } from './resources/api-keys.js';
import { MediaResource } from './resources/media.js';
import { Platforms } from './resources/platforms.js';
import { PlatformInvites } from './resources/platform-invites.js';
import { Posts } from './resources/posts.js';
import { Profiles } from './resources/profiles.js';
import { Webhooks } from './resources/webhooks.js';
import type { DataOf, Me, RequestOptions } from './types.js';
import { VERSION } from './version.js';

export interface ClientOptions {
    /** Your API key (`fh_…`). Defaults to the `FEEDHORIZON_API_KEY` environment variable. */
    apiKey?: string;
    /** Defaults to `FEEDHORIZON_BASE_URL` or `https://feedhorizon.com/api/v1`. */
    baseURL?: string;
    /** Milliseconds before a request is aborted. Default 60 000. */
    timeout?: number;
    /** Retries after network errors, 408, 409 in-progress, 429 and 5xx. Default 2. */
    maxRetries?: number;
    /** Headers sent with every request. */
    defaultHeaders?: Record<string, string>;
    /** A custom `fetch`, e.g. for proxies or tests. Default: the global `fetch`. */
    fetch?: typeof fetch;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Query = Record<string, string | number | boolean | null | undefined>;

interface Request {
    method: Method;
    path: string;
    query?: Query;
    body?: unknown;
    options?: RequestOptions;
}

const DEFAULT_BASE_URL = 'https://feedhorizon.com/api/v1';

function env(name: string): string | undefined {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    return proc?.env?.[name] || undefined;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The FeedHorizon API client.
 *
 * ```ts
 * import FeedHorizon from '@feedhorizon/sdk';
 *
 * const client = new FeedHorizon(); // reads FEEDHORIZON_API_KEY
 * const post = await client.posts.create({ profileId, content: 'Hello', platforms: ['linkedin'], publishNow: true });
 * ```
 */
export class FeedHorizon {
    readonly baseURL: string;
    readonly timeout: number;
    readonly maxRetries: number;
    readonly #apiKey: string;
    private readonly defaultHeaders: Record<string, string>;
    /** @internal */
    readonly fetchImpl: typeof fetch;

    readonly posts: Posts;
    readonly media: MediaResource;
    readonly profiles: Profiles;
    readonly accounts: Accounts;
    readonly platforms: Platforms;
    readonly platformInvites: PlatformInvites;
    readonly webhooks: Webhooks;
    readonly apiKeys: ApiKeys;

    constructor(options: ClientOptions = {}) {
        const apiKey = options.apiKey ?? env('FEEDHORIZON_API_KEY');
        if (!apiKey) {
            throw new FeedHorizonError('No API key. Pass `apiKey` or set the FEEDHORIZON_API_KEY environment variable.');
        }
        this.#apiKey = apiKey;
        this.baseURL = (options.baseURL ?? env('FEEDHORIZON_BASE_URL') ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.timeout = options.timeout ?? 60_000;
        this.maxRetries = options.maxRetries ?? 2;
        this.defaultHeaders = options.defaultHeaders ?? {};
        const fetchImpl = options.fetch ?? globalThis.fetch;
        if (!fetchImpl) throw new FeedHorizonError('No global fetch. Use Node.js 20 or newer, or pass `fetch`.');
        this.fetchImpl = fetchImpl;

        this.posts = new Posts(this);
        this.media = new MediaResource(this);
        this.profiles = new Profiles(this);
        this.accounts = new Accounts(this);
        this.platforms = new Platforms(this);
        this.platformInvites = new PlatformInvites(this);
        this.webhooks = new Webhooks(this);
        this.apiKeys = new ApiKeys(this);
    }

    /** The organization, plan, rate limit and scopes of this key. */
    me(options?: RequestOptions): Promise<Me> {
        return this.get<DataOf<'me.get'>>('/me', undefined, options);
    }

    get<T>(path: string, query?: Query, options?: RequestOptions): Promise<T> {
        return this.data<T>({ method: 'GET', path, query, options });
    }
    post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
        return this.data<T>({ method: 'POST', path, body, options });
    }
    put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
        return this.data<T>({ method: 'PUT', path, body, options });
    }
    patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
        return this.data<T>({ method: 'PATCH', path, body, options });
    }
    delete<T>(path: string, options?: RequestOptions): Promise<T> {
        return this.data<T>({ method: 'DELETE', path, options });
    }

    /** A list call: await it for one page, or `for await` it for every item. */
    list<T>(path: string, query?: Query, options?: RequestOptions): PagePromise<T> {
        const load = async (cursor?: string): Promise<Page<T>> => {
            const body = await this.request<{ data: T[]; nextCursor: string | null }>({
                method: 'GET',
                path,
                query: cursor ? { ...query, cursor } : query,
                options,
            });
            return new Page(body.data, body.nextCursor ?? null, (next) => load(next));
        };
        return new PagePromise(() => load());
    }

    private async data<T>(req: Request): Promise<T> {
        const body = await this.request<{ data: T }>(req);
        return body.data;
    }

    /** Sends a request with retries and returns the parsed JSON body. */
    async request<T>(req: Request): Promise<T> {
        const options = req.options ?? {};
        const maxRetries = options.maxRetries ?? this.maxRetries;
        // One key for all attempts, so a retry after a lost answer never runs twice.
        const idempotencyKey = req.method === 'GET' ? undefined : (options.idempotencyKey ?? `sdk-${crypto.randomUUID()}`);

        for (let attempt = 0; ; attempt++) {
            let response: Response;
            try {
                response = await this.send(req, idempotencyKey);
            } catch (error) {
                if (attempt < maxRetries && !options.signal?.aborted) {
                    await sleep(this.backoff(attempt));
                    continue;
                }
                throw error;
            }

            if (response.ok) {
                const text = await response.text();
                return (text ? JSON.parse(text) : {}) as T;
            }

            const body = await response.json().catch(() => undefined);
            const error = APIError.from(response.status, body, response.headers);
            if (attempt < maxRetries && this.shouldRetry(error)) {
                await sleep(this.backoff(attempt, response.headers.get('retry-after')));
                continue;
            }
            throw error;
        }
    }

    private async send(req: Request, idempotencyKey: string | undefined): Promise<Response> {
        const options = req.options ?? {};
        const url = new URL(this.baseURL + req.path);
        for (const [key, value] of Object.entries(req.query ?? {})) {
            if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
        }
        const headers: Record<string, string> = {
            Accept: 'application/json',
            Authorization: `Bearer ${this.#apiKey}`,
            'X-FeedHorizon-Client': `feedhorizon-node/${VERSION}`,
            ...this.defaultHeaders,
            ...options.headers,
        };
        if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
        if (req.body !== undefined) headers['Content-Type'] = 'application/json';

        const timeout = options.timeout ?? this.timeout;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        const onAbort = () => controller.abort();
        options.signal?.addEventListener('abort', onAbort, { once: true });
        try {
            return await this.fetchImpl(url, {
                method: req.method,
                headers,
                body: req.body === undefined ? undefined : JSON.stringify(req.body),
                signal: controller.signal,
            });
        } catch (error) {
            if (options.signal?.aborted) throw error;
            if (controller.signal.aborted) throw new APITimeoutError(`Request timed out after ${timeout} ms`, { cause: error });
            throw new APIConnectionError(`Could not reach FeedHorizon: ${(error as Error)?.message ?? error}`, { cause: error });
        } finally {
            clearTimeout(timer);
            options.signal?.removeEventListener('abort', onAbort);
        }
    }

    private shouldRetry(error: APIError): boolean {
        if (error.status === 408 || error.status === 429 || error.status >= 500) return true;
        return error.status === 409 && error.code === 'idempotency_request_in_progress';
    }

    private backoff(attempt: number, retryAfter?: string | null): number {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds) && seconds > 0 && seconds <= 60) return seconds * 1000;
        const base = Math.min(500 * 2 ** attempt, 8000);
        return base * (0.75 + Math.random() * 0.25);
    }
}
