import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@components/AppLayout";
import {
  Container,
  Paper,
  TextInput,
  Select,
  NumberInput,
  Button,
  Stack,
  Alert,
  Loader,
  Center,
  Title,
  Text,
  Group,
} from "@mantine/core";
import { authApi, UserProfile, ProfileSaveResponse, ApiError } from "@api";

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [calorieGoal, setCalorieGoal] = useState<number | null>(null);
  const [proteinGoal, setProteinGoal] = useState<number | null>(null);

  // Fetch existing profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const data = await authApi.getProfile();
        setProfile(data);
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 401) {
            navigate("/login");
            return;
          }
          console.error("Error fetching profile:", err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      const result = await authApi.updateProfile(profile);

      setMessage(result.message || "Profile saved successfully!");
      setMessageType("success");
      setCalorieGoal(result.calorie_goal || null);
      setProteinGoal(result.protein_goal || null);

      // Clear message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      console.error("Error saving profile:", err);

      if (err instanceof ApiError) {
        setMessage(err.message || "Failed to save profile.");
      } else {
        setMessage("Unable to reach server. Please try again later.");
      }

      setMessageType("error");
      setCalorieGoal(null);
      setProteinGoal(null);

      // Clear message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Profile">
        <Center style={{ minHeight: '200px' }}>
          <Loader size="lg" />
        </Center>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Profile">
      <Container size="sm">
        <Paper shadow="md" p="xl" withBorder>
          <Stack gap="lg">
            <Title order={2}>Your Profile</Title>

            {message && (
              <Alert
                color={messageType === "success" ? "green" : "red"}
                title={messageType === "success" ? "Success" : "Error"}
                withCloseButton
                onClose={() => setMessage(null)}
              >
                {message}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <TextInput
                  label="Name"
                  placeholder="Enter your name"
                  value={profile.name || ""}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />

                <NumberInput
                  label="Age"
                  placeholder="Enter your age"
                  value={profile.age || ""}
                  onChange={(value) => setProfile({ ...profile, age: Number(value) || undefined })}
                  min={0}
                  max={150}
                />

                <NumberInput
                  label="Height (cm)"
                  placeholder="Enter your height"
                  value={profile.height_cm || ""}
                  onChange={(value) => setProfile({ ...profile, height_cm: Number(value) || undefined })}
                  min={0}
                  max={300}
                />

                <NumberInput
                  label="Weight (kg)"
                  placeholder="Enter your weight"
                  value={profile.weight_kg || ""}
                  onChange={(value) => setProfile({ ...profile, weight_kg: Number(value) || undefined })}
                  min={0}
                  max={500}
                  decimalScale={1}
                />

                <NumberInput
                  label="Goal Weight (kg)"
                  placeholder="Enter your goal weight"
                  value={profile.goal_weight_kg || ""}
                  onChange={(value) => setProfile({ ...profile, goal_weight_kg: Number(value) || undefined })}
                  min={0}
                  max={500}
                  decimalScale={1}
                />

                <Select
                  label="Gender"
                  placeholder="Select gender"
                  value={profile.gender || ""}
                  onChange={(value) => setProfile({ ...profile, gender: value || undefined })}
                  data={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                  ]}
                  clearable
                />

                <Button type="submit" loading={saving} fullWidth mt="md">
                  Save Profile
                </Button>
              </Stack>
            </form>

            {(calorieGoal || proteinGoal) && (
              <Paper bg="blue.0" p="md" mt="md" withBorder>
                <Stack gap="xs">
                  <Title order={4}>Your Goals</Title>
                  {calorieGoal && (
                    <Group gap="xs">
                      <Text fw={500}>Daily Calorie Goal:</Text>
                      <Text>{calorieGoal} kcal</Text>
                    </Group>
                  )}
                  {proteinGoal && (
                    <Group gap="xs">
                      <Text fw={500}>Daily Protein Goal:</Text>
                      <Text>{proteinGoal} g</Text>
                    </Group>
                  )}
                </Stack>
              </Paper>
            )}
          </Stack>
        </Paper>
      </Container>
    </AppLayout>
  );
};

export default ProfilePage;
