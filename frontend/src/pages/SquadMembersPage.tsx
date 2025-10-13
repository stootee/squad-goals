// src/pages/SquadGoalSubmissionPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "@styles/global.css";
import "@styles/SquadMembersPage.css"; // Dedicated CSS for this component

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

interface UserProfile {
    username: string;
    configured_name?: string;
}

// New interface for invites sent by this squad
interface OutboundInvite {
    id: number;
    squad_name: string;
    squad_id: string;
    invited_username: string;
    status: string;
}

interface SquadMembersPageProps {
  squadId: string;
}

const SquadMembersPage: React.FC<SquadMembersPageProps> = ({ squadId }) => {
  const navigate = useNavigate();
  const [squad, setSquad] = useState<Squad | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  // State to store configured names
  const [userProfiles, setUserProfiles] = useState<Map<string, string>>(new Map());
  // New state to store pending invites sent from this squad
  const [outboundInvites, setOutboundInvites] = useState<OutboundInvite[]>([]);

  const apiURL = window.APP_CONFIG?.API_URL || "/api"; 

  // --- UPDATED: Function to fetch configured names from the dedicated endpoint ---
  const fetchProfiles = async () => {
    try {
        const res = await fetch(`${apiURL}/squads/${squadId}/profiles`, { 
            credentials: "include" 
        });
        if (res.ok) {
            const profiles: { username: string, configured_name?: string }[] = await res.json();
            const profileMap = new Map<string, string>();
            profiles.forEach(p => {
                if (p.configured_name) {
                    profileMap.set(p.username, p.configured_name);
                }
            });
            setUserProfiles(profileMap);
        }
    } catch (err) {
        console.error("Failed to fetch user profiles:", err);
    }
  };
  // -----------------------------------------------------------------------------

  // --- NEW: Function to fetch invites sent by this squad (Outbound Invites) ---
  const fetchOutboundInvites = async () => {
    try {
        // Query the /api/invites endpoint with the squad_id parameter
        const res = await fetch(`${apiURL}/invites?squad_id=${squadId}`, {
            credentials: "include"
        });
        if (res.ok) {
            const data: OutboundInvite[] = await res.json();
            setOutboundInvites(data);
        }
    } catch (err) {
        console.error("Failed to fetch outbound invites:", err);
    }
  };
  // -----------------------------------------------------------------------------


  const fetchSquadData = async () => {
    setLoading(true);
    let isAdmin = false; // Local variable to track admin status immediately
    try {
      // 1. Fetch user info
      const userRes = await fetch(`${apiURL}/user_info`, { credentials: "include" });
      let username = "";
      if (userRes.ok) {
        const userData = await userRes.json();
        username = userData.username;
        setCurrentUsername(username);
      }

      // 2. Fetch squad data
      const squadRes = await fetch(`${apiURL}/squads/${squadId}`, { credentials: "include" });
      const squadData = await squadRes.json();
      isAdmin = squadData.is_admin; // Capture admin status

      const members: SquadMember[] = squadData.members.map((m: any) =>
        typeof m === "string" ? { username: m, stats: {} } : { ...m, stats: m.stats || {} }
      );

      setSquad({ ...squadData, members, isAdmin });
      
      // 3. Fetch configured names
      await fetchProfiles();
      
      // 4. Fetch outbound invites if the current user is an admin
      if (isAdmin) {
          await fetchOutboundInvites();
      }

    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSquadData();
  }, [squadId]);


  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;

    try {
      const res = await fetch(`${apiURL}/squads/${squadId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: inviteUsername.trim() }),
      });
      const data = await res.json();
      
      // Update message and clear input on success
      setInviteMessage(data.message || (res.ok ? `Invite sent to ${inviteUsername}! ✅` : "Failed to send invite ❌"));
      if (res.ok) {
        setInviteUsername("");
        // Refresh the list of outbound invites to show the new one
        fetchOutboundInvites(); 
      }
    } catch (err) {
      console.error(err);
      setInviteMessage("Failed to send invite ❌");
    }
  };
  
  // --- Function to handle rescinding an invite ---
  const rescindInvite = async (inviteId: number, invitedUsername: string) => {
      if (!window.confirm(`Are you sure you want to rescind the invite sent to @${invitedUsername}?`)) return;
  
      try {
          const res = await fetch(`${apiURL}/invites/${inviteId}`, {
              method: "DELETE",
              credentials: "include"
          });
          const data = await res.json();
          alert(data.message);
          
          if (res.ok) {
              // Refresh the list of outbound invites
              fetchOutboundInvites(); 
          }
      } catch (err) {
          console.error("Failed to rescind invite:", err);
          alert("Failed to rescind invite.");
      }
  };
  // ---------------------------------------------------

  const removeMember = async (username: string) => {
    if (!squad || !squad.isAdmin || username === squad.admin) return;

    if (!window.confirm(`Remove ${username} from the squad?`)) return;

    try {
      const res = await fetch(`${apiURL}/squads/${squad.id}/remove_member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      alert(data.message);
      if (res.ok) fetchSquadData(); 
    } catch (err) {
      console.error(err);
      alert("Failed to remove member.");
    }
  };

  const leaveSquad = async () => {
    if (!squad) return;
    if (!window.confirm(`Leave squad "${squad.name}"?`)) return;

    try {
      const res = await fetch(`${apiURL}/squads/${squad.id}/leave`, {
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
    if (!window.confirm(`Delete squad "${squad.name}" permanently? This action cannot be undone.`)) return;

    try {
      const res = await fetch(`${apiURL}/squads/${squad.id}`, {
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

  // Filter messages for standardized display
  const isSuccess = inviteMessage && inviteMessage.includes("✅");

  // --- NEW LOGIC: Sort members to put the admin at the top ---
  const sortedMembers = [...squad.members].sort((a, b) => {
    // If 'a' is the admin, it should come first (return -1)
    if (a.username === squad.admin) return -1;
    // If 'b' is the admin, it should come first (return 1)
    if (b.username === squad.admin) return 1;
    // Otherwise, maintain existing order or use a secondary sort (e.g., by username)
    return a.username.localeCompare(b.username);
  });
  // -------------------------------------------------------------
  
  return (
    <div className="glass-card squad-members-card">
      <h2 className="card-title">Squad Members</h2>
      
      {/* Member List */}
      {squad.members.length === 0 ? (
        <p>No members yet.</p>
      ) : (
        <ul className="member-list">
          {sortedMembers.map((member) => { // Use sortedMembers here
            const isCurrentUser = member.username === currentUsername;
            const isAdmin = member.username === squad.admin;
            
            // Priority: 1. Configured name (from userProfiles), 2. Default name (from squad data), 3. Username
            const configuredName = userProfiles.get(member.username);
            const displayName = configuredName || member.name || member.username;

            return (
              <li key={member.username} className="member-list-item">
                <div className="member-info">
                  <strong className={isAdmin ? "admin-name" : ""}>
                    {isAdmin && "👑 "}
                    {displayName}
                    {isCurrentUser && " (You)"}
                  </strong>
                  <span className="member-username">@{member.username}</span>
                </div>

                <div className="member-actions">
                  {squad.isAdmin && !isAdmin && (
                    <button className="submit-btn danger-btn remove-btn" onClick={() => removeMember(member.username)}>
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      
      {/* Invite & Admin Section */}
      {squad.isAdmin && (
        <div className="invite-section">
          {/* Invite Form */}
          <h3 className="card-subtitle">Invite a Member</h3>
          <form onSubmit={handleInvite} className="form-inline">
            <input
              type="text"
              placeholder="Enter username"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              className="input invite-input"
              required
            />
            <button type="submit" className="submit-btn success-btn invite-btn">
              Invite
            </button>
          </form>
          {inviteMessage && (
            <p className={`message ${isSuccess ? "success-message" : "error-message"}`}>
              {inviteMessage}
            </p>
          )}

          {/* Pending Outbound Invites Section */}
          <h3 className="card-subtitle pending-invites-title">Pending Invites ({outboundInvites.length})</h3>
          
          {outboundInvites.length === 0 ? (
            <p className="muted-text">No pending invites from your squad.</p>
          ) : (
            <ul className="member-list pending-invite-list">
              {outboundInvites.map(invite => (
                <li key={invite.id} className="member-list-item pending-invite-item">
                  <div className="member-info">
                    <strong className="invited-name">@{invite.invited_username}</strong>
                    <span className="member-username invite-status">Pending</span>
                  </div>
                  <div className="member-actions">
                    <button 
                      className="submit-btn danger-btn rescind-btn"
                      onClick={() => rescindInvite(invite.id, invite.invited_username)}
                    >
                      Rescind
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}


          {/* Admin Actions: Delete Squad */}
          <div className="action-group admin-actions">
            <button className="submit-btn danger-btn delete-btn" onClick={deleteSquad}>
                Delete Squad
            </button>
          </div>
        </div>
      )}

      {/* Non-Admin Action: Leave Squad */}
      {!squad.isAdmin && squad.members.some(m => m.username === currentUsername) && (
        <div className="action-group non-admin-actions">
            <button className="submit-btn danger-btn leave-btn" onClick={leaveSquad}>
                Leave Squad
            </button>
        </div>
      )}
    </div>
  );
};

export default SquadMembersPage;