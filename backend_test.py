import requests
import sys
import json
import base64
from datetime import datetime
import time

class InvoiceAPITester:
    def __init__(self, base_url="https://invoiceai-14.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_invoice_id = None

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        return success

    def test_user_registration(self):
        """Test user registration"""
        test_user = {
            "name": "Test User",
            "email": f"test_{int(time.time())}@example.com",
            "password": "testpass123"
        }
        
        try:
            response = requests.post(f"{self.api_url}/auth/register", json=test_user, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'token' in data and 'user' in data:
                    self.token = data['token']
                    self.user_id = data['user']['id']
                    return self.log_test("User Registration", True, f"- User ID: {self.user_id}")
                else:
                    return self.log_test("User Registration", False, "- Missing token or user in response")
            else:
                return self.log_test("User Registration", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("User Registration", False, f"- Error: {str(e)}")

    def test_user_login(self):
        """Test user login with existing credentials"""
        login_data = {
            "email": "test@example.com",
            "password": "testpass123"
        }
        
        try:
            response = requests.post(f"{self.api_url}/auth/login", json=login_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'token' in data:
                    # Use this token for subsequent tests if registration failed
                    if not self.token:
                        self.token = data['token']
                        self.user_id = data['user']['id']
                    return self.log_test("User Login", True, "- Login successful")
                else:
                    return self.log_test("User Login", False, "- Missing token in response")
            else:
                return self.log_test("User Login", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("User Login", False, f"- Error: {str(e)}")

    def test_invoice_upload(self):
        """Test invoice upload with a sample image"""
        if not self.token:
            return self.log_test("Invoice Upload", False, "- No authentication token")
        
        # Create a simple test image (1x1 pixel PNG)
        test_image_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        )
        
        try:
            files = {'file': ('test_invoice.png', test_image_data, 'image/png')}
            headers = {'Authorization': f'Bearer {self.token}'}
            
            response = requests.post(
                f"{self.api_url}/invoices/upload", 
                files=files, 
                headers=headers, 
                timeout=30  # AI processing might take time
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'id' in data:
                    self.test_invoice_id = data['id']
                    return self.log_test("Invoice Upload", True, f"- Invoice ID: {self.test_invoice_id}")
                else:
                    return self.log_test("Invoice Upload", False, "- Missing invoice ID in response")
            else:
                return self.log_test("Invoice Upload", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("Invoice Upload", False, f"- Error: {str(e)}")

    def test_get_invoices(self):
        """Test getting all invoices"""
        if not self.token:
            return self.log_test("Get Invoices", False, "- No authentication token")
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(f"{self.api_url}/invoices", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    return self.log_test("Get Invoices", True, f"- Found {len(data)} invoices")
                else:
                    return self.log_test("Get Invoices", False, "- Response is not a list")
            else:
                return self.log_test("Get Invoices", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("Get Invoices", False, f"- Error: {str(e)}")

    def test_get_specific_invoice(self):
        """Test getting a specific invoice"""
        if not self.token or not self.test_invoice_id:
            return self.log_test("Get Specific Invoice", False, "- No token or invoice ID")
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(f"{self.api_url}/invoices/{self.test_invoice_id}", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'id' in data and data['id'] == self.test_invoice_id:
                    return self.log_test("Get Specific Invoice", True, "- Invoice details retrieved")
                else:
                    return self.log_test("Get Specific Invoice", False, "- Invoice ID mismatch")
            else:
                return self.log_test("Get Specific Invoice", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("Get Specific Invoice", False, f"- Error: {str(e)}")

    def test_update_invoice(self):
        """Test updating invoice data"""
        if not self.token or not self.test_invoice_id:
            return self.log_test("Update Invoice", False, "- No token or invoice ID")
        
        update_data = {
            "extracted_data": {
                "invoice_no": "TEST-001",
                "invoice_date": "01/01/2024",
                "supplier_name": "Test Supplier",
                "address": "Test Address",
                "gst_no": "TEST123456789",
                "basic_amount": 1000.0,
                "gst": 180.0,
                "total_amount": 1180.0
            },
            "status": "verified"
        }
        
        try:
            headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
            response = requests.put(
                f"{self.api_url}/invoices/{self.test_invoice_id}", 
                json=update_data, 
                headers=headers, 
                timeout=10
            )
            
            if response.status_code == 200:
                return self.log_test("Update Invoice", True, "- Invoice updated successfully")
            else:
                return self.log_test("Update Invoice", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("Update Invoice", False, f"- Error: {str(e)}")

    def test_export_invoices(self):
        """Test exporting invoices"""
        if not self.token or not self.test_invoice_id:
            return self.log_test("Export Invoices", False, "- No token or invoice ID")
        
        export_data = {
            "invoice_ids": [self.test_invoice_id],
            "format": "csv"
        }
        
        try:
            headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
            response = requests.post(
                f"{self.api_url}/invoices/export", 
                json=export_data, 
                headers=headers, 
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'format' in data and 'data' in data:
                    return self.log_test("Export Invoices", True, f"- Exported as {data['format']}")
                else:
                    return self.log_test("Export Invoices", False, "- Missing format or data in response")
            else:
                return self.log_test("Export Invoices", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("Export Invoices", False, f"- Error: {str(e)}")

    def test_delete_invoice(self):
        """Test deleting an invoice"""
        if not self.token or not self.test_invoice_id:
            return self.log_test("Delete Invoice", False, "- No token or invoice ID")
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.delete(f"{self.api_url}/invoices/{self.test_invoice_id}", headers=headers, timeout=10)
            
            if response.status_code == 200:
                return self.log_test("Delete Invoice", True, "- Invoice deleted successfully")
            else:
                return self.log_test("Delete Invoice", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("Delete Invoice", False, f"- Error: {str(e)}")

    # ============= NEW FEATURE TESTS =============

    def test_admin_login(self):
        """Test admin login with provided credentials"""
        admin_login_data = {
            "email": "admin@test.com",
            "password": "admin123"
        }
        
        try:
            response = requests.post(f"{self.api_url}/auth/login", json=admin_login_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'token' in data and 'user' in data:
                    self.admin_token = data['token']
                    self.admin_user_id = data['user']['id']
                    admin_role = data['user'].get('role', 'user')
                    if admin_role == 'admin':
                        return self.log_test("Admin Login", True, f"- Admin authenticated, Role: {admin_role}")
                    else:
                        return self.log_test("Admin Login", False, f"- User role is '{admin_role}', not 'admin'")
                else:
                    return self.log_test("Admin Login", False, "- Missing token or user in response")
            else:
                return self.log_test("Admin Login", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("Admin Login", False, f"- Error: {str(e)}")

    def test_get_current_user_profile(self):
        """Test GET /api/users/me"""
        if not self.token:
            return self.log_test("Get Current User Profile", False, "- No authentication token")
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(f"{self.api_url}/users/me", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['id', 'email', 'name', 'role', 'created_at']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    return self.log_test("Get Current User Profile", True, f"- Profile retrieved: {data.get('email')}")
                else:
                    return self.log_test("Get Current User Profile", False, f"- Missing fields: {missing_fields}")
            else:
                return self.log_test("Get Current User Profile", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("Get Current User Profile", False, f"- Error: {str(e)}")

    def test_update_user_profile(self):
        """Test PUT /api/users/me"""
        if not self.token:
            return self.log_test("Update User Profile", False, "- No authentication token")
        
        update_data = {
            "name": "Updated Test User"
        }
        
        try:
            headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
            response = requests.put(f"{self.api_url}/users/me", json=update_data, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'message' in data:
                    return self.log_test("Update User Profile", True, "- Profile updated successfully")
                else:
                    return self.log_test("Update User Profile", False, "- Missing success message")
            else:
                return self.log_test("Update User Profile", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("Update User Profile", False, f"- Error: {str(e)}")

    def test_update_user_password(self):
        """Test PUT /api/users/me with password change"""
        if not self.token:
            return self.log_test("Update User Password", False, "- No authentication token")
        
        # First, let's try with wrong current password to test validation
        wrong_password_data = {
            "current_password": "wrongpassword",
            "new_password": "newtestpass123"
        }
        
        try:
            headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
            response = requests.put(f"{self.api_url}/users/me", json=wrong_password_data, headers=headers, timeout=10)
            
            if response.status_code == 400:
                return self.log_test("Update User Password", True, "- Correctly rejected wrong current password")
            else:
                return self.log_test("Update User Password", False, f"- Should reject wrong password, got status: {response.status_code}")
                
        except Exception as e:
            return self.log_test("Update User Password", False, f"- Error: {str(e)}")

    def test_admin_get_all_users(self):
        """Test GET /api/admin/users"""
        if not hasattr(self, 'admin_token') or not self.admin_token:
            return self.log_test("Admin Get All Users", False, "- No admin authentication token")
        
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = requests.get(f"{self.api_url}/admin/users", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    return self.log_test("Admin Get All Users", True, f"- Retrieved {len(data)} users")
                else:
                    return self.log_test("Admin Get All Users", False, "- No users found or invalid response format")
            else:
                return self.log_test("Admin Get All Users", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("Admin Get All Users", False, f"- Error: {str(e)}")

    def test_admin_get_specific_user(self):
        """Test GET /api/admin/users/{user_id}"""
        if not hasattr(self, 'admin_token') or not self.admin_token:
            return self.log_test("Admin Get Specific User", False, "- No admin authentication token")
        
        if not self.user_id:
            return self.log_test("Admin Get Specific User", False, "- No user ID available")
        
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = requests.get(f"{self.api_url}/admin/users/{self.user_id}", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'id' in data and data['id'] == self.user_id:
                    return self.log_test("Admin Get Specific User", True, f"- Retrieved user: {data.get('email')}")
                else:
                    return self.log_test("Admin Get Specific User", False, "- User ID mismatch in response")
            else:
                return self.log_test("Admin Get Specific User", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("Admin Get Specific User", False, f"- Error: {str(e)}")

    def test_admin_update_user(self):
        """Test PUT /api/admin/users/{user_id}"""
        if not hasattr(self, 'admin_token') or not self.admin_token:
            return self.log_test("Admin Update User", False, "- No admin authentication token")
        
        if not self.user_id:
            return self.log_test("Admin Update User", False, "- No user ID available")
        
        update_data = {
            "role": "user",
            "subscription_valid_until": "2024-12-31T23:59:59Z"
        }
        
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}', 'Content-Type': 'application/json'}
            response = requests.put(f"{self.api_url}/admin/users/{self.user_id}", json=update_data, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'message' in data:
                    return self.log_test("Admin Update User", True, "- User updated successfully")
                else:
                    return self.log_test("Admin Update User", False, "- Missing success message")
            else:
                return self.log_test("Admin Update User", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("Admin Update User", False, f"- Error: {str(e)}")

    def test_admin_stats(self):
        """Test GET /api/admin/stats"""
        if not hasattr(self, 'admin_token') or not self.admin_token:
            return self.log_test("Admin Stats", False, "- No admin authentication token")
        
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = requests.get(f"{self.api_url}/admin/stats", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['total_users', 'total_invoices', 'active_subscriptions']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    return self.log_test("Admin Stats", True, f"- Stats: {data['total_users']} users, {data['total_invoices']} invoices")
                else:
                    return self.log_test("Admin Stats", False, f"- Missing fields: {missing_fields}")
            else:
                return self.log_test("Admin Stats", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("Admin Stats", False, f"- Error: {str(e)}")

    def test_financial_summary(self):
        """Test GET /api/reports/financial-summary"""
        if not self.token:
            return self.log_test("Financial Summary", False, "- No authentication token")
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(f"{self.api_url}/reports/financial-summary", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['monthly_data', 'totals']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    monthly_count = len(data.get('monthly_data', []))
                    return self.log_test("Financial Summary", True, f"- Retrieved {monthly_count} months of data")
                else:
                    return self.log_test("Financial Summary", False, f"- Missing fields: {missing_fields}")
            else:
                return self.log_test("Financial Summary", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("Financial Summary", False, f"- Error: {str(e)}")

    def test_non_admin_access_to_admin_endpoints(self):
        """Test that non-admin users cannot access admin endpoints"""
        if not self.token:
            return self.log_test("Non-Admin Access Control", False, "- No authentication token")
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(f"{self.api_url}/admin/users", headers=headers, timeout=10)
            
            if response.status_code == 403:
                return self.log_test("Non-Admin Access Control", True, "- Correctly blocked non-admin access")
            else:
                return self.log_test("Non-Admin Access Control", False, f"- Should block non-admin, got status: {response.status_code}")
                
        except Exception as e:
            return self.log_test("Non-Admin Access Control", False, f"- Error: {str(e)}")

    def test_admin_delete_user(self):
        """Test DELETE /api/admin/users/{user_id} - This should be last as it deletes the test user"""
        if not hasattr(self, 'admin_token') or not self.admin_token:
            return self.log_test("Admin Delete User", False, "- No admin authentication token")
        
        if not self.user_id:
            return self.log_test("Admin Delete User", False, "- No user ID available")
        
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = requests.delete(f"{self.api_url}/admin/users/{self.user_id}", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'message' in data:
                    return self.log_test("Admin Delete User", True, "- User deleted successfully")
                else:
                    return self.log_test("Admin Delete User", False, "- Missing success message")
            else:
                return self.log_test("Admin Delete User", False, f"- Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            return self.log_test("Admin Delete User", False, f"- Error: {str(e)}")

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Invoice Processing API Tests")
        print("=" * 50)
        
        # Test authentication
        self.test_user_registration()
        self.test_user_login()
        
        # Test invoice operations
        self.test_invoice_upload()
        self.test_get_invoices()
        self.test_get_specific_invoice()
        self.test_update_invoice()
        self.test_export_invoices()
        self.test_delete_invoice()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = InvoiceAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())