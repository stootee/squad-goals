// FILE: src/hooks/useSquadGoalsManager.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Goal } from "@api";

// Re-export Goal for backward compatibility
export type { Goal };

// --- INTERFACES (shared) ---
// export interface Goal {
//   id?: string;
//   name: string;
//   type: string;
//   target?: string;
//   target_max?: string;
//   is_private: boolean;
//   is_active: boolean;
//   squad_id?: string;
//   global_goal_id?: string;

//   group_id: string;
//   group_name: string;
//   partition_type:
//     | "Minute"
//     | "Hourly"
//     | "Daily"
//     | "Weekly"
//     | "BiWeekly"
//     | "Monthly"
//     | "CustomCounter";
//   partition_label?: string;
//   start_date: string;
//   end_date: string;
// }

export interface GoalGroup {
  id: string;
  squad_id: string;
  group_name: string;
  partition_type:
    | "Minute"
    | "Hourly"
    | "Daily"
    | "Weekly"
    | "BiWeekly"
    | "Monthly"
    | "CustomCounter";
  partition_label?: string;
  start_date: string;
  end_date: string;
  goal_ids: string[];
}

export interface UseSquadGoalsManagerResult {
  goals: Goal[];
  activeGroup: GoalGroup | null;
  isGroupLoading: boolean;
  hasGroupChanged: boolean;
  newGoal: { name: string; type: string; target: string; target_max: string };
  setGoals: (g: Goal[]) => void;
  addGoal: () => Promise<void>;
  removeGoal: (goal: Goal, index: number) => Promise<void>;
  handleChange: (index: number, field: keyof Goal, value: string | undefined) => void;
  handleNewGoalChange: (field: keyof typeof defaultNewGoal, value: string | undefined) => void;
  handleGroupConfigChange: (field: keyof GoalGroup, value: string | undefined) => void;
  handleWheel: (e: WheelEvent | any) => void;
  apiURL: string;
}

export const GOAL_CONFIGS: { [key: string]: any } = {
  count: { targetLabel: "Target Count", targetPlaceholder: "e.g., 10" },
  target: { targetLabel: "Target Value", targetPlaceholder: "e.g., 10" },
  above: { targetLabel: "Minimum Value", targetPlaceholder: "e.g., 50" },
  below: { targetLabel: "Maximum Value", targetPlaceholder: "e.g., 10" },
  time: { targetLabel: "Target Duration", targetPlaceholder: "e.g., 00:30:00" },
  threshold: { targetLabel: "Required Metric", targetPlaceholder: "e.g., 2 (Liters)" },
  between: {
    targetLabel: "Target Min",
    targetPlaceholder: "Min Value",
    targetMaxLabel: "Target Max",
    targetMaxPlaceholder: "Max Value",
  },
  ratio: {
    targetLabel: "Numerator",
    targetPlaceholder: "e.g., 3 (Strength)",
    targetMaxLabel: "Denominator",
    targetMaxPlaceholder: "e.g., 1 (Cardio)",
  },
  achieved: { targetLabel: "Status", targetPlaceholder: "Boolean (Achieved)" },
  boolean: { targetLabel: "Status", targetPlaceholder: "Boolean (True/False)" },
};

export const GOAL_TYPE_OPTIONS = Object.keys(GOAL_CONFIGS).sort();
export const needsTargets = (type: string) => type !== "boolean" && type !== "achieved";

const formatToDateInput = (isoString: string | number) => {
  if (typeof isoString === "string" && !isNaN(Number(isoString))) return isoString;
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatToDateTimeInput = (isoString: string) => {
  if (!isoString) return "";
  if (!isNaN(Number(isoString))) return isoString;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(isoString)) return isoString;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const convertToLocalISO = (dateString: string, isDateTimeInput: boolean): string => {
  if (!dateString) return "";
  if (isDateTimeInput) {
    const [datePart, timePart] = dateString.split("T");
    const dateParts = datePart.split("-");
    const timeParts = (timePart || "00:00").split(":");
    if (dateParts.length < 3 || timeParts.length < 2) {
      console.error("Invalid datetime string format:", dateString);
      return new Date().toISOString();
    }
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[2], 10);
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);
    const localDate = new Date(year, month, day, hour, minute);
    const timezoneOffsetMinutes = localDate.getTimezoneOffset();
    const utcDate = new Date(Date.UTC(year, month, day, hour, minute + timezoneOffsetMinutes));
    if (isNaN(utcDate.getTime())) {
      console.error("Error creating UTC date from local components:", dateString);
      return new Date().toISOString();
    }
    return utcDate.toISOString();
  } else {
    const parts = dateString.split("T")[0].split("-");
    if (parts.length < 3) return new Date().toISOString();
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day, 0, 0, 0)).toISOString();
  }
};

