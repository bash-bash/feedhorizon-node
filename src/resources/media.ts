import { FeedHorizonError } from '../errors.js';
import type { PagePromise } from '../pagination.js';
import type { Deleted, Media, MediaCreated, MediaCreateParams, MediaListParams, RequestOptions } from '../types.js';
import { Resource, id } from './resource.js';

export type UploadFile = Blob | ArrayBuffer | ArrayBufferView;

export interface MediaUploadParams {
    /** The file's bytes. A Node.js `Buffer` works. */
    file: UploadFile;
    /** File name, e.g. `teaser.mp4`. */
    filename: string;
    /** MIME type, e.g. `video/mp4`. Defaults to the Blob's type. */
    mimeType?: MediaCreateParams['mimeType'];
}

function sizeOf(file: UploadFile): number {
    if (typeof Blob !== 'undefined' && file instanceof Blob) return file.size;
    return (file as ArrayBuffer | ArrayBufferView).byteLength;
}

export class MediaResource extends Resource {
    list(params: MediaListParams = {}, options?: RequestOptions): PagePromise<Media> {
        return this.client.list<Media>('/media', params, options);
    }

    get(mediaId: string, options?: RequestOptions): Promise<Media> {
        return this.client.get<Media>(`/media/${id(mediaId)}`, undefined, options);
    }

    /**
     * Imports a file from a public `https` URL (`{ url }`, up to 100 MB), or announces
     * an upload (`{ filename, mimeType, sizeBytes }`). For uploads, `upload()` does both steps.
     */
    create(params: MediaCreateParams, options?: RequestOptions): Promise<MediaCreated> {
        return this.client.post<MediaCreated>('/media', params, options);
    }

    /** Shortcut for `create({ url })`. */
    import(url: string, options?: RequestOptions): Promise<MediaCreated> {
        return this.create({ url }, options);
    }

    /** Uploads a file (up to 5 GB): announces it, then sends the bytes. Returns the stored file. */
    async upload(params: MediaUploadParams, options?: RequestOptions): Promise<Media> {
        const blobType = typeof Blob !== 'undefined' && params.file instanceof Blob ? params.file.type : '';
        const mimeType = params.mimeType ?? (blobType as MediaCreateParams['mimeType']);
        if (!mimeType) throw new FeedHorizonError('media.upload needs `mimeType`, e.g. "image/png".');

        const created = await this.create({ filename: params.filename, mimeType, sizeBytes: sizeOf(params.file) }, options);
        if (!created.upload) throw new FeedHorizonError('The API did not return an upload URL.');

        const response = await this.client.fetchImpl(created.upload.url, {
            method: 'PUT',
            headers: created.upload.headers,
            body: params.file as BodyInit,
            signal: options?.signal,
        });
        if (!response.ok) {
            throw new FeedHorizonError(`Upload of ${params.filename} failed with HTTP ${response.status}`);
        }
        const { upload: _upload, ...media } = created;
        return media as Media;
    }

    /** Deletes a file no post uses. Throws `ConflictError` (`media_in_use`) otherwise. */
    delete(mediaId: string, options?: RequestOptions): Promise<Deleted> {
        return this.client.delete<Deleted>(`/media/${id(mediaId)}`, options);
    }
}
