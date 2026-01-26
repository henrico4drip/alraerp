import { useState, useEffect } from "react";

export function useAuth() {
    const [user, setUser] = useState<any>({
        id: 1,
        name: "Henrico",
        email: "henrico.pierdona@gmail.com",
        role: "admin"
    });
    const [loading, setLoading] = useState(false);

    const logout = () => {
        setUser(null);
    };

    return { user, loading, logout };
}
