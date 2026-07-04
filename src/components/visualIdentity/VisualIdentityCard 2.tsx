// DISABLED: visual_identity table does not exist
// Feature not implemented
export function VisualIdentityCard({ businessId: _businessId }: { businessId: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <p className="text-gray-500">Visual identity feature not available</p>
    </div>
  );
}
