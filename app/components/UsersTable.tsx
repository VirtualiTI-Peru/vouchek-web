"use client";
import { useEffect, useState } from "react";

type Member = {
  id: string;
  username?: string;
  email?: string;
  role?: string;
  status?: string;
  lastSignInAt?: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
};

type Org = { id: string; name: string };

export default function UsersTable({
	organizations,
	showOrganizationSelector = true,
	isSuperAdmin = false,
}: {
	organizations: Org[];
	showOrganizationSelector?: boolean;
	isSuperAdmin?: boolean;
}) {
	const [selectedOrg, setSelectedOrg] = useState(organizations[0]?.id ?? "");
	const [activeTab, setActiveTab] = useState<"users" | "invitations">("users");
	const [members, setMembers] = useState<Member[]>([]);
	const [invitations, setInvitations] = useState<Invitation[]>([]);
	const [loadingMembers, setLoadingMembers] = useState(false);
	const [loadingInvitations, setLoadingInvitations] = useState(false);
	const [resettingUserId, setResettingUserId] = useState("");
	const [deletingUserId, setDeletingUserId] = useState("");
	const [membersMessage, setMembersMessage] = useState("");
	const [invitationMessage, setInvitationMessage] = useState("");

	const loadMembers = async (orgId: string) => {
		setLoadingMembers(true);
		try {
			const res = await fetch(`/api/org-members?orgId=${orgId}`);
			const data = await res.json();
			if (Array.isArray(data)) {
				setMembers(data);
			} else {
				setMembers([]);
			}
		} finally {
			setLoadingMembers(false);
		}
	};

	const loadInvitations = async (orgId: string) => {
		setLoadingInvitations(true);
		try {
			const res = await fetch(`/api/invitations?orgId=${orgId}`);
			const data = await res.json();
			if (Array.isArray(data)) {
				setInvitations(data);
			} else {
				setInvitations([]);
			}
		} finally {
			setLoadingInvitations(false);
		}
	};

	useEffect(() => {
		if (!selectedOrg) {
			setMembers([]);
			setInvitations([]);
			return;
		}
		void Promise.all([loadMembers(selectedOrg), loadInvitations(selectedOrg)]);
	}, [selectedOrg]);

	// Action handlers
	const handleResetPassword = async (member: Member) => {
		setMembersMessage("");
		if (!member.id || !member.email || !selectedOrg) {
			setMembersMessage("No se pudo preparar el reenvio del enlace.");
			return;
		}

		setResettingUserId(member.id);
		try {
			const res = await fetch('/api/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: member.id, orgId: selectedOrg }),
			});
			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
				setMembersMessage(data?.error ?? 'No se pudo reenviar el correo.');
				return;
			}

			setMembersMessage(`Se envio un nuevo enlace de configuracion a ${member.email}.`);
		} finally {
			setResettingUserId("");
		}
	};

	const handleDeleteUser = async (member: Member) => {
		setMembersMessage("");
		if (!member.id || !member.email || !selectedOrg) {
			setMembersMessage('No se pudo preparar la eliminacion del usuario.');
			return;
		}

		if (!confirm(`Esta accion eliminara al usuario ${member.email}. Deseas continuar?`)) {
			return;
		}

		setDeletingUserId(member.id);
		try {
			const res = await fetch('/api/delete-user', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: member.id, orgId: selectedOrg }),
			});
			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
				setMembersMessage(data?.error ?? 'No se pudo eliminar el usuario.');
				return;
			}

			setMembersMessage(`Usuario ${member.email} eliminado.`);
			await loadMembers(selectedOrg);
		} finally {
			setDeletingUserId("");
		}
	};

	const handleDeleteInvitation = async (invitationId: string, label: "revocar" | "eliminar") => {
		setInvitationMessage("");
		const confirmText =
			label === "revocar"
				? "Esta accion revocara la invitacion pendiente. Deseas continuar?"
				: "Esta accion eliminara el registro de invitacion. Deseas continuar?";
		if (!confirm(confirmText)) {
			return;
		}

		const res = await fetch(`/api/invitations?id=${encodeURIComponent(invitationId)}`, {
			method: "DELETE",
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			setInvitationMessage(data?.error ?? "No se pudo eliminar la invitacion.");
			return;
		}
		setInvitationMessage(label === "revocar" ? "Invitacion revocada." : "Invitacion eliminada.");
		if (selectedOrg) {
			await loadInvitations(selectedOrg);
		}
	};

	return (
		<div>
			{showOrganizationSelector && (
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
			)}
			<div className="mb-3 mt-2 inline-flex rounded-lg border border-slate-200 p-1 text-sm">
				<button
					className={`rounded-md px-3 py-1 ${activeTab === "users" ? "bg-slate-900 text-white" : "text-slate-600"}`}
					onClick={() => setActiveTab("users")}
					type="button"
				>
					Users
				</button>
				<button
					className={`rounded-md px-3 py-1 ${activeTab === "invitations" ? "bg-slate-900 text-white" : "text-slate-600"}`}
					onClick={() => setActiveTab("invitations")}
					type="button"
				>
					Invitations
				</button>
			</div>

			{activeTab === "users" ? (
				<>
					  <table className="min-w-full text-sm border bg-white dark:bg-[#18191A]">
						<thead className="bg-slate-50 text-left text-slate-600">
							<tr>
								<th className="px-2 py-1 border">Usuario</th>
								<th className="px-2 py-1 border">Correo Electronico</th>
								<th className="px-2 py-1 border">Rol</th>
								<th className="px-2 py-1 border">Status</th>
								<th className="px-2 py-1 border">Ultimo Acceso</th>
								<th className="px-2 py-1 border"></th>
							</tr>
						</thead>
						<tbody>
							{loadingMembers ? (
								<tr><td colSpan={6} className="text-center py-2">Estamos preparando los datos...</td></tr>
							) : members.length === 0 ? (
								<tr><td colSpan={6} className="text-center py-2">No members found.</td></tr>
							) : members
									.filter((member: any) => {
										// Hide superadmins unless current user is superadmin
										if (isSuperAdmin) return true;
										// If member has is_super_admin true, hide
										// The backend does not return is_super_admin, so we need to add it
										// If the backend is updated to include is_super_admin, use it here
										// For now, fallback: if role is 'superadmin' or username/email matches known superadmins, hide
										// But ideally, backend should include is_super_admin in the member object
										// If member.is_super_admin is present, use it
										if ((member as any).is_super_admin === true) return false;
										// fallback: hide if role is 'superadmin'
										if ((member.role && member.role.toLowerCase() === 'superadmin')) return false;
										return true;
									})
									.map(member => (
										<tr key={member.id} className="border-t">
											<td className="px-2 py-1 border">{member.username}</td>
											<td className="px-2 py-1 border">{member.email}</td>
											<td className="px-2 py-1 border">{member.role}</td>
											<td className="px-2 py-1 border">{member.status ?? <span className="text-slate-400">Unknown</span>}</td>
											<td className="px-2 py-1 border">{member.lastSignInAt ? new Date(member.lastSignInAt).toLocaleString() : <span className="text-slate-400"></span>}</td>
											<td className="px-2 py-1 border space-x-2">
												<button
													className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded disabled:opacity-50"
													onClick={() => void handleResetPassword(member)}
													disabled={resettingUserId === member.id || deletingUserId === member.id}
												>
													{resettingUserId === member.id ? 'Enviando...' : 'Restablecer Contrasena'}
												</button>
												<button
													className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded disabled:opacity-50"
													onClick={() => void handleDeleteUser(member)}
													disabled={deletingUserId === member.id || resettingUserId === member.id}
												>
													{deletingUserId === member.id ? 'Eliminando...' : 'Eliminar'}
												</button>
											</td>
										</tr>
									))}
						</tbody>
					</table>

					{membersMessage && <div className="mt-2 text-xs text-slate-600">{membersMessage}</div>}

					<div className="mt-6 border rounded p-4 bg-slate-50">
					  <div className="font-semibold mb-2">Crear nuevo usuario</div>
					  <CreateUserForm orgId={selectedOrg} onUserCreated={() => selectedOrg && void loadMembers(selectedOrg)} />
					</div>
				</>
			) : (
				<>
					<div className="mb-4 border rounded p-4 bg-slate-50">
						<div className="font-semibold mb-2">Invitar usuario</div>
						<InviteForm
							orgId={selectedOrg}
							members={members}
							onInvited={() => selectedOrg && void loadInvitations(selectedOrg)}
						/>
					</div>

					  <table className="min-w-full text-sm border bg-white dark:bg-[#18191A]">
						<thead className="bg-slate-50 text-left text-slate-600">
							<tr>
								<th className="px-2 py-1 border">Correo</th>
								<th className="px-2 py-1 border">Rol</th>
								<th className="px-2 py-1 border">Estado</th>
								<th className="px-2 py-1 border">Creada</th>
								<th className="px-2 py-1 border">Expira</th>
								<th className="px-2 py-1 border"></th>
							</tr>
						</thead>
						<tbody>
							{loadingInvitations ? (
								<tr><td colSpan={6} className="text-center py-2">Cargando invitaciones...</td></tr>
							) : invitations.length === 0 ? (
								<tr><td colSpan={6} className="text-center py-2">No hay invitaciones.</td></tr>
							) : invitations.map(invitation => {
								const isAccepted = Boolean(invitation.accepted_at);
								return (
									<tr key={invitation.id} className="border-t">
										<td className="px-2 py-1 border">{invitation.email}</td>
										<td className="px-2 py-1 border">{invitation.role}</td>
										<td className="px-2 py-1 border">{isAccepted ? "Aceptada" : "Pendiente"}</td>
										<td className="px-2 py-1 border">{new Date(invitation.created_at).toLocaleString()}</td>
										<td className="px-2 py-1 border">{new Date(invitation.expires_at).toLocaleString()}</td>
										<td className="px-2 py-1 border space-x-2">
											{!isAccepted && (
												<button
													className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-1 px-2 rounded"
													onClick={() => void handleDeleteInvitation(invitation.id, "revocar")}
												>
													Revocar
												</button>
											)}
											<button
												className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
												onClick={() => void handleDeleteInvitation(invitation.id, "eliminar")}
											>
												Eliminar
											</button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>

					{invitationMessage && <div className="mt-2 text-xs text-slate-600">{invitationMessage}</div>}
				</>
			)}
		</div>
	);
}

type InviteFormProps = {
	orgId: string;
	members: Member[];
	onInvited: () => void;
};

function InviteForm({ orgId, members, onInvited }: InviteFormProps) {
	const [email, setEmail] = useState("");
	const [role, setRole] = useState("org:transportista");
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");

	const availableRoles = [
		{ value: "org:transportista", label: "Transportista" },
		{ value: "org:sistema", label: "Administrador del Sistema" },
		{ value: "org:verificador", label: "Verificador" },
	];

	const handleInvite = async () => {
		setMessage("");
		if (!email || !orgId) return;

		const normalizedEmail = email.trim().toLowerCase();
		const exists = members.some(m => (m.email ?? "").toLowerCase() === normalizedEmail);
		if (exists) {
			setMessage("El usuario ya existe en la organizacion.");
			return;
		}

		setLoading(true);
		try {
			const res = await fetch("/api/invite", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: normalizedEmail, orgId, role }),
			});
			const data = await res.json().catch(() => ({}));
			if (res.ok) {
				setMessage("Invitacion enviada!");
				setEmail("");
				onInvited();
			} else {
				setMessage(data?.error || "Error al enviar la invitacion");
			}
		} catch {
			setMessage("Error al enviar la invitacion");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex flex-wrap items-center gap-2">
			<input
				type="email"
				className="border rounded px-2 py-1"
				placeholder="Correo electronico"
				value={email}
				onChange={e => setEmail(e.target.value)}
				disabled={loading}
			/>
			<select
				className="border rounded px-2 py-1"
				value={role}
				onChange={e => setRole(e.target.value)}
				disabled={loading}
			>
				{availableRoles.map(r => (
					<option key={r.value} value={r.value}>{r.label}</option>
				))}
			</select>
			<button
				className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded"
				onClick={() => void handleInvite()}
				disabled={loading || !email || !orgId}
				type="button"
			>
				{loading ? "Enviando..." : "Invitar"}
			</button>
			{message && <span className="ml-2 text-xs text-slate-600">{message}</span>}
		</div>
	);
}

// CreateUserForm component
function CreateUserForm({ orgId, onUserCreated }: { orgId: string; onUserCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
	const [role, setRole] = useState("org:transportista");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

	const availableRoles = [
		{ value: "org:transportista", label: "Transportista" },
		{ value: "org:sistema", label: "Administrador del Sistema" },
		{ value: "org:verificador", label: "Verificador" },
	];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (!email || !firstName || !lastName) {
      setMessage("Todos los campos son obligatorios.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, firstName, lastName, orgId, role }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Usuario creado exitosamente.");
        setEmail("");
        setFirstName("");
        setLastName("");
        onUserCreated();
      } else {
        setMessage(data.error || "Error al crear el usuario.");
      }
    } catch (e) {
      setMessage("Error al crear el usuario.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col space-y-2" onSubmit={handleCreate}>
      <input
        type="email"
        className="border rounded px-2 py-1"
        placeholder="Correo electrónico"
        value={email}
        onChange={e => setEmail(e.target.value)}
        disabled={loading}
      />
      <input
        type="text"
        className="border rounded px-2 py-1"
        placeholder="Nombre"
        value={firstName}
        onChange={e => setFirstName(e.target.value)}
        disabled={loading}
      />
      <input
        type="text"
        className="border rounded px-2 py-1"
        placeholder="Apellido"
        value={lastName}
        onChange={e => setLastName(e.target.value)}
        disabled={loading}
      />
      <select
        className="border rounded px-2 py-1"
        value={role}
        onChange={e => setRole(e.target.value)}
        disabled={loading}
      >
        {availableRoles.map(r => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded"
        type="submit"
        disabled={loading}
      >
        {loading ? "Creando..." : "Crear Usuario"}
      </button>
      {message && <span className="text-xs text-slate-600 mt-2">{message}</span>}
    </form>
  );
}
