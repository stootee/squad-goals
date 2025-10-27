// src/pages/SquadGoalSubmissionPage.tsx
import React, { useEffect, useState, useMemo } from "react";
// Mantine Imports
import { 
  Title, 
  Paper, 
  Loader, 
  Alert, 
  Table,
  Center,
  Text,
  Stack, 
  Box,
  Group,
  ActionIcon,
} from '@mantine/core';

// Tabler Icons Imports
import { IconAlertCircle, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

import "@styles/global.css";
import "@styles/SquadGoalSubmissionPage.css"; 

// ====================================================
// Interfaces
// ====================================================

// Defines the structure of a single history cell entry
interface HistoryCell {
    status: 'met' | 'unmet' | 'blank' | string; // Allow string fallback just in case
    value: string | null;
    note: string | null;
}

// Defines the structure of the boundaries object for a single goal
interface GoalBoundaries {
    // boundary_key: HistoryCell
    [boundaryKey: string]: HistoryCell;
}

// Defines the structure of a single Goal group
interface GoalGroupData {
    boundaries: GoalBoundaries;
    goal_id: string;
    goal_name: string;
    partition_type: string;
    start_value: string;
    target?: string;
    target_max?: string;
}

// Defines the structure of the API response payload
interface HistoryPayload {
    groups: GoalGroupData[];
    squad_id: string;
    user_id: string;
    total_pages: number; // CRITICAL: Used for pagination control
}

interface SquadGoalSubmissionPageProps {
  squadId: string;
  // This key forces a remount and state reset when navigating back to the tab
  key?: number; 
}

// ====================================================
// Constants & Utilities
// ====================================================

const MAX_PAGE_SIZE_WIDE = 7;
const MAX_PAGE_SIZE_NARROW = 3;

const getStatusIcon = (status: 'met' | 'unmet' | 'blank' | string) => {
    switch (status) {
        case 'met': return { content: '✅', className: 'status-met' };
        case 'unmet': return { content: '❌', className: 'status-unmet' };
        case 'blank': return { content: '—', className: 'status-blank' };
        default: return { content: '—', className: 'status-blank' };
    }
};

const formatDate = (dateString: string) => {
    try {
        // Handle ISO dates like '2025-02-01T00:00:00'
        if (dateString.includes('T')) {
            return new Date(dateString).toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
        }
        // Handle simple date strings like '2025-02-01'
        if (dateString.includes('-')) {
            const dateParts = dateString.split('-');
            return `${dateParts[1]}/${dateParts[2]}`; // MM/DD
        }
        // Handle integer/counter boundaries
        if (!isNaN(Number(dateString))) {
            return dateString;
        }
        return dateString; // Fallback
    } catch {
        return dateString;
    }
};

// ====================================================
// Component Start
// ====================================================

const SquadGoalSubmissionPage: React.FC<SquadGoalSubmissionPageProps> = ({ squadId }) => {
  const apiURL = window.APP_CONFIG.API_URL;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for fetching and displaying data
  const [historyData, setHistoryData] = useState<HistoryPayload | null>(null);
  
  // Pagination State (Start on the newest page, which is 0)
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Responsive Page Size Calculation
  const pageSize = useMemo(() => {
    // 640px is Mantine's 'sm' breakpoint
    // NOTE: We rely on window.innerWidth outside of a resize listener, 
    // but React's rendering lifecycle is generally fast enough on mount/update.
    return window.innerWidth > 640 ? MAX_PAGE_SIZE_WIDE : MAX_PAGE_SIZE_NARROW;
  }, [window.innerWidth]);


  // ==========================
  // Data Fetching
  // ==========================

  const fetchHistoryData = React.useCallback(async () => {
    if (!apiURL || !squadId) {
        setLoading(false);
        setError("Missing API configuration or Squad ID.");
        return;
    }

    setLoading(true);
    setError(null);
    setHistoryData(null); // Clear old data before fetching new

    // Construct the API URL. We do not include goalGroupId, relying on the backend's
    // optional logic to pick the first group.
    const url = `${apiURL}/squads/${squadId}/goals/history?page=${page}&page_size=${pageSize}`;
    
    console.log("Fetching Goal History URL:", url);

    try {
      const response = await fetch(url, { credentials: "include" });
      const data: HistoryPayload = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP Error: ${response.status}`);
      }
      
      console.log("API History Response Payload:", data);
      
      setHistoryData(data);
      setTotalPages(data.total_pages || 0);

      if (data.groups.length === 0 && data.total_pages === 0) {
        setError("No active goals or history data found for your squad.");
      } else if (data.groups.length === 0) {
        // This case is unlikely if total_pages > 0, but provides a safety net
        setError("History data found, but no goal information was returned.");
      }

    } catch (err: any) {
        console.error("Error fetching goal history:", err);
        setError(`Failed to load history: ${err.message}`);
    } finally {
        setLoading(false);
    }
  }, [apiURL, squadId, page, pageSize]); // Dependencies include page and pageSize

  useEffect(() => {
    fetchHistoryData();
  }, [fetchHistoryData]); // Fetch whenever the dependencies (squadId, page, pageSize) change


  // ==========================
  // Navigation Handlers
  // ==========================

  // Moves to newer history (e.g., page 1 -> page 0)
  const handleNewerHistory = () => {
    setPage(prevPage => Math.max(0, prevPage - 1));
  };

  // Moves to older history (e.g., page 0 -> page 1)
  const handleOlderHistory = () => {
    setPage(prevPage => prevPage + 1);
  };
  
  // Calculate button states
  // Page 0 is the newest (Newer History)
  // totalPages - 1 is the oldest possible page index (Older History)
  const isNewerDisabled = page === 0;
  // If totalPages is 0 (no data), it's disabled. If we are on the last page, it's disabled.
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
      <Paper padding="lg" shadow="md" radius="md" withBorder>
        <Title order={2} mb="md">My Progress History</Title>
        <Alert icon={<IconAlertCircle size={16} />} title="History Unavailable" color="red">
            {error}
        </Alert>
      </Paper>
    );
  }
  
  const goalGroups = historyData?.groups || [];
  
  // Determine the canonical boundaries (column headers) from the first goal
  // Assuming all goals share the same boundaries for a given page/period.
  const canonicalBoundariesKeys: string[] = goalGroups.length > 0 
    ? Object.keys(goalGroups[0].boundaries).sort() 
    : [];

  const headerCells = canonicalBoundariesKeys.map((key) => (
    <Table.Th key={key} className="date-header">{formatDate(key)}</Table.Th>
  ));

  const rows = goalGroups.map((goalData) => (
    <Table.Tr key={goalData.goal_id}>
      {/* 1. Goal Name (Row Header) */}
      <Table.Td className="goal-name-cell">
        <Text weight={500}>{goalData.goal_name}</Text>
        <Text size="xs" color="dimmed" mt={2}>({goalData.partition_type})</Text>
      </Table.Td>

      {/* 2. Entry Cells (Data) */}
      {canonicalBoundariesKeys.map((key) => {
        const cellData = goalData.boundaries[key];
        // Handle case where a specific goal might be missing a boundary key (shouldn't happen if API is consistent)
        const status = cellData ? cellData.status : 'blank';
        const value = cellData ? cellData.value : null;
        const note = cellData ? cellData.note : null;

        const { content, className } = getStatusIcon(status);

        let tooltip = `Status: ${status}`;
        if (value) {
            tooltip += `\nValue: ${value}`;
        }
        if (note && note.trim().length > 0) {
            tooltip += `\nNote: ${note}`;
        }

        return (
          <Table.Td key={key} className="entry-cell" title={tooltip}>
            <span className={`entry-status ${className}`}>
              {content}
            </span>
          </Table.Td>
        );
      })}
    </Table.Tr>
  ));


  return (
    <Paper padding="lg" shadow="xl" radius="lg" withBorder className="goal-submission-card">
      <Title order={1} mb="md">My Progress History</Title>
      
      {/* Navigation Controls */}
      <Group position="apart" mb="md">
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
        
        <Text size="sm" color="dimmed">
          Viewing Period: {page + 1} of {totalPages || 1}
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
      <div className="responsive-table-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}> 
          <Table className="squad-table" verticalSpacing="xs" striped highlightOnHover style={{ minWidth: `${(canonicalBoundariesKeys.length + 1) * 70}px` }}>
              <Table.Thead>
                  <Table.Tr>
                      <Table.Th className="goal-header">Goal Name</Table.Th>
                      {headerCells}
                  </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                  {rows}
              </Table.Tbody>
          </Table>
      </div>

      <Text size="xs" color="dimmed" mt="lg" align="center">
          Displaying {canonicalBoundariesKeys.length} periods of history.
      </Text>
    </Paper>
  );
};

export default SquadGoalSubmissionPage;
