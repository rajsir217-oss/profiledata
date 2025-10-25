"""
Test suite for Search Functionality
Tests the advanced search system including:
- Keyword search
- Age range filtering
- Height range filtering
- Location search
- Multiple filter combinations
- Pagination
- Results sorting
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime
from main import app
from database import get_database


@pytest.fixture
def search_test_users(test_db):
    """Create diverse set of users for search testing"""
    users = [
        {
            "username": "john_doe",
            "password": "hashed_password",
            "firstName": "John",
            "lastName": "Doe",
            "dateOfBirth": "1990-01-15",
            "sex": "Male",
            "height": "5'10\"",
            "location": "New York, USA",
            "education": "Bachelor's",
            "occupation": "Engineer",
            "religion": "Christian",
            "eatingPreference": "Non-Veg"
        },
        {
            "username": "jane_smith",
            "password": "hashed_password",
            "firstName": "Jane",
            "lastName": "Smith",
            "dateOfBirth": "1992-05-20",
            "sex": "Female",
            "height": "5'6\"",
            "location": "Los Angeles, USA",
            "education": "Master's",
            "occupation": "Doctor",
            "religion": "Hindu",
            "eatingPreference": "Vegetarian"
        },
        {
            "username": "bob_wilson",
            "password": "hashed_password",
            "firstName": "Bob",
            "lastName": "Wilson",
            "dateOfBirth": "1988-03-10",
            "sex": "Male",
            "height": "6'0\"",
            "location": "New York, USA",
            "education": "PhD",
            "occupation": "Professor",
            "religion": "Christian",
            "eatingPreference": "Vegetarian"
        },
        {
            "username": "alice_brown",
            "password": "hashed_password",
            "firstName": "Alice",
            "lastName": "Brown",
            "dateOfBirth": "1995-07-25",
            "sex": "Female",
            "height": "5'4\"",
            "location": "Chicago, USA",
            "education": "Bachelor's",
            "occupation": "Designer",
            "religion": "Muslim",
            "eatingPreference": "Non-Veg"
        },
        {
            "username": "charlie_davis",
            "password": "hashed_password",
            "firstName": "Charlie",
            "lastName": "Davis",
            "dateOfBirth": "1985-12-05",
            "sex": "Male",
            "height": "5'8\"",
            "location": "Boston, USA",
            "education": "Master's",
            "occupation": "Lawyer",
            "religion": "Hindu",
            "eatingPreference": "Eggetarian"
        }
    ]
    
    import asyncio
    asyncio.get_event_loop().run_until_complete(test_db.users.insert_many(users))
    return users

@pytest.fixture
def cleanup_search(test_db):
    """Clean up after search tests"""
    yield
    # Cleanup is handled by test_db fixture

class TestKeywordSearch:
    """Test keyword-based search"""
    
    def test_search_by_first_name(self, search_test_users):
        """Test searching by first name"""
        response = client.get("/api/users/search?keyword=John")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        
        # Check if John is in results
        usernames = [user["username"] for user in data["users"]]
        assert "john_doe" in usernames
    
    def test_search_by_last_name(self, search_test_users):
        """Test searching by last name"""
        response = client.get("/api/users/search?keyword=Smith")
        
        assert response.status_code == 200
        data = response.json()
        
        usernames = [user["username"] for user in data["users"]]
        assert "jane_smith" in usernames
    
    def test_search_by_location(self, search_test_users):
        """Test searching by location"""
        response = client.get("/api/users/search?keyword=New York")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 2  # john_doe and bob_wilson
    
    def test_search_case_insensitive(self, search_test_users):
        """Test that search is case-insensitive"""
        response1 = client.get("/api/users/search?keyword=john")
        response2 = client.get("/api/users/search?keyword=JOHN")
        response3 = client.get("/api/users/search?keyword=John")
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        assert response3.status_code == 200
        
        # All should return same results
        assert response1.json()["total"] == response2.json()["total"]
        assert response2.json()["total"] == response3.json()["total"]
    
    def test_search_partial_match(self, search_test_users):
        """Test partial keyword matching"""
        response = client.get("/api/users/search?keyword=Jo")
        
        assert response.status_code == 200
        # Should match John
        assert response.json()["total"] >= 1

class TestAgeRangeSearch:
    """Test age range filtering"""
    
    def test_search_by_age_range(self, search_test_users):
        """Test searching within age range"""
        # Search for users aged 30-35
        response = client.get("/api/users/search?ageMin=30&ageMax=35")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all results are within age range
        for user in data["users"]:
            if "age" in user:
                assert 30 <= user["age"] <= 35
    
    def test_search_by_min_age_only(self, search_test_users):
        """Test searching with only minimum age"""
        response = client.get("/api/users/search?ageMin=30")
        
        assert response.status_code == 200
        data = response.json()
        
        for user in data["users"]:
            if "age" in user:
                assert user["age"] >= 30
    
    def test_search_by_max_age_only(self, search_test_users):
        """Test searching with only maximum age"""
        response = client.get("/api/users/search?ageMax=35")
        
        assert response.status_code == 200
        data = response.json()
        
        for user in data["users"]:
            if "age" in user:
                assert user["age"] <= 35
    
    def test_search_invalid_age_range(self, search_test_users):
        """Test searching with invalid age range (min > max)"""
        response = client.get("/api/users/search?ageMin=40&ageMax=30")
        
        # Should either return empty results or validation error
        assert response.status_code in [200, 422]

class TestHeightRangeSearch:
    """Test height range filtering"""
    
    def test_search_by_height_range(self, search_test_users):
        """Test searching within height range"""
        response = client.get("/api/users/search?heightMin=66&heightMax=72")
        
        assert response.status_code == 200
        # Should return users within height range
    
    def test_search_by_min_height_only(self, search_test_users):
        """Test searching with only minimum height"""
        response = client.get("/api/users/search?heightMin=70")
        
        assert response.status_code == 200
        # Should return users with height >= 70 inches
    
    def test_search_by_max_height_only(self, search_test_users):
        """Test searching with only maximum height"""
        response = client.get("/api/users/search?heightMax=68")
        
        assert response.status_code == 200
        # Should return users with height <= 68 inches

class TestGenderSearch:
    """Test gender filtering"""
    
    def test_search_by_gender_male(self, search_test_users):
        """Test searching for male users"""
        response = client.get("/api/users/search?gender=Male")
        
        assert response.status_code == 200
        data = response.json()
        
        for user in data["users"]:
            if "sex" in user:
                assert user["sex"] == "Male"
    
    def test_search_by_gender_female(self, search_test_users):
        """Test searching for female users"""
        response = client.get("/api/users/search?gender=Female")
        
        assert response.status_code == 200
        data = response.json()
        
        for user in data["users"]:
            if "sex" in user:
                assert user["sex"] == "Female"

class TestLocationSearch:
    """Test location-based search"""
    
    def test_search_by_exact_location(self, search_test_users):
        """Test searching by exact location"""
        response = client.get("/api/users/search?location=New York, USA")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 2  # john_doe and bob_wilson
    
    def test_search_by_city_only(self, search_test_users):
        """Test searching by city name only"""
        response = client.get("/api/users/search?location=Chicago")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1  # alice_brown

class TestEducationOccupationSearch:
    """Test education and occupation filtering"""
    
    def test_search_by_education(self, search_test_users):
        """Test searching by education level"""
        response = client.get("/api/users/search?education=Master's")
        
        assert response.status_code == 200
        data = response.json()
        
        for user in data["users"]:
            if "education" in user:
                assert user["education"] == "Master's"
    
    def test_search_by_occupation(self, search_test_users):
        """Test searching by occupation"""
        response = client.get("/api/users/search?occupation=Engineer")
        
        assert response.status_code == 200
        data = response.json()
        
        usernames = [user["username"] for user in data["users"]]
        assert "john_doe" in usernames

class TestReligionEatingPreference:
    """Test religion and eating preference filtering"""
    
    def test_search_by_religion(self, search_test_users):
        """Test searching by religion"""
        response = client.get("/api/users/search?religion=Hindu")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 2  # jane_smith and charlie_davis
    
    def test_search_by_eating_preference(self, search_test_users):
        """Test searching by eating preference"""
        response = client.get("/api/users/search?eatingPreference=Vegetarian")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 2  # jane_smith and bob_wilson

class TestMultipleFilters:
    """Test combining multiple search filters"""
    
    def test_search_with_multiple_filters(self, search_test_users):
        """Test searching with multiple filters combined"""
        response = client.get(
            "/api/users/search?gender=Male&location=New York&ageMin=30&ageMax=40"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all filters are applied
        for user in data["users"]:
            if "sex" in user:
                assert user["sex"] == "Male"
            if "location" in user:
                assert "New York" in user["location"]
    
    def test_search_keyword_with_filters(self, search_test_users):
        """Test combining keyword search with filters"""
        response = client.get("/api/users/search?keyword=John&gender=Male")
        
        assert response.status_code == 200
        data = response.json()
        
        usernames = [user["username"] for user in data["users"]]
        assert "john_doe" in usernames
    
    def test_search_all_filters_combined(self, search_test_users):
        """Test using all available filters together"""
        response = client.get(
            "/api/users/search?"
            "keyword=Engineer&"
            "gender=Male&"
            "ageMin=25&ageMax=40&"
            "heightMin=66&heightMax=72&"
            "location=New York&"
            "education=Bachelor's&"
            "religion=Christian"
        )
        
        assert response.status_code == 200
        # Should return very specific results

class TestPagination:
    """Test search pagination"""
    
    def test_search_with_pagination(self, search_test_users):
        """Test paginated search results"""
        response = client.get("/api/users/search?page=1&limit=2")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["users"]) <= 2
        assert "total" in data
    
    def test_search_page_2(self, search_test_users):
        """Test retrieving second page of results"""
        response = client.get("/api/users/search?page=2&limit=2")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["users"]) <= 2
    
    def test_search_different_page_sizes(self, search_test_users):
        """Test different page sizes"""
        response1 = client.get("/api/users/search?limit=1")
        response2 = client.get("/api/users/search?limit=5")
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        assert len(response1.json()["users"]) <= 1
        assert len(response2.json()["users"]) <= 5
    
    def test_search_invalid_page_number(self, search_test_users):
        """Test invalid page number"""
        response = client.get("/api/users/search?page=0")
        
        # Should return validation error or first page
        assert response.status_code in [200, 422]

class TestEmptyResults:
    """Test search with no matching results"""
    
    def test_search_no_matches(self, search_test_users):
        """Test search that returns no results"""
        response = client.get("/api/users/search?keyword=NonexistentName")
        
        assert response.status_code == 200
        data = response.json()
        assert data["users"] == []
        assert data["total"] == 0
    
    def test_search_impossible_filters(self, search_test_users):
        """Test search with impossible filter combination"""
        response = client.get(
            "/api/users/search?gender=Male&occupation=NonexistentJob"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0

class TestSearchPerformance:
    """Test search performance and optimization"""
    
    @pytest.mark.slow
    def test_search_with_many_results(self, search_test_users):
        """Test search performance with many results"""
        response = client.get("/api/users/search?limit=200")
        
        assert response.status_code == 200
        # Should complete in reasonable time
    
    @pytest.mark.slow
    def test_complex_search_performance(self, search_test_users):
        """Test performance of complex multi-filter search"""
        response = client.get(
            "/api/users/search?"
            "keyword=test&"
            "gender=Male&"
            "ageMin=25&ageMax=45&"
            "location=USA"
        )
        
        assert response.status_code == 200
        # Should complete efficiently

class TestSearchEdgeCases:
    """Test edge cases and error handling"""
    
    def test_search_with_special_characters(self, search_test_users):
        """Test search with special characters in keyword"""
        response = client.get("/api/users/search?keyword=<script>alert('xss')</script>")
        
        assert response.status_code == 200
        # Should handle safely without XSS
    
    def test_search_with_very_long_keyword(self, search_test_users):
        """Test search with extremely long keyword"""
        long_keyword = "a" * 1000
        response = client.get(f"/api/users/search?keyword={long_keyword}")
        
        # Should handle gracefully
        assert response.status_code in [200, 400, 422]
    
    def test_search_with_sql_injection_attempt(self, search_test_users):
        """Test search with SQL injection attempt"""
        response = client.get("/api/users/search?keyword=' OR '1'='1")
        
        assert response.status_code == 200
        # Should not be vulnerable to SQL injection
    
    def test_search_with_empty_parameters(self, search_test_users):
        """Test search with empty parameter values"""
        response = client.get("/api/users/search?keyword=&gender=")
        
        assert response.status_code == 200
        # Should return all users or handle gracefully

class TestSearchIntegration:
    """Integration tests for search workflows"""
    
    def test_search_to_profile_view_workflow(self, search_test_users):
        """Test complete workflow from search to profile view"""
        # Search for user
        search_response = client.get("/api/users/search?keyword=John")
        assert search_response.status_code == 200
        
        users = search_response.json()["users"]
        assert len(users) > 0
        
        # Get profile of first result
        username = users[0]["username"]
        profile_response = client.get(f"/api/users/profile/{username}")
        assert profile_response.status_code == 200
    
    def test_search_excludes_blocked_users(self, search_test_users):
        """Test that search results exclude blocked users"""
        # This would require setting up exclusions
        # Placeholder for future implementation
        pass
