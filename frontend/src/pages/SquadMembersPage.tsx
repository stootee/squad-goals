import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./../styles/global.css";

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

interface SquadDetailPageProps {
  squadId: string;
}

const SquadDetailPage: React.FC<SquadDetailPageProps> = ({ squadId }) => {
  const navigate = useNavigate(); 
  const [squad, setSquad] = useState<Squad | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>(''); 

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
        if (typeof memberData === 'string') member = { username: memberData };
        else member = memberData;

        return { ...member, stats: (member as SquadMember).stats || {} };
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
      setInviteMessage(data.message || "Invite sent!");
      if (res.ok) setInviteUsername("");
    } catch (err) {
      console.error("Error sending invite:", err);
      setInviteMessage("Failed to send invite");
    }
  };

  const removeMember = async (username: string) => {
    if (!squad || !squad.isAdmin) return;
    if (username === squad.admin) return alert("You cannot remove the squad administrator.");
    if (!window.confirm(`Remove ${username} from the squad?`)) return;

    try {
      const res = await fetch(`/api/squads/${squad.id}/remove_member`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      alert(data.message);
      if (res.ok) fetchSquad();
    } catch (err) {
      console.error(err);
      alert("Failed to remove member.");
    }
  };

  const leaveSquad = async () => {
    if (!squad) return;
    if (!window.confirm(`Leave squad "${squad.name}"?`)) return;

    try {
      const res = await fetch(`/api/squads/${squad.id}/leave`, { method: "POST", credentials: "include" });
      const data = await res.json();
      alert(data.message);
      if (res.ok) navigate('/squads');
    } catch (err) {
      console.error(err);
      alert("Failed to leave squad.");
    }
  };

  const deleteSquad = async () => {
    if (!squad || !squad.isAdmin) return;
    if (!window.confirm(`Delete squad "${squad.name}" permanently?`)) return;

    try {
      const res = await fetch(`/api/squads/${squad.id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      alert(data.message);
      if (res.ok) navigate('/squads');
    } catch (err) {
      console.error(err);
      alert("Failed to delete squad.");
    }
  };

  if (loading) return <p>Loading squad...</p>;
  if (!squad) return <p>Squad not found.</p>;

  return (
    <div className="container">
      <div className="glass-card">
        <h1>{squad.name}</h1>
        <p><strong>Administrator:</strong> {squad.admin}</p>
        <p><strong>Members:</strong> {squad.members.length}</p>

        <h2>Squad Members</h2>
        {squad.members.length === 0 ? <p>No members yet.</p> : (
          <ul>
            {squad.members.map((member, idx) => {
              const isCurrentUser = member.username === currentUsername;
              const isAdmin = member.username === squad.admin;

              return (
                <li key={idx} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5em' }}>
                  <div>
                    <strong>{member.name || member.username}{isAdmin && " 👑"}</strong>
                    {member.name && <span style={{ color: '#666', marginLeft: '0.5em' }}>({member.username})</span>}
                  </div>

                  {/* Buttons */}
                  {squad.isAdmin && !isAdmin && <button className="logout-btn" onClick={() => removeMember(member.username)}>Remove</button>}
                  {!squad.isAdmin && isCurrentUser && <button className="nav-btn inactive" onClick={leaveSquad}>Leave Squad</button>}
                </li>
              );
            })}
          </ul>
        )}

        {/* Invite Form */}
        {squad.isAdmin && (
          <div style={{ marginTop: '2em' }}>
            <h2>Invite a Member</h2>
            <form onSubmit={handleInvite} className="form-inline">
              <input type="text" value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} placeholder="Enter username" required />
              <button type="submit" className="submit-btn">Invite</button>
            </form>
            {inviteMessage && <p>{inviteMessage}</p>}
          </div>
        )}

        {/* Admin Actions */}
        {squad.isAdmin && <button className="logout-btn" onClick={deleteSquad} style={{ marginTop: '2em' }}>Delete Squad</button>}

        {/* Leave squad button for non-admin */}
        {!squad.isAdmin && <button className="nav-btn inactive" style={{ marginTop: '2em' }} onClick={leaveSquad}>Leave Squad</button>}

        {/* Back to squads link */}
        <button className="nav-btn inactive" style={{ marginTop: '1em' }} onClick={() => navigate('/squads')}>Back to Squads</button>
      </div>
    </div>
  );
};

export default SquadDetailPage;
