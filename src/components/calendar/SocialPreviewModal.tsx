/**
 * SocialPreviewModal
 *
 * Shows a Facebook or Instagram style preview of a post.
 */
import type { PublishedPost } from '../../hooks/usePublishedPosts'

interface SocialPreviewModalProps {
  post: PublishedPost | null
  businessName?: string
  onClose: () => void
}

// ─── Facebook preview ─────────────────────────────────────────────────────────
function FacebookPreview({ post, businessName }: { post: PublishedPost; businessName: string }) {
  const initials = businessName.slice(0, 2).toUpperCase()

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-w-sm w-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <div className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-white">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-tight truncate">{businessName}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[11px] text-slate-500">Lige nu</span>
            <span className="text-slate-300 text-[10px]">·</span>
            <svg className="w-3 h-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd"/>
            </svg>
          </div>
        </div>
        <button className="p-1.5 hover:bg-slate-100 rounded-full transition-colors">
          <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z"/>
          </svg>
        </button>
      </div>

      {/* Post text */}
      {post.postText && (
        <p className="px-4 pb-3 text-[15px] text-slate-800 whitespace-pre-wrap leading-6">
          {post.postText}
        </p>
      )}

      {/* Image */}
      {post.photoUrl && (
        <div className="w-full bg-slate-100 mt-1">
          <img
            src={post.photoUrl}
            alt=""
            className="w-full object-cover max-h-80"
          />
        </div>
      )}

      {/* Engagement bar */}
      <div className="px-4 py-3 border-t border-slate-100">
        <div className="flex items-center gap-1 mb-2">
          <div className="flex">
            <span className="w-4 h-4 rounded-full bg-[#1877F2] flex items-center justify-center text-[8px]">👍</span>
            <span className="w-4 h-4 rounded-full bg-[#F02849] flex items-center justify-center text-[8px] -ml-1">❤️</span>
          </div>
          <span className="text-xs text-slate-500 ml-1">Synes godt om dette</span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-2 gap-1">
          {[
            { icon: '👍', label: 'Synes godt om' },
            { icon: '💬', label: 'Kommenter' },
            { icon: '↗️', label: 'Del' },
          ].map(({ icon, label }) => (
            <button
              key={label}
              className="flex-1 flex items-center justify-center gap-1 py-1 text-xs text-slate-500 font-semibold hover:bg-slate-100 rounded transition-colors"
            >
              <span className="text-sm">{icon}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Instagram preview ────────────────────────────────────────────────────────
function InstagramPreview({ post, businessName }: { post: PublishedPost; businessName: string }) {
  const initials = businessName.slice(0, 2).toUpperCase()
  const handle = businessName.toLowerCase().replace(/\s+/g, '_')

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-w-sm w-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <div className="w-8 h-8 rounded-full ring-2 ring-pink-400 ring-offset-1 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold text-white">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-900 leading-tight truncate">{handle}</p>
          <p className="text-[10px] text-slate-400 leading-tight">Sponsored</p>
        </div>
        <button className="p-1.5 hover:bg-slate-100 rounded-full transition-colors">
          <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z"/>
          </svg>
        </button>
      </div>

      {/* Image — square crop */}
      {post.photoUrl ? (
        <div className="w-full aspect-square bg-slate-100 overflow-hidden">
          <img src={post.photoUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full aspect-square bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
          <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </div>
      )}

      {/* Actions */}
      <div className="px-3.5 pt-2.5 pb-1.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <button className="hover:text-red-500 transition-colors">
              <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>
              </svg>
            </button>
            <button className="hover:text-slate-600 transition-colors">
              <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/>
              </svg>
            </button>
            <button className="hover:text-slate-600 transition-colors">
              <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
              </svg>
            </button>
          </div>
          <button className="hover:text-slate-600 transition-colors">
            <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"/>
            </svg>
          </button>
        </div>

        {/* Text */}
        {post.postText && (
          <div className="mb-2">
            <p className="text-[13px] text-slate-800 leading-5">
              <span className="font-semibold">{handle}</span>{' '}
              <span className="whitespace-pre-wrap line-clamp-3">{post.postText}</span>
            </p>
          </div>
        )}
        <p className="text-[10px] text-slate-400 leading-tight">Lige nu</p>
      </div>
    </div>
  )
}

// ─── Modal shell ──────────────────────────────────────────────────────────────
export function SocialPreviewModal({ post, businessName = 'Din forretning', onClose }: SocialPreviewModalProps) {
  if (!post) return null

  const platform = post.platform.toLowerCase()
  const isFacebook = platform === 'facebook'
  const isInstagram = platform === 'instagram'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 flex flex-col items-center gap-3 max-w-sm w-full"
        onClick={e => e.stopPropagation()}
      >
        {/* Platform label */}
        <div className="flex items-center gap-2">
          {isFacebook && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1877F2] text-white text-xs font-semibold shadow">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </span>
          )}
          {isInstagram && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 text-white text-xs font-semibold shadow">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              Instagram
            </span>
          )}
          {!isFacebook && !isInstagram && (
            <span className="px-3 py-1 rounded-full bg-slate-700 text-white text-xs font-semibold shadow">
              {post.platform}
            </span>
          )}
          <span className="text-xs text-white/80">Forhåndsvisning</span>
        </div>

        {/* Preview card */}
        {isFacebook && <FacebookPreview post={post} businessName={businessName} />}
        {isInstagram && <InstagramPreview post={post} businessName={businessName} />}
        {!isFacebook && !isInstagram && <FacebookPreview post={post} businessName={businessName} />}

        {/* Close button */}
        <button
          onClick={onClose}
          className="px-6 py-2 rounded-full bg-white text-slate-700 text-sm font-semibold shadow hover:bg-slate-100 transition-colors"
        >
          Luk
        </button>
      </div>
    </div>
  )
}
