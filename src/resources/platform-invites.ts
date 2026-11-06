import type { PagePromise } from '../pagination.js';
import type { Deleted, PlatformInvite, PlatformInviteCreated, PlatformInviteCreateParams, PlatformInviteListParams, RequestOptions } from '../types.js';
import { Resource, id } from './resource.js';

/** Connect links: let a customer connect their account to one of your profiles. */
export class PlatformInvites extends Resource {
    list(params: PlatformInviteListParams, options?: RequestOptions): PagePromise<PlatformInvite> {
        return this.client.list<PlatformInvite>('/platform-invites', params, options);
    }

    /** Creates a link for one profile and platform. `inviteUrl` is returned only here. */
    create(params: PlatformInviteCreateParams, options?: RequestOptions): Promise<PlatformInviteCreated> {
        return this.client.post<PlatformInviteCreated>('/platform-invites', params, options);
    }

    /** Revokes a link. */
    delete(inviteId: string, options?: RequestOptions): Promise<Deleted> {
        return this.client.delete<Deleted>(`/platform-invites/${id(inviteId)}`, options);
    }
}
