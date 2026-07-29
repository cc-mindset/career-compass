
export interface UserProfile {
  name: string;
  role: string;
  company: string;
  location: string;
  country: string;
  experience: string;
  avatar: string;
  skills: string[];
  completedCourses: number;
  certifications: number;
  resume: File | null;
}

export interface NewsArticle {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  authorAvatar: string;
  image: string;
  category: string;
}

export interface RecentNewsArticle {
  id: string;
  title: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  excerpt: string;
  date: string;
  source: string;
  relevance: number; // 1-10
}

export interface Course {
  id: string;
  title: string;
  provider: string;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  rating: number;
  reviews: string;
  image: string;
  icon: string;
  color: string;
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

export interface CareerMilestone {
  id: number;
  title: string;
  status: 'Completed' | 'In Progress' | 'Future';
  progress?: number;
  estimate?: string;
}

export type AppView = 'market-insights' | 'career-intel' | 'eco-simulator' | 'profile' | 'settings' | 'news';