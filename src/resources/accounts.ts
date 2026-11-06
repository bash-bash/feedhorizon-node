import type { PagePromise } from '../pagination.js';
import type { Account, AccountListParams, Deleted, PinterestBoardList, RequestOptions, TikTokCreatorInfo } from '../types.js';
import { Resource, id } from './resource.js';

export class Accounts extends Resource {
    list(params: AccountListParams = {}, options?: RequestOptions): PagePromise<Account> {
        return this.client.list<Account>('/accounts', params, options);
    }

    get(accountId: string, options?: RequestOptions): Promise<Account> {
        return this.client.get<Account>(`/accounts/${id(accountId)}`, undefined, options);
    }

    /** Disconnects the account. Its scheduled posts are deleted with it. */
    delete(accountId: string, options?: RequestOptions): Promise<Deleted> {
        return this.client.delete<Deleted>(`/accounts/${id(accountId)}`, options);
    }

    /** The boards of a Pinterest account, for `targets[].options.pinterest.boardId`. */
    boards(accountId: string, options?: RequestOptions): Promise<PinterestBoardList> {
        return this.client.get<PinterestBoardList>(`/accounts/${id(accountId)}/boards`, undefined, options);
    }

    /** What a TikTok account may post, for `targets[].options.tiktok`. */
    tiktokCreator(accountId: string, options?: RequestOptions): Promise<TikTokCreatorInfo> {
        return this.client.get<TikTokCreatorInfo>(`/accounts/${id(accountId)}/tiktok-creator`, undefined, options);
    }
}
