import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Container, Title, Text, Button, Paper, Stack } from '@mantine/core';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Container size="sm" style={{ marginTop: '2rem' }}>
          <Paper shadow="md" p="xl" withBorder>
            <Stack gap="md">
              <Title order={2} c="red">Something went wrong</Title>
              <Text c="dimmed">
                An unexpected error occurred while rendering this page.
              </Text>
              {this.state.error && (
                <Paper bg="gray.0" p="sm" withBorder>
                  <Text size="sm" ff="monospace" c="red">
                    {this.state.error.message}
                  </Text>
                </Paper>
              )}
              <Button onClick={this.handleReset} variant="filled">
                Reload Page
              </Button>
            </Stack>
          </Paper>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
