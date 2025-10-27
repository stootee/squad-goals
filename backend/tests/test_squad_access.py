"""
Integration test to verify non-admin users can access their squads.

This test verifies the fix for the issue where the frontend
SquadsPage.tsx was not rendering for non-admin users.
"""

import pytest
from models import db, User, Squad, SquadMember


def test_non_admin_can_list_squads(client, db):
    """Test that non-admin user can list their squads."""
    # Create admin user
    admin = User(username='admin')
    admin.set_password('admin123')
    db.session.add(admin)
    db.session.commit()

    # Create non-admin user
    member = User(username='member')
    member.set_password('member123')
    db.session.add(member)
    db.session.commit()

    # Create squad with admin as owner
    squad = Squad(name='Test Squad', admin_id=admin.id)
    db.session.add(squad)
    db.session.commit()

    # Add both users as members
    admin_membership = SquadMember(squad_id=squad.id, user_id=admin.id)
    member_membership = SquadMember(squad_id=squad.id, user_id=member.id)
    db.session.add(admin_membership)
    db.session.add(member_membership)
    db.session.commit()

    # Login as non-admin member
    response = client.post('/api/login', json={
        'username': 'member',
        'password': 'member123'
    })
    assert response.status_code == 200

    # Get squads - should succeed for non-admin member
    response = client.get('/api/squads')
    assert response.status_code == 200

    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]['name'] == 'Test Squad'
    assert data[0]['admin'] == 'admin'
    assert data[0]['is_admin'] == False  # Member is not admin
    assert data[0]['members'] == 2


def test_non_admin_can_view_squad_details(client, db):
    """Test that non-admin user can view squad details."""
    # Create admin user
    admin = User(username='admin')
    admin.set_password('admin123')
    db.session.add(admin)
    db.session.commit()

    # Create non-admin user
    member = User(username='member')
    member.set_password('member123')
    db.session.add(member)
    db.session.commit()

    # Create squad
    squad = Squad(name='Test Squad', admin_id=admin.id)
    db.session.add(squad)
    db.session.commit()

    # Add both as members
    admin_membership = SquadMember(squad_id=squad.id, user_id=admin.id)
    member_membership = SquadMember(squad_id=squad.id, user_id=member.id)
    db.session.add(admin_membership)
    db.session.add(member_membership)
    db.session.commit()

    # Login as non-admin member
    client.post('/api/login', json={
        'username': 'member',
        'password': 'member123'
    })

    # Get squad details - should succeed for member
    response = client.get(f'/api/squads/{squad.id}')
    assert response.status_code == 200

    data = response.get_json()
    assert data['name'] == 'Test Squad'
    assert data['admin'] == 'admin'
    assert data['is_admin'] == False
    assert len(data['members']) == 2


def test_non_admin_cannot_delete_squad(client, db):
    """Test that non-admin user cannot delete squad."""
    # Create admin user
    admin = User(username='admin')
    admin.set_password('admin123')
    db.session.add(admin)
    db.session.commit()

    # Create non-admin user
    member = User(username='member')
    member.set_password('member123')
    db.session.add(member)
    db.session.commit()

    # Create squad
    squad = Squad(name='Test Squad', admin_id=admin.id)
    db.session.add(squad)
    db.session.commit()

    # Add both as members
    admin_membership = SquadMember(squad_id=squad.id, user_id=admin.id)
    member_membership = SquadMember(squad_id=squad.id, user_id=member.id)
    db.session.add(admin_membership)
    db.session.add(member_membership)
    db.session.commit()

    # Login as non-admin member
    client.post('/api/login', json={
        'username': 'member',
        'password': 'member123'
    })

    # Try to delete squad - should fail with 403
    response = client.delete(f'/api/squads/{squad.id}')
    assert response.status_code == 403

    data = response.get_json()
    assert 'error' in data
    assert 'Not authorized' in data['error']


def test_non_member_cannot_view_squad(client, db):
    """Test that non-member cannot view squad details."""
    # Create admin user
    admin = User(username='admin')
    admin.set_password('admin123')
    db.session.add(admin)
    db.session.commit()

    # Create non-member user
    outsider = User(username='outsider')
    outsider.set_password('outsider123')
    db.session.add(outsider)
    db.session.commit()

    # Create squad with only admin as member
    squad = Squad(name='Test Squad', admin_id=admin.id)
    db.session.add(squad)
    db.session.commit()

    admin_membership = SquadMember(squad_id=squad.id, user_id=admin.id)
    db.session.add(admin_membership)
    db.session.commit()

    # Login as non-member
    client.post('/api/login', json={
        'username': 'outsider',
        'password': 'outsider123'
    })

    # Try to view squad - should fail with 403
    response = client.get(f'/api/squads/{squad.id}')
    assert response.status_code == 403

    data = response.get_json()
    assert 'message' in data
    assert 'Not a squad member' in data['message']
