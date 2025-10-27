"""
Authentication routes for Squad Goals application.

Handles:
- User signup
- Login/logout
- Password reset
- User info
"""

from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
import secrets

from models import db, User

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/signup', methods=['POST'])
def signup():
    """Register a new user account."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"message": "Username and password required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"message": "Username already exists"}), 409

    new_user = User(username=username)
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "Account created successfully!"}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate user and create session."""
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    if user and user.check_password(data.get('password')):
        login_user(user, remember=data.get('remember-me', False))
        return jsonify({"message": "Login successful"}), 200
    return jsonify({"message": "Invalid username or password."}), 401


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """Log out the current user."""
    logout_user()
    return jsonify({"message": "Logged out successfully"}), 200


@auth_bp.route('/user_info', methods=['GET'])
@login_required
def user_info():
    """Get current user information."""
    return jsonify({'username': current_user.username}), 200


@auth_bp.route('/forgot_password', methods=['POST'])
def forgot_password():
    """Generate password reset token for user."""
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    if user:
        token = secrets.token_urlsafe(32)
        user.reset_token = token
        user.reset_token_expiration = datetime.now() + timedelta(minutes=15)
        db.session.commit()
        return jsonify({
            "message": "Password reset token generated.",
            "token": token
        }), 200
    return jsonify({"message": "User not found."}), 404


@auth_bp.route('/reset_password/<token>', methods=['POST'])
def reset_password(token):
    """Reset user password with valid token."""
    user = User.query.filter_by(reset_token=token).first()
    if not user or user.reset_token_expiration < datetime.now():
        return jsonify({"message": "Invalid or expired token."}), 400

    data = request.get_json()
    user.set_password(data.get('password'))
    user.reset_token = None
    user.reset_token_expiration = None
    db.session.commit()
    return jsonify({"message": "Password has been reset successfully."}), 200
