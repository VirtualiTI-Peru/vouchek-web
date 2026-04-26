"use client";
import { useEffect, useRef, useState } from "react";
import type { ReceiptPage } from "@/lib/api-types";

type ModalProps = {
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
};

type Org = { id: string; name: string };

type LoadReceiptsOptions = {
	forceRefresh?: boolean;
};

const DEFAULT_PAGE_SIZE = Number(process.env.NEXT_PUBLIC_RECEIPTS_PAGE_SIZE) || 50;
const INVALIDATION_POLL_MS = 15_000;

console.log('ReceiptsTable - NEXT_PUBLIC_RECEIPTS_PAGE_SIZE:', process.env.NEXT_PUBLIC_RECEIPTS_PAGE_SIZE, 'DEFAULT_PAGE_SIZE:', DEFAULT_PAGE_SIZE);

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

function buildEmptyPage(customerId: string, page: number): ReceiptPage {
	return {
		customerId,
		page,
		pageSize: DEFAULT_PAGE_SIZE,
		hasMore: false,
		lastUpdatedAt: null,
		receipts: [],
		totalCount: 0,
	};
}

function buildCacheKey(customerId: string, page: number): string {
	return `${customerId}:${page}`;
}

function formatLastUpdated(lastUpdatedAt: string | null): string {
	if (!lastUpdatedAt) {
		return "Sin datos de actualizacion";
	}

	return new Date(lastUpdatedAt).toLocaleString();
}

