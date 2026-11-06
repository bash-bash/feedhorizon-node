/** Run with: FEEDHORIZON_API_KEY=fh_… npx tsx examples/schedule-post.ts */
import FeedHorizon from '../src/index.js';

const client = new FeedHorizon();

const { data: profiles } = await client.profiles.list();
const profile = profiles[0];
if (!profile) throw new Error('No profile');

const check = await client.posts.validate({ profileId: profile.id, content: 'Hello from the SDK', platforms: ['linkedin'], addToQueue: true });
if (!check.valid) {
    console.error(check.errors);
    process.exit(1);
}

const post = await client.posts.create({ profileId: profile.id, content: 'Hello from the SDK', platforms: ['linkedin'], addToQueue: true });
console.log(`Scheduled ${post.id} for ${post.scheduledAt}`);
