import fs from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import { PDFParse } from 'pdf-parse';

const OCR_MIN_CHARS = 80;
const unsupported = () => Object.assign(new Error("Couldn't extract text from this file. Please try a clearer image or another supported format."), { code: 'TEXT_EXTRACTION_FAILED' });

function cleanText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[|]{3,}/g, ' ')
    .trim()
    .slice(0, 50000);
}

async function ocr(buffer) {
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(buffer);
    const text = cleanText(result.data.text);
    if (text.length < OCR_MIN_CHARS || (result.data.confidence ?? 100) < 45) throw unsupported();
    return text;
  } finally {
    await worker.terminate();
  }
}

async function parsePdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const text = cleanText((await parser.getText()).text);
    if (text.length >= OCR_MIN_CHARS) return text;
    const screenshots = await parser.getScreenshot({ imageBuffer: true, scale: 2 });
    const pages = await Promise.all(screenshots.pages.slice(0, 3).map((page) => ocr(Buffer.from(page.data))));
    return cleanText(pages.join('\n\n')) || Promise.reject(unsupported());
  } finally {
    await parser.destroy();
  }
}

export async function extractResumeText(filePath) {
  try {
    const extension = path.extname(filePath).toLowerCase();
    const buffer = await fs.readFile(filePath);
    let text;
    if (extension === '.pdf') text = await parsePdf(buffer);
    else if (extension === '.docx') text = cleanText((await mammoth.extractRawText({ buffer })).value);
    else if (['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) text = await ocr(buffer);
    else throw unsupported();
    if (cleanText(text).length < OCR_MIN_CHARS) throw unsupported();
    return cleanText(text);
  } catch (error) {
    if (error?.code === 'TEXT_EXTRACTION_FAILED') throw error;
    throw unsupported();
  }
}
