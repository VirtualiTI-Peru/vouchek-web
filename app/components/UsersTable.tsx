"use client";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

// InviteButton component
type InviteButtonProps = { orgId: string; members: any[] };
function InviteButton(props: InviteButtonProps) {
	const { orgId, members } = props;
	const [email, setEmail] = useState("");
	const [role, setRole] = useState("org:transportista");
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");

	const { user } = useUser();

	// Define available roles (customize as needed)
	const availableRoles = [
		{ value: "org:transportista", label: "Transportista" },
		{ value: "org:sistema", label: "Administrador del Sistema" },
		{ value: "org:verificador", label: "Verificador" },
	];

	const handleInvite = async () => {
		setMessage("");
		if (!email) return;
		// Check if email already exists in members
		const exists = members.some(m => m.email?.toLowerCase() === email.toLowerCase());
		if (exists) {
			setMessage("El usuario ya existe en la organización.");
			return;
		}
		setLoading(true);
		try {
			const invitedBy = user?.id || "Administrador";
			const res = await fetch("/api/invite", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, orgId, invitedBy, role }),
			});
			const data = await res.json();
			if (res.ok) {
				setMessage("Invitación enviada!");
				setEmail("");
			} else {
				setMessage(data.error || "Error al enviar la invitación");
			}
		} catch (e) {
			setMessage("Error al enviar la invitación");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex items-center space-x-2">
			<input
				type="email"
				className="border rounded px-2 py-1"
				placeholder="Correo electrónico"
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
				onClick={handleInvite}
				disabled={loading || !email}
			>
				{loading ? "Enviando..." : "Invitar"}
			</button>
			{message && <span className="ml-2 text-xs text-slate-600">{message}</span>}
		</div>
	);
}

type Org = { id: string; name: string };

export default function UsersTable({ organizations }: { organizations: Org[] }) {
	const [selectedOrg, setSelectedOrg] = useState(organizations[0]?.id ?? "");
	const [members, setMembers] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!selectedOrg) return;
		setLoading(true);
		fetch(`/api/org-members?orgId=${selectedOrg}`)
			.then(res => res.json())
			.then(data => {
				if (Array.isArray(data)) {
					setMembers(data);
				} else {
					setMembers([]);
					// Optionally, handle error message: data.error
				}
			})
			.finally(() => setLoading(false));
	}, [selectedOrg]);

	// Action handlers
	const handleResetPassword = async (member: any) => {
		// TODO: Implement API call to send password reset email
		alert(`Password reset link would be sent to: ${member.email}`);
	};

	const handleDeleteUser = async (member: any) => {
		// TODO: Implement API call to delete user
		if (confirm(`Are you sure you want to delete user: ${member.email}?`)) {
			alert(`User ${member.email} would be deleted (API call placeholder).`);
		}
	};

	return (
		<div>
			<select
				className="border rounded px-2 py-1 mb-2"
				value={selectedOrg}
				onChange={e => setSelectedOrg(e.target.value)}
			>
				{organizations.map(org => (
					<option key={org.id} value={org.id}>{org.name}</option>
				))}
			</select>
			<table className="min-w-full text-sm border bg-white">
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
					{loading ? (
						<tr key={1}><td colSpan={5} className="text-center py-2">Estamos preparando los datos...</td></tr>
					) : members.length === 0 ? (
						<tr><td colSpan={5} className="text-center py-2">No members found.</td></tr>
					) : members.map(member => (
						<tr key={member.id} className="border-t">
							<td className="px-2 py-1 border">{member.username}</td>
							<td className="px-2 py-1 border">{member.email}</td>
							<td className="px-2 py-1 border">{member.role}</td>
							<td className="px-2 py-1 border">{member.status ?? <span className='text-slate-400'>Unknown</span>}</td>
							<td className="px-2 py-1 border">{member.lastSignInAt ? new Date(member.lastSignInAt).toLocaleString() : <span className='text-slate-400'></span>}</td>
							<td className="px-2 py-1 border space-x-2">
								<button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded" onClick={() => handleResetPassword(member)}>Restablecer Contraseña</button>
								<button className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded" onClick={() => handleDeleteUser(member)}>Eliminar</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
			<div className="mt-4">
				 <InviteButton orgId={selectedOrg} members={members} />
                {/* Create User Form */}
                <div className="mt-6 border rounded p-4 bg-slate-50">
                  <div className="font-semibold mb-2">Crear nuevo usuario</div>
                  <CreateUserForm orgId={selectedOrg} onUserCreated={() => setMembers([])} />
                </div>
			</div>
		</div>
	);
}

// CreateUserForm component
function CreateUserForm({ orgId, onUserCreated }: { orgId: string; onUserCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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
        body: JSON.stringify({ email, firstName, lastName, orgId }),
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
