"""
Authorization decorators for the Squad Goals application.

This module contains Flask route decorators for:
- Squad membership verification
- Squad admin authorization
"""

from functools import wraps
from typing import Callable, Any
from flask import jsonify
from flask_login import current_user
from models import Squad


def squad_member_required(f: Callable) -> Callable:
    """
    Decorator to ensure the current user is a member of the squad.

    Args:
        f: The view function to decorate

    Returns:
        Decorated function that verifies squad membership

    Usage:
        @app.route('/squads/<squad_id>/resource')
        @login_required
        @squad_member_required
        def my_view(squad_id: str, squad: Squad):
            # squad object is automatically passed
            pass
    """
    @wraps(f)
    def decorated_function(squad_id: str, *args: Any, **kwargs: Any) -> Any:
        squad = Squad.query.get_or_404(squad_id)
        if current_user not in squad.members:
            return jsonify({"message": "Not a squad member"}), 403
        # Pass the retrieved squad object to the view function for efficiency
        return f(squad_id, squad, *args, **kwargs)
    return decorated_function


def squad_admin_required(f: Callable) -> Callable:
    """
    Decorator to ensure the current user is the admin of the squad.

    Args:
        f: The view function to decorate

    Returns:
        Decorated function that verifies squad admin status

    Usage:
        @app.route('/squads/<squad_id>/admin-resource')
        @login_required
        @squad_admin_required
        def my_admin_view(squad_id: str, squad: Squad):
            # squad object is automatically passed
            pass
    """
    @wraps(f)
    def decorated_function(squad_id: str, *args: Any, **kwargs: Any) -> Any:
        squad = Squad.query.get_or_404(squad_id)
        if current_user.id != squad.admin_id:
            return jsonify({"error": "Not authorized to manage this squad"}), 403
        # Pass the retrieved squad object to the view function for efficiency
        return f(squad_id, squad, *args, **kwargs)
    return decorated_function
