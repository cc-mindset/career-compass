import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { openaiClient } from '../lib/openai.js';
import { logger } from '../utils/logger.js';

/**
 * Resume Parser Service
 * Handles resume upload, text extraction, and AI-powered parsing
 */

/**
 * Extract text from PDF buffer
 */
async function extractTextFromPDF(buffer) {
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
async function extractTextFromDOCX(buffer) {
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
async function parseResumeWithAI(resumeText) {
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

    const parsed = await openaiClient.generateJSONCompletion(systemPrompt, userPrompt);
    return parsed;
  } catch (error) {
    logger.error('Error parsing resume with AI:', error);
    throw new Error('Failed to parse resume with AI');
  }
}

/**
 * Main function to parse resume
 */
export async function parseResume(fileBuffer, fileType) {
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
    logger.error('Resume parsing error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