export default function ReceiptsTable({
	organizations,
	initialReceiptsPage,
	showOrganizationSelector = true,
}: {
	organizations: Org[];
	initialReceiptsPage: ReceiptPage;
	showOrganizationSelector?: boolean;
}) {
	const initialOrgId = organizations[0]?.id ?? "";
	const [selectedOrg, setSelectedOrg] = useState(initialOrgId);
	const [currentPage, setCurrentPage] = useState(initialReceiptsPage.page || 1);
	const [receiptPage, setReceiptPage] = useState<ReceiptPage>(initialReceiptsPage);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
	const [imageModal, setImageModal] = useState<string | null>(null);
	const [ocrModal, setOcrModal] = useState<string | null>(null);
	const [highlightedRow, setHighlightedRow] = useState<string | null>(null);
	const pageCacheRef = useRef<Record<string, ReceiptPage>>(
		initialOrgId ? { [buildCacheKey(initialOrgId, initialReceiptsPage.page || 1)]: initialReceiptsPage } : {}
	);
	const lastKnownUpdateRef = useRef<Record<string, string | null>>(
		initialOrgId ? { [initialOrgId]: initialReceiptsPage.lastUpdatedAt ?? null } : {}
	);
	const currentPageRef = useRef(currentPage);
	const activeRequestKeyRef = useRef<string | null>(null);

	useEffect(() => {
		currentPageRef.current = currentPage;
	}, [currentPage]);

	function clearOrgCache(orgId: string) {
		Object.keys(pageCacheRef.current).forEach((cacheKey) => {
			if (cacheKey.startsWith(`${orgId}:`)) {
				delete pageCacheRef.current[cacheKey];
			}
		});
	}

	async function loadReceiptsPage(orgId: string, page: number, options: LoadReceiptsOptions = {}) {
		if (!orgId) {
			setReceiptPage(buildEmptyPage("", 1));
			return;
		}
	function formatCurrencyPen(amount?: number | null): string {
		if (typeof amount !== "number" || Number.isNaN(amount)) {
			return "";
		}

		return new Intl.NumberFormat("es-PE", {
			style: "currency",
			currency: "PEN",
		}).format(amount);
	}

		const cacheKey = buildCacheKey(orgId, page);
		const cachedPage = pageCacheRef.current[cacheKey];
		if (!options.forceRefresh && cachedPage) {
			setReceiptPage(cachedPage);
			setError(null);
			lastKnownUpdateRef.current[orgId] = cachedPage.lastUpdatedAt ?? null;
			return;
		}

		const requestKey = `${cacheKey}:${options.forceRefresh ? "refresh" : "load"}:${Date.now()}`;
		activeRequestKeyRef.current = requestKey;
		setLoading(true);
		setError(null);

		try {
			const searchParams = new URLSearchParams({
				orgId,
				page: String(page),
				pageSize: String(DEFAULT_PAGE_SIZE),
			});

			if (options.forceRefresh) {
				searchParams.set("refresh", "1");
			}

			const response = await fetch(`/api/receipts?${searchParams.toString()}`, {
				cache: "no-store",
			});
			const data = await response.json().catch(() => null);

			if (!response.ok) {
				throw new Error(data?.error ?? "No se pudo cargar vouchers.");
			}

			const nextPage = {
				customerId: String(data?.customerId ?? orgId),
				page: Number(data?.page ?? page),
				pageSize: Number(data?.pageSize ?? DEFAULT_PAGE_SIZE),
				hasMore: Boolean(data?.hasMore),
				lastUpdatedAt: data?.lastUpdatedAt ?? null,
				receipts: Array.isArray(data?.receipts) ? data.receipts : [],
				totalCount: Number(data?.totalCount ?? 0),
			} satisfies ReceiptPage;

			pageCacheRef.current[cacheKey] = nextPage;
			lastKnownUpdateRef.current[orgId] = nextPage.lastUpdatedAt ?? null;

			if (activeRequestKeyRef.current === requestKey) {
				setReceiptPage(nextPage);
			}
		} catch (loadError: any) {
			if (activeRequestKeyRef.current === requestKey) {
				setReceiptPage(buildEmptyPage(orgId, page));
				setError(loadError?.message ?? "No se pudo cargar vouchers.");
			}
		} finally {
			if (activeRequestKeyRef.current === requestKey) {
				setLoading(false);
			}
		}
	}

	useEffect(() => {
		if (!selectedOrg) {
			return;
		}

		void loadReceiptsPage(selectedOrg, currentPage);
	}, [selectedOrg, currentPage]);

	useEffect(() => {
		if (!selectedOrg) {
			return;
		}

		const intervalId = window.setInterval(async () => {
			try {
				const searchParams = new URLSearchParams({ orgId: selectedOrg });
				const response = await fetch(`/api/receipts/summary?${searchParams.toString()}`, {
					cache: "no-store",
				});
				const data = await response.json().catch(() => null);
				if (!response.ok) {
					return;
				}

				const lastUpdatedAt = data?.lastUpdatedAt ?? null;
				const previousLastUpdatedAt = lastKnownUpdateRef.current[selectedOrg] ?? null;
				if (lastUpdatedAt && previousLastUpdatedAt && lastUpdatedAt !== previousLastUpdatedAt) {
					clearOrgCache(selectedOrg);
					lastKnownUpdateRef.current[selectedOrg] = lastUpdatedAt;
					setRefreshNotice("Se detectaron nuevos vouchers. La lista fue actualizada.");
					setHighlightedRow(null);
					if (currentPageRef.current !== 1) {
						setCurrentPage(1);
						return;
					}

					void loadReceiptsPage(selectedOrg, 1, { forceRefresh: true });
				}
			} catch {
				// Ignore background polling errors.
			}
		}, INVALIDATION_POLL_MS);

		return () => window.clearInterval(intervalId);
	}, [selectedOrg]);

	function handleOrganizationChange(nextOrgId: string) {
		setSelectedOrg(nextOrgId);
		setCurrentPage(1);
		setRefreshNotice(null);
		setHighlightedRow(null);
	}

	function refreshCurrentPage() {
		if (!selectedOrg) {
			return;
		}

		clearOrgCache(selectedOrg);
		setRefreshNotice(null);
		void loadReceiptsPage(selectedOrg, currentPage, { forceRefresh: true });
	}

	const receipts = receiptPage.receipts;
	const canGoPrevious = currentPage > 1 && !loading;
	const canGoNext = receiptPage.hasMore && !loading;

	return (
		<>
			<div className="mb-3 flex flex-wrap items-center gap-2">
				{showOrganizationSelector && (
					<select
						className="border rounded px-2 py-1"
						value={selectedOrg}
						onChange={(event) => handleOrganizationChange(event.target.value)}
						disabled={organizations.length <= 1}
					>
						{organizations.map((org) => (
							<option key={org.id} value={org.id}>{org.name}</option>
						))}
					</select>
				)}
				<button
					className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					onClick={refreshCurrentPage}
					disabled={!selectedOrg || loading}
					type="button"
				>
					{loading ? "Actualizando..." : "Actualizar"}
				</button>
				<div className="text-sm text-slate-500">
					Ultima actualizacion: {formatLastUpdated(receiptPage.lastUpdatedAt)}
				</div>
			</div>
			{refreshNotice && (
				<div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
					{refreshNotice}
				</div>
			)}
			{error && (
				<div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
					{error}
				</div>
			)}
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
						{loading && receipts.length === 0 && (
							<tr className="border-t">
								<td className="px-4 py-6 text-center text-slate-500" colSpan={8}>Cargando vouchers...</td>
							</tr>
						)}
						{!loading && receipts.length === 0 && !error && (
							<tr className="border-t">
								<td className="px-4 py-6 text-center text-slate-500" colSpan={8}>No hay vouchers para esta organizacion.</td>
							</tr>
						)}
						{receipts.map((receipt) => {
							const isHighlighted = highlightedRow === receipt.receiptId;
							return (
								<tr
									key={`${receipt.userId}:${receipt.receiptId}`}
									className={`border-t ${isHighlighted ? "bg-yellow-100" : ""}`}
									onClick={() => setHighlightedRow(receipt.receiptId)}
									style={{ cursor: "pointer" }}
								>
									<td className="px-4 py-2">
										{receipt.blobUrl ? (
											<img
												src={`/api/receipt-image/${receipt.userId}/${receipt.receiptId}`}
												alt="Receipt"
												className="h-12 w-12 object-cover rounded cursor-pointer hover:opacity-80"
												onClick={() => setImageModal(`/api/receipt-image/${receipt.userId}/${receipt.receiptId}`)}
											/>
										) : (
											<span className="text-slate-400">No image</span>
										)}
									</td>
									<td className="px-4 py-2">{new Date(receipt.createdAt).toLocaleString()}</td>
									<td className="px-4 py-2">{receipt.transactionSource ?? ""}</td>
									<td className="px-4 py-2">{receipt.transactionAmount ?? ""}</td>
									<td className="px-4 py-2">{receipt.transactionDateTimeUtc ? new Date(receipt.transactionDateTimeUtc).toLocaleString() : ""}</td>
									<td className="px-4 py-2">{receipt.transactionOperationNumber ?? ""}</td>
									<td className="px-4 py-2 text-slate-500">{receipt.userName}</td>
									<td className="px-4 py-2">
										<button
											className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
											onClick={() => setOcrModal(receipt.ocrText ?? "No OCR text available.")}
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
			<div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-600">
				<div>Pagina {currentPage}</div>
				<div className="flex items-center gap-2">
					<button
						className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-50"
						onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
						disabled={!canGoPrevious}
						type="button"
					>
						Anterior
					</button>
					<button
						className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-50"
						onClick={() => setCurrentPage((page) => page + 1)}
						disabled={!canGoNext}
						type="button"
					>
						Siguiente
					</button>
				</div>
			</div>

			<Modal open={!!imageModal} onClose={() => setImageModal(null)}>
				{imageModal && (
					<img src={imageModal ?? undefined} alt="Receipt Full" className="max-w-full max-h-[70vh] mx-auto rounded" />
				)}
			</Modal>

			<Modal open={!!ocrModal} onClose={() => setOcrModal(null)}>
				<div className="font-semibold mb-2">OCR Text</div>
				<div className="whitespace-pre-wrap text-sm max-h-[60vh] overflow-y-auto">
					{ocrModal}
				</div>
			</Modal>
		</>
	);
}
