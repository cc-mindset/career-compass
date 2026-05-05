import { useUser } from "@clerk/clerk-react";
import { useEffect } from "react";
import { useUserContext } from "../../../state/contexts/user";

const SyncUser = () => {
  const { user, isLoaded } = useUser();
  const { setUser, user: userContext } = useUserContext();

  useEffect(() => {
    if (isLoaded && user) {
      // Merge Clerk user data with existing app state (preserves profile and journey state)
      setUser({
        clerkId: user.id,
        email: user.emailAddresses?.[0]?.emailAddress || "",
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
        username: user.username,
        phone: user.phoneNumbers?.[0]?.phoneNumber || null,
        createdAt: new Date(user.createdAt || user.lastSignInAt || Date.now()),
        lastSignInAt: user.lastSignInAt ? new Date(user.lastSignInAt) : null,
        profile: userContext.profile,
        hasJourneyStarted: userContext.hasJourneyStarted || false,
      });

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
      })
        .then(() => console.log("User synced successfully"))
        .catch((err) => console.error("Failed to sync user:", err));

      // Upload user resume if present
      if (userContext.profile.resume) {
        const formData = new FormData();
        formData.append('userId', user.id);
        formData.append('resume', userContext.profile.resume);

        fetch(`${import.meta.env.VITE_API_URL}/api/resume/upload`, {
          method: "POST",
          body: formData,
        })
          .then(() => console.log("Resume uploaded successfully"))
          .catch((err) => console.error("Failed to upload resume:", err));
      }
    }
  }, [
    isLoaded,
    user,
    setUser,
    userContext.profile,
    userContext.hasJourneyStarted,
    userContext.profile.resume,
  ]);

  return null;
};

export default SyncUser;