const PARTITION_TYPE_OPTIONS: GoalGroup["partition_type"][] = [
  "Daily",
  "Weekly",
  "BiWeekly",
  "Monthly",
  "CustomCounter",
];

const DEFAULT_GROUP_NAME = "Squad Tracking Group";

const defaultNewGoal = {
  name: "",
  type: GOAL_TYPE_OPTIONS[0] || "count",
  target: "",
  target_max: "",
};

export const useSquadGoalsManager = (squadId: string, isAdmin: boolean): UseSquadGoalsManagerResult => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeGroup, setActiveGroup] = useState<GoalGroup | null>(null);
  const [isGroupLoading, setIsGroupLoading] = useState(true);
  const [hasGroupChanged, setHasGroupChanged] = useState(false);
  const [newGoal, setNewGoal] = useState(defaultNewGoal);

  const apiURL = (window as any).APP_CONFIG?.API_URL || "/api";

  const defaultGroupConfig = useMemo(() => {
    const todayIso = new Date().toISOString();
    const nextYear = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString();

    return {
      group_name: DEFAULT_GROUP_NAME,
      partition_type: "Daily" as GoalGroup["partition_type"],
      partition_label: undefined as string | undefined,
      start_date: formatToDateInput(todayIso),
      end_date: formatToDateInput(nextYear),
    };
  }, []);

  // --- saveGroup (debounced handled via useEffect below) ---
  const saveGroup = useCallback(
    async (groupData: Partial<GoalGroup>) => {
      if (!isAdmin) return null;
      const isCustomCounter = groupData.partition_type === "CustomCounter";

      let payload: any = {
        id: groupData.id,
        squad_id: squadId,
        group_name: groupData.group_name || DEFAULT_GROUP_NAME,
        partition_type: groupData.partition_type,
        partition_label: isCustomCounter ? groupData.partition_label : undefined,
      };

      if (isCustomCounter) {
        const startValue = groupData.start_date ? parseInt(groupData.start_date) : 0;
        const endValueStr = groupData.end_date?.trim();
        const endValue = endValueStr ? parseInt(endValueStr) : undefined;
        payload.start_value = isNaN(startValue) ? 0 : startValue;
        payload.end_value = (endValue === undefined || isNaN(endValue)) ? undefined : endValue;
        delete payload.start_date;
        delete payload.end_date;
      } else {
        const rawStartDate = groupData.start_date || "";
        const rawEndDate = groupData.end_date || "";
        const isDateTimeInput = ["Minute", "Hourly"].includes(groupData.partition_type as string);
        const startIso = convertToLocalISO(rawStartDate, isDateTimeInput);
        const endIso = convertToLocalISO(rawEndDate, isDateTimeInput);
        payload.start_date = startIso;
        payload.end_date = endIso;
        delete payload.start_value;
        delete payload.end_value;
      }

      try {
        const res = await fetch(`${apiURL}/squads/${squadId}/groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const savedGroup: any = await res.json();

          if (groupData.partition_type === "CustomCounter") {
            const returnedEndValue = savedGroup.end_value !== undefined && savedGroup.end_value !== null ? String(savedGroup.end_value) : "";

            setActiveGroup({
              ...savedGroup,
              start_date: String(savedGroup.start_value ?? groupData.start_date ?? "1"),
              end_date: returnedEndValue,
            } as GoalGroup);
          } else {
            const isDateTimeInput = ["Minute", "Hourly"].includes(groupData.partition_type as string);
            const returnedStart = savedGroup.start_date || savedGroup.start_value || groupData.start_date || "";
            const returnedEnd = savedGroup.end_date || savedGroup.end_value || groupData.end_date || "";

            setActiveGroup({
              ...savedGroup,
              start_date: isDateTimeInput ? formatToDateTimeInput(returnedStart) : formatToDateInput(returnedStart),
              end_date: isDateTimeInput ? formatToDateTimeInput(returnedEnd) : formatToDateInput(returnedEnd),
            } as GoalGroup);
          }

          setHasGroupChanged(false);
          return savedGroup;
        } else {
          const data = await res.json();
          console.error(`Failed to save group configuration: ${data.error || res.statusText}`);
        }
      } catch (err) {
        console.error("Error saving group:", err);
      }
      return null;
    },
    [squadId, isAdmin, apiURL]
  );

  const loadGroupAndGoals = useCallback(async () => {
    setIsGroupLoading(true);

    let group: GoalGroup | undefined;
    try {
      const res = await fetch(`${apiURL}/squads/${squadId}/groups`, { credentials: "include" });
      if (res.ok) {
        const loadedGroups: any[] = await res.json();
        if (loadedGroups.length > 0) {
          const apiGroup = loadedGroups[0];
          const partitionType: GoalGroup["partition_type"] = apiGroup.partition_type || "Daily";
          const isDateTimeInput = ["Minute", "Hourly"].includes(partitionType);
          const startValue = apiGroup.partition_type === 'CustomCounter' ? apiGroup.start_value : apiGroup.start_date;
          const endValue = apiGroup.partition_type === 'CustomCounter' ? apiGroup.end_value : api_group_end_value_fallback(apiGroup);

          let localEndDate;
          if (apiGroup.partition_type === 'CustomCounter') {
            localEndDate = (endValue !== undefined && endValue !== null) ? String(endValue) : "";
          } else {
            localEndDate = isDateTimeInput ? formatToDateTimeInput(endValue) : formatToDateInput(endValue);
          }

          group = {
            ...apiGroup,
            start_date: (isDateTimeInput ? formatToDateTimeInput(startValue) : formatToDateInput(startValue)) || "",
            end_date: localEndDate || "",
            partition_type: partitionType,
          } as GoalGroup;
        }
      }
    } catch (err) {
      console.error("Error loading goal groups:", err);
    }

    if (!group && isAdmin) {
      try {
        const isDateTimeInput = ["Minute", "Hourly"].includes(defaultGroupConfig.partition_type);
        const startIso = convertToLocalISO(defaultGroupConfig.start_date, isDateTimeInput);
        const endIso = convertToLocalISO(defaultGroupConfig.end_date, isDateTimeInput);

        const payload = {
          ...defaultGroupConfig,
          start_date: startIso,
          end_date: endIso,
        };

        const newGroupRes = await fetch(`${apiURL}/squads/${squadId}/groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (newGroupRes.ok) {
          const newGroup = await newGroupRes.json();
          const partitionType: GoalGroup["partition_type"] = newGroup.partition_type || defaultGroupConfig.partition_type;
          const isDateTime = ["Minute", "Hourly"].includes(partitionType);

          group = {
            ...newGroup,
            start_date: isDateTime
              ? formatToDateTimeInput(newGroup.start_date || newGroup.start_value || defaultGroupConfig.start_date)
              : formatToDateInput(newGroup.start_date || newGroup.start_value || defaultGroupConfig.start_date),
            end_date: isDateTime
              ? formatToDateTimeInput(newGroup.end_date || newGroup.end_value || defaultGroupConfig.end_date)
              : formatToDateInput(newGroup.end_date || newGroup.end_value || defaultGroupConfig.end_date),
            partition_type: partitionType,
          } as GoalGroup;
        }
      } catch (err) {
        console.error("Error auto-creating initial group:", err);
      }
    }

    setActiveGroup(group || null);
    setIsGroupLoading(false);

    try {
      const res = await fetch(`${apiURL}/squads/${squadId}/goals`, { credentials: "include" });
      if (res.ok) setGoals(await res.json());
    } catch (err) {
      console.error("Error loading goals:", err);
    }
  }, [squadId, isAdmin, apiURL, defaultGroupConfig]);

  // small helper since some APIs use end_date or end_value
  function api_group_end_value_fallback(apiGroup: any) {
    return apiGroup.end_date ?? apiGroup.end_value ?? undefined;
  }

  useEffect(() => {
    loadGroupAndGoals();
  }, [loadGroupAndGoals]);

  // Debounce saveGroup
  useEffect(() => {
    if (!hasGroupChanged || !activeGroup || isGroupLoading || !isAdmin) return;
    const handler = setTimeout(() => {
      saveGroup(activeGroup);
    }, 500);
    return () => clearTimeout(handler);
  }, [activeGroup, hasGroupChanged, isAdmin, isGroupLoading, saveGroup]);

  const saveGoal = async (goal: Goal) => {
    if (!isAdmin || !activeGroup) return;
    if (!goal.name?.trim() && goal.is_private !== false) return;
    if (!goal.type?.trim() && goal.is_private !== false) return;
  
    const config = GOAL_CONFIGS[goal.type?.toLowerCase() || ""];
    const requiresMax = config?.targetMaxLabel;
  
    // Construct goal payload
    const goalData: any = {
      name: goal.is_private ? goal.name.trim() : undefined,
      type: goal.is_private ? goal.type : undefined,
      target: needsTargets(goal.type) ? Number(goal.target) || undefined : undefined,
      target_max: requiresMax ? Number(goal.target_max) || undefined : undefined,
      is_private: goal.is_private ?? true,
      squad_id: squadId,
    };
  
    // Include group_id only for new goals
    if (!goal.id) {
      goalData.group_id = activeGroup.id;
    } else {
      goalData.id = goal.id; // include id for updates
    }
  
    // Remove undefined fields to satisfy backend
    Object.keys(goalData).forEach(
      (key) => goalData[key] === undefined && delete goalData[key]
    );
  
    try {
      const res = await fetch(
        `${apiURL}/squads/${squadId}/goals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ goals: [goalData] }),
        }
      );
  
      if (!res.ok) {
        const errText = await res.text();
        console.error("Failed saving goal:", errText);
        return;
      }
  
      return (await res.json())[0];
    } catch (err) {
      console.error("Error saving goal:", err);
    }
  };
  
  const removeGoal = useCallback(
    async (goal: Goal, index: number) => {
      if (!isAdmin) return;
      if (goal.id) {
        if (!window.confirm(`Delete goal: ${goal.name}? This will delete all associated entries.`)) return;
        try {
          const res = await fetch(`${apiURL}/squads/${squadId}/goals/${goal.id}`, { method: "DELETE", credentials: "include" });
          if (!res.ok) {
            const data = await res.json();
            alert(data.error || "Failed to delete goal");
            return;
          }
        } catch (err) {
          console.error("Error deleting goal:", err);
          return;
        }
      }
      setGoals((prev) => prev.filter((g) => g.id !== goal.id));
    },
    [squadId, isAdmin, apiURL]
  );

  const addGoal = useCallback(async () => {
    if (!isAdmin || !activeGroup) {
      if (!activeGroup) alert("Please wait for the tracking period to be configured.");
      return;
    }

    if (!newGoal.name.trim() || !newGoal.type.trim()) {
      alert("Please ensure goal name and type are selected.");
      return;
    }

    const goalTemplate: Goal = {
      ...newGoal,
      group_id: activeGroup.id,
      is_private: true,
      is_active: true,
      squad_id: squadId,
      group_name: activeGroup.group_name,
      partition_type: activeGroup.partition_type,
      start_date: activeGroup.start_date,
      end_date: activeGroup.end_date,
    } as Goal;

    const savedGoal = await saveGoal(goalTemplate);
    if (savedGoal) setGoals((prev) => [...prev, savedGoal]);

    setNewGoal(defaultNewGoal);
  }, [isAdmin, activeGroup, newGoal, saveGoal, squadId]);

  const handleChange = useCallback((index: number, field: keyof Goal, value: string | undefined) => {
    if (!isAdmin) return;
    setGoals((prev) => {
      const updated = [...prev];
      (updated[index] as any)[field] = value;
      // Auto-save if ID exists
      if (updated[index].id) saveGoal(updated[index]);
      return updated;
    });
  }, [isAdmin, saveGoal]);

  const handleNewGoalChange = useCallback((field: keyof typeof defaultNewGoal, value: string | undefined) => {
    setNewGoal((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleGroupConfigChange = useCallback((field: keyof GoalGroup, value: string | undefined) => {
    if (!isAdmin || !activeGroup) return;

    let updatedGroup: GoalGroup = { ...activeGroup } as GoalGroup;

    if (field === "partition_type") {
      const newType = value as GoalGroup["partition_type"];
      const oldType = updatedGroup.partition_type;
      updatedGroup.partition_type = newType;

      // Only reset dates when switching between counter and time-based, preserve existing values otherwise
      if (newType === "CustomCounter" && oldType !== "CustomCounter") {
        // Switching TO CustomCounter
        updatedGroup.partition_label = "Custom Counter";
        updatedGroup.start_date = "1";
        updatedGroup.end_date = "";
      } else if (newType !== "CustomCounter" && oldType === "CustomCounter") {
        // Switching FROM CustomCounter to time-based
        const today = new Date().toISOString();
        const nextYear = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString();
        updatedGroup.start_date = formatToDateInput(today);
        updatedGroup.end_date = formatToDateInput(nextYear);
        updatedGroup.partition_label = undefined;
      }
      // If both are time-based (e.g., Daily -> Weekly), preserve the existing dates
      // If both are CustomCounter, preserve the existing values
    } else {
      const finalValue = value ?? "";
      if (updatedGroup.partition_type === "CustomCounter" && (field === "start_date" || field === "end_date")) {
        (updatedGroup as any)[field] = finalValue;
      } else {
        updatedGroup = { ...updatedGroup, [field]: finalValue } as GoalGroup;
      }
    }

    if (updatedGroup.partition_type === "CustomCounter") {
      if (!updatedGroup.start_date || !/^\d+$/.test(updatedGroup.start_date)) updatedGroup.start_date = "1";
    }

    setActiveGroup(updatedGroup);
    setHasGroupChanged(true);
  }, [activeGroup, isAdmin]);

  const handleWheel = useCallback((e: WheelEvent | any) => {
    try {
      (e.target as HTMLInputElement).blur();
    } catch (e) {
      // ignore
    }
  }, []);

  return {
    goals,
    activeGroup,
    isGroupLoading,
    hasGroupChanged,
    newGoal,
    setGoals,
    addGoal,
    removeGoal,
    handleChange,
    handleNewGoalChange,
    handleGroupConfigChange,
    handleWheel,
    apiURL,
  } as UseSquadGoalsManagerResult;
};
  