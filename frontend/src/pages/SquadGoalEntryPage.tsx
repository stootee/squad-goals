// src/pages/SquadGoalEntryPage.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
// Import Mantine Components
import { Box, Stack, Group, Title, Text, Button, Paper, Checkbox, useMantineTheme } from "@mantine/core";

// ⬇️ IMPORT THE EXTERNAL COMPONENT AND ITS TYPES ⬇️
import BoundaryNavigator, { PartitionContext } from "../components/BoundaryNavigator"; 

// The style imports below caused compilation errors due to unresolved path aliases. 
// They have been removed to allow the application to run.
import "@styles/global.css"; 
import "@styles/SquadGoalEntryPage.css"; 

// ====================================================
// Interfaces (Kept interfaces needed locally)
// ====================================================
interface Goal {
  id: string;
  name: string;
  type: string;
  target?: string;
  target_max?: string;
  
  group_name: string;
  partition_type: string;
  partition_label: string | null;
  start_date: string; 
  end_date: string;   
}

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
  
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  const navigate = useNavigate();
  const apiURL = window.APP_CONFIG?.API_URL; 
  const theme = useMantineTheme(); 
  
  const apiDependencies = [squadId, apiURL];
  
  const isBooleanType = (type: string) => ['boolean', 'achieved'].includes(type.toLowerCase());


  // ==========================
  // Partition Context Derivation 
  // ==========================
  const partitionContext: PartitionContext = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const defaultContext: PartitionContext = { 
      type: 'Daily', 
      label: 'Daily Entry', 
      start: today, 
      end: '2099-12-31', 
      isCounter: false,
      groupName: 'Default'
    };
    
    if (goals.length === 0) return defaultContext;

    const g = goals[0];
    const isCounter = g.partition_type === 'CustomCounter';
    const isTimeBased = ['PerMinute', 'PerHour'].includes(g.partition_type);

    let startValue: string | number;
    let endValue: string | number | null;
    
    if (isCounter) {
        startValue = g.start_date ? parseInt(g.start_date, 10) : 0; 
        endValue = g.end_date ? parseInt(g.end_date, 10) : null;

        if (isNaN(startValue as number)) startValue = 0;
        if (endValue !== null && isNaN(endValue as number)) endValue = null;

    } else {
        if (isTimeBased) {
             startValue = g.start_date || new Date().toISOString(); 
             endValue = g.end_date || '2099-12-31T23:59:59.000Z';
        } else {
            startValue = g.start_date ? g.start_date.split('T')[0] : new Date().toISOString().split('T')[0];
            endValue = g.end_date ? g.end_date.split('T')[0] : '2099-12-31';
        }
    }
    
    return {
      type: g.partition_type,
      label: g.partition_label || g.partition_type,
      start: startValue,
      end: endValue,
      isCounter,
      groupName: g.group_name
    };
  }, [goals]);

  // ==========================
  // Logic Functions
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
      if (context.isCounter || typeof context.start !== 'string') return [];
      
      const boundaries: (string | number)[] = [];
      const { start, end, type } = context;
      
      // Use local date methods here for initialization/current check as it's easier,
      // but the API calls rely on the consistency established by the currentBoundary
      let current = new Date(start); 
      const endDate = new Date(end as string);
      const now = new Date();
      
      const isTimeBased = ['PerMinute', 'PerHour'].includes(type);
  
      const getFormattedBoundary = (date: Date): string => {
          if (isTimeBased) {
              return date.toISOString();
          }
          return date.toISOString().split('T')[0]; 
      };
      
      while (current <= endDate && current <= now) {
          
          const boundaryStr = getFormattedBoundary(current);
          boundaries.push(boundaryStr);
          
          const next = new Date(current);
  
          switch (type) {
              case 'Weekly':
                  next.setDate(next.getDate() + 7);
                  break;
              case 'Monthly':
                  next.setMonth(next.getMonth() + 1);
                  break;
              case 'Yearly':
                  next.setFullYear(next.getFullYear() + 1);
                  break;
              case 'BiWeekly':
                    next.setDate(next.getDate() + 14);
                    break;
              case 'Daily':
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
  }, [partitionContext]);

  useEffect(() => {
    if (currentBoundary === null && goals.length > 0) {
      const { isCounter, start, end } = partitionContext;

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


  const handleSave = useCallback(async (currentEntries: { [goalId: string]: GoalEntryState }) => {
    if (isSaving || !apiURL || currentBoundary === null) return;

    if (!isBoundaryValid) {
        setMessage(`Cannot save entry. The current boundary (${currentBoundary}) is outside the configured goal group range.`);
        setTimeout(() => setMessage(null), 5000);
        return; 
    }

    setIsSaving(true);
    setMessage("Saving entries...");

    try {
      const payloadEntries: { [goalId: string]: { value: string | null, note: string | null } } = {};
      
      goals.forEach(goal => {
          const state = currentEntries[goal.id];
          if (!state) return;

          let valueToSend: string | null = null;
          let noteToSend: string | null = state.note.trim() === '' ? null : state.note.trim(); 

          if (isBooleanType(goal.type)) {
              valueToSend = state.value; 
          } else if (state.value.trim() !== '') {
              valueToSend = state.value.trim();
          } else {
              valueToSend = null;
          }

          if (valueToSend !== null || noteToSend !== null) {
              payloadEntries[goal.id] = { 
                  value: valueToSend, 
                  note: noteToSend 
              };
          }
      });
      
      const payload = {
          date: currentBoundary, 
          entries: payloadEntries 
      };

      const res = await fetch(`${apiURL}/squads/${squadId}/goals/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload), 
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Save failed: ${errorText}`);
      }
      
      setMessage("Entries saved ✅");
    } catch (error: any) {
      console.error(error);
      setMessage(`Error saving entries: ${error.message || 'Check console.'}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000); 
    }
  }, [apiURL, squadId, currentBoundary, goals, isSaving, isBoundaryValid]);


  useEffect(() => {
    if (!apiURL) return;
    const fetchGoals = async () => {
      try {
        const res = await fetch(`${apiURL}/squads/${squadId}/goals`, { credentials: "include" });
        const data: Goal[] = await res.json();
        setGoals(data);
      } catch {
        setMessage("Error loading goals");
      }
    };
    fetchGoals();
  }, apiDependencies);

  useEffect(() => {
    if (goals.length === 0 || !apiURL || currentBoundary === null) return;

    const fetchEntries = async () => {
      setLoading(true);
      setEntriesState({}); 
      setOpenNoteId(null); 
      
      // The currentBoundary is the date string the backend expects, which is now 
      // guaranteed to be the correct YYYY-MM-DD from the UTC arithmetic below.
      const url = `${apiURL}/squads/${squadId}/goals/entry?date=${currentBoundary}`;
      
      try {
        const res = await fetch(url, {
          credentials: "include",
        });
        
        if (res.ok) {
            const entriesData: Entry[] = await res.json();
            
            const prefilledState: { [goalId: string]: GoalEntryState } = {};
            
            goals.forEach((goal) => {
              const entry = entriesData.find((e) => e.goal_id === goal.id);
              
              let initialValue = "";
              if (isBooleanType(goal.type) && entry?.value !== 'True') {
                  initialValue = 'False';
              }
              
              const value = (entry?.value !== undefined && entry?.value !== null) 
                            ? entry.value.toString() 
                            : initialValue;
                            
              const note = (entry?.note !== undefined && entry?.note !== null) 
                           ? entry.note.toString() 
                           : "";

              prefilledState[goal.id] = { value, note };
            });
            
            setEntriesState(prefilledState);
            setMessage(null);

        } else {
            const errorText = await res.text();
            console.error(`[API ERROR] Failed to fetch entries for ${currentBoundary}. Status: ${res.status}. Response: ${errorText}`);
            setEntriesState({}); 
            setMessage("Error fetching entries for this boundary");
        }
      } catch (err) {
        console.error(err);
        setMessage("Error fetching entries for this boundary");
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [currentBoundary, goals, ...apiDependencies]); 

  const handleChange = (goalId: string, field: keyof GoalEntryState, val: string) => {
    if (!isBoundaryValid) return; 

    setEntriesState((prev) => {
        const newState = {
            ...prev,
            [goalId]: {
                ...prev[goalId],
                [field]: val,
            },
        };
        
        // This is where you trigger the save after a change
        handleSave(newState);
        
        return newState;
    });
  };
  
  const handleCheckboxChange = (goalId: string, isChecked: boolean) => {
      handleChange(goalId, 'value', isChecked ? 'True' : 'False');
  };
  
  const toggleNote = (goalId: string) => {
      if (!isBoundaryValid) return; 
      setOpenNoteId(prevId => prevId === goalId ? null : goalId);
  };

  /**
   * FIX: Uses UTC logic for date arithmetic and ensures the boundary is capped at the start date.
   */
  const changeBoundary = useCallback((delta: number) => {
    if (currentBoundary === null) return;
    const { isCounter, start, end, type } = partitionContext;

    if (isCounter) {
      // Counter logic remains unchanged
      const currentNum = Number(currentBoundary);
      const startNum = Number(start);
      const endNum = end !== null ? Number(end) : null;
      
      const newBoundary = currentNum + delta;

      if (newBoundary >= startNum && (endNum === null || newBoundary <= endNum)) {
        setCurrentBoundary(newBoundary);
      } else {
        console.warn(`[NAVIGATION] Attempted to navigate to counter ${newBoundary}, which is outside the range [${startNum}, ${endNum}].`);
      }
    } else {
      const currentStr = currentBoundary as string;
      const startStr = start as string;
      const endStr = end as string; 
      
      // --- FIX 1: Create Date object using UTC components ---
      const parts = currentStr.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-indexed month
      const day = parseInt(parts[2], 10);
      
      // Initialize Date object using Date.UTC() to treat YYYY-MM-DD as calendar date
      const d = new Date(Date.UTC(year, month, day)); 
      const newDate = new Date(d);
      // -----------------------------------------------------
      
      const isTimeBased = ['PerMinute', 'PerHour'].includes(type);
      
      // --- FIX 2: Use UTC methods for all date arithmetic ---
      switch (type) {
        case 'Weekly':
          newDate.setUTCDate(newDate.getUTCDate() + delta * 7);
          break;
        case 'Monthly':
          newDate.setUTCMonth(newDate.getUTCMonth() + delta);
          break;
        case 'Yearly':
          newDate.setUTCFullYear(newDate.getUTCFullYear() + delta);
          break;
        case 'BiWeekly':
          newDate.setUTCDate(newDate.getUTCDate() + delta * 14);
          break;
        case 'Daily':
        default:
          newDate.setUTCDate(newDate.getUTCDate() + delta);
          break;
      }
      // -----------------------------------------------------
      
      let newBoundaryStr: string;

      if (isTimeBased) {
        // Time-based uses the full ISO string
        newBoundaryStr = newDate.toISOString();
      } else {
        // Date-based uses the YYYY-MM-DD part, which is now correctly preserved by UTC arithmetic
        newBoundaryStr = newDate.toISOString().split("T")[0];
      }
      
      // --- FIX 3: Boundary Validation Logic (Recap for preventing overshoot) ---
      if (newBoundaryStr < startStr) {
          // If the calculated boundary is less than the goal's start, cap it at the start date.
          if (currentBoundary !== startStr) {
              setCurrentBoundary(startStr);
          }
      } else if (newBoundaryStr <= endStr) {
        // Only set the boundary if it is valid (within the start/end range)
        setCurrentBoundary(newBoundaryStr);
      } else {
        console.warn(`[NAVIGATION] Attempted to navigate to boundary ${newBoundaryStr}, which is outside the range [${startStr}, ${endStr}].`);
      }
      // -----------------------------------------------------------------------
    }
  }, [currentBoundary, partitionContext]);
  
  // ==========================
  // Render Helpers 
  // ==========================
  const renderGoalInput = (goal: Goal) => {
    const currentState = entriesState[goal.id] || { value: '', note: '' };
    const goalType = goal.type.toLowerCase();
    
    const hasNoteContent = currentState.note.trim().length > 0;
    const isNoteOpen = openNoteId === goal.id || hasNoteContent;
    
    const isDisabled = !isBoundaryValid;
    
    let inputField;
    let targetLabel = '';

    // 1. Determine Input Type and Target Label
    if (isBooleanType(goalType)) {
        targetLabel = 'Achieved';

        inputField = (
            <Checkbox
                checked={currentState.value === 'True'}
                onChange={(e) => handleCheckboxChange(goal.id, e.target.checked)}
                disabled={isDisabled}
                size="md"
                label="Did I achieve this?"
                styles={{ label: { fontSize: theme.fontSizes.sm, fontWeight: 500 } }}
            />
        );
    } else {
        let placeholder = 'Value';
        let htmlInputType: 'text' | 'time' = 'text';

        if (goalType === 'range' && goal.target && goal.target_max) {
            placeholder = `Range: ${goal.target} to ${goal.target_max}`;
            targetLabel = `${goal.target} - ${goal.target_max}`;
        } else if (goal.target) {
            placeholder = `Target: ${goal.target}`;
            targetLabel = `${goal.target}`;
        }
        
        if (goalType === 'time') {
            htmlInputType = 'time';
        }
        
        // Use a standard HTML input styled by Mantine's theme
        inputField = (
            <input
                type={htmlInputType} 
                value={currentState.value}
                onChange={(e) => handleChange(goal.id, 'value', e.target.value)}
                placeholder={placeholder}
                inputMode={partitionContext.isCounter || goalType === 'number' ? 'numeric' : 'text'}
                disabled={isDisabled}
                // Apply input styling that works well in a Mantine context
                style={{
                    width: '100%',
                    padding: theme.spacing.xs,
                    borderRadius: theme.radius.sm,
                    border: `1px solid ${isDisabled ? theme.colors.gray[3] : theme.colors.gray[4]}`,
                    backgroundColor: isDisabled ? theme.colors.gray[0] : theme.white,
                    transition: 'border-color 150ms',
                }}
            />
        );
    }
    
    // 2. Render Row Structure using Mantine components
    return (
      <Paper 
          key={goal.id} 
          p="md" 
          withBorder 
          radius="md" 
          mb="md" 
          bg={isDisabled ? theme.colors.gray[1] : theme.white}
      >
          {/* Goal Label & Controls: Responsive Layout */}
          <Group position="apart" align="start" mb={isBooleanType(goalType) ? 0 : 'sm'}>
              {/* Goal Name and Meta (ALWAYS VERTICAL STACK ON MOBILE) */}
              <Stack gap={2} sx={{ 
                  flex: 1, 
                  // Desktop: min-width: 576px. Ensures goal name takes 45% width.
                  [`@media (min-width: ${theme.breakpoints.sm})`]: { 
                      flexDirection: 'column', 
                      flexBasis: '45%', 
                      maxWidth: '45%', 
                  }
              }}>
                  <Text weight={600} size="md">{goal.name}</Text>
                  <Text size="xs" color="dimmed">
                      ({goal.type}{targetLabel && `: ${targetLabel}`})
                  </Text>
              </Stack>
              
              {/* Value Input/Checkbox & Note Toggle */}
              <Group 
                  gap="xs" 
                  align="center"
                  sx={{ 
                      flex: 1,
                      [`@media (min-width: ${theme.breakpoints.sm})`]: {
                          flexBasis: '50%',
                          maxWidth: '50%',
                          justifyContent: 'flex-end', 
                      }
                  }}
              >
                  {/* Input/Checkbox Field */}
                  <Box sx={{ flex: 1 }}>
                      {inputField}
                  </Box>

                  {/* Note Icon Button */}
                  <Button
                      onClick={isDisabled ? undefined : () => toggleNote(goal.id)}
                      disabled={isDisabled}
                      variant={isNoteOpen ? 'filled' : hasNoteContent ? 'light' : 'subtle'}
                      color={isNoteOpen ? 'blue' : 'gray'}
                      size="sm"
                      px={isBooleanType(goalType) ? theme.spacing.xs : 0} 
                      title={isDisabled ? 'Boundary out of range' : hasNoteContent ? 'Edit Note' : 'Add Note'}
                      leftSection={<Text size="md">📝</Text>}
                      compact
                  >
                      {/* Only show 'Note' text on desktop/larger screens */}
                      <Box sx={{ display: 'none', [`@media (min-width: ${theme.breakpoints.sm})`]: { display: 'block' } }}>
                        Note
                      </Box>
                  </Button>
              </Group>
          </Group>
          
          {/* Conditional Note Input: Renders BELOW the row */}
          {isNoteOpen && (
              <Box mt="sm">
                  <input
                      type="text"
                      value={currentState.note}
                      onChange={(e) => handleChange(goal.id, 'note', e.target.value)}
                      placeholder="Enter your note here..."
                      disabled={isDisabled}
                      // Apply full-width input styling
                      style={{
                          width: '100%',
                          padding: theme.spacing.xs,
                          borderRadius: theme.radius.sm,
                          border: `1px solid ${isDisabled ? theme.colors.gray[3] : theme.colors.gray[4]}`,
                          backgroundColor: isDisabled ? theme.colors.gray[0] : theme.white,
                      }}
                  />
              </Box>
          )}
      </Paper>
    );
  };
  
  // Custom container component for conditional Paper styles
  const OuterContainer = ({ children }: { children: React.ReactNode }) => (
    <Box
      sx={(t) => ({
        // Apply Paper styles only on desktop (min-width: sm)
        [`@media (min-width: ${t.breakpoints.sm})`]: {
          border: `1px solid ${t.colors.gray[3]}`,
          borderRadius: t.radius.md,
          boxShadow: t.shadows.md,
          padding: t.spacing.xl,
          backgroundColor: t.white,
        },
        // Base padding for mobile
        padding: t.spacing.sm,
      })}
    >
        {children}
    </Box>
  );

  // ==========================
  // Main Render
  // ==========================
  if (loading || currentBoundary === null) return <p>Loading goals for group...</p>;
  
  return (
    <OuterContainer>
      <div className="goal-entry-page">
        
        <Title order={1} className="page-title">{partitionContext.groupName} Entries</Title>
        
        {/* Boundary Navigator (Now imported) */}
        <BoundaryNavigator 
            currentBoundary={currentBoundary} 
            changeBoundary={changeBoundary} 
            partitionContext={partitionContext}
        />
        
        {/* Boundary Validity Alert */}
        {!isBoundaryValid && (
             <Paper p="sm" mb="md" radius="md" color="red" bg={theme.colors.red[0]} withBorder>
                <Text size="sm" color="red" weight={500} align="center">
                    <span role="img" aria-label="Warning">⚠️</span> This boundary ({currentBoundary}) is outside the group's configured range. Entries cannot be saved here.
                </Text>
            </Paper>
        )}

        {goals.length === 0 && <p>No goals configured for this squad group.</p>}
        
        {/* Goal List */}
        <Stack gap="md" className="goal-list">
          {goals.map(renderGoalInput)}
        </Stack>

        {message && (
          <p className={message.includes("✅") ? "success-message" : "error-message"}>
            {message}
          </p>
        )}
      </div>
    </OuterContainer>
  );
};

export default SquadGoalEntryPage;