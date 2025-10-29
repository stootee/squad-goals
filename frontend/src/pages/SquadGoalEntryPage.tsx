import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Stack, Title, Text, Paper, Box, Alert, Loader, Center } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { goalsApi, ApiError, Goal } from "@api";
import BoundaryNavigator, { PartitionContext } from "@components/BoundaryNavigator";
import GoalInputRow from "@components/GoalInputRow";

// ====================================================
// Interfaces
// ====================================================
interface Entry {
  goal_id: string;
  value: string | null;
  note: string | null;
}

interface GoalEntryState {
  value: string;
  note: string;
}

interface SquadGoalEntryPageProps {
  squadId: string;
}

// ====================================================
// Main Component
// ====================================================
const SquadGoalEntryPage: React.FC<SquadGoalEntryPageProps> = ({ squadId }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [entriesState, setEntriesState] = useState<{ [goalId: string]: GoalEntryState }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentBoundary, setCurrentBoundary] = useState<string | number | null>(null);

  // Debounce timer reference
  const saveTimerRef = useRef<number | null>(null);
  const DEBOUNCE_DELAY = 1000; // Wait 1 second after user stops typing

  const isBooleanType = (type: string) => ["boolean", "achieved"].includes(type.toLowerCase());

  // ==========================
  // Partition Context Derivation
  // ==========================
  const partitionContext: PartitionContext = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const defaultContext: PartitionContext = {
      type: "Daily",
      label: "Daily Entry",
      start: today,
      end: "2099-12-31",
      isCounter: false,
      groupName: "Default",
    };

    if (goals.length === 0) return defaultContext;

    const g = goals[0];
    const isCounter = g.partition_type === "CustomCounter";
    const isTimeBased = ["PerMinute", "PerHour"].includes(g.partition_type);

    let startValue: string | number;
    let endValue: string | number | null;

    if (isCounter) {
      startValue = g.start_date ? parseInt(g.start_date, 10) : 0;
      endValue = g.end_date ? parseInt(g.end_date, 10) : null;

      if (isNaN(startValue as number)) startValue = 0;
      if (endValue !== null && isNaN(endValue as number)) endValue = null;
    } else {
      // For time-based partitions, cap end date at today
      const today = new Date();

      if (isTimeBased) {
        startValue = g.start_date || today.toISOString();
        const configuredEnd = g.end_date ? new Date(g.end_date) : new Date("2099-12-31T23:59:59.000Z");
        // Use the earlier of: configured end date or today
        endValue = (configuredEnd < today ? configuredEnd : today).toISOString();
      } else {
        const todayStr = today.toISOString().split("T")[0];
        startValue = g.start_date ? g.start_date.split("T")[0] : todayStr;
        const configuredEnd = g.end_date ? g.end_date.split("T")[0] : "2099-12-31";
        // Use the earlier of: configured end date or today
        endValue = configuredEnd < todayStr ? configuredEnd : todayStr;
      }
    }

    return {
      type: g.partition_type,
      label: g.partition_label || g.partition_type,
      start: startValue,
      end: endValue,
      isCounter,
      groupName: g.group_name,
    };
  }, [goals]);

  // ==========================
  // Boundary Validation
  // ==========================
  const isBoundaryValid = useMemo(() => {
    if (currentBoundary === null) return false;

    const { isCounter, start, end } = partitionContext;

    const current = isCounter ? Number(currentBoundary) : (currentBoundary as string);
    const startValue = isCounter ? Number(start) : (start as string);

    if (current < startValue) {
      return false;
    }

    if (end !== null && end !== undefined) {
      const endValue = isCounter ? Number(end) : (end as string);
      if (current > endValue) {
        return false;
      }
    }

    return true;
  }, [currentBoundary, partitionContext]);

  const calculateBoundaries = useCallback((context: PartitionContext): (string | number)[] => {
    if (context.isCounter || typeof context.start !== "string") return [];

    const boundaries: (string | number)[] = [];
    const { start, end, type } = context;

    let current = new Date(start);
    const endDate = new Date(end as string);
    const now = new Date();

    const isTimeBased = ["PerMinute", "PerHour"].includes(type);

    const getFormattedBoundary = (date: Date): string => {
      if (isTimeBased) {
        return date.toISOString();
      }
      return date.toISOString().split("T")[0];
    };

    while (current <= endDate && current <= now) {
      const boundaryStr = getFormattedBoundary(current);
      boundaries.push(boundaryStr);

      const next = new Date(current);

      switch (type) {
        case "Weekly":
          next.setDate(next.getDate() + 7);
          break;
        case "Monthly":
          next.setMonth(next.getMonth() + 1);
          break;
        case "Yearly":
          next.setFullYear(next.getFullYear() + 1);
          break;
        case "BiWeekly":
          next.setDate(next.getDate() + 14);
          break;
        case "Daily":
        default:
          next.setDate(next.getDate() + 1);
          break;
      }

      if (next.getTime() === current.getTime()) {
        console.error("Boundary calculation stopped: Date is not advancing.");
        break;
      }

      current = next;
    }

    return boundaries;
  }, []);

  // Initialize current boundary
  useEffect(() => {
    if (currentBoundary === null && goals.length > 0) {
      const { isCounter, start } = partitionContext;

      if (isCounter) {
        setCurrentBoundary(start as number);
      } else {
        const validBoundaries = calculateBoundaries(partitionContext);

        if (validBoundaries.length > 0) {
          const mostRecentBoundary = validBoundaries[validBoundaries.length - 1];
          setCurrentBoundary(mostRecentBoundary);
          return;
        }

        const fallbackBoundary = start as string;
        setCurrentBoundary(fallbackBoundary);
      }
    }
  }, [currentBoundary, goals, partitionContext, calculateBoundaries]);

  // ==========================
  // Save Handler (with proper useCallback)
  // ==========================
  const handleSave = useCallback(
    async (currentEntries: { [goalId: string]: GoalEntryState }) => {
      if (isSaving || currentBoundary === null) return;

      if (!isBoundaryValid) {
        setMessage(
          `Cannot save entry. The current boundary (${currentBoundary}) is outside the configured goal group range.`
        );
        setTimeout(() => setMessage(null), 5000);
        return;
      }

      setIsSaving(true);
      setMessage("Saving entries...");

      try {
        const payloadEntries: { [goalId: string]: { value: string | null; note: string | null } } = {};

        goals.forEach((goal) => {
          if (!goal.id) return; // Skip goals without an id

          const state = currentEntries[goal.id];
          if (!state) return;

          let valueToSend: string | null = null;
          let noteToSend: string | null = state.note.trim() === "" ? null : state.note.trim();

          if (isBooleanType(goal.type)) {
            valueToSend = state.value;
          } else if (state.value.trim() !== "") {
            valueToSend = state.value.trim();
          } else {
            valueToSend = null;
          }

          if (valueToSend !== null || noteToSend !== null) {
            payloadEntries[goal.id] = {
              value: valueToSend,
              note: noteToSend,
            };
          }
        });

        const payload = {
          date: currentBoundary,
          entries: payloadEntries,
        };

        await goalsApi.submitEntry(squadId, payload);

        setMessage("Entries saved ✅");
      } catch (error) {
        if (error instanceof ApiError) {
          setMessage(`Error saving entries: ${error.message}`);
        } else {
          setMessage("Error saving entries");
        }
        console.error(error);
      } finally {
        setIsSaving(false);
        setTimeout(() => setMessage(null), 3000);
      }
    },
    [squadId, currentBoundary, goals, isSaving, isBoundaryValid]
  );

  // ==========================
  // Fetch Goals
  // ==========================
  useEffect(() => {
    const fetchGoals = async () => {
      try {
        const data = await goalsApi.getAll(squadId);
        setGoals(data);
      } catch (err) {
        if (err instanceof ApiError) {
          setMessage(err.message);
        } else {
          setMessage("Error loading goals");
        }
      }
    };
    fetchGoals();
  }, [squadId]);

  // ==========================
  // Fetch Entries for Current Boundary
  // ==========================
  useEffect(() => {
    if (goals.length === 0 || currentBoundary === null) return;

    const fetchEntries = async () => {
      setLoading(true);
      setEntriesState({});

      try {
        const entriesData = await goalsApi.getEntry(squadId, currentBoundary.toString());

        const prefilledState: { [goalId: string]: GoalEntryState } = {};

        goals.forEach((goal) => {
          if (!goal.id) return; // Skip goals without an id

          const entry = entriesData.find((e: Entry) => e.goal_id === goal.id);

          let initialValue = "";
          if (isBooleanType(goal.type) && entry?.value !== "True") {
            initialValue = "False";
          }

          const value =
            entry?.value !== undefined && entry?.value !== null ? entry.value.toString() : initialValue;

          const note = entry?.note !== undefined && entry?.note !== null ? entry.note.toString() : "";

          prefilledState[goal.id] = { value, note };
        });

        setEntriesState(prefilledState);
        setMessage(null);
      } catch (err) {
        if (err instanceof ApiError) {
          console.error(`Failed to fetch entries for ${currentBoundary}:`, err.message);
          setMessage("Error fetching entries for this boundary");
        }
        setEntriesState({});
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [currentBoundary, goals, squadId]);

  // ==========================
  // Input Change Handlers (with debouncing)
  // ==========================
  const handleValueChange = useCallback(
    (goalId: string, val: string) => {
      if (!isBoundaryValid) return;

      setEntriesState((prev) => {
        const newState = {
          ...prev,
          [goalId]: {
            ...prev[goalId],
            value: val,
          },
        };

        // Clear existing timer
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
        }

        // Set new debounced save
        saveTimerRef.current = setTimeout(() => {
          handleSave(newState);
          saveTimerRef.current = null;
        }, DEBOUNCE_DELAY);

        return newState;
      });
    },
    [isBoundaryValid, handleSave]
  );

  const handleNoteChange = useCallback(
    (goalId: string, val: string) => {
      if (!isBoundaryValid) return;

      setEntriesState((prev) => {
        const newState = {
          ...prev,
          [goalId]: {
            ...prev[goalId],
            note: val,
          },
        };

        // Clear existing timer
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
        }

        // Set new debounced save
        saveTimerRef.current = setTimeout(() => {
          handleSave(newState);
          saveTimerRef.current = null;
        }, DEBOUNCE_DELAY);

        return newState;
      });
    },
    [isBoundaryValid, handleSave]
  );

  const handleCheckboxChange = useCallback(
    (goalId: string, isChecked: boolean) => {
      setEntriesState((prev) => {
        const newState = {
          ...prev,
          [goalId]: {
            ...prev[goalId],
            value: isChecked ? "True" : "False",
          },
        };
        // Save immediately for checkboxes
        handleSave(newState);
        return newState;
      });
    },
    [handleSave]
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // ==========================
  // Boundary Navigation
  // ==========================
  const changeBoundary = useCallback(
    (delta: number) => {
      if (currentBoundary === null) return;
      const { isCounter, start, end, type } = partitionContext;

      if (isCounter) {
        const currentNum = Number(currentBoundary);
        const startNum = Number(start);
        const endNum = end !== null ? Number(end) : null;

        const newBoundary = currentNum + delta;

        if (newBoundary >= startNum && (endNum === null || newBoundary <= endNum)) {
          setCurrentBoundary(newBoundary);
        }
      } else {
        const currentStr = currentBoundary as string;
        const startStr = start as string;
        const endStr = end as string;

        const parts = currentStr.split("-");
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);

        const d = new Date(Date.UTC(year, month, day));
        const newDate = new Date(d);

        switch (type) {
          case "Weekly":
            newDate.setUTCDate(newDate.getUTCDate() + delta * 7);
            break;
          case "Monthly":
            newDate.setUTCMonth(newDate.getUTCMonth() + delta);
            break;
          case "Yearly":
            newDate.setUTCFullYear(newDate.getUTCFullYear() + delta);
            break;
          case "BiWeekly":
            newDate.setUTCDate(newDate.getUTCDate() + delta * 14);
            break;
          case "Daily":
          default:
            newDate.setUTCDate(newDate.getUTCDate() + delta);
            break;
        }

        const isTimeBased = ["PerMinute", "PerHour"].includes(type);
        let newBoundaryStr: string;

        if (isTimeBased) {
          newBoundaryStr = newDate.toISOString();
        } else {
          newBoundaryStr = newDate.toISOString().split("T")[0];
        }

        if (newBoundaryStr < startStr) {
          if (currentBoundary !== startStr) {
            setCurrentBoundary(startStr);
          }
        } else if (newBoundaryStr <= endStr) {
          setCurrentBoundary(newBoundaryStr);
        }
      }
    },
    [currentBoundary, partitionContext]
  );

  // ==========================
  // Main Render
  // ==========================
  if (loading || currentBoundary === null) {
    return (
      <Center style={{ minHeight: 200 }}>
        <Loader size="xl" />
      </Center>
    );
  }

  return (
    <Box style={{ maxWidth: 600, margin: "0 auto", padding: "20px" }}>
      <Stack gap="md">
        <Title order={1}>{partitionContext.groupName} Entries</Title>

        <BoundaryNavigator
          currentBoundary={currentBoundary}
          changeBoundary={changeBoundary}
          partitionContext={partitionContext}
        />

        {!isBoundaryValid && (
          <Alert color="red" title="Boundary Out of Range" icon={<IconAlertCircle size={16} />}>
            This boundary ({currentBoundary}) is outside the group's configured range. Entries cannot be saved
            here.
          </Alert>
        )}

        {goals.length === 0 && (
          <Paper p="md" withBorder>
            <Text c="dimmed" ta="center">
              No goals configured for this squad group.
            </Text>
          </Paper>
        )}

        {/* Goal Input List */}
        {goals.map((goal) => {
          if (!goal.id) return null; // Skip goals without an id

          return (
            <GoalInputRow
              key={goal.id}
              goal={goal}
              currentState={entriesState[goal.id] || { value: "", note: "" }}
              isDisabled={!isBoundaryValid}
              onValueChange={handleValueChange}
              onNoteChange={handleNoteChange}
              onCheckboxChange={handleCheckboxChange}
            />
          );
        })}

        {message && (
          <Alert
            color={message.includes("✅") ? "green" : message.includes("Saving") ? "blue" : "red"}
            title={message.includes("✅") ? "Success" : message.includes("Saving") ? "Saving" : "Error"}
          >
            {message}
          </Alert>
        )}
      </Stack>
    </Box>
  );
};

export default SquadGoalEntryPage;
