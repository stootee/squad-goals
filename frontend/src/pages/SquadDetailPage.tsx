// src/pages/SquadDetailPage.tsx
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import SquadGoalsManager from "@components/SquadGoalsManager";

interface SquadMember {
  username: string;
  name?: string; 
  stats?: { [key: string]: number };
}

interface Squad {
  id: string;
  name: string;
  admin: string; 
  members: SquadMember[];
  isAdmin: boolean; 
}

interface SquadGoalSubmissionPageProps {
  squadId: string;
}

const SquadDetailPage: React.FC<SquadGoalSubmissionPageProps> = ({ squadId }) => {
  const navigate = useNavigate(); 
  const [squad, setSquad] = useState<Squad | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>(''); // Current user's username

  // Fetch current user's info and squad data on initial load
  useEffect(() => {
    const fetchUserInfo = async () => {
        try {
            const res = await fetch('/api/user_info', { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setCurrentUsername(data.username);
            }
        } catch (error) {
            console.error("Failed to fetch user info:", error);
        }
    };
    fetchUserInfo();
    fetchSquad();
  }, [squadId]);

  const fetchSquad = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/squads/${squadId}`, { credentials: "include" });
      const data = await res.json();

      const membersWithDefaults: SquadMember[] = data.members.map((memberData: string | { username: string, name?: string }) => {
        let member: { username: string, name?: string };

        if (typeof memberData === 'string') {
            member = { username: memberData };
        } else {
            member = memberData;
        }

        return { 
            ...member, 
            stats: (member as SquadMember).stats || {}
        };
      });

      setSquad({
        ...data,
        members: membersWithDefaults, 
        isAdmin: data.is_admin, 
      });
    } catch (err) {
      console.error("Failed to fetch squad:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;

    try {
      const res = await fetch(`/api/squads/${squadId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: inviteUsername.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setInviteMessage(data.message || "Invite sent!");
        setInviteUsername("");
      } else {
        setInviteMessage(data.message || "Failed to send invite");
      }
    } catch (err) {
      console.error("Error sending invite:", err);
      setInviteMessage("Failed to send invite");
    }
  };

  const removeMember = async (username: string) => {
    if (!squad || !squad.isAdmin) return;

    if (username === squad.admin) {
      alert("You cannot remove the squad administrator.");
      return;
    }

    if (!window.confirm(`Are you sure you want to remove ${username} from the squad?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/squads/${squad.id}/remove_member`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
      });

      const data = await res.json();
      alert(data.message);

      if (res.ok) {
        fetchSquad(); 
      }
    } catch (err) {
      console.error("Error removing member:", err);
      alert("Failed to remove member.");
    }
  };
  
  const leaveSquad = async () => {
    if (!squad) return;

    if (!window.confirm(`Are you sure you want to leave the squad "${squad.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/squads/${squad.id}/leave`, {
        method: "POST", 
        credentials: "include",
      });

      const data = await res.json();
      alert(data.message);

      if (res.ok) {
        navigate('/squads');
      }
    } catch (err) {
      console.error("Error leaving squad:", err);
      alert("Failed to leave squad.");
    }
  };

  const deleteSquad = async () => {
    if (!squad || !squad.isAdmin) return;

    if (!window.confirm(`WARNING: Are you sure you want to permanently delete the squad "${squad.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/squads/${squad.id}`, {
        method: "DELETE", 
        credentials: "include",
      });

      const data = await res.json();
      alert(data.message);

      if (res.ok) {
        navigate('/squads');
      }
    } catch (err) {
      console.error("Error deleting squad:", err);
      alert("Failed to delete squad.");
    }
  };

  if (loading) return <p>Loading squad...</p>;
  if (!squad) return <p>Squad not found.</p>;

  return (
    <div style={{ fontFamily: "sans-serif", background: "#f9f9f9", minHeight: "100vh", padding: "2em" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", background: "#fff", padding: "2em", borderRadius: 8, boxShadow: "0 4px 8px rgba(0,0,0,0.1)" }}>

        <h1 style={{ marginTop: 0, color: "#007bff" }}>{squad.name}</h1>

        {/* Admin and Member Count */}
        <p><strong>Administrator:</strong> {squad.admin}</p>
        <p><strong>Members:</strong> {squad.members.length}</p>

        {/* Squad Members List */}
        <h2>Squad Members</h2>
        {squad.members.length === 0 ? (
          <p>No members yet.</p>
        ) : (
          <ul>
            {squad.members.map((member, index) => {
                const isCurrentUser = member.username === currentUsername;
                const isSquadAdmin = member.username === squad.admin;

                return (
                  <li key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5em', borderBottom: '1px dotted #eee' }}>
                    <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '1.1em' }}>
                          {member.name || member.username} 
                          {isSquadAdmin && " 👑 (Admin)"}
                        </strong>
                        {member.name && <span style={{ color: '#666', marginLeft: '0.5em' }}>({member.username})</span>}
                    </div>
                    
                    {/* --- BUTTON LOGIC --- */}
                    {/* 1. Admin's "Remove" button (for non-admins) */}
                    {squad.isAdmin && !isSquadAdmin && (
                        <button
                            onClick={() => removeMember(member.username)}
                            style={{ marginLeft: '1em', padding: "0.3em 0.8em", background: "#dc3545", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.8em" }}
                        >
                            Remove
                        </button>
                    )}

                    {/* 2. Non-Admin's "Leave Squad" button (only for the current user) */}
                    {!squad.isAdmin && isCurrentUser && (
                        <button
                            onClick={leaveSquad}
                            style={{ marginLeft: '1em', padding: "0.3em 0.8em", background: "#6c757d", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.8em" }}
                        >
                            Leave Squad
                        </button>
                    )}
                    {/* -------------------- */}
                  </li>
                );
            })}
          </ul>
        )}
        
        {/* Separator */}
        <hr style={{ margin: '2em 0' }} />

        {/* Admin-only actions */}
        {squad.isAdmin && (
          <>
            {/* Invite Form */}
            <div style={{ marginTop: "2em" }}>
              <h2>Invite a Member</h2>
              <form onSubmit={handleInvite} style={{ display: "flex", gap: "0.5em", marginBottom: "1em" }}>
                <input
                  type="text"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  placeholder="Enter username"
                  style={{ flex: 1, padding: "0.5em", border: "1px solid #ccc", borderRadius: 4 }}
                />
                <button type="submit" style={{ padding: "0.5em 1em", background: "#007bff", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
                  Invite
                </button>
              </form>
              {inviteMessage && <p>{inviteMessage}</p>}
            </div>

            {/* Squad Goals Manager */}
            <div style={{ marginTop: "2em" }}>
              <SquadGoalsManager squadId={squad.id} />
            </div>
            
            {/* Delete Squad Button */}
            <button
                onClick={deleteSquad}
                style={{ marginTop: "3em", padding: "0.7em 1.5em", background: "#dc3545", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
            >
                Delete Squad
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SquadDetailPage;