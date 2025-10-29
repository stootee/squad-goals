// src/pages/SquadGoalsHistoryPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  Title,
  Loader,
  Alert,
  Table,
  Center,
  Text,
  Group,
  ActionIcon,
  Box,
} from "@mantine/core";
import { IconAlertCircle, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { goalsApi, ApiError } from "@api";

// ====================================================
// Interfaces
// ====================================================

interface HistoryCell {
  status: "met" | "unmet" | "blank" | string;
  value: string | null;
  note: string | null;
}

interface GoalBoundaries {
  [boundaryKey: string]: HistoryCell;
}

interface GoalGroupData {
  boundaries: GoalBoundaries;
  goal_id: string;
  goal_name: string;
  goal_type: string;
  partition_type: string;
  start_value: string;
  target?: string;
  target_max?: string;
}

interface HistoryPayload {
  groups: GoalGroupData[];
  squad_id: string;
  user_id: string;
  total_pages: number;
}

interface SquadGoalsHistoryPageProps {
  squadId: string;
  key?: number;
}

// ====================================================
// Constants & Utilities
// ====================================================

const MAX_PAGE_SIZE_WIDE = 7;
const MAX_PAGE_SIZE_NARROW = 3;

const getStatusIcon = (status: "met" | "unmet" | "blank" | string) => {
  switch (status) {
    case "met":
      return { content: "✅", color: "green" };
    case "unmet":
      return { content: "❌", color: "red" };
    case "blank":
      return { content: "—", color: "dimmed" };
    default:
      return { content: "—", color: "dimmed" };
  }
};

const formatDate = (dateString: string) => {
  try {
    if (dateString.includes("T")) {
      return new Date(dateString).toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
    }
    if (dateString.includes("-")) {
      const dateParts = dateString.split("-");
      return `${dateParts[1]}/${dateParts[2]}`;
    }
    if (!isNaN(Number(dateString))) {
      return dateString;
    }
    return dateString;
  } catch {
    return dateString;
  }
};

// ====================================================
// Component Start
// ====================================================

const SquadGoalsHistoryPage: React.FC<SquadGoalsHistoryPageProps> = ({ squadId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<HistoryPayload | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // 1. useMemo for Page Size
  const pageSize = useMemo(() => {
    if (typeof window === 'undefined') return MAX_PAGE_SIZE_WIDE;
    return window.innerWidth > 640 ? MAX_PAGE_SIZE_WIDE : MAX_PAGE_SIZE_NARROW;
  }, []);

  // 2. Logic and useMemo for Canonical Keys
  const goalGroups = historyData?.groups || [];

  const canonicalBoundariesKeys: string[] = useMemo(() => {
    if (goalGroups.length === 0) {
      return [];
    }

    const keys = Object.keys(goalGroups[0].boundaries);
    
    const isCounter = keys.length > 0 && !keys[0].includes('-') && !isNaN(Number(keys[0]));

    return keys.sort((a, b) => {
      if (isCounter) {
        return Number(a) - Number(b);
      } else {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      }
    });
  }, [goalGroups]);

  // 3. useCallback for Data Fetching (FIX APPLIED HERE)
  const fetchHistoryData = React.useCallback(async () => {
    if (!squadId) {
      setLoading(false);
      setError("Missing Squad ID.");
      return;
    }

    setLoading(true);
    setError(null);
    setHistoryData(null);

    try {
      const data: HistoryPayload = await goalsApi.getHistory(squadId, {
        page,
        pageSize,
      });

      setHistoryData(data);
      setTotalPages(data.total_pages || 0);

      if (data.groups.length === 0 && data.total_pages === 0) {
        setError("No active goals or history data found for your squad.");
      } else if (data.groups.length === 0) {
        setError("History data found, but no goal information was returned.");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load history");
      }
    } finally {
      setLoading(false);
    }
  }, [squadId, page]); // Removed pageSize from dependencies

  // 4. useEffect to trigger fetch
  useEffect(() => {
    fetchHistoryData();
  }, [fetchHistoryData]);

  // ==========================
  // Navigation Handlers
  // ==========================

  const handleNewerHistory = () => {
    setPage((prevPage) => Math.max(0, prevPage - 1));
  };

  const handleOlderHistory = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const isNewerDisabled = page === 0;
  const isOlderDisabled = totalPages === 0 || page >= totalPages - 1;

  // ==========================
  // Main Render
  // ==========================

  if (loading) {
    return (
      <Center style={{ height: 200 }}>
        <Loader size="xl" />
      </Center>
    );
  }

  if (error) {
    return (
      <>
        <Title order={2} mb="md">
          My Progress History
        </Title>
        <Alert icon={<IconAlertCircle size={16} />} title="History Unavailable" color="red">
          {error}
        </Alert>
      </>
    );
  }
  
  const headerCells = canonicalBoundariesKeys.map((key) => (
    <Table.Th key={key} style={{ textAlign: "center", whiteSpace: "nowrap" }}>
      {formatDate(key)}
    </Table.Th>
  ));

  const rows = goalGroups.map((goalData) => (
    <Table.Tr key={goalData.goal_id}>
      <Table.Td style={{ minWidth: "120px", whiteSpace: "nowrap" }}>
        <Text fw={500} size="sm">
          {goalData.goal_name}
        </Text>
      </Table.Td>

      {canonicalBoundariesKeys.map((key) => {
        const cellData = goalData.boundaries[key];
        const status = cellData ? cellData.status : "blank";
        const value = cellData ? cellData.value : null;
        const note = cellData ? cellData.note : null;

        const { content, color } = getStatusIcon(status);

        let tooltip = `Status: ${status}`;
        if (value) {
          tooltip += `\nValue: ${value}`;
        }
        if (note && note.trim().length > 0) {
          tooltip += `\nNote: ${note}`;
        }

        let displayContent: React.ReactNode;
        let displayColor = color;

        if (goalData.goal_type === 'count' && value !== null && value.trim() !== "") {
          // If goal is 'count' and has a value, display the value
          displayContent = value;
          // Use a dark color for the number itself
          displayColor = 'grey'; 
        } else {
          // Otherwise, display the status icon (✅/❌/—)
          displayContent = content;
        }

        return (
          <Table.Td key={key} style={{ textAlign: "center" }} title={tooltip}>
            <Text c={displayColor} size="lg" fw={500}> 
              {displayContent}
            </Text>
          </Table.Td>
        );
        // --- END MODIFIED LOGIC ---
      })}
    </Table.Tr>
  ));

  return (
    <>
      <Title order={1} mb="md">
        My Progress History
      </Title>

      {/* Navigation Controls */}
      <Group justify="space-between" mb="md">
        <ActionIcon
          size="lg"
          variant="filled"
          color="dark"
          onClick={handleOlderHistory}
          disabled={isOlderDisabled}
          aria-label="Load Older History"
          title={`Load period older than current (Page ${page + 1} of ${totalPages})`}
        >
          <IconChevronLeft size={20} />
        </ActionIcon>

        <Text size="sm" c="dimmed">
          Page: {totalPages - page} of {totalPages || 1}
        </Text>

        <ActionIcon
          size="lg"
          variant="filled"
          color="dark"
          onClick={handleNewerHistory}
          disabled={isNewerDisabled}
          aria-label="Load Newer History"
          title={`Load period newer than current (Page ${page + 1} of ${totalPages})`}
        >
          <IconChevronRight size={20} />
        </ActionIcon>
      </Group>

      {/* Goal History Table */}
      <Box style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <Table
          striped
          highlightOnHover
          verticalSpacing="xs"
          style={{ minWidth: `${(canonicalBoundariesKeys.length + 1) * 70}px` }}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ textAlign: "left" }}>Goal Name</Table.Th>
              {headerCells}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      </Box>
    </>
  );
};

export default SquadGoalsHistoryPage;