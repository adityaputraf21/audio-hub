function getToken() {
  return localStorage.getItem("authToken");
}
function saveUser(user) {
  localStorage.setItem("authUser", JSON.stringify(user));
}
function getUser() {
  try {
    return JSON.parse(localStorage.getItem("authUser") || "null");
  } catch {
    return null;
  }
}
function clearSession() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("authUser");
}
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function requireLogin() {
  if (!getToken()) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}
