#!/bin/bash

# ============================================================================
# WorkPlus Backend Deployment Verification Script
# ============================================================================
# Usage: ./verify-deployment.sh [BACKEND_URL] [SUPER_ADMIN_EMAIL] [SUPER_ADMIN_PASSWORD]
# 
# Environment variables can be set instead of command-line args:
#   BACKEND_URL: Backend API URL (default: https://workplus-backend-sg3a.onrender.com)
#   SUPER_ADMIN_EMAIL: Admin email for testing (from .env SUPER_ADMIN_EMAIL)
#   SUPER_ADMIN_PASSWORD: Admin password for testing (from .env SUPER_ADMIN_PASSWORD)
# ============================================================================

echo "🔍 WorkPlus Backend Deployment Verification"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration - Use environment variables or command-line arguments
# SECURITY: Never hardcode production credentials; use environment variables
BACKEND_URL="${1:-${BACKEND_URL:-https://workplus-backend-sg3a.onrender.com}}"
SUPER_ADMIN_EMAIL="${2:-${SUPER_ADMIN_EMAIL:-admin@example.com}}"
SUPER_ADMIN_PASSWORD="${3:-${SUPER_ADMIN_PASSWORD}}"

# Validate required parameters
if [ -z "$SUPER_ADMIN_EMAIL" ] || [ -z "$SUPER_ADMIN_PASSWORD" ]; then
  echo -e "${RED}❌ ERROR: Missing required parameters${NC}"
  echo "Usage: ./verify-deployment.sh [BACKEND_URL] [SUPER_ADMIN_EMAIL] [SUPER_ADMIN_PASSWORD]"
  echo ""
  echo "Or set environment variables:"
  echo "  export BACKEND_URL=https://your-backend.com"
  echo "  export SUPER_ADMIN_EMAIL=admin@example.com"
  echo "  export SUPER_ADMIN_PASSWORD=<your-secure-password>"
  echo "  ./verify-deployment.sh"
  exit 1
fi

echo "📍 Backend URL: $BACKEND_URL"
echo "📧 Admin Email: $SUPER_ADMIN_EMAIL"
echo ""

# Test 1: Basic Health Check
echo "Test 1: Basic Health Check"
echo "-------------------------------------------"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ PASSED${NC} - Server is healthy (HTTP $HTTP_CODE)"
    echo "Response: $RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
else
    echo -e "${RED}❌ FAILED${NC} - Server health check failed (HTTP $HTTP_CODE)"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

# Test 2: Database Health Check
echo "Test 2: Database Health Check"
echo "-------------------------------------------"
DB_HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/health/db")
DB_HTTP_CODE=$(echo "$DB_HEALTH_RESPONSE" | tail -n1)
DB_RESPONSE_BODY=$(echo "$DB_HEALTH_RESPONSE" | head -n-1)

if [ "$DB_HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ PASSED${NC} - Database is connected (HTTP $DB_HTTP_CODE)"
    echo "Response: $DB_RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$DB_RESPONSE_BODY"
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - Database health check returned (HTTP $DB_HTTP_CODE)"
    echo "Response: $DB_RESPONSE_BODY"
fi
echo ""

# Test 3: Super Admin Login
echo "Test 3: Super Admin Login"
echo "-------------------------------------------"
echo "   Endpoint: ${BACKEND_URL}/api/auth/login"
echo "   Email: $SUPER_ADMIN_EMAIL"
echo ""

LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SUPER_ADMIN_EMAIL\",\"password\":\"$SUPER_ADMIN_PASSWORD\"}")
LOGIN_HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
LOGIN_RESPONSE_BODY=$(echo "$LOGIN_RESPONSE" | head -n-1)

