import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@components/AppLayout";
import {
  Container,
  Loader,
  Center,
  Text,
  Alert,
  Button,
  TextInput,
  Card,
  Grid,
  Title,
  Group,
  Badge,
  Stack,
  Collapse,
  Paper,
} from "@mantine/core";
import { squadsApi, invitesApi, Squad, Invite, ApiError } from "@api";

const SquadsPage: React.FC = () => {
  const navigate = useNavigate();

  const [squads, setSquads] = useState<Squad[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [newSquadName, setNewSquadName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Load squads and invites
  const loadInvites = async () => {
    try {
      const data = await invitesApi.getAll();
      setInvites(data);
    } catch (err) {
      if (err instanceof ApiError && err.status !== 401) {
        console.error("Error loading invites:", err);
      }
    }
  };

  const loadSquads = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await squadsApi.getAll();
      setSquads(data);
    } catch (err) {
      if (err instanceof ApiError && err.status !== 401) {
        console.error("Error loading squads:", err);
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Create new squad
  const createSquad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSquadName.trim()) return;

    try {
      setCreateLoading(true);
      await squadsApi.create(newSquadName);
      setNewSquadName("");
      setMenuOpen(false);
      await loadSquads();
    } catch (err) {
      console.error("Error creating squad:", err);
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  // Respond to squad invite
  const respondInvite = async (inviteId: string, response: "accept" | "decline") => {
    try {
      await invitesApi.respond(inviteId, response);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      if (response === "accept") {
        await loadSquads();
      }
    } catch (err) {
      console.error("Error responding to invite:", err);
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  };

  useEffect(() => {
    loadInvites();
    loadSquads();
    const interval = setInterval(loadInvites, 15000);
    return () => clearInterval(interval);
  }, []);

  // Show loading state
  if (loading) {
    return (
      <AppLayout title="Squads">
        <Center style={{ minHeight: '200px' }}>
          <Loader size="lg" />
        </Center>
      </AppLayout>
    );
  }

  // Show error state
  if (error) {
    return (
      <AppLayout title="Squads">
        <Alert color="red" title="Error Loading Squads" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Squads">
      <Container size="xl" px={0}>
        <Stack gap="md">
          {/* Create New Squad Section */}
          <Paper shadow="xs" p="md" withBorder>
            <Button
              onClick={() => setMenuOpen((prev) => !prev)}
              variant={menuOpen ? "light" : "filled"}
              fullWidth
            >
              {menuOpen ? "Cancel" : "Create New Squad"}
            </Button>

            <Collapse in={menuOpen}>
              <form onSubmit={createSquad}>
                <Stack gap="sm" mt="md">
                  <TextInput
                    placeholder="Squad name"
                    value={newSquadName}
                    onChange={(e) => setNewSquadName(e.target.value)}
                    required
                    disabled={createLoading}
                  />
                  <Button type="submit" loading={createLoading}>
                    Create Squad
                  </Button>
                </Stack>
              </form>
            </Collapse>
          </Paper>

          {/* Empty state */}
          {squads.length === 0 && invites.length === 0 && (
            <Center style={{ minHeight: '200px' }}>
              <Stack align="center" gap="sm">
                <Text c="dimmed" size="lg">
                  No squads yet
                </Text>
                <Text c="dimmed" size="sm">
                  Create your first squad to get started!
                </Text>
              </Stack>
            </Center>
          )}

          {/* Content Grid */}
          {(squads.length > 0 || invites.length > 0) && (
            <Grid gutter="md">
              {/* Pending Invites */}
              {invites.map((invite) => (
                <Grid.Col key={invite.id} span={{ base: 12, sm: 6, md: 4 }}>
                  <Card shadow="sm" padding="lg" withBorder>
                    <Stack gap="sm">
                      <Group justify="space-between">
                        <Title order={4}>{invite.squad}</Title>
                        <Badge color="yellow" variant="light">
                          Invite
                        </Badge>
                      </Group>

                      <Text size="sm" c="dimmed">
                        Invited by {invite.invited_by}
                      </Text>

                      {invite.status === "pending" && (
                        <Group grow>
                          <Button
                            color="green"
                            variant="light"
                            onClick={() => respondInvite(invite.id, "accept")}
                          >
                            Accept
                          </Button>
                          <Button
                            color="red"
                            variant="light"
                            onClick={() => respondInvite(invite.id, "decline")}
                          >
                            Decline
                          </Button>
                        </Group>
                      )}
                    </Stack>
                  </Card>
                </Grid.Col>
              ))}

              {/* Squads */}
              {squads.map((squad) => (
                <Grid.Col key={squad.id} span={{ base: 12, sm: 6, md: 4 }}>
                  <Card
                    shadow="sm"
                    padding="lg"
                    withBorder
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/squads/${squad.id}/submit`)}
                  >
                    <Stack gap="sm">
                      <Group justify="space-between">
                        <Title order={4}>{squad.name}</Title>
                        {squad.is_admin && (
                          <Badge color="blue" variant="filled">
                            Admin
                          </Badge>
                        )}
                      </Group>

                      <Text size="sm">
                        <strong>Admin:</strong> {squad.admin}
                      </Text>

                      <Text size="sm">
                        <strong>Members:</strong> {squad.members ?? 1}
                      </Text>
                    </Stack>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
          )}
        </Stack>
      </Container>
    </AppLayout>
  );
};

export default SquadsPage;
