import React, { useEffect } from "react";
import { UserProfile } from "../../types";
import {
  MapPin,
  Linkedin,
  Twitter,
  Github,
  CheckCircle2,
  Newspaper,
  GraduationCap,
  Lightbulb,
  Compass,
  Zap,
} from "lucide-react";
import { StatCard } from "../../ui-kit";
import { useClerk } from "@clerk/clerk-react";
import { useUserContext } from "../../state/contexts/user";

interface ProfileViewProps {
  onEdit: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ onEdit }) => {
  const { signOut, user: clerkUser } = useClerk();
  const { clearUser, setHasJourneyStarted, setUser, user } = useUserContext();
  const userProfile = user?.profile || ({} as UserProfile);
  const handleLogout = () => {
    signOut(() => {
      clearUser();
      setHasJourneyStarted(false);
    });
  };

  useEffect(() => {
    if (clerkUser) {
      fetch(`${import.meta.env.VITE_API_URL}/api/users/${clerkUser.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.profile) {
            setUser({
              ...user,
              profile: {
                ...userProfile,
                skills: data.profile.skills || [],
              },
            });
          }
        })
        .catch((err) => console.error("Failed to fetch user details:", err));
    }
  }, [clearUser]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 lg:pl-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 md:mb-12 pr-0 sm:pr-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Your Profile
        </h1>
        <div className="flex gap-4">
          <button
            onClick={onEdit}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl sm:rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 touch-manipulation w-fit"
          >
            Edit Profile
          </button>
          <div>
            <button
              onClick={handleLogout}
              className="bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 px-5 py-2.5 rounded-xl sm:rounded-2xl font-bold transition-all touch-manipulation w-fit"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 md:gap-12 xl:gap-20 items-start">
        {/* Left Section: Profile Summary */}
        <div className="lg:col-span-2 lg:pl-12">
          <div className="flex flex-col items-center text-center w-full max-w-sm mx-auto lg:mx-0">
            <div className="relative inline-block mb-4">
              {/* Top-aligned image container */}
              <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-[2.5rem] sm:rounded-[3rem] overflow-hidden border-4 border-indigo-600/10 p-1.5 bg-slate-100 shadow-inner">
                <img
                  src={userProfile.avatar}
                  alt={userProfile.name}
                  className="w-full h-full object-cover rounded-[2.5rem]"
                />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2.5 rounded-2xl border-4 border-white shadow-lg">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="w-full">
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-1 tracking-tight text-slate-900">
                {userProfile.name}
              </h2>
              <p className="text-indigo-600 font-bold text-base sm:text-lg mb-3">
                {userProfile.role}
              </p>

              <div className="flex items-center justify-center gap-2 text-slate-500 mb-6">
                <div className="bg-slate-100 p-1.5 rounded-lg">
                  <MapPin className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">{userProfile.location}</span>
              </div>

              <div className="flex justify-center gap-5">
                <SocialIcon icon={<Linkedin />} />
                <SocialIcon icon={<Twitter />} />
                <SocialIcon icon={<Github />} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Content: Compass & Top Skills */}
        <div className="lg:col-span-3">
          {/* Compass Section */}
          <div className="mb-4 md:mb-6 flex items-center gap-3">
            <div className="flex items-center justify-center">
              <Compass className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              Compass
            </h2>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 xl:gap-6 mb-10 md:mb-16">
            <StatCard
              icon={<Newspaper />}
              count={24}
              label="New Articles"
              trend="+12%"
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              icon={<GraduationCap />}
              count={16}
              label="Courses"
              trend="+8%"
              color="bg-purple-50 text-purple-600"
            />
            <StatCard
              icon={<Lightbulb />}
              count={8}
              label="Suggestions"
              trend="New"
              color="bg-amber-50 text-amber-600"
            />
            <StatCard
              icon={<MapPin />}
              count={3}
              label="Paths"
              status="Active"
              color="bg-emerald-50 text-emerald-600"
            />
          </div>

          {/* Top Skills Section */}
          <div>
            <div className="mb-4 md:mb-6 flex items-center gap-3">
              <div className="flex items-center justify-center">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                Top Skills
              </h2>
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-3">
              {userProfile.skills?.map((skill, index) => (
                <div
                  key={index}
                  className="px-4 py-2.5 sm:px-5 sm:py-3 bg-white border border-slate-200 rounded-xl sm:rounded-[2rem] text-xs sm:text-sm font-bold text-slate-700 hover:text-indigo-600 hover:border-indigo-500/50 transition-all cursor-default"
                >
                  {skill}
                </div>
              ))}
              <button className="px-4 py-2.5 sm:px-5 sm:py-3 border-2 border-dashed border-slate-200 rounded-xl sm:rounded-[2rem] text-xs sm:text-sm font-bold text-slate-400 hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center gap-2 touch-manipulation">
                <span>+</span> Add Skill
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SocialIcon = ({ icon }: { icon: React.ReactNode }) => (
  <button className="p-4 bg-white text-slate-600 rounded-[1.25rem] border border-slate-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all transform hover:-translate-y-1.5 shadow-sm">
    {React.cloneElement(icon as React.ReactElement<any>, {
      className: "w-5 h-5",
    })}
  </button>
);

export default ProfileView;
