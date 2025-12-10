import { useTranslation } from 'react-i18next'

export function PlansPage() {
  const { t } = useTranslation()

  const plans = [
    {
      name: 'Free',
      price: t('plans.free.price', '$0'),
      period: t('plans.free.period', 'forever'),
      description: t('plans.free.description', 'Perfect for getting started'),
      features: [
        t('plans.free.features.1', '3 AI-generated post ideas per day'),
        t('plans.free.features.2', 'Basic text improvements'),
        t('plans.free.features.3', 'Manual posting only'),
        t('plans.free.features.4', 'Community support')
      ],
      buttonText: t('plans.free.button', 'Current Plan'),
      buttonStyle: 'bg-slate-100 text-slate-700 cursor-default',
      popular: false
    },
    {
      name: 'Smart',
      price: t('plans.standardPlus.price', '$9.99'),
      period: t('plans.standardPlus.period', 'per month'),
      description: t('plans.standardPlus.description', 'For growing businesses'),
      features: [
        t('plans.standardPlus.features.1', 'Unlimited AI-generated ideas'),
        t('plans.standardPlus.features.2', 'Advanced AI text enhancement'),
        t('plans.standardPlus.features.3', 'Tone and length customization'),
        t('plans.standardPlus.features.4', 'Scheduled posting'),
        t('plans.standardPlus.features.5', 'Priority support')
      ],
      buttonText: t('plans.standardPlus.button', 'Upgrade'),
      buttonStyle: 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700',
      popular: true
    },
    {
      name: 'Pro',
      price: t('plans.premium.price', '$19.99'),
      period: t('plans.premium.period', 'per month'),
      description: t('plans.premium.description', 'For professional marketers'),
      features: [
        t('plans.premium.features.1', 'Everything in Smart'),
        t('plans.premium.features.2', 'Team collaboration tools'),
        t('plans.premium.features.3', 'Advanced analytics'),
        t('plans.premium.features.4', 'Custom AI training'),
        t('plans.premium.features.5', 'White-label options'),
        t('plans.premium.features.6', 'Dedicated account manager')
      ],
      buttonText: t('plans.premium.button', 'Go Pro'),
      buttonStyle: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700',
      popular: false
    }
  ]

  return (
    <div className="p-6">
      <div className="text-center mb-8">
        <h1 className="text-xl font-bold text-gray-900 mb-4">
          {t('plans.title', 'Choose Your Plan')}
        </h1>
        <p className="text-sm text-gray-600">
          {t('plans.subtitle', 'Select the perfect plan for your social media needs')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative bg-white rounded-xl shadow-lg border-2 ${
              plan.popular ? 'border-indigo-500' : 'border-gray-200'
            } p-6 ${plan.popular ? 'transform scale-105' : ''}`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                  {t('plans.popular', 'Most Popular')}
                </span>
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{plan.name}</h3>
              <div className="flex items-baseline justify-center mb-2">
                <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-gray-600 ml-1">/{plan.period}</span>
              </div>
              <p className="text-gray-600">{plan.description}</p>
            </div>

            <ul className="space-y-3 mb-8">
              {plan.features.map((feature, featureIndex) => (
                <li key={featureIndex} className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${plan.buttonStyle}`}
              disabled={plan.name === 'Free'}
            >
              {plan.buttonText}
            </button>
          </div>
        ))}
      </div>

      <div className="text-center mt-12">
        <p className="text-gray-600 mb-4">
          {t('plans.questions', 'Have questions about our plans?')}
        </p>
        <button className="text-indigo-600 hover:text-indigo-800 font-medium">
          {t('plans.contact', 'Contact our sales team')}
        </button>
      </div>
    </div>
  )
}