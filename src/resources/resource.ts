import type { FeedHorizon } from '../client.js';

export abstract class Resource {
    constructor(protected readonly client: FeedHorizon) {}
}

/** Encodes an id for use in a path. */
export const id = (value: string) => encodeURIComponent(value);
