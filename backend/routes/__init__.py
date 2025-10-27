"""
Routes package for Squad Goals application.

This package contains Flask blueprints organized by feature:
- auth: Authentication (signup, login, logout, password reset)
- profile: User profile management
- squads: Squad CRUD and member management
- invites: Squad invitation system
- goals: Goal groups and goals management
- goal_entries: Goal entry submission and history
"""

from flask import Flask


def register_blueprints(app: Flask) -> None:
    """
    Register all application blueprints with the Flask app.

    Args:
        app: The Flask application instance
    """
    from .auth import auth_bp
    from .profile import profile_bp
    from .squads import squads_bp
    from .invites import invites_bp
    from .goals import goals_bp
    from .goal_entries import goal_entries_bp

    # Register all blueprints with /api prefix
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(profile_bp, url_prefix='/api')
    app.register_blueprint(squads_bp, url_prefix='/api')
    app.register_blueprint(invites_bp, url_prefix='/api')
    app.register_blueprint(goals_bp, url_prefix='/api')
    app.register_blueprint(goal_entries_bp, url_prefix='/api')
