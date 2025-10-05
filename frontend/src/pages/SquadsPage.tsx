// src/pages/SquadsPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Squad {
  id: string;
  name: string;
  admin: string;
  is_admin: boolean;
}

interface Invite {
  id: string;
  squad: string;
  invited_by: string;
  status: "pending" | "accepted" | "declined";
}

const SquadsPage: React.FC = () => {
  const apiURL = import.meta.env.VITE_API_URL;
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
      console.error("Error loading invites:", err);
    }
  };

  const loadSquads = async () => {
    try {
      const res = await fetch(`${apiURL}/squads`, { credentials: "include" });
      const data = await res.json();
      setSquads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading squads:", err);
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

        if (response === "accept") {
            loadSquads(); 
        }

        alert(data.message);
      } else {
        alert(data.message || "Failed to respond to invite");
      }
    } catch (err) {
      console.error(err);
      alert("Error responding to invite");
    }
  };

  useEffect(() => {
    loadInvites();
    loadSquads();
    const interval = setInterval(loadInvites, 15000); // refresh invites every 15s
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", minHeight: "100vh", background: "#f4f4f4" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "1em", background: "#007bff", color: "#fff" }}>
        <h1>Squads</h1>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: "transparent", border: "none", color: "#fff", fontSize: "1.5em", cursor: "pointer" }}
        >
          ☰
        </button>
      </div>

      {/* Hidden Menu */}
      {menuOpen && (
        <div style={{ background: "#fff", padding: "1em", borderBottom: "1px solid #ddd" }}>
          <form onSubmit={createSquad} style={{ display: "flex", gap: "0.5em" }}>
            <input
              type="text"
              placeholder="Squad name"
              value={newSquadName}
              onChange={(e) => setNewSquadName(e.target.value)}
              required
            />
            <button type="submit" style={{ background: "#007bff", color: "#fff", padding: "0.5em 1em" }}>Create</button>
          </form>
        </div>
      )}

      {/* Grid of Squads & Invites */}
      <div style={{ padding: "1em", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1em" }}>
        {/* Invites */}
        {invites.map((invite) => (
          <div key={invite.id} style={{ background: "#fff", border: "1px solid #ddd", padding: "1em", borderRadius: 6 }}>
            <h3>{invite.squad}</h3>
            <p>Invited by {invite.invited_by}</p>

            {invite.status === "pending" && (
              <div style={{ display: "flex", gap: "0.5em", marginTop: "0.5em" }}>
                <button
                  onClick={() => respondInvite(invite.id, "accept")}
                  style={{ background: "#28a745", color: "#fff", padding: "0.5em 1em" }}
                >
                  Accept
                </button>
                <button
                  onClick={() => respondInvite(invite.id, "decline")}
                  style={{ background: "#dc3545", color: "#fff", padding: "0.5em 1em" }}
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Squads */}
        {squads.map((squad) => (
          <div
            key={squad.id}
            onClick={() => navigate(`/squads/${squad.id}/submit`)}
            style={{
              background: "#fff",
              border: "1px solid #ddd",
              padding: "1em",
              borderRadius: 6,
              cursor: "pointer",
              transition: "0.2s",
            }}
          >
            <h3>{squad.name}</h3>
            <p>Admin: **{squad.admin}**</p> 
          </div>
        ))}
      </div>
    </div>
  );
};

export default SquadsPage;