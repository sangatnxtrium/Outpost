import React from 'react'
import { ArrowLeft } from 'lucide-react'

const LAST_UPDATED = 'June 28, 2026'
const COMPANY = 'Outpost'
const EMAIL = 'legal@getoutpost.net'
const WEBSITE = 'www.getoutpost.net'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="font-black text-lg mb-3 text-zinc-900">{title}</h2>
      <div className="text-sm text-zinc-600 leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen font-sans text-[#F5F5F4]" style={{ background: '#0A0B0C' }}>
      <header className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <a href="/" className="h-8 w-8 rounded-xl bg-zinc-100 flex items-center justify-center">
            <ArrowLeft className="h-4 w-4 text-zinc-600" />
          </a>
          <h1 className="font-black text-base">Privacy Policy</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-zinc-50 rounded-3xl p-6 shadow-sm border border-zinc-100">
          <p className="text-xs text-zinc-400 font-mono mb-8">Last updated: {LAST_UPDATED}</p>

          <Section title="1. Introduction">
            <p>{COMPANY} ("we," "our," or "us") operates {WEBSITE} and the Outpost mobile application. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.</p>
            <p>By using Outpost, you agree to the collection and use of information in accordance with this policy.</p>
          </Section>

          <Section title="2. Information We Collect">
            <p><strong>Account Information:</strong> When you create an account, we collect your email address and the username you choose.</p>
            <p><strong>Location Data:</strong> With your permission, we collect your device's location to show nearby collectibles shops, events, and community listings. When you post a marketplace listing or trade, we attach an <strong>approximate</strong> location to that post (your coordinates are rounded to roughly a neighborhood-sized area before they are stored) so other users can see about how far away an item is. We do not store or display your exact location for posts. You can disable location access at any time in your device settings.</p>
            <p><strong>Usage Data:</strong> We collect information about how you use the app, including shops you view, events you RSVP to, and trades and listings you post.</p>
            <p><strong>Payment Information:</strong> Payments are processed by Stripe. We do not store your credit card information. Stripe's privacy policy applies to payment data.</p>
            <p><strong>User Content:</strong> Content you create — including trade posts, marketplace listings, shop photos, profile images, questions, and replies — is stored on our servers. <strong>Photos and images you upload are stored in publicly accessible storage,</strong> which means anyone with the image's link can view it. Do not upload images that contain sensitive personal information.</p>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <p>• Provide, maintain, and improve the Outpost service</p>
            <p>• Show you nearby shops and events based on your location</p>
            <p>• Process subscriptions and payments</p>
            <p>• Send you OTP authentication codes via email</p>
            <p>• Respond to your comments and questions</p>
            <p>• Monitor and analyze usage patterns to improve the app</p>
            <p>• Detect and prevent fraudulent or abusive activity</p>
          </Section>

          <Section title="4. Information Sharing">
            <p>We do not sell, trade, or rent your personal information to third parties.</p>
            <p>We may share your information with:</p>
            <p>• <strong>Supabase:</strong> Our database and authentication provider</p>
            <p>• <strong>Stripe:</strong> Our payment processor</p>
            <p>• <strong>Vercel:</strong> Our hosting provider</p>
            <p>• <strong>Law enforcement:</strong> When required by law or to protect our rights</p>
            <p>Public information such as trade posts, marketplace listings, uploaded photos, usernames, and the approximate location attached to your posts is visible to other users of the app.</p>
          </Section>

          <Section title="5. Data Security">
            <p>We implement industry-standard security measures to protect your information. All data is encrypted in transit using HTTPS. Authentication is handled via one-time passwords (OTP) — we never store passwords.</p>
            <p>However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.</p>
          </Section>

          <Section title="6. Location Data">
            <p>Location access is optional. If you grant permission, we use your device location to show nearby shops, events, and community listings, and to calculate distances.</p>
            <p>When you post a marketplace listing or trade, the location attached to that post is <strong>approximate</strong>: your coordinates are rounded to roughly a neighborhood-sized area before being stored, and other users only ever see an approximate distance (for example, "~3 mi"), never your precise location or address. Shop listings, which represent public businesses, may show a more precise location and distance.</p>
            <p>We do not track your location in the background or share it with third parties for advertising. You can revoke location permission at any time in your device settings; you can still use the app, and you can browse listings from anywhere instead of by distance.</p>
          </Section>

          <Section title="7. Cookies and Local Storage">
            <p>Outpost does not use advertising cookies or third-party tracking or analytics cookies. We do not track you across other websites.</p>
            <p>We use first-party browser storage (local storage) only for essential functions: keeping you signed in to your account and remembering that you've completed the welcome screens. This information stays on your device and is not used to profile you or sold to anyone. Clearing your browser storage will sign you out and reset these preferences.</p>
            <p>Some of our service providers (such as Stripe for payments) may set their own cookies when you interact with their checkout. Their use of cookies is governed by their own privacy policies.</p>
          </Section>

          <Section title="8. Data Retention">
            <p>We retain your account data for as long as your account is active. If you delete your account, we will delete your personal data within 30 days, except where required by law.</p>
            <p>Public content (trade posts, listings, questions, and replies) may remain visible until removed by you or an administrator.</p>
          </Section>

          <Section title="9. Your Rights">
            <p>You have the right to:</p>
            <p>• Access the personal information we hold about you</p>
            <p>• Request correction of inaccurate data</p>
            <p>• Request deletion of your account and data</p>
            <p>• Opt out of any marketing communications</p>
            <p>To exercise these rights, contact us at {EMAIL}</p>
          </Section>

          <Section title="10. Children's Privacy">
            <p>Outpost is not directed to children under 13. We do not knowingly collect personal information from children under 13. If we learn we have collected information from a child under 13, we will delete it promptly.</p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.</p>
          </Section>

          <Section title="12. Contact Us">
            <p>If you have questions about this Privacy Policy, please contact us at:</p>
            <p><strong>Email:</strong> {EMAIL}</p>
            <p><strong>Website:</strong> {WEBSITE}</p>
          </Section>
        </div>
      </main>
    </div>
  )
}

