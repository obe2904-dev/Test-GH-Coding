import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';
import { TierBadge } from '@/components/tier/TierBadge';
import { Link } from 'react-router-dom';

export function SmartDashboard() {
  const { t } = useTranslation('tier');
  const { business } = useAuthStore();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header with tier badge */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-lg text-gray-600">{t('tier.smart.tagline')}</p>
        </div>
        <TierBadge tier="smart" />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Aktive Mål</div>
          <div className="text-3xl font-bold text-gray-900">3</div>
          <Link to="/dashboard/smart/goals" className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block">
            Se mål →
          </Link>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Profil Komplet</div>
          <div className="text-3xl font-bold text-gray-900">85%</div>
          <div className="text-sm text-gray-500 mt-2">Næsten klar!</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">AI-Status</div>
          <div className="text-3xl font-bold text-green-600">✓</div>
          <div className="text-sm text-gray-500 mt-2">Aktiv og klar</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Hurtige handlinger</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/dashboard/smart/goals"
            className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <div className="text-3xl">🎯</div>
            <div>
              <div className="font-semibold text-gray-900">Se dine mål</div>
              <div className="text-sm text-gray-600">Følg fremgang på top 3 mål</div>
            </div>
          </Link>

          <Link
            to="/dashboard/smart/brand-profile"
            className="flex items-center gap-4 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <div className="text-3xl">✨</div>
            <div>
              <div className="font-semibold text-gray-900">Din brandprofil</div>
              <div className="text-sm text-gray-600">Se AI-genereret identitet</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Upgrade CTA */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Klar til mere kontrol?
            </h3>
            <p className="text-gray-600 mb-4">
              Opgrader til Pro og få fuld adgang til redigering, ubegrænsede mål, og avanceret analyse.
            </p>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <span className="text-purple-600">✓</span>
                <span>Rediger alle AI-genererede data</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-600">✓</span>
                <span>Ubegrænsede forretningsmål</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-600">✓</span>
                <span>Avanceret performance-analyse</span>
              </li>
            </ul>
          </div>
          <button className="px-8 py-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-lg whitespace-nowrap">
            Opgrader til Pro
          </button>
        </div>
      </div>
    </div>
  );
}
