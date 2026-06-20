import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'

interface UserRole {
  businessName: string
  role: 'owner' | 'admin' | 'member'
  isOwner: boolean
}

const UserIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

const MailIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
)

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
)

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

export function MyProfilePage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [showNameEdit, setShowNameEdit] = useState(false)
  const [nameForm, setNameForm] = useState(user?.user_metadata?.fullName || '')
  const [nameMessage, setNameMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [loadingRoles, setLoadingRoles] = useState(true)

  useEffect(() => {
    const fetchUserRoles = async () => {
      if (!user?.id) return

      try {
        // Get businesses where user is the owner
        const { data: ownedBusinesses } = await supabase
          .from('businesses')
          .select('id, name')
          .eq('owner_id', user.id)

        // Team member feature not implemented (business_team_members table does not exist)
        const teamMemberships: any[] = []
        /*
        const { data: teamMemberships } = await supabase
          .from('business_team_members')
          .select('business_id, role, businesses(name)')
          .eq('user_id', user.id)
          .not('accepted_at', 'is', null)
        */

        const roles: UserRole[] = []

        // Add owned businesses
        if (ownedBusinesses) {
          ownedBusinesses.forEach(business => {
            roles.push({
              businessName: business.name || 'Unnamed Business',
              role: 'owner',
              isOwner: true
            })
          })
        }

        // Add team memberships (feature not implemented yet)
        if (teamMemberships && Array.isArray(teamMemberships)) {
          teamMemberships.forEach((membership: any) => {
            if (membership.businesses) {
              roles.push({
                businessName: membership.businesses.name || 'Unnamed Business',
                role: membership.role,
                isOwner: false
              })
            }
          })
        }

        setUserRoles(roles)
      } catch (error) {
        console.error('Error fetching user roles:', error)
      } finally {
        setLoadingRoles(false)
      }
    }

    fetchUserRoles()
  }, [user?.id])

  const handleNameUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setNameMessage(null)

    if (!nameForm.trim()) {
      setNameMessage({ type: 'error', text: t('myProfile.nameCannotBeEmpty') })
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          fullName: nameForm.trim()
        }
      })

      if (error) throw error

      setNameMessage({ type: 'success', text: t('myProfile.nameUpdated') })
      setTimeout(() => {
        setShowNameEdit(false)
        setNameMessage(null)
      }, 2000)
    } catch (error) {
      setNameMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : t('myProfile.failedToUpdateName')
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMessage(null)

    if (passwordForm.newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: t('myProfile.password.passwordMinLength') })
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: t('myProfile.password.passwordsDoNotMatch') })
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      })

      if (error) throw error

      setPasswordMessage({ type: 'success', text: t('myProfile.password.passwordUpdated') })
      setPasswordForm({ newPassword: '', confirmPassword: '' })
      setTimeout(() => {
        setShowPasswordChange(false)
        setPasswordMessage(null)
      }, 2000)
    } catch (error) {
      setPasswordMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : t('myProfile.password.failedToUpdatePassword')
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getProviderName = () => {
    const provider = user?.app_metadata?.provider
    if (provider === 'google') return 'Google'
    if (provider === 'azure') return 'Microsoft'
    return 'Email'
  }

  const isOAuthUser = user?.app_metadata?.provider && user.app_metadata.provider !== 'email'

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'admin':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'member':
        return 'bg-slate-100 text-slate-700 border-slate-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return t('myProfile.roles.owner')
      case 'admin':
        return t('myProfile.roles.admin')
      case 'member':
        return t('myProfile.roles.member')
      default:
        return role
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t('myProfile.title')}</h1>
        <p className="text-sm text-slate-600 mt-1">{t('myProfile.subtitle')}</p>
      </div>

      <div className="space-y-6">
        {/* Account Information */}
        <div className="bg-white rounded-lg shadow border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <UserIcon className="w-5 h-5" />
              {t('myProfile.accountInfo')}
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {/* Name */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <UserIcon className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-700">{t('myProfile.fullName')}</label>
                {!showNameEdit ? (
                  <div className="mt-1 flex items-center gap-3">
                    <div className="text-base text-slate-900">
                      {user?.user_metadata?.fullName || t('myProfile.notSet')}
                    </div>
                    <button
                      onClick={() => {
                        setShowNameEdit(true)
                        setNameForm(user?.user_metadata?.fullName || '')
                      }}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      {t('myProfile.edit')}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleNameUpdate} className="mt-2 space-y-3">
                    <input
                      type="text"
                      value={nameForm}
                      onChange={(e) => setNameForm(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder={t('myProfile.enterFullName')}
                      required
                    />
                    {nameMessage && (
                      <div className={`p-2 rounded-lg text-sm ${
                        nameMessage.type === 'success' 
                          ? 'bg-green-50 text-green-800 border border-green-200' 
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}>
                        {nameMessage.text}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-3 py-1.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        {isSubmitting ? t('myProfile.saving') : t('myProfile.save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNameEdit(false)
                          setNameMessage(null)
                        }}
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        {t('myProfile.cancel')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <MailIcon className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-700">{t('myProfile.emailAddress')}</label>
                <div className="mt-1 text-base text-slate-900">{user?.email}</div>
                {user?.email_confirmed_at && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600">
                    <CheckIcon className="w-4 h-4" />
                    <span>{t('myProfile.verified')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Account Provider */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <ShieldIcon className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-700">{t('myProfile.signInMethod')}</label>
                <div className="mt-1 text-base text-slate-900">{getProviderName()}</div>
              </div>
            </div>

            {/* User ID (for reference) */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <ShieldIcon className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-700">{t('myProfile.userId')}</label>
                <div className="mt-1 text-xs text-slate-600 font-mono">{user?.id}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Business Roles & Permissions */}
        <div className="bg-white rounded-lg shadow border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <ShieldIcon className="w-5 h-5" />
              {t('myProfile.roles.title')}
            </h2>
          </div>
          <div className="p-6">
            {loadingRoles ? (
              <div className="text-sm text-slate-600">{t('myProfile.roles.loading')}</div>
            ) : userRoles.length === 0 ? (
              <div className="text-sm text-slate-600">{t('myProfile.roles.noAssociations')}</div>
            ) : (
              <div className="space-y-3">
                {userRoles.map((userRole, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-800">{userRole.businessName}</div>
                    </div>
                    <div>
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getRoleBadgeColor(userRole.role)}`}>
                        {getRoleLabel(userRole.role)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                {t('myProfile.roles.explanation')}
              </p>
            </div>
          </div>
        </div>

        {/* Password Management */}
        {!isOAuthUser && (
          <div className="bg-white rounded-lg shadow border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <LockIcon className="w-5 h-5" />
                {t('myProfile.password.title')}
              </h2>
            </div>
            <div className="p-6">
              {!showPasswordChange ? (
                <div>
                  <p className="text-sm text-slate-600 mb-4">
                    {t('myProfile.password.description')}
                  </p>
                  <button
                    onClick={() => setShowPasswordChange(true)}
                    className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    {t('myProfile.password.changePassword')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-1">
                      {t('myProfile.password.newPassword')}
                    </label>
                    <input
                      id="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder={t('myProfile.password.newPasswordPlaceholder')}
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
                      {t('myProfile.password.confirmPassword')}
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder={t('myProfile.password.confirmPasswordPlaceholder')}
                      required
                      minLength={6}
                    />
                  </div>
                  
                  {passwordMessage && (
                    <div className={`p-3 rounded-lg text-sm ${
                      passwordMessage.type === 'success' 
                        ? 'bg-green-50 text-green-800 border border-green-200' 
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      {passwordMessage.text}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? t('myProfile.password.updating') : t('myProfile.password.updatePassword')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordChange(false)
                        setPasswordForm({ newPassword: '', confirmPassword: '' })
                        setPasswordMessage(null)
                      }}
                      className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      {t('myProfile.cancel')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {isOAuthUser && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              {t('myProfile.password.oauthMessage', { provider: getProviderName() })}
            </p>
          </div>
        )}

        {/* Account Created Date */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="text-sm text-slate-600">
            <span className="font-medium">{t('myProfile.memberSince')}</span>{' '}
            {user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }) : 'Unknown'}
          </div>
        </div>
      </div>
    </div>
  )
}