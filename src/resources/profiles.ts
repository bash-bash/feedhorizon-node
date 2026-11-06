import type { PagePromise } from '../pagination.js';
import type {
    Deleted,
    Profile,
    ProfileCreateParams,
    ProfileListParams,
    ProfileUpdateParams,
    Queue,
    QueueSetParams,
    QueueSlots,
    QueueSlotsParams,
    RequestOptions,
} from '../types.js';
import { Resource, id } from './resource.js';

/** The weekly posting times of a profile. */
export class ProfileQueue extends Resource {
    get(profileId: string, options?: RequestOptions): Promise<Queue> {
        return this.client.get<Queue>(`/profiles/${id(profileId)}/queue`, undefined, options);
    }

    /** Replaces all slots. `reshuffle: true` moves queued posts to the new times. */
    set(profileId: string, params: QueueSetParams, options?: RequestOptions): Promise<Queue> {
        return this.client.put<Queue>(`/profiles/${id(profileId)}/queue`, params, options);
    }

    /** The next slots with the post that holds each one. `free: true` lists only open slots. */
    slots(profileId: string, params: QueueSlotsParams = {}, options?: RequestOptions): Promise<QueueSlots> {
        return this.client.get<QueueSlots>(`/profiles/${id(profileId)}/queue/slots`, params, options);
    }
}

export class Profiles extends Resource {
    readonly queue = new ProfileQueue(this.client);

    /** Lists profiles. `externalId` finds the profile of one of your customers. */
    list(params: ProfileListParams = {}, options?: RequestOptions): PagePromise<Profile> {
        return this.client.list<Profile>('/profiles', params, options);
    }

    get(profileId: string, options?: RequestOptions): Promise<Profile> {
        return this.client.get<Profile>(`/profiles/${id(profileId)}`, undefined, options);
    }

    create(params: ProfileCreateParams, options?: RequestOptions): Promise<Profile> {
        return this.client.post<Profile>('/profiles', params, options);
    }

    update(profileId: string, params: ProfileUpdateParams, options?: RequestOptions): Promise<Profile> {
        return this.client.patch<Profile>(`/profiles/${id(profileId)}`, params, options);
    }

    /** Deletes the profile with its accounts, posts and queue. */
    delete(profileId: string, options?: RequestOptions): Promise<Deleted> {
        return this.client.delete<Deleted>(`/profiles/${id(profileId)}`, options);
    }
}
