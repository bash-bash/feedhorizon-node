import type { PagePromise } from '../pagination.js';
import type { ApiKey, ApiKeyCreated, ApiKeyCreateParams, Deleted, RequestOptions } from '../types.js';
import { Resource, id } from './resource.js';

export class ApiKeys extends Resource {
    list(options?: RequestOptions): PagePromise<ApiKey> {
        return this.client.list<ApiKey>('/api-keys', undefined, options);
    }

    /** Creates a key. The answer holds the full `key`, shown only once. */
    create(params: ApiKeyCreateParams, options?: RequestOptions): Promise<ApiKeyCreated> {
        return this.client.post<ApiKeyCreated>('/api-keys', params, options);
    }

    /** Revokes a key at once. */
    delete(keyId: string, options?: RequestOptions): Promise<Deleted> {
        return this.client.delete<Deleted>(`/api-keys/${id(keyId)}`, options);
    }
}
