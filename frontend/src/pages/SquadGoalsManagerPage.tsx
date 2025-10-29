// FILE: src/components/SquadGoalsManager.tsx
import React from "react";
import { useSquadGoalsManager, GOAL_TYPE_OPTIONS, GOAL_CONFIGS, needsTargets } from "../hooks/useSquadGoalsManager";
import type { Goal, GoalGroup } from "../hooks/useSquadGoalsManager";
// Import Mantine's responsive styling hooks
import { TextInput, Select, Button, Group, Paper, Collapse, Divider, Stack, Title, Box, Flex } from "@mantine/core";

// ***********************************************************************************
// CollapsibleCardLocal: No functional changes needed.
// ***********************************************************************************

const CollapsibleCardLocal: React.FC<any> = ({ id, title, defaultOpen = true, children, squadId }) => {
  const storageKey = `squad:${squadId}:card:${id}:open`;
  const [open, setOpen] = React.useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) return raw === "1";
    } catch (e) {}
    // Default to closed on screens smaller than large desktop (e.g., 1024px)
    return typeof window !== "undefined" ? (window.innerWidth > 1024 ? defaultOpen : false) : defaultOpen;
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(storageKey, open ? "1" : "0");
    } catch (e) {}
  }, [open, storageKey]);

  return (
    <Paper shadow="xs" p="sm" mb="sm">
      <Button
        variant="subtle"
        fullWidth
        onClick={() => setOpen((o) => !o)}
        justify="space-between"
        style={{ padding: '0 8px' }}
      >
        <span>{title}</span>
        <span>{open ? "▾" : "▸"}</span>
      </Button>
      <Collapse in={open}>
        <Box pt="xs">
          {children}
        </Box>
      </Collapse>
    </Paper>
  );
};

