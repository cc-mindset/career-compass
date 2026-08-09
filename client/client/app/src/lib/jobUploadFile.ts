/** Holds the selected job-posting File outside React state (File is not serializable). */
let jobUploadFile: File | null = null;

export const setJobUploadFile = (file: File | null): void => {
  jobUploadFile = file;
};

export const getJobUploadFile = (): File | null => jobUploadFile;

export const clearJobUploadFile = (): void => {
  jobUploadFile = null;
};
