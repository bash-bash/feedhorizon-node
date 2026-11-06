/** One page of a list. `for await` over the list call walks every page instead. */
export class Page<T> {
    constructor(
        readonly data: T[],
        readonly nextCursor: string | null,
        private readonly fetchPage: (cursor: string) => Promise<Page<T>>,
    ) {}

    hasNextPage(): boolean {
        return this.nextCursor !== null;
    }

    /** The next page, or `null` after the last one. */
    async getNextPage(): Promise<Page<T> | null> {
        return this.nextCursor === null ? null : this.fetchPage(this.nextCursor);
    }

    /** Every item from this page on, fetching further pages as needed. */
    async *iterAll(): AsyncGenerator<T, void, undefined> {
        let page: Page<T> | null = this;
        while (page) {
            yield* page.data;
            page = await page.getNextPage();
        }
    }
}

/**
 * What a list call returns: `await` it for the first page, or `for await` it
 * for every item across all pages.
 */
export class PagePromise<T> implements PromiseLike<Page<T>>, AsyncIterable<T> {
    private promise: Promise<Page<T>> | undefined;

    constructor(private readonly load: () => Promise<Page<T>>) {}

    private get page(): Promise<Page<T>> {
        return (this.promise ??= this.load());
    }

    then<A = Page<T>, B = never>(
        onfulfilled?: ((value: Page<T>) => A | PromiseLike<A>) | null,
        onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ): Promise<A | B> {
        return this.page.then(onfulfilled, onrejected);
    }

    catch<B = never>(onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null): Promise<Page<T> | B> {
        return this.page.catch(onrejected);
    }

    async *[Symbol.asyncIterator](): AsyncGenerator<T, void, undefined> {
        yield* (await this.page).iterAll();
    }
}
