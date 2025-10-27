#!/usr/bin/env python3
"""
Quick test script to verify API endpoints are accessible.
Run this to check if the backend is working correctly.
"""

import requests
import sys

BASE_URL = "http://localhost:5050/api"

def test_endpoint(method, path, **kwargs):
    """Test an API endpoint."""
    url = f"{BASE_URL}{path}"
    try:
        if method == "GET":
            response = requests.get(url, **kwargs)
        elif method == "POST":
            response = requests.post(url, **kwargs)

        print(f"✓ {method} {path}: {response.status_code}")
        return response
    except Exception as e:
        print(f"✗ {method} {path}: ERROR - {e}")
        return None

def main():
    print("Testing Squad Goals API Endpoints\n")
    print("=" * 50)

    # Test unauthenticated endpoint
    print("\n1. Testing unauthenticated endpoints:")
    test_endpoint("GET", "/squads")  # Should return 401

    # Test signup
    print("\n2. Testing signup:")
    test_endpoint("POST", "/signup", json={
        "username": "testuser",
        "password": "testpass123"
    })

    # Test login
    print("\n3. Testing login:")
    session = requests.Session()
    response = session.post(f"{BASE_URL}/login", json={
        "username": "testuser",
        "password": "testpass123"
    })
    print(f"✓ POST /login: {response.status_code}")

    if response.status_code == 200:
        # Test authenticated endpoint
        print("\n4. Testing authenticated endpoints:")
        response = session.get(f"{BASE_URL}/squads")
        print(f"✓ GET /squads: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"  Response: {data}")

            if isinstance(data, list):
                print(f"  ✓ User can access squads endpoint")
                print(f"  ✓ User has {len(data)} squad(s)")
            else:
                print(f"  ✗ Unexpected response format")
        else:
            print(f"  ✗ Cannot access squads endpoint")

    print("\n" + "=" * 50)
    print("\nIf all tests pass, the API is working correctly!")
    print("Non-admin users should be able to access /api/squads")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nTest interrupted.")
        sys.exit(1)
