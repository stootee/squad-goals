// FILE: src/components/SquadLayout.tsx
import React, { useEffect, useState } from "react";
import SquadGoalsHistoryPage from "@pages/SquadGoalsHistoryPage";
import SquadMembersPage from "@pages/SquadMembersPage";
import SquadDailyOverviewPage from "@pages/SquadGoalsOverviewPage";
import SquadGoalsManagerPage from "@pages/SquadGoalsManagerPage";
import SquadGoalEntryPage from "@pages/SquadGoalEntryPage";
import AppLayout from "@components/AppLayout";
// Mantine components
import { Tabs, Paper, Box, Stack } from "@mantine/core";

type SquadTabKey = "entry" | "history" | "progress" | "members" | "goals";

interface SquadLayoutProps {
  squadId: string;
}

const SquadLayout: React.FC<SquadLayoutProps> = ({ squadId }) => {
  const apiURL = window.APP_CONFIG.API_URL;

  const [activeTab, setActiveTab] = useState<SquadTabKey>(() => {
    const savedTab = localStorage.getItem(`squad-${squadId}-activeTab`);
    return (savedTab as SquadTabKey) || "entry";
  });
  
  // 1. ADD STATE: Key to force remount of SquadGoalEntryPage
  const [goalEntryKey, setGoalEntryKey] = useState(0);
  // 1b. NEW STATE: Key to force remount of SquadGoalsHistoryPage
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
        if (key === "entry") {
            setGoalEntryKey(prev => prev + 1);
        }
        
        if (key === "history") {
            setHistoryKey(prev => prev + 1);
        }
        
        setActiveTab(key as SquadTabKey);
        localStorage.setItem(`squad-${squadId}-activeTab`, key);
    }
  };

  const renderTabContent = (key: SquadTabKey) => {
    switch (key) {
      case "entry":
        return <SquadGoalEntryPage key={goalEntryKey} squadId={squadId} />;
      case "history":
        return <SquadGoalsHistoryPage key={historyKey} squadId={squadId} />;
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
        <Stack gap="md">
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
                value="entry" 
                // Add your active class conditionally for the CSS to pick up the underline
                className={activeTab === 'entry' ? 'active' : ''}
              >
                Log Entry
              </Tabs.Tab>
              <Tabs.Tab 
                value="history"
                className={activeTab === 'history' ? 'active' : ''}
              >
                History
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
              <Tabs.Panel value="entry">{renderTabContent("entry")}</Tabs.Panel>
              <Tabs.Panel value="history">{renderTabContent("history")}</Tabs.Panel>
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
