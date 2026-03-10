import mongoose, { Document, Schema } from 'mongoose';
import { ILocation, IPreferences, IProfile, IResume } from '../types/user';

export interface IUser extends Document {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  location?: ILocation;
  isPremium?: boolean;
  premiumActivatedAt?: Date;
  profile?: IProfile;
  resume?: IResume;
  preferences?: IPreferences;
  fullName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    location: {
      formatted: String,      // Full formatted address
      city: String,           // City name
      lat: Number,            // Latitude
      lng: Number,            // Longitude
    },
    // Premium subscription
    isPremium: {
      type: Boolean,
      default: false,
    },
    premiumActivatedAt: Date,
    // Profile data (from resume parsing)
    profile: {
      name: String,
      university: String,
      major: String,
      skills: [String],
      projects: [{
        name: String,
        description: String,
        technologies: [String],
      }],
      experience: [{
        title: String,
        company: String,
        duration: String,
        description: String,
      }],
      education: [{
        degree: String,
        institution: String,
        year: String,
      }],
    },
    resume: {
      fileName: String,
      fileUrl: String,        // S3/storage URL (future)
      uploadedAt: Date,
      content: String,        // Text content (optional)
    },
    preferences: {
      industry: String,
      experienceLevel: String,
      notifications: {
        type: Boolean,
        default: true,
      },
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
userSchema.virtual('fullName').get(function(this: IUser) {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

const User = mongoose.model<IUser>('User', userSchema);
export default User;
