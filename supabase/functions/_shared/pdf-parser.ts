/**
 * PDF text extraction using unpdf library
 */

// @ts-ignore - Deno npm import (VS Code doesn't recognize npm: prefix)
import { extractText, getDocumentProxy } from 'npm:unpdf'

/**
 * Extract text content from a PDF URL
 * 
 * @param pdfUrl - URL to the PDF file
 * @returns Extracted text content, or empty string if extraction fails
 */
export async function extractTextFromPdf(pdfUrl: string): Promise<string> {
  try {
    console.log('📄 Attempting to extract text from PDF via unpdf:', pdfUrl)

    const resp = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BusinessProfileBot/1.0)',
      },
    })

    if (!resp.ok) {
      console.log('❌ Failed to fetch PDF:', pdfUrl, resp.status)
      return ''
    }

    const buffer = await resp.arrayBuffer()
    console.log('📦 PDF buffer size:', buffer.byteLength, 'bytes')
    
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    console.log('📄 PDF loaded, pages:', pdf.numPages)

    const { text } = await extractText(pdf, { mergePages: true })

    console.log('✅ Extracted PDF text length:', text.length)
    if (text.length > 0) {
      console.log('📄 First 200 chars:', text.substring(0, 200))
    } else {
      console.log('⚠️ PDF has no extractable text - might be image-based PDF')
    }
    return text
  } catch (err) {
    console.log('⚠️ PDF parsing failed (unpdf):', err)
    return ''
  }
}
