import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { openaiClient } from '../lib/openai.js';
import { logger } from '../utils/logger.js';

interface ParsedResumeData {
  name?: string;
  university?: string;
  major?: string;
  skills?: string[];
  projects?: Array<{
    name?: string;
    description?: string;
    technologies?: string[];
  }>;
  experience?: Array<{
    title?: string;
    company?: string;
    duration?: string;
    description?: string;
  }>;
  education?: Array<{
    degree?: string;
    institution?: string;
    year?: string;
  }>;
}

interface ParseResult {
  success: boolean;
  data?: ParsedResumeData;
  rawText?: string;
  error?: string;
}

/**
 * Resume Parser Service
 * Handles resume upload, text extraction, and AI-powered parsing
 */

/**
 * Extract text from PDF buffer
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  } catch (error) {
    logger.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF');
  }
}

/**
 * Extract text from DOCX buffer
 */
async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    logger.error('Error parsing DOCX:', error);
    throw new Error('Failed to parse DOCX');
  }
}

/**
 * Extract structured data from resume text using OpenAI
 */
async function parseResumeWithAI(resumeText: string): Promise<ParsedResumeData> {
  try {
    const systemPrompt = 'You are a resume parser. Extract structured information and return ONLY valid JSON, no additional text.';
    
    const userPrompt = `Extract structured information from the following resume. Return ONLY valid JSON with this exact structure:
{
  "name": "Full Name",
  "university": "University Name",
  "major": "Major/Degree",
  "skills": ["skill1", "skill2", ...],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description",
      "technologies": ["tech1", "tech2"]
    }
  ],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Duration",
      "description": "Brief description"
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "institution": "Institution",
      "year": "Year or Duration"
    }
  ]
}

Resume:
${resumeText}`;

    const parsed = await openaiClient.generateJSONCompletion(systemPrompt, userPrompt) as ParsedResumeData;
    return parsed;
  } catch (error) {
    logger.error('Error parsing resume with AI:', error);
    throw new Error('Failed to parse resume with AI');
  }
}

/**
 * Main function to parse resume
 */
export async function parseResume(fileBuffer: Buffer, fileType: string): Promise<ParseResult> {
  try {
    let resumeText = '';

    // Extract text based on file type
    if (fileType === 'application/pdf') {
      resumeText = await extractTextFromPDF(fileBuffer);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      resumeText = await extractTextFromDOCX(fileBuffer);
    } else {
      throw new Error('Unsupported file type. Please upload PDF or DOCX');
    }

    logger.info('Extracted resume text, sending to OpenAI for parsing...');

    // Parse with AI
    const parsedData = await parseResumeWithAI(resumeText);

    logger.info('Successfully parsed resume');

    return {
      success: true,
      data: parsedData,
      rawText: resumeText,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Resume parsing error:', err);
    return {
      success: false,
      error: err.message,
    };
  }
}
