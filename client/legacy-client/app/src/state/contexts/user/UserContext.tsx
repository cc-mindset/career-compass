import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from "react";
import { UserProfile } from "../../../types";
import { useClerk } from "@clerk/clerk-react";

const INITIAL_USER: AuthUser = {
  profile: {
    name: "",
    skills: [],
    location: "",
    role: "",
    company: "",
    country: "",
    experience: "",
    avatar: "",
    completedCourses: 0,
    certifications: 0,
    resume: null,
  },
  clerkId: "",
  email: "",
  firstName: null,
  lastName: null,
  imageUrl: null,
  username: null,
  phone: null,
  createdAt: new Date(),
  lastSignInAt: null,
};

export interface AuthUser {
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  username: string | null;
  phone: string | null;
  profile: UserProfile;
  createdAt: Date;
  lastSignInAt: Date | null;
  hasJourneyStarted?: boolean;
}

export interface UserContextType {
  user: AuthUser;
  isLoading: boolean;
  error: string | null;
  setUser: (user: AuthUser) => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  clearUser: () => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setHasJourneyStarted: (started: boolean) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUserContext = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUserContext must be used within UserProvider");
  }
  return context;
};

export const clerkUserToAuthUser = (clerkUser: any): AuthUser => {
  return {
    clerkId: clerkUser.id,
    email: clerkUser.emailAddresses?.[0]?.emailAddress || "",
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    imageUrl: clerkUser.imageUrl,
    username: clerkUser.username,
    phone: clerkUser.phoneNumbers?.[0]?.phoneNumber || null,
    createdAt: new Date(clerkUser.createdAt),
    profile: INITIAL_USER.profile,
    lastSignInAt: clerkUser.lastSignInAt
      ? new Date(clerkUser.lastSignInAt)
      : null,
  };
};

interface UserProviderProps {
  children: ReactNode;
}

const serializeUser = (user: AuthUser): string => {
  return JSON.stringify({
    ...user,
    createdAt: user.createdAt.toISOString(),
    lastSignInAt: user.lastSignInAt?.toISOString() || null,
  });
};

const deserializeUser = (jsonString: string): AuthUser => {
  const data = JSON.parse(jsonString);
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    lastSignInAt: data.lastSignInAt ? new Date(data.lastSignInAt) : null,
  };
};

const STORAGE_KEY = "careercompass_user_state";

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const { user: clerkUser } = useClerk();
  const [user, setUserState] = useState<AuthUser>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? deserializeUser(stored) : INITIAL_USER;
    } catch (error) {
      console.warn("Failed to load user from sessionStorage:", error);
      return INITIAL_USER;
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist user state to sessionStorage whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, serializeUser(user));
    } catch (error) {
      console.warn("Failed to persist user to sessionStorage:", error);
    }
  }, [user]);

  useEffect(() => {
    const storedUser = sessionStorage.getItem(STORAGE_KEY);
    if (storedUser) {
      const parsedUser = deserializeUser(storedUser);
      if (clerkUser && clerkUser.id === parsedUser.clerkId) {
        setUserState(parsedUser);
        return;
      }
    }
  }, [clerkUser]);

  const setUser = useCallback((newUser: AuthUser) => {
    setUserState(newUser);
    if (newUser) {
      setError(null);
    }
  }, []);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUserState((prevUser) => {
      return { ...prevUser, ...updates };
    });
  }, []);

  const setHasJourneyStarted = useCallback((started: boolean) => {
    setUserState((prevUser) => {
      return { ...prevUser, hasJourneyStarted: started };
    });
  }, []);

  const updateUserProfile = useCallback(
    (profileUpdates: Partial<UserProfile>) => {
      setUserState((prevUser) => ({
        ...prevUser,
        profile: prevUser.profile
          ? { ...prevUser.profile, ...profileUpdates }
          : (profileUpdates as UserProfile),
      }));

      const reader = new FileReader();

      reader.onloadend = () => {
        if (reader.result) {
          sessionStorage.setItem("user_resume", reader.result.toString());
          sessionStorage.setItem(
            "user_resume_name",
            profileUpdates?.resume?.name || "resume",
          );
        }
      };

      if (profileUpdates.resume) {
        reader.readAsDataURL(profileUpdates.resume);
      }
    },
    [],
  );

  const clearUser = useCallback(() => {
    setUserState(INITIAL_USER);
    setError(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("Failed to clear user from sessionStorage:", error);
    }
  }, []);

  const value: UserContextType = {
    user,
    isLoading,
    error,
    setUser,
    updateUser,
    updateUserProfile,
    clearUser,
    setError,
    setIsLoading,
    setHasJourneyStarted,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
