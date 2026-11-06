import type { PagePromise } from '../pagination.js';
import type {
    Deleted,
    Post,
    PostCreateParams,
    PostListParams,
    PostUpdateParams,
    PostValidateParams,
    PostValidation,
    RequestOptions,
} from '../types.js';
import { Resource, id } from './resource.js';

export class Posts extends Resource {
    /**
     * Lists posts, newest first. With `from` or `to` it is a calendar range, oldest first.
     * `await` it for one page, or `for await (const post of client.posts.list())` for all.
     */
    list(params: PostListParams = {}, options?: RequestOptions): PagePromise<Post> {
        return this.client.list<Post>('/posts', params, options);
    }

    get(postId: string, options?: RequestOptions): Promise<Post> {
        return this.client.get<Post>(`/posts/${id(postId)}`, undefined, options);
    }

    /**
     * Creates a draft, a scheduled post (`scheduledFor`), a queued post (`addToQueue`)
     * or publishes right away (`publishNow`). Throws `InvalidRequestError` with every
     * problem in `details` if the post breaks a platform's rules.
     */
    create(params: PostCreateParams, options?: RequestOptions): Promise<Post> {
        return this.client.post<Post>('/posts', params, options);
    }

    /** Runs every check of `create` without creating anything. */
    validate(params: PostValidateParams, options?: RequestOptions): Promise<PostValidation> {
        return this.client.post<PostValidation>('/posts/validate', params, options);
    }

    /** Changes a post that has not started publishing. `scheduledFor: null` makes it a draft. */
    update(postId: string, params: PostUpdateParams, options?: RequestOptions): Promise<Post> {
        return this.client.patch<Post>(`/posts/${id(postId)}`, params, options);
    }

    /** Deletes the post in FeedHorizon. Posts already live stay on the platforms. */
    delete(postId: string, options?: RequestOptions): Promise<Deleted> {
        return this.client.delete<Deleted>(`/posts/${id(postId)}`, options);
    }

    /** Publishes a draft or scheduled post right away. */
    publish(postId: string, options?: RequestOptions): Promise<Post> {
        return this.client.post<Post>(`/posts/${id(postId)}/publish`, undefined, options);
    }

    /** Takes a scheduled post off the schedule; it stays as a draft. */
    cancel(postId: string, options?: RequestOptions): Promise<Post> {
        return this.client.post<Post>(`/posts/${id(postId)}/cancel`, undefined, options);
    }

    /** Sends the failed accounts of a post again. */
    retry(postId: string, options?: RequestOptions): Promise<Post> {
        return this.client.post<Post>(`/posts/${id(postId)}/retry`, undefined, options);
    }

    /** Copies a post as a new draft. */
    duplicate(postId: string, options?: RequestOptions): Promise<Post> {
        return this.client.post<Post>(`/posts/${id(postId)}/duplicate`, undefined, options);
    }
}
