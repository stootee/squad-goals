import React, { useMemo } from 'react';
import { Stack, Group, Text, Button, useMantineTheme } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

// ====================================================
// Interfaces (Move these definitions here or to a shared types file)
// ====================================================
interface PartitionContext {
    type: string;
    label: string;
    start: string | number;
    end: string | number | null;
    isCounter: boolean;
    groupName: string;
}

interface BoundaryNavigatorProps {
  currentBoundary: string | number; 
  changeBoundary: (delta: number) => void;
  partitionContext: PartitionContext;
}

// ====================================================
// Boundary Navigator Component
// ====================================================
const BoundaryNavigator: React.FC<BoundaryNavigatorProps> = ({ currentBoundary, changeBoundary, partitionContext }) => {
  const { isCounter, label, end, type } = partitionContext;
  const theme = useMantineTheme();
  
  const isToday = useMemo(() => {
    if (isCounter || typeof currentBoundary !== 'string') return false;
    const todayDatePart = new Date().toISOString().split("T")[0];
    const boundaryDatePart = currentBoundary.split("T")[0];
    return todayDatePart === boundaryDatePart;
  }, [currentBoundary, isCounter]);

  const formattedDisplay = useMemo(() => {
    if (isCounter) {
      const counterLabel = partitionContext.groupName || 'Counter';
      return `${counterLabel} ${String(currentBoundary)}`;
    }
    
    if (typeof currentBoundary !== 'string') return 'Invalid Date Type';
    
    const dateObj = new Date(currentBoundary);
    const isTimeBased = ['PerMinute', 'PerHour'].includes(type);
    
    const dateOptions: Intl.DateTimeFormatOptions = { 
        weekday: "short", 
        month: "short", 
        day: "numeric" 
    };
    
    const timeOptions: Intl.DateTimeFormatOptions = { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false
    };

    let display;

    if (isToday) {
        display = `Today, ${dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    } else {
        display = dateObj.toLocaleDateString(undefined, dateOptions);
    }
    
    if (isTimeBased) {
        display += ` ${dateObj.toLocaleTimeString(undefined, timeOptions)}`;
    }
    return display;

  }, [currentBoundary, isCounter, isToday, type, partitionContext.groupName]);

  const isAtEndBoundary = useMemo(() => {
    if (end === null || end === undefined) return false;
    
    let current: string | number;
    let maxEnd: string | number;

    if (isCounter) {
        current = Number(currentBoundary);
        maxEnd = Number(end);
    } else {
        current = currentBoundary as string;
        maxEnd = end as string;
    }
    
    return current >= maxEnd;
  }, [currentBoundary, end, isCounter]);

  return (
    // Outer Stack centers all content
    <Stack 
        align="center" 
        gap="xs" 
        py="md"
        mb="md"
        sx={{ borderBottom: `1px solid ${theme.colors.gray[3]}`, width: '100%' }}
    >
        {/* Line 1: Weekly / Daily Label */}
        <Text size="xs" color="dimmed" weight={500} tt="uppercase" align="center">
             {partitionContext.label}
        </Text>
        
        {/* Line 2: Date / Boundary Value */}
        <Text weight={700} size="lg" color="dark" align="center">
          {formattedDisplay}
        </Text>
        
        {/* Line 3: Navigation Buttons */}
        <Group 
            position="center" 
            grow 
            gap="xs" 
            mt="xs" 
            sx={{ width: '100%', maxWidth: 300 }}
        >
            <Button 
                variant="default" 
                color="dark"
                onClick={() => changeBoundary(-1)}
                leftSection={<IconChevronLeft size={16} />}
            >
                Prev
            </Button>
            
            <Button 
                variant="default" 
                color="dark"
                onClick={() => changeBoundary(1)} 
                disabled={isAtEndBoundary} 
                rightSection={<IconChevronRight size={16} />}
            >
                Next
            </Button>
        </Group>
    </Stack>
  );
};

export { PartitionContext, BoundaryNavigatorProps }; // Export types if needed elsewhere
export default BoundaryNavigator; // Export the component