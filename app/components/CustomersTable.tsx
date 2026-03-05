"use client";
import { CustomerList } from "@/lib/api-types";

export default function CustomersTable({ customers }: CustomerList) {
	return (
		<>
			<div className="overflow-x-auto rounded border bg-white">
				<table className="min-w-full text-sm border">
					<thead className="bg-slate-50 text-left text-slate-600">
						<tr>
							<th className="px-2 py-1 border">Customer ID</th>
							<th className="px-2 py-1 border">Nombre</th>
							<th className="px-2 py-1 border">Usuarios Máximos</th>
							<th className="px-2 py-1 border">Imágenes Máximas/Mes</th>
							<th className="px-2 py-1 border"></th>
						</tr>
					</thead>
					<tbody>
						{customers.map((customer) => (
							<tr key={customer.customerId} className="border-t">
								<td className="px-2 py-1 border">{customer.customerId}</td>
								<td className="px-2 py-1 border">{customer.customerName}</td>
								<td className="px-2 py-1 border">{customer.maxUsersAllowed ?? <span className='text-slate-400'>Not set</span>}</td>
								<td className="px-2 py-1 border">{customer.maxImagesPerMonth ?? <span className='text-slate-400'>Not set</span>}</td>
								<td className="px-2 py-1 border">
									<button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded">Editar</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}
