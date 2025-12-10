import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { SignUpForm } from '../components/auth/SignUpForm'
import { useAuthStore } from '../stores/authStore'

export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [signUpOpen, setSignUpOpen] = useState(false)

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate])

  const closeModal = () => setSignUpOpen(false)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link to="/" className="text-xl font-semibold tracking-tight">
          SoMePilot
        </Link>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-900 bg-white rounded-md shadow hover:bg-slate-100 transition"
          >
            {t('home.nav.login', 'Log ind')}
          </Link>
        </div>
      </header>

      <main className="px-6 sm:px-10">
        <section className="max-w-4xl py-16 sm:py-24">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {t('home.heroBadge', 'Alt-i-en social media platform')}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-white">
            {t('home.heroTitle', 'Planlæg, skriv og udgiv indhold — hurtigere end nogensinde før')}
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-200 max-w-3xl">
            {t(
              'home.heroSubtitle',
              'AI-drevet social media planlægning, design og publicering samlet ét sted. Få flere kunder, brug mindre tid.'
            )}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => setSignUpOpen(true)}
              className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold rounded-md bg-emerald-400 text-slate-900 shadow-lg shadow-emerald-500/25 hover:bg-emerald-300 transition"
              type="button"
            >
              {t('home.callToAction', 'Opret gratis konto')}
            </button>
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold rounded-md border border-white/30 text-white hover:bg-white/10 transition"
            >
              {t('home.secondaryAction', 'Log ind på din konto')}
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            {t('home.noCreditCard', 'Ingen kreditkort nødvendig — kom i gang på få minutter')}
          </p>
        </section>

        <section className="py-12 border-t border-white/10">
          <h2 className="text-xl font-semibold text-white mb-6">
            {t('home.featuresTitle', 'Hvorfor marketingteams vælger SoMePilot')}
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="bg-white/10 rounded-lg p-6 shadow-lg shadow-slate-900/40">
              <h3 className="text-lg font-semibold text-white">
                {t('home.features.automation.title', 'Automatisér planlægningen')}
              </h3>
              <p className="mt-3 text-sm text-slate-200">
                {t('home.features.automation.description', 'Planlæg kampagner på tværs af kanaler med få klik og bevar fuldt overblik.')}
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-6 shadow-lg shadow-slate-900/40">
              <h3 className="text-lg font-semibold text-white">
                {t('home.features.ai.title', 'AI der forstår din virksomhed')}
              </h3>
              <p className="mt-3 text-sm text-slate-200">
                {t('home.features.ai.description', 'Få indholdsforslag, tekster og billeder baseret på dine målgrupper og mål.')}
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-6 shadow-lg shadow-slate-900/40">
              <h3 className="text-lg font-semibold text-white">
                {t('home.features.collaboration.title', 'Byg stærkere samarbejde')}
              </h3>
              <p className="mt-3 text-sm text-slate-200">
                {t('home.features.collaboration.description', 'Invitér teamet, godkend indhold og følg performance i realtid.')}
              </p>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-8 sm:p-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div>
                <h3 className="text-2xl font-semibold text-white">
                  {t('home.ctaSection.title', 'Klar til at få styr på jeres sociale medier?')}
                </h3>
                <p className="mt-3 text-sm text-slate-300 max-w-xl">
                  {t('home.ctaSection.subtitle', 'Opret en gratis konto på få minutter og se hvordan SoMePilot kan skaleres med dine behov.')}
                </p>
              </div>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold rounded-md bg-emerald-400 text-slate-900 shadow-lg shadow-emerald-500/25 hover:bg-emerald-300 transition"
              >
                {t('home.callToAction', 'Opret gratis konto')}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-6 sm:px-10 py-8 border-t border-white/10 text-sm text-slate-400">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p>© {new Date().getFullYear()} SoMePilot</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-white transition">
              {t('home.footer.privacy', 'Privatlivspolitik')}
            </Link>
            <Link to="/terms" className="hover:text-white transition">
              {t('home.footer.terms', 'Vilkår & betingelser')}
            </Link>
            <Link to="/login" className="hover:text-white transition">
              {t('home.footer.login', 'Log ind')}
            </Link>
          </div>
        </div>
      </footer>

      {signUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <div
            className="absolute inset-0 bg-slate-900/80"
            aria-hidden="true"
            onClick={closeModal}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl shadow-black/40">
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              aria-label={t('common.close', 'Close')}
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <SignUpForm redirectOnSuccess={false} onClose={closeModal} />
          </div>
        </div>
      )}
    </div>
  )
}

export default HomePage