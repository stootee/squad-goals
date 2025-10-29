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
import tempfile

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from flask import Flask
from models import db as _db, User, Squad, SquadMember
from flask_login import LoginManager
from flask_cors import CORS


@pytest.fixture(scope='function')
def app():
    """
    Create and configure a Flask app instance for testing.

    Returns:
        Flask app configured for testing
    """
    # Create a fresh Flask app for each test
    test_app = Flask(__name__)

    # Configure for testing
    test_app.config.update({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'SQLALCHEMY_TRACK_MODIFICATIONS': False,
        'WTF_CSRF_ENABLED': False,
        'SECRET_KEY': 'test-secret-key',
        'SESSION_COOKIE_HTTPONLY': True,
        'SESSION_COOKIE_SECURE': False,
        'SESSION_COOKIE_SAMESITE': "Lax"
    })

    # Initialize extensions
    _db.init_app(test_app)
    login_manager = LoginManager()
    login_manager.init_app(test_app)
    CORS(test_app, supports_credentials=True)

    # User loader
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(user_id)

    @login_manager.unauthorized_handler
    def unauthorized():
        from flask import jsonify
        return jsonify({"error": "Unauthorized"}), 401

    # Register blueprints
    from routes import register_blueprints
    register_blueprints(test_app)

    # Create database tables
    with test_app.app_context():
        _db.create_all()
        yield test_app
        # Cleanup after each test
        _db.session.remove()
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
    # App context is already active from app fixture
    yield _db


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
