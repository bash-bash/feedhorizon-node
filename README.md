# FeedHorizon Node.js SDK

The official Node.js and TypeScript client for the [FeedHorizon API](https://feedhorizon.com/docs): schedule and publish posts on X, LinkedIn, Instagram, Bluesky, Pinterest and TikTok with one API.

- Typed requests and responses, generated from the [OpenAPI spec](https://feedhorizon.com/openapi.json)
- Automatic retries with idempotency keys, so a retry never posts twice
- `for await` over any list, across all pages
- Webhook signature verification
- No dependencies. Node.js 20+, Deno, Bun and edge runtimes

## Install

```bash
npm install @feedhorizon/sdk
```

## Quickstart

Create an API key under **API & Apps** in the [dashboard](https://feedhorizon.com/dashboard/api-keys) and set it as `FEEDHORIZON_API_KEY`.

```ts
import FeedHorizon from '@feedhorizon/sdk';

const client = new FeedHorizon(); // reads FEEDHORIZON_API_KEY

const { data: profiles } = await client.profiles.list();

const post = await client.posts.create({
    profileId: profiles[0].id,
    content: 'Hello from the FeedHorizon SDK!',
    platforms: ['linkedin', 'bluesky'],
    scheduledFor: '2026-11-12T09:00:00+01:00',
});

console.log(post.id, post.status); // post_… scheduled
```

Leave out the timing field for a draft, or send `addToQueue: true` or `publishNow: true` instead of `scheduledFor`. See [Scheduling](https://feedhorizon.com/docs/guides/scheduling).

## Check a post before creating it

```ts
const check = await client.posts.validate({ profileId, content, platforms: ['twitter', 'instagram'] });
if (!check.valid) {
    for (const issue of check.errors) console.log(issue.code, issue.message);
}
```

## Media

```ts
// From a public URL
const image = await client.media.import('https://example.com/launch.jpg');

// From a file (up to 5 GB)
import { readFile } from 'node:fs/promises';
const video = await client.media.upload({ file: await readFile('teaser.mp4'), filename: 'teaser.mp4', mimeType: 'video/mp4' });

await client.posts.create({ profileId, content: 'The teaser is out', platforms: ['instagram'], mediaIds: [image.id, video.id], addToQueue: true });
```

## Lists and pagination

`await` a list for one page, or `for await` it for every item across all pages:

```ts
const page = await client.posts.list({ status: 'failed', limit: 50 });
console.log(page.data.length, page.hasNextPage());

for await (const post of client.posts.list({ updatedSince: '2026-11-01T00:00:00Z' })) {
    console.log(post.id, post.status);
}
```

## Errors

Every API error is an `APIError` with `status`, `code`, `message`, `param`, `details` and `requestId`. Branch on `code`; the [error reference](https://feedhorizon.com/docs/api/errors) lists them all.

```ts
import { ConflictError, InvalidRequestError } from '@feedhorizon/sdk';

try {
    await client.posts.update(postId, { content: 'New text' });
} catch (error) {
    if (error instanceof InvalidRequestError) {
        for (const d of error.details) console.log(d.code, d.param, d.message);
    } else if (error instanceof ConflictError && error.code === 'post_not_editable') {
        // already publishing or published
    } else {
        throw error;
    }
}
```

| Class | Status |
| --- | --- |
| `InvalidRequestError` | 400, 422 |
| `AuthenticationError` | 401 |
| `PermissionDeniedError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `RateLimitError` | 429 (`retryAfter` in seconds) |
| `InternalServerError` | 5xx |
| `APIConnectionError`, `APITimeoutError` | no answer |

## Retries and idempotency

Network errors, timeouts, `429` and `5xx` are retried twice with backoff (honouring `Retry-After`). Every write gets an `Idempotency-Key`, the same on each attempt, so a retry after a lost answer returns the first result instead of creating a second post. Pass your own key to make retries safe across process restarts:

```ts
await client.posts.create(params, { idempotencyKey: `launch-${campaignId}` });
```

```ts
const client = new FeedHorizon({ maxRetries: 5, timeout: 30_000 });
await client.posts.get(postId, { maxRetries: 0, timeout: 5_000 });
```

## Webhooks

Verify the signature against the **raw** body, then handle the typed event:

```ts
import express from 'express';
import { constructWebhookEvent, WebhookVerificationError } from '@feedhorizon/sdk';

app.post('/webhooks/feedhorizon', express.raw({ type: 'application/json' }), async (req, res) => {
    let event;
    try {
        event = await constructWebhookEvent({
            payload: req.body,
            signature: req.get('X-Webhook-Signature'),
            secret: process.env.FEEDHORIZON_WEBHOOK_SECRET!,
        });
    } catch (error) {
        if (error instanceof WebhookVerificationError) return res.sendStatus(400);
        throw error;
    }
    res.sendStatus(200);

    switch (event.event) {
        case 'post.target.failed':
            console.log(event.data.platform, event.data.error?.code);
            break;
        case 'account.needs_reauth':
            console.log('Reconnect', event.data.accountId);
            break;
    }
});
```

## Resources

| | Methods |
| --- | --- |
| `client.me()` | Organization, plan, rate limit and scopes of the key |
| `client.posts` | `list`, `get`, `create`, `validate`, `update`, `delete`, `publish`, `cancel`, `retry`, `duplicate` |
| `client.media` | `list`, `get`, `create`, `import`, `upload`, `delete` |
| `client.profiles` | `list`, `get`, `create`, `update`, `delete` |
| `client.profiles.queue` | `get`, `set`, `slots` |
| `client.accounts` | `list`, `get`, `delete`, `boards`, `tiktokCreator` |
| `client.platforms` | `list`, `get` |
| `client.platformInvites` | `list`, `create`, `delete` (connect links) |
| `client.webhooks` | `list`, `get`, `create`, `update`, `delete`, `test` |
| `client.apiKeys` | `list`, `create`, `delete` |

Every method takes request options as its last argument: `idempotencyKey`, `timeout`, `maxRetries`, `signal` and `headers`.

## Configuration

| Option | Default |
| --- | --- |
| `apiKey` | `FEEDHORIZON_API_KEY` |
| `baseURL` | `FEEDHORIZON_BASE_URL`, else `https://feedhorizon.com/api/v1` |
| `timeout` | `60000` ms |
| `maxRetries` | `2` |
| `defaultHeaders` | none |
| `fetch` | the global `fetch` |

## Development

```bash
npm install
npm test
npm run spec:update   # pull the latest OpenAPI spec and regenerate the types
```

Releases are published to npm from GitHub releases (tag `vX.Y.Z`), with [provenance](https://docs.npmjs.com/generating-provenance-statements).

## License

MIT
