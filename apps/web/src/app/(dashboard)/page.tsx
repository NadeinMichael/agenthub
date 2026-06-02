export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-600">Manage your agents from here.</p>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {['Active Agents', 'Total Runs', 'Success Rate'].map((stat) => (
          <div key={stat} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">{stat}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">—</p>
          </div>
        ))}
      </div>
    </div>
  );
}
