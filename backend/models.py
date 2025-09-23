from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date, datetime

db = SQLAlchemy()


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    daily_stats = db.relationship('DailyStats', backref='user', lazy=True)

    # New columns for password reset
    reset_token = db.Column(db.String(128), nullable=True, unique=True)
    reset_token_expiration = db.Column(db.DateTime, nullable=True)

    # New relationship to UserProfile
    profile = db.relationship('UserProfile', backref='user', uselist=False, lazy=True)

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
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    __table_args__ = (db.UniqueConstraint('user_id', 'date', name='_user_date_uc'),)


# NEW: UserProfile model
class UserProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=True)
    gender = db.Column(db.String(10), nullable=True)
    age = db.Column(db.Integer, nullable=True)
    height_cm = db.Column(db.Float, nullable=True)
    weight_kg = db.Column(db.Float, nullable=True)
    goal_weight_kg = db.Column(db.Float, nullable=True)

    def to_dict(self):
        return {
            'name': self.name,
            'gender': self.gender,
            'age': self.age,
            'height_cm': self.height_cm,
            'weight_kg': self.weight_kg,
            'goal_weight_kg': self.goal_weight_kg
        }
