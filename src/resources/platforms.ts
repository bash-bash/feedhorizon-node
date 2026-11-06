import type { PagePromise } from '../pagination.js';
import type { Platform, PlatformId, RequestOptions } from '../types.js';
import { Resource, id } from './resource.js';

export class Platforms extends Resource {
    /** Every platform with its limits: text length, media types and counts. */
    list(options?: RequestOptions): PagePromise<Platform> {
        return this.client.list<Platform>('/platforms', undefined, options);
    }

    get(platform: PlatformId, options?: RequestOptions): Promise<Platform> {
        return this.client.get<Platform>(`/platforms/${id(platform)}`, undefined, options);
    }
}
