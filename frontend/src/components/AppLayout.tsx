import React from "react";
import { useNavigate } from "react-router-dom";
import {
  AppShell,
  Burger,
  Group,
  Button,
  Title,
  Container,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { authApi } from "@api";

interface AppLayoutProps {
  title?: string;
  children: React.ReactNode;
  showMenu?: boolean;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  title = "Squagol",
  children,
  showMenu = true,
}) => {
  const navigate = useNavigate();
  const [opened, { toggle, close }] = useDisclosure();

  const handleLogout = async () => {
    try {
      await authApi.logout();
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
      // Even if logout fails, navigate to login
      navigate("/login");
    }
  };

  const handleTitleClick = () => {
    navigate("/");
    close();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    close();
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 250,
        breakpoint: 'sm',
        collapsed: { mobile: !opened, desktop: true },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            {showMenu && (
              <Burger
                opened={opened}
                onClick={toggle}
                hiddenFrom="sm"
                size="sm"
              />
            )}
            <Title
              order={3}
              style={{ cursor: 'pointer' }}
              onClick={handleTitleClick}
            >
              {title}
            </Title>
          </Group>

          {showMenu && (
            <Group visibleFrom="sm" gap="sm">
              <Button
                variant="subtle"
                onClick={() => handleNavigation("/squads")}
              >
                Squads
              </Button>
              <Button
                variant="subtle"
                onClick={() => handleNavigation("/profile")}
              >
                Profile
              </Button>
              <Button
                variant="subtle"
                color="red"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </Group>
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Button
          variant="subtle"
          fullWidth
          justify="flex-start"
          onClick={() => handleNavigation("/squads")}
        >
          Squads
        </Button>
        <Button
          variant="subtle"
          fullWidth
          justify="flex-start"
          onClick={() => handleNavigation("/profile")}
        >
          Profile
        </Button>
        <Button
          variant="subtle"
          color="red"
          fullWidth
          justify="flex-start"
          onClick={handleLogout}
        >
          Logout
        </Button>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="xl" px="md">
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
};

export default AppLayout;
