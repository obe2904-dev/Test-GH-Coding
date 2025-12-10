export function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center animate-fade-in">
        <div className="w-16 h-16 border-4 border-[#0F2E32] border-t-[#88F2D7] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-700 font-medium">Loading...</p>
      </div>
    </div>
  )
}
