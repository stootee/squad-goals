import React from "react";
import { Container, Paper, Stack, Title, Text, Button, Center } from "@mantine/core";

const HomePage: React.FC = () => {
  return (
    <Center style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Container size="sm">
        <Paper shadow="xl" p="xl" radius="md" withBorder>
          <Stack gap="lg" align="center">
            <Title order={1} ta="center">Welcome to Squad Goals!</Title>

            <Text size="lg" c="dimmed" ta="center">
              Track your squads, invite friends, and achieve your goals together.
            </Text>

            <Button
              component="a"
              href="/login.html"
              size="lg"
              variant="filled"
              fullWidth
              mt="md"
            >
              Log In
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Center>
  );
};

export default HomePage;
