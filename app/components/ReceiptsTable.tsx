"use client";
import { useEffect, useState } from "react";
// import { fetchReceipts } from '@/lib/webapi';

type ModalProps = {
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
};

function Modal({ open, onClose, children }: ModalProps) {
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
			<div className="bg-white rounded shadow-lg p-4 max-w-lg w-full relative">
				<button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-black">&times;</button>
				{children}
			</div>
		</div>
	);
}

type Org = { id: string; name: string };

export default function ReceiptsTable({ organizations }: { organizations: Org[] }) {

	// Default selected org
	const [selectedOrg, setSelectedOrg] = useState(organizations[0]?.id ?? "");
	const [receipts, setReceipts] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);


	const [imageModal, setImageModal] = useState<string | null>(null);
	const [ocrModal, setOcrModal] = useState<string | null>(null);
	const [highlightedRow, setHighlightedRow] = useState<string | null>(null);

	useEffect(() => {
		if (!selectedOrg) return;
		setLoading(true);
		fetch(`/api/receipts?orgId=${selectedOrg}`)
			.then(res => res.json())
			.then(data => {
				if (Array.isArray(data)) {
					setReceipts(data);
				} else {
					setReceipts([]);
				}
			})
			.finally(() => setLoading(false));
	}, [selectedOrg]);

	return (
		<>
			<div>
				<select
					className="border rounded px-2 py-1 mb-2"
					value={selectedOrg}
					onChange={e => setSelectedOrg(e.target.value)}
					disabled={organizations.length <= 1}
				>
					{organizations.map(org => (
						<option key={org.id} value={org.id}>{org.name}</option>
					))}
				</select>
			</div>
			<div className="overflow-x-auto rounded border bg-white">
				<table className="min-w-full text-sm">
					<thead className="bg-slate-50 text-left text-slate-600">
						<tr>
							<th className="px-4 py-2">Voucher</th>
							<th className="px-4 py-2">Fecha de Captura</th>
							<th className="px-4 py-2">Origen</th>
							<th className="px-4 py-2">Importe</th>
							<th className="px-4 py-2">Fecha Operacion</th>
							<th className="px-4 py-2">Nº Operacion</th>
							<th className="px-4 py-2">Usuario</th>
							<th className="px-4 py-2">Texto</th>
						</tr>
					</thead>
					<tbody>
						{receipts.map((r) => {
							const isHighlighted = highlightedRow === r.receiptId;
							return (
								<tr
									key={`${r.userId}:${r.receiptId}`}
									className={`border-t ${isHighlighted ? 'bg-yellow-100' : ''}`}
									onClick={() => setHighlightedRow(r.receiptId)}
									style={{ cursor: 'pointer' }}
								>
									<td className="px-4 py-2">
										{r.blobUrl ? (
											<img
												src={r.blobUrl}
												alt="Receipt"
												className="h-12 w-12 object-cover rounded cursor-pointer hover:opacity-80"
												onClick={() => setImageModal(r.blobUrl ?? null)}
											/>
										) : (
											<span className="text-slate-400">No image</span>
										)}
									</td>
									<td className="px-4 py-2">{new Date(r.createdAt).toLocaleString()}</td>
									<td className="px-4 py-2">{r.transactionSource ?? ''}</td>
									<td className="px-4 py-2">{r.transactionAmount ?? ''}</td>
									<td className="px-4 py-2">{r.transactionDateTimeUtc ? new Date(r.transactionDateTimeUtc).toLocaleString() : ''}</td>
									<td className="px-4 py-2">{r.transactionOperationNumber ?? ''}</td>
									<td className="px-4 py-2 text-slate-500">{r.userName}</td>
									<td className="px-4 py-2">
										<button
											className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
											onClick={() => setOcrModal(r.ocrText ?? 'No OCR text available.')}
										>
											Show OCR
										</button>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{/* Image Modal */}
			<Modal open={!!imageModal} onClose={() => setImageModal(null)}>
				{imageModal && (
					<img src={imageModal ?? undefined} alt="Receipt Full" className="max-w-full max-h-[70vh] mx-auto rounded" />
				)}
			</Modal>

			{/* OCR Modal */}
			<Modal open={!!ocrModal} onClose={() => setOcrModal(null)}>
				<div className="font-semibold mb-2">OCR Text</div>
				<div className="whitespace-pre-wrap text-sm max-h-[60vh] overflow-y-auto">
					{ocrModal}
				</div>
			</Modal>
		</>
	);
}
