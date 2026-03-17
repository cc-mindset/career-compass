export interface ILocation {
  formatted?: string;
  city?: string;
  lat?: number;
  lng?: number;
}

export interface IProject {
  name?: string;
  description?: string;
  technologies?: string[];
}

export interface IExperience {
  title?: string;
  company?: string;
  duration?: string;
  description?: string;
}

export interface IEducation {
  degree?: string;
  institution?: string;
  year?: string;
}

export interface IProfile {
  name?: string;
  university?: string;
  major?: string;
  skills?: string[];
  projects?: IProject[];
  experience?: IExperience[];
  education?: IEducation[];
}

export interface IResume {
  fileName?: string;
  fileUrl?: string;
  uploadedAt?: Date;
  content?: string;
}

export interface IPreferences {
  industry?: string;
  experienceLevel?: string;
  notifications?: boolean;
}
