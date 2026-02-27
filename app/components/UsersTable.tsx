"use client";
import { useEffect, useState } from "react";

// InviteButton component
type InviteButtonProps = { orgId: string };
function InviteButton(props: InviteButtonProps) {
	const { orgId } = props;
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");

	const handleInvite = async () => {
		setLoading(true);
		setMessage("");
		try {
			const res = await fetch("/api/invite", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, orgId }),
			});
			const data = await res.json();
			if (res.ok) {
				setMessage("Invitation sent!");
				setEmail("");
			} else {
				setMessage(data.error || "Failed to send invitation");
			}
		} catch (e) {
			setMessage("Error sending invitation");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex items-center space-x-2">
			<input
				type="email"
				className="border rounded px-2 py-1"
				placeholder="Invite email"
				value={email}
				onChange={e => setEmail(e.target.value)}
				disabled={loading}
			/>
			<button
				className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded"
				onClick={handleInvite}
				disabled={loading || !email}
			>
				{loading ? "Inviting..." : "Invite"}
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
						<th className="px-2 py-1 border">Name</th>
						<th className="px-2 py-1 border">Email</th>
						<th className="px-2 py-1 border">Status</th>
						<th className="px-2 py-1 border">Last Login</th>
						<th className="px-2 py-1 border">Actions</th>
					</tr>
				</thead>
				<tbody>
					{loading ? (
						<tr key={1}><td colSpan={5} className="text-center py-2">Loading...</td></tr>
					) : members.length === 0 ? (
						<tr><td colSpan={5} className="text-center py-2">No members found.</td></tr>
					) : members.map(member => (
						<tr key={member.id} className="border-t">
							<td className="px-2 py-1 border">{member.name}</td>
							<td className="px-2 py-1 border">{member.email}</td>
							<td className="px-2 py-1 border">{member.status ?? <span className='text-slate-400'>Unknown</span>}</td>
							<td className="px-2 py-1 border">{member.lastLogin ? new Date(member.lastLogin).toLocaleString() : <span className='text-slate-400'>Never</span>}</td>
							<td className="px-2 py-1 border space-x-2">
								<button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded" onClick={() => handleResetPassword(member)}>Reset Password</button>
								<button className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded" onClick={() => handleDeleteUser(member)}>Delete</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
			<div className="mt-4">
				<InviteButton orgId={selectedOrg} />
			</div>
		</div>
	);
}
