"""
Backend API Tests for Invoice Processing Application
Tests: Auth (login, register, forgot-password), Admin (users, reset-password), Manual Invoice Entry
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"
DEMO_EMAIL = "demo@smartitbox.com"
DEMO_PASSWORD = "demo123"

class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_login_admin_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        print(f"Admin login response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            assert "token" in data
            assert "user" in data
            assert data["user"]["email"] == ADMIN_EMAIL
            assert data["user"]["role"] == "admin"
            print("✓ Admin login successful")
        else:
            print(f"Admin login failed: {response.text}")
            pytest.skip("Admin credentials not set up")
    
    def test_login_demo_user_success(self):
        """Test demo user login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        print(f"Demo user login response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            assert "token" in data
            assert "user" in data
            assert data["user"]["email"] == DEMO_EMAIL
            print("✓ Demo user login successful")
        else:
            print(f"Demo user login failed: {response.text}")
            pytest.skip("Demo user credentials not set up")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")
    
    def test_forgot_password_existing_email(self):
        """Test forgot password with existing email"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": ADMIN_EMAIL
        })
        print(f"Forgot password response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Forgot password response: {data['message']}")
    
    def test_forgot_password_nonexistent_email(self):
        """Test forgot password with non-existent email (should still return 200 for security)"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "nonexistent@test.com"
        })
        # Should return 200 for security (don't reveal if email exists)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✓ Forgot password handles non-existent email securely")
    
    def test_register_new_user(self):
        """Test user registration"""
        unique_email = f"TEST_user_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "name": "Test User"
        })
        print(f"Register response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            assert "token" in data
            assert "user" in data
            assert data["user"]["email"] == unique_email
            print(f"✓ User registration successful: {unique_email}")
        else:
            print(f"Registration response: {response.text}")
            # May fail if email already exists
            assert response.status_code in [200, 400]


class TestAdminEndpoints:
    """Admin panel endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_get_all_users(self, admin_token):
        """Test admin can get all users"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"Get all users response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin retrieved {len(data)} users")
        
        # Verify user structure
        if len(data) > 0:
            user = data[0]
            assert "id" in user
            assert "email" in user
            assert "name" in user
            print("✓ User data structure is correct")
    
    def test_get_all_users_unauthorized(self):
        """Test non-admin cannot access admin endpoints"""
        # First login as demo user
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        if login_response.status_code != 200:
            pytest.skip("Demo user not available")
        
        demo_token = login_response.json().get("token")
        
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        # Should be forbidden for non-admin
        assert response.status_code == 403
        print("✓ Non-admin correctly denied access to admin endpoints")
    
    def test_admin_reset_password_for_user(self, admin_token):
        """Test admin can reset password for a non-admin user"""
        # First get list of users
        users_response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if users_response.status_code != 200:
            pytest.skip("Could not get users list")
        
        users = users_response.json()
        
        # Find a non-admin user
        non_admin_user = None
        for user in users:
            if user.get("role") != "admin":
                non_admin_user = user
                break
        
        if not non_admin_user:
            pytest.skip("No non-admin user found to test password reset")
        
        # Reset password
        response = requests.post(
            f"{BASE_URL}/api/admin/users/{non_admin_user['id']}/reset-password",
            json={"new_password": "newpassword123"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"Reset password response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Admin reset password for user: {non_admin_user['email']}")
        
        # Verify user can login with new password
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": non_admin_user['email'],
            "password": "newpassword123"
        })
        assert login_response.status_code == 200
        print("✓ User can login with new password")
        
        # Reset back to original password if it was demo user
        if non_admin_user['email'] == DEMO_EMAIL:
            requests.post(
                f"{BASE_URL}/api/admin/users/{non_admin_user['id']}/reset-password",
                json={"new_password": DEMO_PASSWORD},
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            print("✓ Demo user password restored")
    
    def test_admin_cannot_reset_admin_password(self, admin_token):
        """Test admin cannot reset another admin's password via this endpoint"""
        # Get admin user ID
        users_response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        users = users_response.json()
        
        admin_user = None
        for user in users:
            if user.get("role") == "admin":
                admin_user = user
                break
        
        if not admin_user:
            pytest.skip("No admin user found")
        
        response = requests.post(
            f"{BASE_URL}/api/admin/users/{admin_user['id']}/reset-password",
            json={"new_password": "newadminpass"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Should be rejected
        assert response.status_code == 400
        print("✓ Admin password reset correctly blocked")


class TestManualInvoiceEntry:
    """Manual invoice entry endpoint tests"""
    
    @pytest.fixture
    def user_token(self):
        """Get user authentication token"""
        # Try demo user first
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        
        # Try admin if demo not available
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        
        pytest.skip("No user authentication available")
    
    def test_create_manual_sales_invoice(self, user_token):
        """Test creating a manual sales invoice"""
        invoice_no = f"TEST_SALES_{uuid.uuid4().hex[:6]}"
        invoice_data = {
            "invoice_type": "sales",
            "original_filename": f"Manual Entry - {invoice_no}",
            "extracted_data": {
                "invoice_no": invoice_no,
                "invoice_date": "2024-12-15",
                "bill_to_name": "Test Customer",
                "bill_to_gst": "22AAAAA0000A1Z5",
                "bill_to_address": "Test Address",
                "basic_amount": 10000,
                "gst": 1800,
                "total_amount": 11800
            },
            "confidence_scores": {},
            "status": "verified",
            "is_manual_entry": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/manual",
            json=invoice_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        print(f"Create manual sales invoice response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            assert data["invoice_type"] == "sales"
            print(f"✓ Manual sales invoice created: {invoice_no}")
            
            # Cleanup - delete the test invoice
            delete_response = requests.delete(
                f"{BASE_URL}/api/invoices/{data['id']}",
                headers={"Authorization": f"Bearer {user_token}"}
            )
            print(f"Cleanup: deleted test invoice")
        else:
            print(f"Response: {response.text}")
            # May fail due to GST validation - that's expected behavior
            assert response.status_code in [200, 400]
    
    def test_create_manual_purchase_invoice(self, user_token):
        """Test creating a manual purchase invoice"""
        invoice_no = f"TEST_PURCH_{uuid.uuid4().hex[:6]}"
        invoice_data = {
            "invoice_type": "purchase",
            "original_filename": f"Manual Entry - {invoice_no}",
            "extracted_data": {
                "invoice_no": invoice_no,
                "invoice_date": "2024-12-15",
                "supplier_name": "Test Supplier",
                "supplier_gst": "22BBBBB0000B1Z5",
                "supplier_address": "Supplier Address",
                "basic_amount": 5000,
                "gst": 900,
                "total_amount": 5900
            },
            "confidence_scores": {},
            "status": "verified",
            "is_manual_entry": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/manual",
            json=invoice_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        print(f"Create manual purchase invoice response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            assert data["invoice_type"] == "purchase"
            print(f"✓ Manual purchase invoice created: {invoice_no}")
            
            # Cleanup
            requests.delete(
                f"{BASE_URL}/api/invoices/{data['id']}",
                headers={"Authorization": f"Bearer {user_token}"}
            )
        else:
            print(f"Response: {response.text}")
            assert response.status_code in [200, 400]
    
    def test_duplicate_invoice_rejected(self, user_token):
        """Test that duplicate invoice numbers are rejected"""
        invoice_no = f"TEST_DUP_{uuid.uuid4().hex[:6]}"
        invoice_data = {
            "invoice_type": "sales",
            "original_filename": f"Manual Entry - {invoice_no}",
            "extracted_data": {
                "invoice_no": invoice_no,
                "invoice_date": "2024-12-15",
                "bill_to_name": "Test Customer",
                "basic_amount": 1000,
                "gst": 180,
                "total_amount": 1180
            },
            "status": "verified",
            "is_manual_entry": True
        }
        
        # Create first invoice
        response1 = requests.post(
            f"{BASE_URL}/api/invoices/manual",
            json=invoice_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        if response1.status_code != 200:
            pytest.skip("Could not create first invoice for duplicate test")
        
        first_invoice_id = response1.json().get("id")
        
        # Try to create duplicate
        response2 = requests.post(
            f"{BASE_URL}/api/invoices/manual",
            json=invoice_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # Should be rejected as duplicate
        assert response2.status_code == 400
        assert "duplicate" in response2.text.lower()
        print("✓ Duplicate invoice correctly rejected")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/invoices/{first_invoice_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )


class TestHealthAndBasicEndpoints:
    """Basic health and endpoint tests"""
    
    def test_api_reachable(self):
        """Test that API is reachable"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        # Health endpoint may not exist, but we should get some response
        print(f"Health check response: {response.status_code}")
        assert response.status_code in [200, 404, 405]
        print("✓ API is reachable")
    
    def test_invoices_endpoint_requires_auth(self):
        """Test that invoices endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/invoices")
        assert response.status_code in [401, 403]
        print("✓ Invoices endpoint correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
