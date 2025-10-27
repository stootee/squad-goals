"""
Pytest configuration and fixtures for Squad Goals tests.

This module provides common test fixtures including:
- Flask app with test configuration
- Test database setup and teardown
- Test client for API requests
- Sample test data
"""

import pytest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app as flask_app
from models import db as _db, User, Squad, SquadMember


@pytest.fixture(scope='session')
def app():
    """
    Create and configure a Flask app instance for testing.

    Returns:
        Flask app configured for testing
    """
    flask_app.config.update({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'WTF_CSRF_ENABLED': False,
        'SECRET_KEY': 'test-secret-key'
    })

    # Create database tables
    with flask_app.app_context():
        _db.create_all()

    yield flask_app

    # Cleanup
    with flask_app.app_context():
        _db.drop_all()


@pytest.fixture(scope='function')
def db(app):
    """
    Provide database session with automatic rollback.

    Args:
        app: Flask app fixture

    Yields:
        Database session
    """
    with app.app_context():
        _db.create_all()
        yield _db
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope='function')
def client(app, db):
    """
    Provide Flask test client.

    Args:
        app: Flask app fixture
        db: Database fixture

    Returns:
        Flask test client
    """
    return app.test_client()


@pytest.fixture(scope='function')
def test_user(db):
    """
    Create a test user.

    Args:
        db: Database fixture

    Returns:
        User object
    """
    user = User(username='testuser')
    user.set_password('testpass123')
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture(scope='function')
def authenticated_client(client, test_user):
    """
    Provide authenticated test client.

    Args:
        client: Flask test client
        test_user: Test user fixture

    Returns:
        Authenticated Flask test client
    """
    # Login the test user
    client.post('/api/login', json={
        'username': 'testuser',
        'password': 'testpass123'
    })
    return client


@pytest.fixture(scope='function')
def test_squad(db, test_user):
    """
    Create a test squad with test user as admin.

    Args:
        db: Database fixture
        test_user: Test user fixture

    Returns:
        Squad object
    """
    squad = Squad(name='Test Squad', admin_id=test_user.id)
    db.session.add(squad)
    db.session.commit()

    # Add user as member
    membership = SquadMember(squad_id=squad.id, user_id=test_user.id)
    db.session.add(membership)
    db.session.commit()

    return squad
