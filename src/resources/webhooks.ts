import type { PagePromise } from '../pagination.js';
import type { Deleted, RequestOptions, Webhook, WebhookCreated, WebhookCreateParams, WebhookTestResult, WebhookUpdateParams } from '../types.js';
import { Resource, id } from './resource.js';

/** Webhook endpoints. To check incoming deliveries, use `verifyWebhook` / `constructWebhookEvent`. */
export class Webhooks extends Resource {
    list(options?: RequestOptions): PagePromise<Webhook> {
        return this.client.list<Webhook>('/webhooks', undefined, options);
    }

    get(webhookId: string, options?: RequestOptions): Promise<Webhook> {
        return this.client.get<Webhook>(`/webhooks/${id(webhookId)}`, undefined, options);
    }

    /** Creates an endpoint. The answer holds the signing `secret`, shown only once. */
    create(params: WebhookCreateParams, options?: RequestOptions): Promise<WebhookCreated> {
        return this.client.post<WebhookCreated>('/webhooks', params, options);
    }

    update(webhookId: string, params: WebhookUpdateParams, options?: RequestOptions): Promise<Webhook> {
        return this.client.patch<Webhook>(`/webhooks/${id(webhookId)}`, params, options);
    }

    delete(webhookId: string, options?: RequestOptions): Promise<Deleted> {
        return this.client.delete<Deleted>(`/webhooks/${id(webhookId)}`, options);
    }

    /** Sends a signed `webhook.test` event to the endpoint. */
    test(webhookId: string, options?: RequestOptions): Promise<WebhookTestResult> {
        return this.client.post<WebhookTestResult>(`/webhooks/${id(webhookId)}/test`, undefined, options);
    }
}
