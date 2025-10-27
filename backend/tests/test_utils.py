"""
Unit tests for utility functions in utils.py.

Tests cover:
- Date and datetime parsing
- Validation functions
- Database query helpers
"""

import pytest
from datetime import date, datetime
from utils import (
    parse_date_range,
    parse_iso_datetime_range,
    validate_counter_range,
    validate_boundary_value,
    validate_partition_data,
    validate_counter_partition,
    validate_time_partition
)


class TestParseDateRange:
    """Tests for parse_date_range function."""

    def test_parse_with_start_and_end(self):
        """Test parsing with both start and end dates."""
        start, end, error = parse_date_range("2024-01-01", "2024-01-31")
        assert start == date(2024, 1, 1)
        assert end == date(2024, 1, 31)
        assert error is None

    def test_parse_single_date(self):
        """Test parsing with single date."""
        start, end, error = parse_date_range(single_date="2024-01-15")
        assert start == date(2024, 1, 15)
        assert end == date(2024, 1, 15)
        assert error is None

    def test_parse_default_to_today(self):
        """Test default to today when no dates provided."""
        start, end, error = parse_date_range()
        today = datetime.utcnow().date()
        assert start == today
        assert end == today
        assert error is None

    def test_parse_invalid_format(self):
        """Test error on invalid date format."""
        start, end, error = parse_date_range("01/01/2024", "01/31/2024")
        assert start is None
        assert end is None
        assert error == "Invalid date format. Must be YYYY-MM-DD"

    def test_parse_no_default(self):
        """Test behavior when default_to_today is False."""
        start, end, error = parse_date_range(default_to_today=False)
        assert start is None
        assert end is None
        assert error == "No date provided"


class TestParseIsoDatetimeRange:
    """Tests for parse_iso_datetime_range function."""

    def test_parse_valid_iso_datetimes(self):
        """Test parsing valid ISO 8601 datetimes."""
        start, end, error = parse_iso_datetime_range(
            "2024-01-01T00:00:00",
            "2024-01-31T23:59:59"
        )
        assert start == datetime(2024, 1, 1, 0, 0, 0)
        assert end == datetime(2024, 1, 31, 23, 59, 59)
        assert error is None

    def test_parse_with_utc_suffix(self):
        """Test parsing ISO datetimes with Z suffix."""
        start, end, error = parse_iso_datetime_range(
            "2024-01-01T00:00:00Z",
            "2024-01-31T23:59:59Z"
        )
        assert start is not None
        assert end is not None
        assert error is None

    def test_parse_start_after_end(self):
        """Test error when start is after end."""
        start, end, error = parse_iso_datetime_range(
            "2024-01-31T00:00:00",
            "2024-01-01T00:00:00"
        )
        assert start is None
        assert end is None
        assert error == "Start date/time must be before end date/time"

    def test_parse_invalid_format(self):
        """Test error on invalid datetime format."""
        start, end, error = parse_iso_datetime_range(
            "not-a-date",
            "also-not-a-date"
        )
        assert start is None
        assert end is None
        assert "Invalid date/datetime format" in error


class TestValidateCounterRange:
    """Tests for validate_counter_range function."""

    def test_validate_valid_range(self):
        """Test validation of valid counter range."""
        start, end, error = validate_counter_range(1, 10)
        assert start == 1
        assert end == 10
        assert error is None

    def test_validate_with_none_start(self):
        """Test validation with None start value."""
        start, end, error = validate_counter_range(None, 10)
        assert start == 0  # Default
        assert end == 10
        assert error is None

    def test_validate_with_none_end(self):
        """Test validation with None end value."""
        start, end, error = validate_counter_range(5, None)
        assert start == 5
        assert end is None
        assert error is None

    def test_validate_string_numbers(self):
        """Test validation with string representations of numbers."""
        start, end, error = validate_counter_range("5", "15")
        assert start == 5
        assert end == 15
        assert error is None

    def test_validate_start_equals_end(self):
        """Test error when start equals or exceeds end."""
        start, end, error = validate_counter_range(10, 10)
        assert start is None
        assert end is None
        assert error == "Start value must be less than or equal to end value"

    def test_validate_invalid_values(self):
        """Test error with non-numeric values."""
        start, end, error = validate_counter_range("not-a-number", 10)
        assert start is None
        assert end is None
        assert error == "CustomCounter start/end values must be integers"


class TestValidateBoundaryValue:
    """Tests for validate_boundary_value function."""

    def test_validate_date_string(self):
        """Test validation of date string."""
        value, error = validate_boundary_value("2024-01-01")
        assert value == "2024-01-01"
        assert error is None

    def test_validate_counter_value(self):
        """Test validation of counter value."""
        value, error = validate_boundary_value(42)
        assert value == "42"
        assert error is None

    def test_validate_empty_string(self):
        """Test error on empty string."""
        value, error = validate_boundary_value("")
        assert value is None
        assert error == "Invalid or missing entry boundary value"

    def test_validate_none(self):
        """Test error on None."""
        value, error = validate_boundary_value(None)
        assert value is None
        assert error == "Invalid or missing entry boundary value"


class TestValidatePartitionData:
    """Tests for partition validation functions."""

    def test_validate_invalid_partition_type(self):
        """Test error on invalid partition type."""
        valid_types = ['Daily', 'Weekly', 'CustomCounter']
        data, error = validate_partition_data('InvalidType', {}, valid_types)
        assert data is None
        assert "Invalid partition_type" in error

    def test_validate_custom_counter_partition(self):
        """Test validation of CustomCounter partition."""
        data_input = {
            'partition_label': 'Episodes',
            'start_value': 1,
            'end_value': 10
        }
        data, error = validate_counter_partition(data_input)
        assert data is not None
        assert error is None
        assert data['partition_label'] == 'Episodes'
        assert data['start_value'] == 1
        assert data['end_value'] == 10

    def test_validate_counter_missing_label(self):
        """Test error when counter partition missing label."""
        data_input = {
            'start_value': 1,
            'end_value': 10
        }
        data, error = validate_counter_partition(data_input)
        assert data is None
        assert error == "CustomCounter partition requires a partition_label"

    def test_validate_time_partition(self):
        """Test validation of time-based partition."""
        data_input = {
            'start_date': '2024-01-01T00:00:00',
            'end_date': '2024-01-31T23:59:59'
        }
        data, error = validate_time_partition(data_input)
        assert data is not None
        assert error is None
        assert data['start_date'] is not None
        assert data['end_date'] is not None

    def test_validate_time_partition_missing_dates(self):
        """Test error when time partition missing dates."""
        data_input = {}
        data, error = validate_time_partition(data_input)
        assert data is None
        assert error == "Missing required group fields (start_date, end_date)"


# Note: Database query helper tests require database fixtures
# and are covered in integration tests
