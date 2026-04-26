"use client";
type Organization = {
	id: string;
	name: string;
	code: string;
	ruc: string | null;
	is_active: boolean;
	created_at?: string;
};

export default function CustomersTable({
	organizations,
	canManage,
	onToggleStatus,
}: {
	organizations: Organization[];
	canManage: boolean;
	onToggleStatus: (org: Organization, nextActive: boolean) => void;
}) {
	return (
		<>
			<div className="overflow-x-auto rounded border bg-white dark:bg-[#18191A]">
				<table className="min-w-full text-sm border">
					<thead className="bg-slate-50 text-left text-slate-600">
						<tr>
							<th className="px-2 py-1 border">ID</th>
							<th className="px-2 py-1 border">Codigo</th>
							<th className="px-2 py-1 border">Nombre</th>
							<th className="px-2 py-1 border">RUC</th>
							<th className="px-2 py-1 border">Estado</th>
							<th className="px-2 py-1 border">Accion</th>
						</tr>
					</thead>
					<tbody>
						{organizations.map((organization) => (
							<tr key={organization.id} className="border-t">
								<td className="px-2 py-1 border">{organization.id}</td>
								<td className="px-2 py-1 border">{organization.code ?? <span className='text-slate-400'>Not set</span>}</td>
								<td className="px-2 py-1 border">{organization.name}</td>
								<td className="px-2 py-1 border">{organization.ruc ?? <span className='text-slate-400'>Not set</span>}</td>
								<td className="px-2 py-1 border">
									{organization.is_active ? (
										<span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Activo</span>
									) : (
										<span className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">Inactivo</span>
									)}
								</td>
								<td className="px-2 py-1 border">
									{canManage ? (
										<button
											type="button"
											onClick={() => onToggleStatus(organization, !organization.is_active)}
											className={`${organization.is_active ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-bold py-1 px-2 rounded`}
										>
											{organization.is_active ? 'Inactivar' : 'Activar'}
										</button>
									) : (
										<span className="text-slate-400">-</span>
									)}
								</td>
							</tr>
						))}
						{organizations.length === 0 && (
							<tr>
								<td className="px-2 py-3 text-center text-slate-500" colSpan={6}>No hay organizaciones.</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</>
	);
}
