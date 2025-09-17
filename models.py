# In models.py
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date  # NEW: Import date

db = SQLAlchemy()


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    # NEW: Relationship to DailyStats
    daily_stats = db.relationship('DailyStats', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class DailyStats(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, default=date.today)
    steps = db.Column(db.Integer, default=0)
    calories_in = db.Column(db.Integer, default=0)
    water_in = db.Column(db.Integer, default=0)
    sleep = db.Column(db.Float, default=0.0)
    exercise = db.Column(db.Integer, default=0)
    protein = db.Column(db.Integer, default=0)
    # Foreign key linking to the User model
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    # Ensure only one record per user per day
    __table_args__ = (db.UniqueConstraint('user_id', 'date', name='_user_date_uc'),)