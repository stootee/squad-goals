import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./../styles/global.css"; // import global styles

interface Squad {
  id: string;
  name: string;
  admin: string;
  is_admin: boolean;
  members: number;
}

interface Invite {
  id: string;
  squad: string;
  invited_by: string;
  status: "pending" | "accepted" | "declined";
}

const SquadsPage: React.FC = () => {
  const apiURL = window.APP_CONFIG.API_URL;
  const navigate = useNavigate();

  const [squads, setSquads] = useState<Squad[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [newSquadName, setNewSquadName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const loadInvites = async () => {
    try {
      const res = await fetch(`${apiURL}/invites`, { credentials: "include" });
      const data = await res.json();
      setInvites(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSquads = async () => {
    try {
      const res = await fetch(`${apiURL}/squads`, { credentials: "include" });
      const data = await res.json();
      setSquads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const createSquad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSquadName.trim()) return;
    try {
      const res = await fetch(`${apiURL}/squads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newSquadName }),
      });
      const data = await res.json();
      alert(data.message);
      if (res.ok) {
        setNewSquadName("");
        loadSquads();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const respondInvite = async (inviteId: string, response: "accept" | "decline") => {
    try {
      const res = await fetch(`${apiURL}/invites/${inviteId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response }),
      });
      const data = await res.json();
      if (res.ok) {
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
        if (response === "accept") loadSquads();
        alert(data.message);
      } else {
        alert(data.message || "Failed to respond");
      }
    } catch (err) {
      console.error(err);
      alert("Error responding to invite");
    }
  };

  useEffect(() => {
    loadInvites();
    loadSquads();
    const interval = setInterval(loadInvites, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="header-bar">
        <h1 className="header-title">Squads</h1>
        <button className="hamburger-btn" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      </div>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div className="dropdown-menu">
          <ul>
            <li><button onClick={() => (window.location.href = "/profile")}>Profile</button></li>
            <li><button onClick={() => (window.location.href = "/squads")}>Squads</button></li>
            <li><button className="logout-btn" onClick={() => alert("Logout logic here")}>Logout</button></li>
          </ul>

          {/* Create Squad Form */}
          <form onSubmit={createSquad} className="form-inline">
            <input type="text" placeholder="Squad name" value={newSquadName} onChange={e => setNewSquadName(e.target.value)} required />
            <button type="submit" className="submit-btn">Create</button>
          </form>
        </div>
      )}

      {/* Content Grid */}
      <div className="container grid">
        {invites.map(invite => (
          <div key={invite.id} className="glass-card">
            <h3>{invite.squad}</h3>
            <span>Invited by {invite.invited_by}</span>
            {invite.status === "pending" && (
              <div style={{ display: "flex", gap: "0.5em", marginTop: "0.5em" }}>
                <button onClick={() => respondInvite(invite.id, "accept")} className="submit-btn">Accept</button>
                <button onClick={() => respondInvite(invite.id, "decline")} className="logout-btn">Decline</button>
              </div>
            )}
          </div>
        ))}

        {squads.map(squad => (
          <div key={squad.id} className="glass-card" onClick={() => navigate(`/squads/${squad.id}/submit`)}>
            <h3>{squad.name}</h3>
            <span className="text-break"><b>Admin:</b> {squad.admin}</span>
            <span className="text-break"><b>Members:</b> {squad.members ?? 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SquadsPage;
