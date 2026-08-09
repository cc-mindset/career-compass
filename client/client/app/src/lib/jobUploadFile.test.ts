import { afterEach, describe, expect, it } from 'vitest';
import {
  clearJobUploadFile,
  getJobUploadFile,
  setJobUploadFile,
} from './jobUploadFile';

describe('jobUploadFile', () => {
  afterEach(() => {
    clearJobUploadFile();
  });

  it('holds, returns, and clears the selected File', () => {
    expect(getJobUploadFile()).toBeNull();
    const file = new File(['posting'], 'role.pdf', { type: 'application/pdf' });
    setJobUploadFile(file);
    expect(getJobUploadFile()).toBe(file);
    clearJobUploadFile();
    expect(getJobUploadFile()).toBeNull();
  });
});
