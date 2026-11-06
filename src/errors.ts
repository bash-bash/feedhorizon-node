import type { ErrorBody } from './types.js';

type ErrorDetail = NonNullable<ErrorBody['error']['details']>[number];

/** Base class of every error this SDK throws. */
export class FeedHorizonError extends Error {
    override name = 'FeedHorizonError';
}

/** The API answered with an error status. `code` says what went wrong; branch on it, not on `message`. */
export class APIError extends FeedHorizonError {
    override name = 'APIError';
    /** HTTP status, e.g. 400. */
    readonly status: number;
    /** Error type, e.g. `invalid_request_error`. */
    readonly type: string;
    /** Error code, e.g. `content_too_long`. See https://feedhorizon.com/docs/api/errors */
    readonly code: string;
    /** The request field the error is about, if any. */
    readonly param: string | undefined;
    /** Every problem at once, for `post_invalid` and `validation_failed`. */
    readonly details: ErrorDetail[];
    /** Quote this when you contact support. */
    readonly requestId: string | undefined;
    readonly docUrl: string | undefined;
    /** Response headers. */
    readonly headers: Headers;
    /** The raw error body. */
    readonly body: unknown;

    constructor(status: number, body: unknown, headers: Headers) {
        const error = (body as Partial<ErrorBody> | undefined)?.error;
        super(error?.message ?? `HTTP ${status}`);
        this.status = status;
        this.type = error?.type ?? 'api_error';
        this.code = error?.code ?? 'unknown';
        this.param = error?.param ?? undefined;
        this.details = error?.details ?? [];
        this.requestId = error?.requestId ?? headers.get('x-request-id') ?? undefined;
        this.docUrl = error?.docUrl ?? undefined;
        this.headers = headers;
        this.body = body;
    }

    /** Picks the subclass that fits the status. */
    static from(status: number, body: unknown, headers: Headers): APIError {
        if (status === 400 || status === 422) return new InvalidRequestError(status, body, headers);
        if (status === 401) return new AuthenticationError(status, body, headers);
        if (status === 403) return new PermissionDeniedError(status, body, headers);
        if (status === 404) return new NotFoundError(status, body, headers);
        if (status === 409) return new ConflictError(status, body, headers);
        if (status === 429) return new RateLimitError(status, body, headers);
        if (status >= 500) return new InternalServerError(status, body, headers);
        return new APIError(status, body, headers);
    }
}

/** 400 or 422: the request breaks a rule. `details` lists every problem. */
export class InvalidRequestError extends APIError {
    override name = 'InvalidRequestError';
}
/** 401: no key, or the key is unknown, revoked or expired. */
export class AuthenticationError extends APIError {
    override name = 'AuthenticationError';
}
/** 403: the key lacks a scope or access to the profile. */
export class PermissionDeniedError extends APIError {
    override name = 'PermissionDeniedError';
}
/** 404: the object does not exist or the key cannot see it. */
export class NotFoundError extends APIError {
    override name = 'NotFoundError';
}
/** 409: the current state does not allow this, e.g. editing a published post. */
export class ConflictError extends APIError {
    override name = 'ConflictError';
}
/** 429: too many requests. `retryAfter` says how many seconds to wait. */
export class RateLimitError extends APIError {
    override name = 'RateLimitError';
    get retryAfter(): number | undefined {
        const value = Number(this.headers.get('retry-after'));
        return Number.isFinite(value) && value > 0 ? value : undefined;
    }
}
/** 5xx: something failed on FeedHorizon's side. */
export class InternalServerError extends APIError {
    override name = 'InternalServerError';
}

/** The request never got an answer: network error or DNS failure. */
export class APIConnectionError extends FeedHorizonError {
    override name = 'APIConnectionError';
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
    }
}
/** The request took longer than `timeout`. */
export class APITimeoutError extends APIConnectionError {
    override name = 'APITimeoutError';
}

/** A webhook signature is missing, malformed, wrong or too old. */
export class WebhookVerificationError extends FeedHorizonError {
    override name = 'WebhookVerificationError';
}
