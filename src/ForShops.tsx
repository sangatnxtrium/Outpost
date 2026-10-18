import { ArrowLeft, Check } from 'lucide-react'
import { FOR_SHOPS as C, FOR_SHOPS_CONTACT_EMAIL as EMAIL, FOR_SHOPS_META } from '../shared/forShops'

export default function ForShops() {
  if (typeof document !== 'undefined') document.title = FOR_SHOPS_META.title
  return (
    <div className="min-h-screen font-sans text-[#F5F5F4]" style={{ background: '#0A1A2B' }}>
      <header className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <a href="/" aria-label="Back to Outpost" className="h-8 w-8 rounded-xl bg-zinc-100 flex items-center justify-center">
            <ArrowLeft className="h-4 w-4 text-zinc-600" />
          </a>
          <h1 className="font-black text-base">{C.heading}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <p className="text-sm text-zinc-400 leading-relaxed">{C.intro}</p>

        <section className="rounded-3xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}>
          <p className="text-xs font-black uppercase text-white/60">Limited · 1,000 spots</p>
          <h2 className="font-black text-lg mt-1">{C.founding.title}</h2>
          <p className="text-sm text-white/80 mt-1">{C.founding.body}</p>
        </section>

        <section className="bg-zinc-50 rounded-3xl p-5 border border-zinc-100">
          <h2 className="font-black text-lg mb-3 text-zinc-900">Why claim your shop</h2>
          <ul className="space-y-3">
            {C.benefits.map(b => (
              <li key={b.title} className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#EF3E36' }} />
                <p className="text-sm text-zinc-600"><span className="font-bold text-zinc-900">{b.title}.</span> {b.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-zinc-50 rounded-3xl p-5 border border-zinc-100">
          <h2 className="font-black text-lg mb-3 text-zinc-900">How claiming works</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-zinc-600">
            {C.steps.map(s => <li key={s}>{s}</li>)}
          </ol>
          <p className="text-xs mt-4 p-3 rounded-2xl" style={{ color: '#FCD34D', background: 'rgba(245,158,11,0.08)' }}>{C.einNote}</p>
        </section>

        <a href="/" className="block w-full text-center py-4 rounded-2xl text-sm font-black uppercase text-white" style={{ background: '#7C3AED' }}>
          Find and claim your shop →
        </a>
        <p className="text-center text-xs text-zinc-400">
          Questions? <a href={`mailto:${EMAIL}`} className="underline" style={{ color: '#EF3E36' }}>{EMAIL}</a>
        </p>
      </main>
    </div>
  )
}