if [ "$LOGIN_HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ PASSED${NC} - Super Admin login successful (HTTP $LOGIN_HTTP_CODE)"
    echo "Response: $LOGIN_RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE_BODY"
    
    # Extract token for further tests
    TOKEN=$(echo "$LOGIN_RESPONSE_BODY" | jq -r '.data.token' 2>/dev/null)
    if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
        echo -e "${GREEN}✅ JWT Token received${NC}"
    fi
else
    echo -e "${RED}❌ FAILED${NC} - Super Admin login failed (HTTP $LOGIN_HTTP_CODE)"
    echo "Response: $LOGIN_RESPONSE_BODY"
fi
echo ""

# Test 4: CORS Check
echo "Test 4: CORS Configuration"
echo "-------------------------------------------"
CORS_RESPONSE=$(curl -s -I -X OPTIONS "$BACKEND_URL/api/auth/login" \
  -H "Origin: https://hexerve.online" \
  -H "Access-Control-Request-Method: POST")

if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
    echo -e "${GREEN}✅ PASSED${NC} - CORS headers present"
    echo "$CORS_RESPONSE" | grep "Access-Control"
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - CORS headers not found"
fi
echo ""

# Summary
echo "============================================"
echo "📊 VERIFICATION SUMMARY"
echo "============================================"
echo ""

TESTS_PASSED=0
TESTS_TOTAL=4

[ "$HTTP_CODE" = "200" ] && ((TESTS_PASSED++))
[ "$DB_HTTP_CODE" = "200" ] && ((TESTS_PASSED++))
[ "$LOGIN_HTTP_CODE" = "200" ] && ((TESTS_PASSED++))
echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin" && ((TESTS_PASSED++))

echo "Tests Passed: $TESTS_PASSED/$TESTS_TOTAL"
echo ""

if [ "$TESTS_PASSED" -eq "$TESTS_TOTAL" ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo "Backend is production-ready and fully operational."
    exit 0
elif [ "$TESTS_PASSED" -ge 2 ]; then
    echo -e "${YELLOW}⚠️  SOME TESTS FAILED${NC}"
    echo "Backend is partially operational. Review failed tests above."
    exit 1
else
    echo -e "${RED}❌ CRITICAL FAILURES${NC}"
    echo "Backend has critical issues. Review all failed tests above."
    exit 2
fi

# Test 1: Basic Health Check
echo "Test 1: Basic Health Check"
echo "-------------------------------------------"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ PASSED${NC} - Server is healthy (HTTP $HTTP_CODE)"
    echo "Response: $RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
else
    echo -e "${RED}❌ FAILED${NC} - Server health check failed (HTTP $HTTP_CODE)"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

# Test 2: Database Health Check
echo "Test 2: Database Health Check"
echo "-------------------------------------------"
DB_HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/health/db")
DB_HTTP_CODE=$(echo "$DB_HEALTH_RESPONSE" | tail -n1)
DB_RESPONSE_BODY=$(echo "$DB_HEALTH_RESPONSE" | head -n-1)

if [ "$DB_HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ PASSED${NC} - Database is connected (HTTP $DB_HTTP_CODE)"
    echo "Response: $DB_RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$DB_RESPONSE_BODY"
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - Database health check returned (HTTP $DB_HTTP_CODE)"
    echo "Response: $DB_RESPONSE_BODY"
fi
echo ""

# Test 3: Full Health Check
echo "Test 3: Full Health Check"
echo "-------------------------------------------"
FULL_HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/health/full")
FULL_HTTP_CODE=$(echo "$FULL_HEALTH_RESPONSE" | tail -n1)
FULL_RESPONSE_BODY=$(echo "$FULL_HEALTH_RESPONSE" | head -n-1)

if [ "$FULL_HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ PASSED${NC} - Full health check successful (HTTP $FULL_HTTP_CODE)"
    echo "Response: $FULL_RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$FULL_RESPONSE_BODY"
else
    echo -e "${RED}❌ FAILED${NC} - Full health check failed (HTTP $FULL_HTTP_CODE)"
    echo "Response: $FULL_RESPONSE_BODY"
fi
echo ""

# Test 4: Super Admin Login
echo "Test 4: Super Admin Login"
echo "-------------------------------------------"
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SUPER_ADMIN_EMAIL\",\"password\":\"$SUPER_ADMIN_PASSWORD\"}")
LOGIN_HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
LOGIN_RESPONSE_BODY=$(echo "$LOGIN_RESPONSE" | head -n-1)

if [ "$LOGIN_HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ PASSED${NC} - Super Admin login successful (HTTP $LOGIN_HTTP_CODE)"
    echo "Response: $LOGIN_RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE_BODY"
    
    # Extract token for further tests
    TOKEN=$(echo "$LOGIN_RESPONSE_BODY" | jq -r '.data.token' 2>/dev/null)
    if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
        echo -e "${GREEN}✅ JWT Token received${NC}"
    fi
else
    echo -e "${RED}❌ FAILED${NC} - Super Admin login failed (HTTP $LOGIN_HTTP_CODE)"
    echo "Response: $LOGIN_RESPONSE_BODY"
fi
echo ""

# Test 5: CORS Check
echo "Test 5: CORS Configuration"
echo "-------------------------------------------"
CORS_RESPONSE=$(curl -s -I -X OPTIONS "$BACKEND_URL/api/auth/login" \
  -H "Origin: https://hexerve.online" \
  -H "Access-Control-Request-Method: POST")

if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
    echo -e "${GREEN}✅ PASSED${NC} - CORS headers present"
    echo "$CORS_RESPONSE" | grep "Access-Control"
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - CORS headers not found"
fi
echo ""

# Summary
echo "============================================"
echo "📊 VERIFICATION SUMMARY"
echo "============================================"
echo ""

TESTS_PASSED=0
TESTS_TOTAL=5

[ "$HTTP_CODE" = "200" ] && ((TESTS_PASSED++))
[ "$DB_HTTP_CODE" = "200" ] && ((TESTS_PASSED++))
[ "$FULL_HTTP_CODE" = "200" ] && ((TESTS_PASSED++))
[ "$LOGIN_HTTP_CODE" = "200" ] && ((TESTS_PASSED++))
echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin" && ((TESTS_PASSED++))

echo "Tests Passed: $TESTS_PASSED/$TESTS_TOTAL"
echo ""

if [ "$TESTS_PASSED" -eq "$TESTS_TOTAL" ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo "Backend is production-ready and fully operational."
    exit 0
elif [ "$TESTS_PASSED" -ge 3 ]; then
    echo -e "${YELLOW}⚠️  SOME TESTS FAILED${NC}"
    echo "Backend is partially operational. Review failed tests above."
    exit 1
else
    echo -e "${RED}❌ CRITICAL FAILURES${NC}"
    echo "Backend has critical issues. Review all failed tests above."
    exit 2
fi
