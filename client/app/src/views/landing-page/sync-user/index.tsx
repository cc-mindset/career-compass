import { useUser } from "@clerk/clerk-react";
import React, { useEffect } from "react";

const SyncUser = () => {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      // Sync user data with backend MongoDB
      fetch(`${import.meta.env.VITE_API_URL}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          firstName: user.firstName,
          lastName: user.lastName,
        }),
      }).catch((err) => console.error("Failed to sync user:", err));
    }
  }, [isLoaded, user]);

  return null;
};

export default SyncUser;
