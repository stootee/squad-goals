from flask import Flask, request, jsonify, send_from_directory
from models import db, User
from flask_login import LoginManager
from flask_cors import CORS
import os
from datetime import datetime, timedelta, date
from collections import defaultdict
import logging
import sys
import json
from dateutil.relativedelta import relativedelta

app = Flask(__name__)

# Force logs to go to stdout
app.logger.addHandler(logging.StreamHandler(sys.stdout))
app.logger.setLevel(logging.INFO)


# ------------------------
# APP CONFIG
# ------------------------

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'a_secret_key')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# secure session cookie setup
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_SAMESITE'] = "Lax"

db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)

# CORS for frontend
CORS(
    app, supports_credentials=True, origins=[
        "http://192.168.0.200:5173",
        "http://squagol:5173"
        ]
    )

@app.errorhandler(405)
def method_not_allowed(e):
    app.logger.error(f"405 Method Not Allowed: {request.method} {request.path}")
    return {"error": "Method Not Allowed"}, 405

# ------------------------
# USER LOADER
# ------------------------
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)

# Return JSON 401 instead of redirect
@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Unauthorized"}), 401

# ------------------------
# AUTO-CREATE DB
# ------------------------
@app.before_request
def create_tables():
    if not os.path.exists('users.db'):
        with app.app_context():
            db.create_all()

# ------------------------
# LEGACY ENDPOINT
# ------------------------
# This endpoint serves static HTML and is kept for backward compatibility
@app.route('/api/reset_password/<token>', methods=['GET'])
def serve_reset_password_page(token):
    # Assuming the frontend handles this
    return send_from_directory('../frontend', 'reset_password.html')

# ------------------------
# REGISTER BLUEPRINTS
# ------------------------
from routes import register_blueprints
register_blueprints(app)

# ------------------------
# RUN
# ------------------------
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5050, debug=True)
