import type { components, operations, webhooks } from './generated/openapi.js';

type Ops = operations;
type Json<T> = T extends { content: { 'application/json': infer B } } ? B : never;

/** The JSON body an operation takes. */
export type BodyOf<K extends keyof Ops> = Ops[K] extends { requestBody?: infer R } ? Json<NonNullable<R>> : never;
/** The query parameters an operation takes. */
export type QueryOf<K extends keyof Ops> = Ops[K] extends { parameters: { query?: infer Q } } ? NonNullable<Q> : never;
type Success<R> = R extends { 200: infer S } ? S : R extends { 201: infer S } ? S : never;
/** The `data` an operation answers with. */
export type DataOf<K extends keyof Ops> = Json<Success<Ops[K]['responses']>> extends { data: infer D } ? D : never;

export type Schemas = components['schemas'];

export type Me = Schemas['Me'];
export type Post = Schemas['Post'];
export type PostTarget = Schemas['PostTarget'];
export type PostTargetInput = Schemas['PostTargetInput'];
export type PostTargetOptions = Schemas['PostTargetOptions'];
export type PostMedia = Schemas['PostMedia'];
export type PostIssue = Schemas['PostIssue'];
export type PostValidation = Schemas['PostValidation'];
export type Media = Schemas['Media'];
export type MediaCreated = Schemas['MediaCreated'];
export type Profile = Schemas['Profile'];
export type Queue = Schemas['Queue'];
export type QueueSlot = Schemas['QueueSlot'];
export type QueueSlots = Schemas['QueueSlots'];
export type Account = Schemas['Account'];
export type TikTokCreatorInfo = Schemas['TikTokCreatorInfo'];
export type PinterestBoardList = Schemas['PinterestBoardList'];
export type Platform = Schemas['Platform'];
export type PlatformId = Platform['id'];
export type PlatformInvite = Schemas['PlatformInvite'];
export type PlatformInviteCreated = Schemas['PlatformInviteCreated'];
export type Webhook = Schemas['Webhook'];
export type WebhookCreated = DataOf<'webhooks.create'>;
export type WebhookTestResult = Schemas['WebhookTestResult'];
export type ApiKey = Schemas['ApiKey'];
export type ApiKeyCreated = DataOf<'api_keys.create'>;
export type Deleted = { id: string; deleted: true };
export type ErrorBody = Schemas['Error'];

export type PostCreateParams = BodyOf<'posts.create'>;
export type PostValidateParams = BodyOf<'posts.validate'>;
export type PostUpdateParams = BodyOf<'posts.update'>;
export type PostListParams = QueryOf<'posts.list'>;
export type MediaCreateParams = BodyOf<'media.create'>;
export type MediaListParams = QueryOf<'media.list'>;
export type ProfileCreateParams = BodyOf<'profiles.create'>;
export type ProfileUpdateParams = BodyOf<'profiles.update'>;
export type ProfileListParams = QueryOf<'profiles.list'>;
export type QueueSetParams = BodyOf<'queue.set'>;
export type QueueSlotsParams = QueryOf<'queue.slots'>;
export type AccountListParams = QueryOf<'accounts.list'>;
export type PlatformInviteCreateParams = BodyOf<'platform_invites.create'>;
export type PlatformInviteListParams = QueryOf<'platform_invites.list'>;
export type WebhookCreateParams = BodyOf<'webhooks.create'>;
export type WebhookUpdateParams = BodyOf<'webhooks.update'>;
export type ApiKeyCreateParams = BodyOf<'api_keys.create'>;

/** The body FeedHorizon POSTs to your webhook URL, per event name. */
export type WebhookEventMap = {
    [E in keyof webhooks]: webhooks[E]['post'] extends { requestBody?: infer R } ? Json<NonNullable<R>> : never;
};
export type WebhookEventName = keyof WebhookEventMap;
/** Any webhook event; narrow it with `switch (event.event)`. */
export type WebhookEvent = WebhookEventMap[WebhookEventName];

/** Options every call takes. */
export interface RequestOptions {
    /** Sent as `Idempotency-Key`. Writes get a random key by default, so automatic retries never run twice. */
    idempotencyKey?: string;
    /** Milliseconds before the request is aborted. Default: the client's `timeout`. */
    timeout?: number;
    /** Retries after network errors, 408, 409 in-progress, 429 and 5xx. Default: the client's `maxRetries`. */
    maxRetries?: number;
    /** Abort the request. */
    signal?: AbortSignal;
    /** Extra headers. */
    headers?: Record<string, string>;
}