export function TermsOfService() {
  return (
    <div className="min-h-screen font-sans text-[#F5F5F4]" style={{ background: '#0A0B0C' }}>
      <header className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <a href="/" className="h-8 w-8 rounded-xl bg-zinc-100 flex items-center justify-center">
            <ArrowLeft className="h-4 w-4 text-zinc-600" />
          </a>
          <h1 className="font-black text-base">Terms of Service</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-zinc-50 rounded-3xl p-6 shadow-sm border border-zinc-100">
          <p className="text-xs text-zinc-400 font-mono mb-8">Last updated: {LAST_UPDATED}</p>

          <Section title="1. Acceptance of Terms">
            <p>By accessing or using Outpost ({WEBSITE}), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>Outpost is a directory and community platform for collectibles enthusiasts. We help users discover local comic shops, trading card stores, and collectibles dealers, and we provide tools for buying, selling, and trading collectibles and connecting with other collectors.</p>
          </Section>

          <Section title="3. User Accounts">
            <p>You must provide a valid email address to create an account. You are responsible for maintaining the security of your account and all activities that occur under it.</p>
            <p>You may not use another person's account or create accounts for the purpose of abuse, spam, or fraud.</p>
            <p>We reserve the right to terminate accounts that violate these terms.</p>
          </Section>

          <Section title="4. User Content">
            <p>You retain ownership of content you post (trade listings, marketplace items, photos, questions, and replies). By posting content, you grant Outpost a non-exclusive, worldwide, royalty-free license to host, store, display, and distribute that content within the app for the purpose of operating the service. Photos you upload are stored in publicly accessible storage and may be viewed by anyone with the link.</p>
            <p>You are solely responsible for the content you post, and you represent that you own it or have the right to share it.</p>
            <p>You agree not to post content that is:</p>
            <p>• False, misleading, or fraudulent</p>
            <p>• Offensive, harassing, or abusive</p>
            <p>• Infringing on intellectual property rights</p>
            <p>• Spam or unsolicited commercial content</p>
            <p>We reserve the right to remove any content that violates these terms.</p>
          </Section>

          <Section title="5. Marketplace and Trades">
            <p>Outpost provides a platform for users to list items for sale and post trade offers and to connect with one another. <strong>Outpost does not process payments, handle shipping, or take part in any transaction between users.</strong> We are not a party to, and take no commission on, any sale or trade. All arrangements — including payment, exchange, and delivery or meetup — are made directly between users.</p>
            <p>We do not verify users, listings, or items, and we do not guarantee the accuracy of listings, the condition or authenticity of items, or that any transaction will be completed. You transact at your own risk.</p>
            <p><strong>Meeting safety:</strong> If you arrange to meet another user in person, you do so at your own risk. We strongly recommend meeting in a safe, public place, and we are not responsible for any interactions, transactions, injuries, losses, or disputes that arise between users.</p>
          </Section>

          <Section title="6. Shop Listings">
            <p>Shop information is sourced from third-party data providers and user submissions. We do not guarantee the accuracy, completeness, or currency of shop information including hours, phone numbers, or addresses.</p>
            <p>Shop owners may request to claim their listing by submitting business details, including an EIN. Claims are reviewed by our team before approval, but this review is not a guarantee of identity or ownership — we do not independently verify EINs or business registration, and approval does not constitute an endorsement. We may approve, decline, or revoke any claim at our discretion. Once approved, shop owners are responsible for keeping their information accurate.</p>
          </Section>

          <Section title="7. Subscriptions and Payments">
            <p>Outpost offers free and paid subscription tiers. Paid subscriptions are billed monthly through Stripe.</p>
            <p>All plans are free for the first 6 months from account creation. After the free period, continued access to premium features requires a paid subscription.</p>
            <p>Subscriptions automatically renew unless cancelled before the renewal date. Refunds are handled at our discretion.</p>
          </Section>

          <Section title="8. Prohibited Uses">
            <p>You may not use Outpost to:</p>
            <p>• Scrape, harvest, or collect data from the platform</p>
            <p>• Interfere with or disrupt the service</p>
            <p>• Attempt to gain unauthorized access to any part of the service</p>
            <p>• Use the service for any illegal purpose</p>
            <p>• Impersonate any person or entity</p>
            <p>• Misrepresent items or post fraudulent listings</p>
          </Section>

          <Section title="9. Disclaimer of Warranties">
            <p>Outpost is provided "as is" without warranties of any kind. We do not warrant that the service will be uninterrupted, error-free, or free of viruses or other harmful components.</p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>To the maximum extent permitted by law, Outpost shall not be liable for any indirect, incidental, special, or consequential damages resulting from your use of the service.</p>
            <p>Our total liability to you for any claim shall not exceed the amount you paid us in the 12 months preceding the claim.</p>
          </Section>

          <Section title="11. Changes to Terms">
            <p>We may update these Terms of Service at any time. Continued use of the service after changes constitutes acceptance of the new terms. We will notify users of significant changes via email.</p>
          </Section>

          <Section title="12. Governing Law">
            <p>These terms are governed by the laws of the State of Colorado, without regard to conflict of law provisions.</p>
          </Section>

          <Section title="13. Contact Us">
            <p>For questions about these Terms of Service, contact us at:</p>
            <p><strong>Email:</strong> {EMAIL}</p>
            <p><strong>Website:</strong> {WEBSITE}</p>
          </Section>
        </div>
      </main>
    </div>
  )
}