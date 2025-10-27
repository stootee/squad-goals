// FILE: src/components/SquadLayout.tsx
import React, { useEffect, useState } from "react";
import SquadGoalSubmissionPage from "@pages/SquadGoalSubmissionPage";
import SquadMembersPage from "@pages/SquadMembersPage";
import SquadDailyOverviewPage from "@pages/SquadGoalsOverviewPage";
import SquadGoalsManagerPage from "@pages/SquadGoalsManagerPage";
import SquadGoalEntryPage from "@pages/SquadGoalEntryPage";
import AppLayout from "@components/AppLayout";
// Mantine components
import { Tabs, Paper, Box, Stack } from "@mantine/core";

type SquadTabKey = "today" | "submission" | "progress" | "members" | "goals";

interface SquadLayoutProps {
  squadId: string;
}

const SquadLayout: React.FC<SquadLayoutProps> = ({ squadId }) => {
  const apiURL = window.APP_CONFIG.API_URL;

  const [activeTab, setActiveTab] = useState<SquadTabKey>(() => {
    const savedTab = localStorage.getItem(`squad-${squadId}-activeTab`);
    return (savedTab as SquadTabKey) || "today";
  });
  
  // 1. ADD STATE: Key to force remount of SquadGoalEntryPage
  const [goalEntryKey, setGoalEntryKey] = useState(0);
  // 1b. NEW STATE: Key to force remount of SquadGoalSubmissionPage
  const [historyKey, setHistoryKey] = useState(0); 

  const [squadName, setSquadName] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    const fetchSquadName = async () => {
      try {
        const res = await fetch(`${apiURL}/squads/${squadId}`, { credentials: "include" });
        const data = await res.json();
        setSquadName(data.name || "Squad");

        if (data.is_admin !== undefined) {
          setIsAdmin(data.is_admin);
        } else if (data.admin_id && data.admin_id === data.current_user_id) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Error fetching squad info:", err);
        setSquadName("Squad");
        setIsAdmin(false);
      }
    };
    fetchSquadName();
  }, [squadId, apiURL]);
  
  const handleTabChange = (key: string | null) => {
    if (key) {
        // 2. INCREMENT KEY: Increment the key when navigating to the "today" tab
        if (key === "today") {
            setGoalEntryKey(prev => prev + 1);
        }
        
        // NEW LOGIC: Increment key when navigating to the "submission" tab
        if (key === "submission") {
            setHistoryKey(prev => prev + 1);
        }
        
        setActiveTab(key as SquadTabKey);
        localStorage.setItem(`squad-${squadId}-activeTab`, key);
    }
  };

  const renderTabContent = (key: SquadTabKey) => {
    switch (key) {
      case "today":
        // 3. PASS KEY: Use the key prop to force remount
        return <SquadGoalEntryPage key={goalEntryKey} squadId={squadId} />;
      case "submission":
        // 3b. PASS NEW KEY: Use the historyKey prop to force remount/refresh
        // Pass an empty string for goalGroupId to hit the optional endpoint
        return <SquadGoalSubmissionPage key={historyKey} squadId={squadId} goalGroupId={""} />;
      case "members":
        return <SquadMembersPage squadId={squadId} />;
      case "progress":
        return <SquadDailyOverviewPage squadId={squadId} />;
      case "goals":
        return <SquadGoalsManagerPage squadId={squadId} isAdmin={isAdmin} />;
      default:
        return <Box>Select a view.</Box>;
    }
  };

  return (
    <AppLayout title={squadName}>
      <Box px={{ base: 'md', md: 0 }}>
        <Stack spacing="md">
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange} 
            // Remove all Mantine styling props (styles, sx, variant)
            // Mantine renders Tabs as a container for the Tabs.List
            w="100%" 
          >
            {/* 🚀 CRITICAL FIX: Apply your original working class name */}
            <Tabs.List className="tabs">
              {/* Note: The global CSS rules for .tabs button and .tabs button.active
                   should now correctly style these Mantine Tabs.Tab components. */}
              <Tabs.Tab 
                value="today" 
                // Add your active class conditionally for the CSS to pick up the underline
                className={activeTab === 'today' ? 'active' : ''}
              >
                Today
              </Tabs.Tab>
              <Tabs.Tab 
                value="submission"
                className={activeTab === 'submission' ? 'active' : ''}
              >
                Recent History
              </Tabs.Tab>
              <Tabs.Tab 
                value="progress"
                className={activeTab === 'progress' ? 'active' : ''}
              >
                Progress
              </Tabs.Tab>
              <Tabs.Tab 
                value="members"
                className={activeTab === 'members' ? 'active' : ''}
              >
                Members
              </Tabs.Tab>
              <Tabs.Tab 
                value="goals"
                className={activeTab === 'goals' ? 'active' : ''}
              >
                Goals
              </Tabs.Tab>
            </Tabs.List>

            <Paper 
              shadow="md"
              p="lg" 
              mt="md" 
              radius="md" 
              withBorder 
              // Set background to use a solid CSS variable or let the global CSS handle it
              // We remove the explicit Mantine bg="white" to let global styles take over
            >
              <Tabs.Panel value="today">{renderTabContent("today")}</Tabs.Panel>
              <Tabs.Panel value="submission">{renderTabContent("submission")}</Tabs.Panel>
              <Tabs.Panel value="progress">{renderTabContent("progress")}</Tabs.Panel>
              <Tabs.Panel value="members">{renderTabContent("members")}</Tabs.Panel>
              <Tabs.Panel value="goals">{renderTabContent("goals")}</Tabs.Panel>
            </Paper>
          </Tabs>
        </Stack>
      </Box>
    </AppLayout>
  );
};

export default SquadLayout;
