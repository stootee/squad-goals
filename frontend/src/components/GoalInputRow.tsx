import React, { useState } from "react";
import { Paper, Group, Stack, Text, Button, Checkbox, Box, TextInput } from "@mantine/core";
import { IconNote } from "@tabler/icons-react";
import { Goal } from "@api";

interface GoalEntryState {
  value: string;
  note: string;
}

interface GoalInputRowProps {
  goal: Goal;
  currentState: GoalEntryState;
  isDisabled: boolean;
  onValueChange: (goalId: string, value: string) => void;
  onNoteChange: (goalId: string, note: string) => void;
  onCheckboxChange: (goalId: string, checked: boolean) => void;
}

const GoalInputRow: React.FC<GoalInputRowProps> = ({
  goal,
  currentState,
  isDisabled,
  onValueChange,
  onNoteChange,
  onCheckboxChange,
}) => {
  // Guard against goals without IDs
  if (!goal.id) return null;

  // Extract ID for type safety (we've verified it exists above)
  const goalId = goal.id;

  const [isNoteOpen, setIsNoteOpen] = useState(currentState.note.trim().length > 0);

  const goalType = goal.type.toLowerCase();
  const isBooleanType = ["boolean", "achieved"].includes(goalType);
  const hasNoteContent = currentState.note.trim().length > 0;

  // Calculate target label with proper handling for "between" type
  const getTargetLabel = (): string => {
    if (isBooleanType) {
      return "Achieved";
    }

    // Fix for "between" type - show range if both target and target_max exist
    if ((goalType === "between" || goalType === "range") && goal.target && goal.target_max) {
      return `${goal.target} - ${goal.target_max}`;
    }

    // For other types with a target
    if (goal.target) {
      return String(goal.target);
    }

    return "";
  };

  const targetLabel = getTargetLabel();

  // Render input field based on goal type
  const renderInputField = () => {
    if (isBooleanType) {
      return (
        <Checkbox
          checked={currentState.value === "True"}
          onChange={(e) => onCheckboxChange(goalId, e.target.checked)}
          disabled={isDisabled}
          size="md"
          label="Did I achieve this?"
        />
      );
    }

    let placeholder = "Value";
    let inputType: "text" | "time" | "number" = "text";

    if ((goalType === "between" || goalType === "range") && goal.target && goal.target_max) {
      placeholder = `Range: ${goal.target} to ${goal.target_max}`;
    } else if (goal.target) {
      placeholder = `Target: ${goal.target}`;
    }

    if (goalType === "time") {
      inputType = "time";
    } else if (goalType === "count" || goalType === "number") {
      inputType = "number";
    }

    return (
      <TextInput
        type={inputType}
        value={currentState.value}
        onChange={(e) => onValueChange(goalId, e.target.value)}
        placeholder={placeholder}
        disabled={isDisabled}
        styles={{ input: { textAlign: "right" } }}
      />
    );
  };

  return (
    <Paper p="md" withBorder radius="md" mb="md" bg={isDisabled ? "gray.0" : "white"}>
      <Group justify="space-between" align="start" mb={isBooleanType ? 0 : "sm"} wrap="nowrap">
        {/* Goal Name and Type */}
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text fw={600} size="md" truncate>
            {goal.name}
          </Text>
          <Text size="xs" c="dimmed">
            ({goal.type}
            {targetLabel && `: ${targetLabel}`})
          </Text>
        </Stack>

        {/* Input and Note Button */}
        <Group gap="xs" align="center" wrap="nowrap" style={{ flexShrink: 0 }}>
          <Box style={{ width: isBooleanType ? "auto" : "120px" }}>{renderInputField()}</Box>

          <Button
            onClick={() => !isDisabled && setIsNoteOpen(!isNoteOpen)}
            disabled={isDisabled}
            variant={isNoteOpen ? "filled" : hasNoteContent ? "light" : "subtle"}
            color={isNoteOpen ? "blue" : "gray"}
            size="sm"
            px="xs"
            title={isDisabled ? "Boundary out of range" : hasNoteContent ? "Edit Note" : "Add Note"}
          >
            <IconNote size={16} />
          </Button>
        </Group>
      </Group>

      {/* Note Input (shown when open) */}
      {isNoteOpen && (
        <TextInput
          mt="sm"
          value={currentState.note}
          onChange={(e) => onNoteChange(goalId, e.target.value)}
          placeholder="Enter your note here..."
          disabled={isDisabled}
          leftSection={<IconNote size={14} />}
        />
      )}
    </Paper>
  );
};

export default GoalInputRow;
