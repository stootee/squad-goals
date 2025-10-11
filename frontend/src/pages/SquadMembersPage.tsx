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
  const [currentUsername, setCurrentUsername] = useState<string>("");

  useEffect(() => {
    fetchUserInfo();
    fetchSquad();
  }, [squadId]);

  const fetchUserInfo = async () => {
    try {
      const res = await fetch("/api/user_info", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCurrentUsername(data.username);
      }
    } catch (err) {
      console.error("Failed to fetch user info:", err);
    }
  };

  const fetchSquad = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/squads/${squadId}`, { credentials: "include" });
      const data = await res.json();

      const members: SquadMember[] = data.members.map((m: any) =>
        typeof m === "string" ? { username: m, stats: {} } : { ...m, stats: m.stats || {} }
      );

      setSquad({ ...data, members, isAdmin: data.is_admin });
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
      console.error(err);
      setInviteMessage("Failed to send invite");
    }
  };

  const removeMember = async (username: string) => {
    if (!squad || !squad.isAdmin || username === squad.admin) return;

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
      const res = await fetch(`/api/squads/${squad.id}/leave`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      alert(data.message);
      if (res.ok) navigate("/squads");
    } catch (err) {
      console.error(err);
      alert("Failed to leave squad.");
    }
  };

  const deleteSquad = async () => {
    if (!squad || !squad.isAdmin) return;
    if (!window.confirm(`Delete squad "${squad.name}" permanently?`)) return;

    try {
      const res = await fetch(`/api/squads/${squad.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      alert(data.message);
      if (res.ok) navigate("/squads");
    } catch (err) {
      console.error(err);
      alert("Failed to delete squad.");
    }
  };

  if (loading) return <p>Loading squad...</p>;
  if (!squad) return <p>Squad not found.</p>;

  return (
    <div className="container">
      <div className="glass-card" style={{ maxWidth: "480px", margin: "0 auto" }}>
        <h2>Squad Members</h2>
        {squad.members.length === 0 ? (
          <p>No members yet.</p>
        ) : (
          <ul>
            {squad.members.map((member) => {
              const isCurrentUser = member.username === currentUsername;
              const isAdmin = member.username === squad.admin;

              return (
                <li
                  key={member.username}
                  className="glass-card"
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5em" }}
                >
                  <div>
                    <strong>
                      {isAdmin && "👑 "}
                      {member.name || member.username}
                      </strong>
                  </div>

                  <div>
                    {squad.isAdmin && !isAdmin && (
                      <button className="logout-btn" onClick={() => removeMember(member.username)}>
                        Remove
                      </button>
                    )}
                    {!squad.isAdmin && isCurrentUser && (
                      <button className="nav-btn inactive" onClick={leaveSquad}>
                        Leave Squad
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {squad.isAdmin && (
          <div style={{ marginTop: "2em" }}>
            <h2>Invite a Member</h2>
            <form onSubmit={handleInvite} className="form-inline">
              <input
                type="text"
                placeholder="Enter username"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                required
              />
              <button type="submit" className="submit-btn">
                Invite
              </button>
            </form>
            {inviteMessage && <p>{inviteMessage}</p>}
          </div>
        )}

      </div>
    </div>
  );
};

export default SquadDetailPage;
