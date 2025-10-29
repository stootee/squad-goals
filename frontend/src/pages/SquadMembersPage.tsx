// src/pages/SquadMembersPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Stack,
  Title,
  Text,
  Button,
  TextInput,
  Paper,
  Group,
  Badge,
  Loader,
  Center,
  Alert,
  ActionIcon,
  Box,
  Card,
} from "@mantine/core";
import { IconCrown, IconTrash, IconUserMinus, IconUserPlus, IconX } from "@tabler/icons-react";
import { squadsApi, invitesApi, ApiError, type SquadMember } from "@api";

// ====================================================
// Constants
// ====================================================

const REFRESH_INTERVAL_MS = 30000; 

// ====================================================
// Interfaces
// ====================================================

interface UserProfile {
  username: string;
  configured_name?: string;
}

interface OutboundInvite {
  id: string;
  squad_name: string;
  squad_id: string;
  invited_username: string;
  status: string;
}

interface SquadMembersPageProps {
  squadId: string;
}

// ====================================================
// Component Start
// ====================================================

const SquadMembersPage: React.FC<SquadMembersPageProps> = ({ squadId }) => {
  const navigate = useNavigate();
  const apiURL = window.APP_CONFIG?.API_URL || "/api";

  const [members, setMembers] = useState<SquadMember[]>([]);
  const [squadName, setSquadName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUsername, setCurrentUsername] = useState("");
  
  // PRIMARY LOADING STATE (for initial mount)
  const [loading, setLoading] = useState(true);
  
  // SECONDARY LOADING STATE (for smooth periodic refresh)
  const [isRefreshing, setIsRefreshing] = useState(false); 
  
  const [error, setError] = useState<string | null>(null);

  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState(false);

  const [userProfiles, setUserProfiles] = useState<Map<string, string>>(new Map());
  const [outboundInvites, setOutboundInvites] = useState<OutboundInvite[]>([]);

  // Fetch user profiles (Original logic restored as requested)
  const fetchProfiles = async () => {
    try {
      const res = await fetch(`${apiURL}/squads/${squadId}/members`, {
        credentials: "include",
      });
      if (res.ok) {
        const profiles: UserProfile[] = await res.json();
        const profileMap = new Map<string, string>();
        profiles.forEach((p) => {
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

  // Fetch outbound invites (for admins)
  const fetchOutboundInvites = async () => {
    try {
      const res = await fetch(`${apiURL}/invites?squad_id=${squadId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data: OutboundInvite[] = await res.json();
        setOutboundInvites(data);
      }
    } catch (err) {
      console.error("Failed to fetch outbound invites:", err);
    }
  };

  // Fetch squad data (Modified to accept isInitialLoad flag)
  const fetchSquadData = React.useCallback(async (isInitialLoad: boolean) => {
    try {
      setError(null);
      
      if (isInitialLoad) {
        setLoading(true); // Show full page loader
      } else {
        setIsRefreshing(true); // Show small spinner indicator
      }

      // Fetch current user info
      const userRes = await fetch(`${apiURL}/user_info`, { credentials: "include" });
      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentUsername(userData.username);
      }

      // Fetch squad details
      const squad = await squadsApi.getById(squadId);
      setSquadName(squad.name);
      setAdminUsername(squad.admin);
      setIsAdmin(squad.is_admin);

      // Fetch members
      const membersData = await squadsApi.getMembers(squadId);
      setMembers(membersData);

      // Fetch profiles
      await fetchProfiles();

      // Fetch outbound invites if admin
      if (squad.is_admin) {
        await fetchOutboundInvites();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load squad data");
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false); // Hide full page loader
      } else {
        setIsRefreshing(false); // Hide small spinner indicator
      }
    }
  }, [squadId, apiURL]); // Dependencies added for useCallback stability

  // 1. Initial Data Fetch (on mount/squadId change)
  useEffect(() => {
    fetchSquadData(true); // Pass TRUE for initial load
  }, [fetchSquadData]);

  // 2. Automatic Data Refresh 🔄
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Only refresh if the component isn't fully loading or already refreshing
      if (!loading && !isRefreshing) { 
        fetchSquadData(false); // Pass FALSE for background refresh
      }
    }, REFRESH_INTERVAL_MS);

    // Cleanup function to clear the interval when the component unmounts
    return () => clearInterval(intervalId);

  }, [squadId, loading, isRefreshing, fetchSquadData]); 

  // Handle invite
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;

    try {
      setInviteLoading(true);
      setInviteMessage(null);
      setInviteError(false);

      await invitesApi.send(squadId, inviteUsername.trim());

      setInviteMessage(`Invite sent to ${inviteUsername}!`);
      setInviteUsername("");
      setInviteError(false);

      // Refresh data immediately after a successful invite
      await fetchSquadData(false); // Pass false for a background refresh

      // Clear message after 3 seconds
      setTimeout(() => setInviteMessage(null), 3000);
    } catch (err) {
      setInviteError(true);
      if (err instanceof ApiError) {
        setInviteMessage(err.message);
      } else {
        setInviteMessage("Failed to send invite");
      }
    } finally {
      setInviteLoading(false);
    }
  };

  // Rescind invite
  const rescindInvite = async (inviteId: string, invitedUsername: string) => {
    if (!window.confirm(`Rescind invite sent to @${invitedUsername}?`)) return;

    try {
      const res = await fetch(`${apiURL}/invites/${inviteId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        // Refresh data immediately after a rescind
        await fetchSquadData(false); // Pass false for a background refresh
      }
    } catch (err) {
      console.error("Failed to rescind invite:", err);
    }
  };

  // Remove member
  const removeMember = async (username: string) => {
    if (username === adminUsername) return;
    if (!window.confirm(`Remove ${username} from the squad?`)) return;

    try {
      const res = await fetch(`${apiURL}/squads/${squadId}/remove_member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
      });

      if (res.ok) {
        await fetchSquadData(false); // Pass false for a background refresh
      }
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  };

  // Leave squad
  const leaveSquad = async () => {
    if (!window.confirm(`Leave squad "${squadName}"?`)) return;

    try {
      await squadsApi.leave(squadId);
      navigate("/squads");
    } catch (err) {
      console.error("Failed to leave squad:", err);
    }
  };

  // Delete squad
  const deleteSquad = async () => {
    if (!window.confirm(`Delete squad "${squadName}" permanently? This action cannot be undone.`)) return;

    try {
      await squadsApi.delete(squadId);
      navigate("/squads");
    } catch (err) {
      console.error("Failed to delete squad:", err);
    }
  };

  // Loading state (Only for initial page load)
  if (loading) {
    return (
      <Center style={{ minHeight: "200px" }}>
        <Loader size="lg" />
      </Center>
    );
  }

  // Error state
  if (error) {
    return <Alert color="red" title="Error">{error}</Alert>;
  }

  // Sort members - admin first
  const sortedMembers = [...members].sort((a, b) => {
    if (a.username === adminUsername) return -1;
    if (b.username === adminUsername) return 1;
    return a.username.localeCompare(b.username);
  });

  return (
    <Stack gap="md" maw={800} style={{ margin: '0 auto' }}>
      <Paper shadow="sm" p="lg" withBorder>
        <Stack gap="lg">
          {/* Title Row with subtle loading spinner */}
          <Group gap="sm" align="center">
            <Title order={3}>Squad Members</Title>
            {isRefreshing && <Loader size="sm" />} 
          </Group>

          {/* Members List */}
          {members.length === 0 ? (
            <Text c="dimmed">No members yet.</Text>
          ) : (
            <Stack gap="xs">
              {sortedMembers.map((member) => {
                const isCurrentUser = member.username === currentUsername;
                const isMemberAdmin = member.username === adminUsername;
                const configuredName = userProfiles.get(member.username);
                const displayName = configuredName || member.username;

                return (
                  <Card key={member.username} padding="sm" withBorder>
                    <Group justify="space-between" align="center">
                      <Group gap="sm">
                        <Box>
                          <Text fw={500}>
                            {displayName}
                            {isCurrentUser && " (You)"}
                          </Text>
                          <Text size="sm" c="dimmed">
                            @{member.username}
                          </Text>
                        </Box>
                        {isMemberAdmin && (
                          <Badge color="blue" variant="light">
                            Admin
                          </Badge>
                        )}
                      </Group>

                      {isAdmin && !isMemberAdmin && (
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => removeMember(member.username)}
                          title="Remove member"
                        >
                          <IconUserMinus size={18} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Paper>

      {/* Admin Section */}
      {isAdmin && (
        <>
          {/* Invite Form */}
          <Paper shadow="sm" p="lg" withBorder>
            <Stack gap="md">
              <Title order={4}>Invite a Member</Title>

              <form onSubmit={handleInvite}>
                <Stack gap="sm">
                  <TextInput
                    placeholder="Enter username"
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    required
                    disabled={inviteLoading}
                    leftSection={<IconUserPlus size={16} />}
                  />
                  <Button type="submit" loading={inviteLoading} fullWidth>
                    Send Invite
                  </Button>
                </Stack>
              </form>

              {inviteMessage && (
                <Alert color={inviteError ? "red" : "green"} withCloseButton onClose={() => setInviteMessage(null)}>
                  {inviteMessage}
                </Alert>
              )}
            </Stack>
          </Paper>

          {/* Pending Invites */}
          <Paper shadow="sm" p="lg" withBorder>
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={4}>Pending Invites</Title>
                <Badge>{outboundInvites.length}</Badge>
              </Group>

              {outboundInvites.length === 0 ? (
                <Text c="dimmed" size="sm">
                  No pending invites
                </Text>
              ) : (
                <Stack gap="xs">
                  {outboundInvites.map((invite) => (
                    <Card key={invite.id} padding="sm" withBorder>
                      <Group justify="space-between" align="center">
                        <Box>
                          <Text fw={500}>@{invite.invited_username}</Text>
                          <Badge size="sm" color="yellow" variant="light">
                            Pending
                          </Badge>
                        </Box>

                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => rescindInvite(invite.id, invite.invited_username)}
                          title="Rescind invite"
                        >
                          <IconX size={18} />
                        </ActionIcon>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>

          {/* Admin Actions */}
          <Paper shadow="sm" p="lg" withBorder>
            <Stack gap="md">
              <Title order={4}>Danger Zone</Title>
              <Button
                color="red"
                variant="light"
                fullWidth
                leftSection={<IconTrash size={16} />}
                onClick={deleteSquad}
              >
                Delete Squad
              </Button>
            </Stack>
          </Paper>
        </>
      )}

      {/* Non-Admin Actions */}
      {!isAdmin && (
        <Paper shadow="sm" p="lg" withBorder>
          <Button
            color="red"
            variant="light"
            fullWidth
            leftSection={<IconUserMinus size={16} />}
            onClick={leaveSquad}
          >
            Leave Squad
          </Button>
        </Paper>
      )}
    </Stack>
  );
};

export default SquadMembersPage;