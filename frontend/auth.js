// auth.js
const apiURL = window.APP_CONFIG.API_URL;

async function login(username, password) {
    try {
        const response = await fetch(`${apiURL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // ✅ important for session cookies
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            window.location.href = "profile.html";
        } else {
            alert(data.message || "Login failed");
        }
    } catch (err) {
        console.error("Login error:", err);
    }
}

async function logout() {
    try {
        const response = await fetch(`${apiURL}/logout`, {
            method: "POST",
            credentials: "include"
        });
        if (response.ok) {
            window.location.href = "login.html";
        } else {
            console.error("Logout failed.");
        }
    } catch (error) {
        console.error("Error during logout:", error);
    }
}
