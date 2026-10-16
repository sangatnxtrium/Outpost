// Copy for the /for-shops page. Shared by the React page (src/ForShops.tsx)
// and middleware.ts (server-rendered HTML for crawlers), so they never drift.
// Keep this file dependency-free.

// TODO: replace with a dedicated partners/support inbox when one exists.
// legal@getoutpost.net is the only contact address currently in the repo (src/Legal.tsx).
export const FOR_SHOPS_CONTACT_EMAIL = 'legal@getoutpost.net'

export const FOR_SHOPS_META = {
  title: 'For Shop Owners: Claim Your Free Listing | Outpost',
  description:
    'Own a card, comic or collectibles shop? Claim your free Outpost listing to drive foot traffic with GPS check-ins and rewards, publish drops, and earn a verified badge.',
}

export const FOR_SHOPS = {
  heading: 'Outpost for Shop Owners',
  intro:
    'Outpost helps local collectors find card, comic and collectibles shops near them. Claim your listing to bring more of them through your door.',
  benefits: [
    { title: 'More foot traffic', body: 'Get discovered by collectors searching for shops in your city.' },
    { title: 'GPS check-ins', body: 'Collectors check in when they visit your shop in person, so you can see real visits.' },
    { title: 'Rewards', body: 'Post your own rewards, like a free pack or a discount, that collectors redeem in store with a one-time code.' },
    { title: 'Publish drops', body: 'Highlight your hot finds and new arrivals so collectors know what just landed.' },
    { title: 'Verified badge', body: 'Approved owners get a verified badge and can edit hours, details and up to 5 photos.' },
  ],
  founding: {
    title: 'Founding Member offer',
    body: 'The first 1,000 members get the Store plan free for life, plus a serial-numbered Founding Member badge. Every plan is also free for everyone until January 2028. No credit card needed.',
  },
  steps: [
    'Sign in to Outpost with your email.',
    'Find your shop and tap "Own a shop? Claim your listing". If it isn\'t listed yet, you can add it.',
    'Enter your business details and EIN.',
    'Our team reviews your claim. Once approved, you get the verified badge and can edit your listing.',
  ],
  einNote:
    'Your EIN is used only to verify you own this business. Stored securely and never shared or shown publicly.',
}
