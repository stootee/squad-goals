"""
Integration tests for goal history endpoint with partition filtering.

Tests verify that the /history route only returns entries with boundaries
that are valid for the current partition type.
"""

import pytest
from datetime import datetime, timedelta
from models import db, Goal, GoalGroup, GoalEntry


class TestGoalHistoryPartitionFiltering:
    """Tests for goal history filtering by partition type."""

    @pytest.fixture
    def daily_goal_group(self, db, test_squad):
        """Create a Daily goal group."""
        group = GoalGroup(
            squad_id=test_squad.id,
            group_name="Daily Goals",
            partition_type="Daily",
            start_date=datetime(2024, 10, 1),
            end_date=datetime(2024, 10, 31)
        )
        db.session.add(group)
        db.session.commit()
        return group

    @pytest.fixture
    def weekly_goal_group(self, db, test_squad):
        """Create a Weekly goal group."""
        group = GoalGroup(
            squad_id=test_squad.id,
            group_name="Weekly Goals",
            partition_type="Weekly",
            start_date=datetime(2024, 10, 1),
            end_date=datetime(2024, 10, 31)
        )
        db.session.add(group)
        db.session.commit()
        return group

    @pytest.fixture
    def biweekly_goal_group(self, db, test_squad):
        """Create a BiWeekly goal group."""
        group = GoalGroup(
            squad_id=test_squad.id,
            group_name="BiWeekly Goals",
            partition_type="BiWeekly",
            start_date=datetime(2024, 10, 1),
            end_date=datetime(2024, 10, 31)
        )
        db.session.add(group)
        db.session.commit()
        return group

    @pytest.fixture
    def monthly_goal_group(self, db, test_squad):
        """Create a Monthly goal group."""
        group = GoalGroup(
            squad_id=test_squad.id,
            group_name="Monthly Goals",
            partition_type="Monthly",
            start_date=datetime(2024, 10, 1),
            end_date=datetime(2025, 1, 1)
        )
        db.session.add(group)
        db.session.commit()
        return group

    @pytest.fixture
    def goal_with_daily_entries(self, db, test_user, test_squad, daily_goal_group):
        """Create a goal with daily entries, simulating a partition change scenario."""
        # Create goal (will be changed to weekly later in tests)
        goal = Goal(
            squad_id=test_squad.id,
            group_id=daily_goal_group.id,
            name="Exercise Minutes",
            type="count",
            target="30",
            is_private=True
        )
        db.session.add(goal)
        db.session.commit()

        # Add daily entries from Oct 1-15
        for day_offset in range(15):
            date = datetime(2024, 10, 1) + timedelta(days=day_offset)
            entry = GoalEntry(
                user_id=test_user.id,
                squad_id=test_squad.id,
                goal_id=goal.id,
                boundary_value=date.strftime("%Y-%m-%d"),
                value=str(30 + day_offset),
                note=f"Day {day_offset + 1}"
            )
            db.session.add(entry)

        db.session.commit()
        return goal

    def test_daily_partition_returns_all_entries(
        self,
        authenticated_client,
        test_squad,
        goal_with_daily_entries
    ):
        """Test that Daily partition returns all daily entries."""
        response = authenticated_client.get(
            f'/api/squads/{test_squad.id}/goals/history?page_size=100'
        )

        assert response.status_code == 200
        data = response.json

        # Should have one goal group
        assert len(data['groups']) == 1
        goal_data = data['groups'][0]

        # All 15 entries should be present
        assert len(goal_data['boundaries']) >= 15

    def test_weekly_partition_filters_daily_entries(
        self,
        db,
        authenticated_client,
        test_squad,
        test_user,
        weekly_goal_group,
        goal_with_daily_entries
    ):
        """Test that Weekly partition filters out non-weekly boundaries."""
        # Change goal to weekly group (simulating partition change)
        goal = goal_with_daily_entries
        goal.group_id = weekly_goal_group.id
        db.session.commit()

        response = authenticated_client.get(
            f'/api/squads/{test_squad.id}/goals/history?page_size=100'
        )

        assert response.status_code == 200
        data = response.json

        # Should have one goal group
        assert len(data['groups']) == 1
        goal_data = data['groups'][0]

        # Extract returned boundaries
        boundaries = list(goal_data['boundaries'].keys())

        # Should only include weekly boundaries: Oct 1, 8, 15
        # (entries from other days should be filtered out)
        expected_weekly = {"2024-10-01", "2024-10-08", "2024-10-15"}
        returned_with_data = {b for b in boundaries if goal_data['boundaries'][b]['value'] is not None}

        # All returned entries with data should be valid weekly boundaries
        assert returned_with_data == expected_weekly

        # Should NOT include daily boundaries like Oct 2, 3, 4, etc.
        invalid_boundaries = {"2024-10-02", "2024-10-03", "2024-10-04", "2024-10-05"}
        for invalid in invalid_boundaries:
            if invalid in boundaries:
                # If it's in boundaries, it should be blank (filled gap)
                assert goal_data['boundaries'][invalid]['value'] is None

    def test_biweekly_partition_filters_weekly_entries(
        self,
        db,
        authenticated_client,
        test_squad,
        biweekly_goal_group,
        goal_with_daily_entries
    ):
        """Test that BiWeekly partition filters out non-biweekly boundaries."""
        # Change goal to biweekly group
        goal = goal_with_daily_entries
        goal.group_id = biweekly_goal_group.id
        db.session.commit()

        response = authenticated_client.get(
            f'/api/squads/{test_squad.id}/goals/history?page_size=100'
        )

        assert response.status_code == 200
        data = response.json

        goal_data = data['groups'][0]
        boundaries = list(goal_data['boundaries'].keys())
        returned_with_data = {b for b in boundaries if goal_data['boundaries'][b]['value'] is not None}

        # Should only include biweekly boundaries: Oct 1, 15
        expected_biweekly = {"2024-10-01"}  # Oct 15 is day 14, also valid

        # All returned entries should be valid biweekly boundaries
        for boundary in returned_with_data:
            date = datetime.fromisoformat(boundary)
            start_date = datetime(2024, 10, 1)
            delta_days = (date - start_date).days
            # Must be multiple of 14
            assert delta_days % 14 == 0, f"{boundary} is not a valid biweekly boundary"

        # Should NOT include weekly-only boundaries like Oct 8
        assert "2024-10-08" not in returned_with_data

    def test_monthly_partition_filters_entries(
        self,
        db,
        authenticated_client,
        test_squad,
        test_user,
        monthly_goal_group
    ):
        """Test that Monthly partition only returns same-day-of-month boundaries."""
        # Create goal with monthly group
        goal = Goal(
            squad_id=test_squad.id,
            group_id=monthly_goal_group.id,
            name="Monthly Review",
            type="boolean",
            target="1",
            is_private=True
        )
        db.session.add(goal)
        db.session.commit()

        # Add entries for various days
        dates = [
            "2024-10-01",  # Valid (1st)
            "2024-10-02",  # Invalid
            "2024-10-15",  # Invalid
            "2024-11-01",  # Valid (1st)
            "2024-11-15",  # Invalid
            "2024-12-01",  # Valid (1st)
        ]

        for date_str in dates:
            entry = GoalEntry(
                user_id=test_user.id,
                squad_id=test_squad.id,
                goal_id=goal.id,
                boundary_value=date_str,
                value="1",
                note="Done"
            )
            db.session.add(entry)

        db.session.commit()

        response = authenticated_client.get(
            f'/api/squads/{test_squad.id}/goals/history?page_size=100'
        )

        assert response.status_code == 200
        data = response.json

        goal_data = data['groups'][0]
        boundaries = list(goal_data['boundaries'].keys())
        returned_with_data = {b for b in boundaries if goal_data['boundaries'][b]['value'] is not None}

        # Should only include 1st of each month
        expected_monthly = {"2024-10-01", "2024-11-01", "2024-12-01"}
        assert returned_with_data == expected_monthly

        # Should NOT include other days
        assert "2024-10-02" not in returned_with_data
        assert "2024-10-15" not in returned_with_data
        assert "2024-11-15" not in returned_with_data

    def test_empty_history_with_no_valid_boundaries(
        self,
        db,
        authenticated_client,
        test_squad,
        test_user,
        weekly_goal_group
    ):
        """Test history when no entries match the partition type."""
        # Create goal with weekly group
        goal = Goal(
            squad_id=test_squad.id,
            group_id=weekly_goal_group.id,
            name="Weekly Goal",
            type="count",
            target="5",
            is_private=True
        )
        db.session.add(goal)
        db.session.commit()

        # Add entries that are NOT weekly boundaries
        # (simulating old daily entries)
        invalid_dates = ["2024-10-02", "2024-10-03", "2024-10-04"]
        for date_str in invalid_dates:
            entry = GoalEntry(
                user_id=test_user.id,
                squad_id=test_squad.id,
                goal_id=goal.id,
                boundary_value=date_str,
                value="5",
                note="Invalid"
            )
            db.session.add(entry)

        db.session.commit()

        response = authenticated_client.get(
            f'/api/squads/{test_squad.id}/goals/history?page_size=100'
        )

        assert response.status_code == 200
        data = response.json

        # Should return empty groups since no valid boundaries exist
        assert len(data['groups']) == 0 or len(data['groups'][0]['boundaries']) == 0

    def test_multiple_goals_different_partitions(
        self,
        db,
        authenticated_client,
        test_squad,
        test_user,
        daily_goal_group,
        weekly_goal_group
    ):
        """Test history with multiple goals having different partition types."""
        # Create daily goal with entries
        daily_goal = Goal(
            squad_id=test_squad.id,
            group_id=daily_goal_group.id,
            name="Daily Steps",
            type="count",
            target="10000",
            is_private=True
        )
        db.session.add(daily_goal)

        # Create weekly goal with entries
        weekly_goal = Goal(
            squad_id=test_squad.id,
            group_id=weekly_goal_group.id,
            name="Weekly Workout",
            type="count",
            target="5",
            is_private=True
        )
        db.session.add(weekly_goal)
        db.session.commit()

        # Add daily entries for daily goal
        for day_offset in range(10):
            date = datetime(2024, 10, 1) + timedelta(days=day_offset)
            entry = GoalEntry(
                user_id=test_user.id,
                squad_id=test_squad.id,
                goal_id=daily_goal.id,
                boundary_value=date.strftime("%Y-%m-%d"),
                value="10000"
            )
            db.session.add(entry)

        # Add entries for weekly goal (mix of valid and invalid)
        weekly_dates = ["2024-10-01", "2024-10-02", "2024-10-08", "2024-10-09"]
        for date_str in weekly_dates:
            entry = GoalEntry(
                user_id=test_user.id,
                squad_id=test_squad.id,
                goal_id=weekly_goal.id,
                boundary_value=date_str,
                value="5"
            )
            db.session.add(entry)

        db.session.commit()

        response = authenticated_client.get(
            f'/api/squads/{test_squad.id}/goals/history?page_size=100'
        )

        assert response.status_code == 200
        data = response.json

        # Should have two goal groups
        assert len(data['groups']) == 2

        # Find each goal in results
        daily_data = next(g for g in data['groups'] if g['goal_name'] == 'Daily Steps')
        weekly_data = next(g for g in data['groups'] if g['goal_name'] == 'Weekly Workout')

        # Daily goal should have all entries
        daily_with_data = {b for b in daily_data['boundaries'] if daily_data['boundaries'][b]['value'] is not None}
        assert len(daily_with_data) == 10

        # Weekly goal should only have valid weekly entries (Oct 1, 8)
        weekly_with_data = {b for b in weekly_data['boundaries'] if weekly_data['boundaries'][b]['value'] is not None}
        assert "2024-10-01" in weekly_with_data
        assert "2024-10-08" in weekly_with_data
        assert "2024-10-02" not in weekly_with_data
        assert "2024-10-09" not in weekly_with_data
