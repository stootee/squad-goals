import React, { useEffect, useState, useMemo } from "react";
import {
  Stack,
  Paper,
  Card,
  Group,
  Box,
  Title,
  Text,
  Loader,
  Center,
  Alert,
  Table,
  ActionIcon,
  Badge,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconChevronDown, IconChevronUp, IconAlertCircle } from "@tabler/icons-react";
import { goalsApi, ApiError } from "@api";

interface Entry {
  goal_id: string;
  value: number;
  date: string;
}

interface UserEntryGroup {
  user_id: string;
  username: string;
  entries: Record<string, Entry[]>; // date -> entries
}

interface Goal {
  id: string;
  name: string;
}

interface SquadGoalsOverviewPageProps {
  squadId: string;
}

function getCurrentWeekMonday(): Date {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  return monday;
}

function getCurrentWeekSunday(monday: Date): Date {
  const date = new Date(monday);
  date.setDate(date.getDate() + 6);
  return date;
}

const SquadGoalsOverviewPage: React.FC<SquadGoalsOverviewPageProps> = ({ squadId }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [userEntries, setUserEntries] = useState<UserEntryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const [startDate, setStartDate] = useState<Date>(getCurrentWeekMonday());
  const [endDate, setEndDate] = useState<Date>(() => getCurrentWeekSunday(getCurrentWeekMonday()));

  const fetchGoals = async () => {
    try {
      const goalsData = await goalsApi.getAll(squadId);
      setGoals(goalsData);
    } catch (err) {
      if (err instanceof ApiError) {
        console.error("Failed to fetch goals:", err.message);
      }
    }
  };

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await goalsApi.getEntriesByDay(squadId, {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      });
      setUserEntries(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load entries");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [squadId]);

  useEffect(() => {
    fetchEntries();
  }, [squadId, startDate, endDate]);

  const getGoalSummary = (user: UserEntryGroup) => {
    const summed: Record<string, number> = {};
    Object.values(user.entries).forEach((dayEntries) => {
      dayEntries.forEach((entry) => {
        summed[entry.goal_id] = (summed[entry.goal_id] || 0) + entry.value;
      });
    });
    return summed;
  };

  const summarizedEntries = useMemo(() => {
    return userEntries
      .map((user) => {
        const summary = getGoalSummary(user);
        const total = Object.values(summary).reduce((acc, val) => acc + val, 0);
        const daysCount = Object.keys(user.entries).length;

        return { ...user, summary, total, daysCount };
      })
      .sort((a, b) => b.total - a.total);
  }, [userEntries]);

  const toggleExpand = (userId: string) => {
    setExpandedUsers((prev) => {
      const updated = new Set(prev);
      updated.has(userId) ? updated.delete(userId) : updated.add(userId);
      return updated;
    });
  };

  const getGoalName = (goalId: string) => {
    return goals.find((g) => g.id === goalId)?.name || `Goal ${goalId}`;
  };

  const renderDesktopUserRows = (user: (typeof summarizedEntries)[0]) => {
    const isExpanded = expandedUsers.has(user.user_id);
    const sortedDates = Object.keys(user.entries).sort();

    return (
      <React.Fragment key={user.user_id}>
        <Table.Tr style={{ cursor: "pointer" }} onClick={() => toggleExpand(user.user_id)}>
          <Table.Td style={{ width: "50px" }}>
            <ActionIcon variant="subtle" size="sm">
              {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </ActionIcon>
          </Table.Td>
          <Table.Td>
            <Text fw={600}>{user.username}</Text>
          </Table.Td>
          {goals.map((goal) => (
            <Table.Td key={goal.id} style={{ textAlign: "center" }}>
              <Text>{user.summary[goal.id] ?? 0}</Text>
            </Table.Td>
          ))}
          <Table.Td style={{ textAlign: "center" }}>
            <Badge size="lg" variant="filled" color="blue">
              {user.total}
            </Badge>
          </Table.Td>
        </Table.Tr>

        {isExpanded &&
          sortedDates.map((date) => (
            <Table.Tr key={date} style={{ backgroundColor: "rgba(0, 0, 0, 0.05)" }}>
              <Table.Td />
              <Table.Td>
                <Text size="sm" c="dimmed" style={{ paddingLeft: "20px" }}>
                  {new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </Text>
              </Table.Td>
              {goals.map((goal) => {
                const dayEntry = user.entries[date].find((e) => e.goal_id === goal.id);
                return (
                  <Table.Td key={goal.id} style={{ textAlign: "center" }}>
                    <Text size="sm" c={dayEntry ? undefined : "dimmed"}>
                      {dayEntry ? dayEntry.value : "-"}
                    </Text>
                  </Table.Td>
                );
              })}
              <Table.Td />
            </Table.Tr>
          ))}
      </React.Fragment>
    );
  };

  const renderMobileUserCard = (user: (typeof summarizedEntries)[0]) => {
    const isExpanded = expandedUsers.has(user.user_id);
    const sortedDates = Object.keys(user.entries).sort();

    return (
      <Card
        key={user.user_id}
        shadow="sm"
        padding="md"
        withBorder
        style={{ cursor: "pointer", marginBottom: "12px" }}
        onClick={() => toggleExpand(user.user_id)}
      >
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600}>{user.username}</Text>
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Days: <strong>{user.daysCount}</strong>
            </Text>
            {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </Group>
        </Group>

        {isExpanded && (
          <Stack gap="md" mt="md">
            <Box>
              <Text size="sm" fw={600} mb="xs">
                Goal Totals (Total Progress: {user.total})
              </Text>
              <Stack gap="xs">
                {Object.entries(user.summary)
                  .filter(([, value]) => value > 0)
                  .map(([goalId, value]) => (
                    <Group key={goalId} justify="space-between">
                      <Text size="sm">{getGoalName(goalId)}</Text>
                      <Badge variant="light" color="green">
                        {value}
                      </Badge>
                    </Group>
                  ))}
              </Stack>
            </Box>

            <Box>
              <Text size="sm" fw={600} mb="xs">
                Daily Entries
              </Text>
              <Stack gap="sm">
                {sortedDates.map((date) => (
                  <Paper key={date} p="xs" withBorder style={{ backgroundColor: "rgba(0, 0, 0, 0.02)" }}>
                    <Text size="sm" fw={600} mb="xs" c="blue">
                      {new Date(date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        weekday: "short",
                      })}
                    </Text>
                    <Stack gap={4}>
                      {goals.map((goal) => {
                        const dayEntry = user.entries[date].find((e) => e.goal_id === goal.id);
                        return (
                          <Group key={goal.id} justify="space-between">
                            <Text size="xs">{goal.name}:</Text>
                            <Text size="xs" c={dayEntry?.value ? "dark" : "dimmed"}>
                              {dayEntry ? dayEntry.value : "-"}
                            </Text>
                          </Group>
                        );
                      })}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          </Stack>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <Center style={{ minHeight: "200px" }}>
        <Loader size="lg" />
      </Center>
    );
  }

  if (error) {
    return (
      <Alert color="red" title="Error" icon={<IconAlertCircle size={16} />}>
        {error}
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Paper shadow="sm" p="lg" withBorder>
        <Title order={2} mb="md">
          Squad Progress Overview
        </Title>

        <Group gap="md" mb="lg">
          <DateInput
            label="Start Date"
            value={startDate}
            onChange={(value) => value && setStartDate(value)}
            clearable={false}
          />
          <DateInput
            label="End Date"
            value={endDate}
            onChange={(value) => value && setEndDate(value)}
            clearable={false}
          />
        </Group>

        {/* Desktop Table View */}
        <Box hiddenFrom="sm">
          <Stack gap="xs">{summarizedEntries.map(renderMobileUserCard)}</Stack>
        </Box>

        {/* Mobile Card View */}
        <Box visibleFrom="sm">
          <Box style={{ overflowX: "auto" }}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: "50px" }} />
                  <Table.Th>User</Table.Th>
                  {goals.map((goal) => (
                    <Table.Th key={goal.id} style={{ textAlign: "center" }}>
                      {goal.name}
                    </Table.Th>
                  ))}
                  <Table.Th style={{ textAlign: "center" }}>Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{summarizedEntries.map(renderDesktopUserRows)}</Table.Tbody>
            </Table>
          </Box>
        </Box>
      </Paper>
    </Stack>
  );
};

export default SquadGoalsOverviewPage;