const SquadGoalsManager: React.FC<{ squadId: string; isAdmin: boolean }> = ({ squadId, isAdmin }) => {
  const {
    goals,
    activeGroup,
    isGroupLoading,
    hasGroupChanged,
    newGoal,
    addGoal,
    removeGoal,
    handleChange,
    handleNewGoalChange,
    handleGroupConfigChange,
    handleWheel,
  } = useSquadGoalsManager(squadId, isAdmin);

  // ***********************************************************************************
  // renderTargetInputs & renderTypeDropdown: Use responsive minWidth for small
  // screens and a fixed max-width for desktop to prevent stretching.
  // ***********************************************************************************

  const renderTargetInputs = (goal: Pick<Goal, "type" | "target" | "target_max">, index?: number) => {
    const config = GOAL_CONFIGS[goal.type.toLowerCase()] || GOAL_CONFIGS["count"];
    const isNew = index === undefined;
    if (!needsTargets(goal.type)) return null;

    const targetValue = isNew ? (goal as any).target : goals[index!].target;
    const targetMaxValue = isNew ? (goal as any).target_max : goals[index!].target_max;

    const targetHandler = isNew
      ? (e: React.ChangeEvent<HTMLInputElement>) => handleNewGoalChange("target", e.target.value)
      : (e: React.ChangeEvent<HTMLInputElement>) => handleChange(index!, "target", e.target.value);

    const targetMaxHandler = isNew
      ? (e: React.ChangeEvent<HTMLInputElement>) => handleNewGoalChange("target_max", e.target.value)
      : (e: React.ChangeEvent<HTMLInputElement>) => handleChange(index!, "target_max", e.target.value);

    return (
      // Use Flex to force targets side-by-side, but allow it to take up available space
      <Flex gap="xs" style={{ flexGrow: 1, minWidth: 0 }}>
        <TextInput
          value={targetValue ?? ""}
          placeholder={config.targetPlaceholder}
          size="xs"
          style={{ flex: 1, minWidth: 50, maxWidth: 100 }} // Reduced minWidth for mobile
          onChange={targetHandler}
          onWheel={handleWheel}
          disabled={!isAdmin}
          readOnly={!isAdmin}
          styles={{
            input: {
              cursor: isAdmin ? 'text' : 'default',
              backgroundColor: isAdmin ? undefined : 'var(--mantine-color-gray-0)',
              color: 'var(--mantine-color-dark-9)',
              opacity: 1,
              border: isAdmin ? undefined : '1px solid var(--mantine-color-gray-3)'
            }
          }}
        />
        {config.targetMaxLabel && (
          <TextInput
            value={targetMaxValue ?? ""}
            placeholder={config.targetMaxPlaceholder}
            size="xs"
            style={{ flex: 1, minWidth: 50, maxWidth: 100 }} // Reduced minWidth for mobile
            onChange={targetMaxHandler}
            onWheel={handleWheel}
            disabled={!isAdmin}
            readOnly={!isAdmin}
            styles={{
              input: {
                cursor: isAdmin ? 'text' : 'default',
                backgroundColor: isAdmin ? undefined : 'var(--mantine-color-gray-0)',
                color: 'var(--mantine-color-dark-9)',
                opacity: 1,
                border: isAdmin ? undefined : '1px solid var(--mantine-color-gray-3)'
              }
            }}
          />
        )}
      </Flex>
    );
  };

  const renderTypeDropdown = (goal: Pick<Goal, "type">, index?: number) => {
    const isNew = index === undefined;
    const value = isNew ? newGoal.type : goals[index!].type;
    const handler = isNew
      ? (e: string) => handleNewGoalChange("type", e)
      : (val: string) => handleChange(index!, "type", val);

    return (
      <Select
        data={GOAL_TYPE_OPTIONS.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
        value={value}
        onChange={handler}
        disabled={!isAdmin}
        readOnly={!isAdmin}
        size="xs"
        style={{ flex: 1, minWidth: 90, maxWidth: 150 }} // Reduced minWidth for mobile
        styles={{
          input: {
            cursor: isAdmin ? 'pointer' : 'default',
            backgroundColor: isAdmin ? undefined : 'var(--mantine-color-gray-0)',
            color: 'var(--mantine-color-dark-9)',
            opacity: 1,
            border: isAdmin ? undefined : '1px solid var(--mantine-color-gray-3)'
          }
        }}
      />
    );
  };

  // ***********************************************************************************
  // renderPartitionInputs: Using responsive max-width.
  // ***********************************************************************************

  const renderPartitionInputs = (activeGroup: GoalGroup) => {
    const type = activeGroup.partition_type;
    const sanitizeInputForDisplay = (value: string, inputType: "date" | "datetime-local") => {
      if (type === "CustomCounter") return value;
      return value || "";
    };

    if (type === "CustomCounter") {
      return (
        <Group gap="xs" align="flex-end" wrap="wrap" grow style={{ flex: 1, minWidth: 0 }}>
          <TextInput
            label="Name"
            value={activeGroup.partition_label ?? ""}
            placeholder="Sprint, Hole"
            size="xs"
            onChange={(e) => handleGroupConfigChange("partition_label", e.target.value)}
            disabled={!isAdmin}
            style={{ flex: 1, minWidth: 80, maxWidth: 150 }}
          />
          <TextInput
            label="Start"
            type="number"
            value={activeGroup.start_date || "1"}
            size="xs"
            onChange={(e) => handleGroupConfigChange("start_date", e.target.value)}
            onWheel={handleWheel}
            disabled={!isAdmin}
            style={{ flex: 1, minWidth: 50, maxWidth: 100 }}
          />
          <TextInput
            label="End (Optional)"
            type="number"
            value={activeGroup.end_date ?? ""}
            size="xs"
            onChange={(e) => handleGroupConfigChange("end_date", e.target.value)}
            onWheel={handleWheel}
            disabled={!isAdmin}
            style={{ flex: 1, minWidth: 50, maxWidth: 100 }}
          />
        </Group>
      );
    }

    const isDateTime = ["Minute", "Hourly"].includes(type);
    const inputType = isDateTime ? "datetime-local" : "date";

    return (
      <Group gap="xs" align="flex-end" wrap="wrap" grow style={{ flex: 1, minWidth: 0 }}>
        <TextInput
          label="Start"
          type={inputType}
          value={sanitizeInputForDisplay(activeGroup.start_date, inputType)}
          size="xs"
          onChange={(e) => handleGroupConfigChange("start_date", e.target.value)}
          disabled={!isAdmin}
          style={{ flex: 1, minWidth: 100, maxWidth: 200 }}
        />
        <TextInput
          label="End"
          type={inputType}
          value={sanitizeInputForDisplay(activeGroup.end_date, inputType)}
          size="xs"
          onChange={(e) => handleGroupConfigChange("end_date", e.target.value)}
          disabled={!isAdmin}
          style={{ flex: 1, minWidth: 100, maxWidth: 200 }}
        />
      </Group>
    );
  };

  if (isGroupLoading) {
    return (
      <Stack gap="xs">
        <Title order={3}>Loading Goals...</Title>
      </Stack>
    );
  }

  // ***********************************************************************************
  // Final Structure:
  // 1. Overall max-width: Max 900px for desktop.
  // 2. Goal Items: Use a responsive <Flex> container for the whole line item.
  //    - `direction="column"` on base (mobile) for stacking.
  //    - `direction="row"` on 'md' (desktop) for single line.
  // ***********************************************************************************

  return (
    // Set a max-width for the entire component to prevent excessive spreading on desktop
    <Stack gap="sm" style={{ margin: '0 auto' }} maw={800}>
      <Title order={3}>{isAdmin ? "Manage Squad Goals (Admin)" : "Configured Squad Goals"}</Title>

      {isAdmin && activeGroup && (
        <CollapsibleCardLocal id="group-config" title="Goal Tracking Period Configuration" squadId={squadId}>
          <Stack gap="xs">
            <Group gap="xs" align="flex-end" wrap="wrap" grow>
              <Select
                label="Grouped"
                data={["Daily", "Weekly", "BiWeekly", "Monthly", "CustomCounter"].map((t) => ({
                  value: t,
                  label: t.replace(/([A-Z])/g, " $1").trim(),
                }))}
                value={activeGroup.partition_type}
                onChange={(val) => handleGroupConfigChange("partition_type", val!)}
                disabled={!isAdmin}
                size="xs"
                style={{ flex: 1, minWidth: 100, maxWidth: 180 }}
              />
              {renderPartitionInputs(activeGroup)}
            </Group>
          </Stack>

          <Divider my="xs" />
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {activeGroup.partition_type === "CustomCounter"
              ? `Goals tracked by "${activeGroup.partition_label || "Label Missing"}", from ${activeGroup.start_date || "1"} to ${activeGroup.end_date || "No End"}.`
              : `Goals partitioned ${activeGroup.partition_type.toLowerCase()}, from ${activeGroup.start_date} to ${activeGroup.end_date}.`}
            {hasGroupChanged && " (Saving...)"}
          </div>
        </CollapsibleCardLocal>
      )}

      <Stack gap="xs">
        {goals
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((goal, index) => (
            <Paper key={goal.id || `temp-${index}`} shadow="xs" p="sm" withBorder>
              {/* This is the key change: Flex with responsive direction */}
              <Flex
                gap="xs"
                wrap="wrap"
                align="center"
                direction={{ base: 'column', md: 'row' }} // Stack on mobile, single row on desktop
                justify="space-between"
              >
                {/* 1. Goal Name (must be full width on mobile) */}
                <TextInput
                  value={goal.name}
                  placeholder="Goal name"
                  size="xs"
                  onChange={(e) => handleChange(index, "name", e.target.value)}
                  disabled={!isAdmin}
                  readOnly={!isAdmin}
                  styles={{
                    input: {
                      cursor: isAdmin ? 'text' : 'default',
                      backgroundColor: isAdmin ? undefined : 'var(--mantine-color-gray-0)',
                      color: 'var(--mantine-color-dark-9)',
                      opacity: 1,
                      border: isAdmin ? undefined : '1px solid var(--mantine-color-gray-3)'
                    }
                  }}
                  style={{ flex: 1, minWidth: 0 }} // Allow it to flex, minWidth 0 for proper shrinking
                  w={{ base: '100%', md: 250 }} // Full width on mobile, fixed width on desktop
                />

                {/* 2. Type and Targets (will wrap if needed on small screens) */}
                <Group
                  gap="xs"
                  wrap="wrap"
                  grow
                  align="center"
                  style={{ flex: 1, minWidth: 0 }} // minWidth 0 allows shrinking
                  w={{ base: '100%', md: 'auto' }} // Full width on mobile, auto-size on desktop
                >
                  {renderTypeDropdown(goal, index)}
                  {renderTargetInputs(goal, index)}
                </Group>

                {/* 3. Remove Button (must be at the end of the flex container) */}
                {isAdmin && (
                  <Button color="red" size="xs" onClick={() => removeGoal(goal, index)} style={{ flexShrink: 0 }} w={{ base: '100%', md: 'auto' }}>
                    Remove
                  </Button>
                )}
              </Flex>
            </Paper>
          ))}
      </Stack>

      {isAdmin && activeGroup && (
        <CollapsibleCardLocal id="new-goal" title="Add New Goal" squadId={squadId}>
          {/* Apply the same responsive Flex structure here for the Add New Goal section */}
          <Flex 
            gap="xs"
            wrap="wrap"
            align="center"
            direction={{ base: 'column', md: 'row' }}
            justify="space-between"
          >
            {/* 1. New Goal Name */}
            <TextInput
              placeholder="New Goal name"
              value={newGoal.name}
              size="xs"
              onChange={(e) => handleNewGoalChange("name", e.target.value)}
              style={{ flex: 1, minWidth: 150 }}
              w={{ base: '100%', md: 250 }}
            />

            {/* 2. Type and Targets */}
            <Group
              gap="xs"
              wrap="wrap"
              grow
              align="center"
              style={{ flex: 1, minWidth: 0 }}
              w={{ base: '100%', md: 'auto' }}
            >
              {renderTypeDropdown(newGoal)}
              {renderTargetInputs(newGoal)}
            </Group>

            {/* 3. Add Button */}
            <Button color="green" size="xs" onClick={addGoal} style={{ flexShrink: 0 }} w={{ base: '100%', md: 'auto' }}>
              Add
            </Button>
          </Flex>
        </CollapsibleCardLocal>
      )}
    </Stack>
  );
};

export default SquadGoalsManager;