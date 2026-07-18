/**
 * Artifact Capture System
 * Handles storing extraction artifacts in Supabase Storage
 * Browser-compatible version (no compression)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ArtifactManifest,
  ArtifactReference,
  NetworkCapture,
} from './types';
import { CONFIG } from './constants';

export class ArtifactCapture {
  private supabase: SupabaseClient;
  private bucketName: string;
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.bucketName = CONFIG.ARTIFACT_BUCKET_NAME;
  }
  
  /**
   * Ensure storage bucket exists
   */
  async ensureBucketExists(): Promise<void> {
    const { data: buckets } = await this.supabase.storage.listBuckets();
    
    if (!buckets?.find(b => b.name === this.bucketName)) {
      await this.supabase.storage.createBucket(this.bucketName, {
        public: false,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: [
          'text/html',
          'text/plain',
          'application/json',
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/webp',
          'application/gzip'
        ]
      });
    }
  }
  
  /**
   * Generate storage path for artifact
   */
  private getStoragePath(
    businessId: string,
    sourceId: string,
    runId: string,
    filename: string
  ): string {
    return `${businessId}/${sourceId}/${runId}/${filename}`;
  }
  
  /**
   * Upload artifact to storage
   */
  private async uploadArtifact(
    content: string | Uint8Array,
    path: string,
    contentType: string,
    compress: boolean = true
  ): Promise<ArtifactReference> {
    let buffer: Uint8Array;
    let compressed = false;
    let actualContentType = contentType;
    
    // Convert to buffer (browser-compatible)
    if (typeof content === 'string') {
      buffer = new TextEncoder().encode(content);
    } else {
      buffer = content;
    }
    
    // Compression disabled for browser compatibility
    // In production, consider moving to edge function for gzip support
    compressed = false;
    
    // Generate hash (browser-compatible)
    const contentString = typeof content === 'string' ? content : new TextDecoder().decode(buffer);
    const hash = this.hashContent(contentString);
    
    // Upload to Supabase Storage
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(path, buffer, {
        contentType: actualContentType,
        upsert: true
      });
    
    if (error) {
      throw new Error(`Failed to upload artifact: ${error.message}`);
    }
    
    return {
      storagePath: path,
      sizeBytes: buffer.length,
      contentType: actualContentType,
      compressed,
      hash
    };
  }
  
  /**
   * Redact sensitive data from text
   */
  private redactSensitiveData(text: string): string {
    let redacted = text;
    
    // Redact API keys
    redacted = redacted.replace(/[a-zA-Z0-9]{32,}/g, '[REDACTED_KEY]');
    
    // Redact authorization headers
    redacted = redacted.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]');
    redacted = redacted.replace(/"authorization":\s*"[^"]+"/gi, '"authorization": "[REDACTED]"');
    
    // Redact email addresses
    redacted = redacted.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
    
    // Redact phone numbers (Danish format)
    redacted = redacted.replace(/(\+45\s?)?\d{8}/g, '[REDACTED_PHONE]');
    
    // Redact potential credit card numbers
    redacted = redacted.replace(/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, '[REDACTED_CARD]');
    
    return redacted;
  }
  
  /**
   * Capture initial HTML
   */
  async captureInitialHtml(
    html: string,
    businessId: string,
    sourceId: string,
    runId: string
  ): Promise<ArtifactReference> {
    const redacted = this.redactSensitiveData(html);
    const path = this.getStoragePath(businessId, sourceId, runId, 'initial.html.gz');
    return await this.uploadArtifact(redacted, path, 'text/html', true);
  }
  
  /**
   * Capture rendered HTML
   */
  async captureRenderedHtml(
    html: string,
    businessId: string,
    sourceId: string,
    runId: string
  ): Promise<ArtifactReference> {
    const redacted = this.redactSensitiveData(html);
    const path = this.getStoragePath(businessId, sourceId, runId, 'rendered.html.gz');
    return await this.uploadArtifact(redacted, path, 'text/html', true);
  }
  
  /**
   * Capture visible text
   */
  async captureVisibleText(
    text: string,
    businessId: string,
    sourceId: string,
    runId: string
  ): Promise<ArtifactReference> {
    const path = this.getStoragePath(businessId, sourceId, runId, 'visible-text.txt.gz');
    return await this.uploadArtifact(text, path, 'text/plain', true);
  }
  
  /**
   * Capture screenshot
   */
  async captureScreenshot(
    buffer: Uint8Array,
    type: 'full' | 'menu',
    businessId: string,
    sourceId: string,
    runId: string,
    index: number = 0
  ): Promise<ArtifactReference> {
    const filename = type === 'full' 
      ? 'screenshot-full.webp'
      : `screenshot-menu-${index.toString().padStart(2, '0')}.webp`;
    
    const path = this.getStoragePath(businessId, sourceId, runId, filename);
    return await this.uploadArtifact(buffer, path, 'image/webp', false);
  }
  
  /**
   * Capture network responses
   */
  async captureNetworkResponses(
    responses: NetworkCapture[],
    businessId: string,
    sourceId: string,
    runId: string
  ): Promise<ArtifactReference> {
    // Redact sensitive data from responses
    const redacted = responses.map(r => ({
      ...r,
      requestHeaders: r.requestHeaders ? this.redactHeaders(r.requestHeaders) : undefined,
      responseBody: typeof r.responseBody === 'string' 
        ? this.redactSensitiveData(r.responseBody)
        : r.responseBody
    }));
    
    const json = JSON.stringify(redacted, null, 2);
    const path = this.getStoragePath(businessId, sourceId, runId, 'network-captures.json.gz');
    return await this.uploadArtifact(json, path, 'application/json', true);
  }
  
  /**
   * Capture PDF
   */
  async capturePDF(
    buffer: Uint8Array,
    businessId: string,
    sourceId: string,
    runId: string
  ): Promise<ArtifactReference> {
    const path = this.getStoragePath(businessId, sourceId, runId, 'source-document.pdf');
    return await this.uploadArtifact(buffer, path, 'application/pdf', false);
  }
  
  /**
   * Capture diagnostics
   */
  async captureDiagnostics(
    data: any,
    businessId: string,
    sourceId: string,
    runId: string
  ): Promise<ArtifactReference> {
    const json = JSON.stringify(data, null, 2);
    const path = this.getStoragePath(businessId, sourceId, runId, 'diagnostics.json');
    return await this.uploadArtifact(json, path, 'application/json', false);
  }
  
  /**
   * Redact sensitive headers
   */
  private redactHeaders(headers: Record<string, string>): Record<string, string> {
    const redacted = { ...headers };
    
    const sensitiveKeys = [
      'authorization',
      'cookie',
      'set-cookie',
      'x-api-key',
      'api-key',
      'x-auth-token'
    ];
    
    for (const key of Object.keys(redacted)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        redacted[key] = '[REDACTED]';
      }
    }
    
    return redacted;
  }
  
  /**
   * Create complete artifact manifest
   */
  async createManifest(
    businessId: string,
    sourceId: string,
    runId: string,
    artifacts: {
      initialHtml?: string;
      renderedHtml?: string;
      visibleText?: string;
      screenshotFull?: Uint8Array;
      screenshotMenu?: Uint8Array[];
      networkCaptures?: NetworkCapture[];
      sourcePdf?: Uint8Array;
      diagnostics?: any;
    }
  ): Promise<ArtifactManifest> {
    const manifest: ArtifactManifest = {
      runId,
      businessId,
      sourceId,
      storagePrefix: `${businessId}/${sourceId}/${runId}`,
      artifacts: {},
      contentHashes: {},
      totalSizeBytes: 0,
      capturedAt: new Date().toISOString()
    };
    
    // Capture each artifact type
    if (artifacts.initialHtml) {
      const ref = await this.captureInitialHtml(artifacts.initialHtml, businessId, sourceId, runId);
      manifest.artifacts.initialHtml = ref;
      manifest.contentHashes.initialHtml = ref.hash;
      manifest.totalSizeBytes += ref.sizeBytes;
    }
    
    if (artifacts.renderedHtml) {
      const ref = await this.captureRenderedHtml(artifacts.renderedHtml, businessId, sourceId, runId);
      manifest.artifacts.renderedHtml = ref;
      manifest.contentHashes.renderedHtml = ref.hash;
      manifest.totalSizeBytes += ref.sizeBytes;
    }
    
    if (artifacts.visibleText) {
      const ref = await this.captureVisibleText(artifacts.visibleText, businessId, sourceId, runId);
      manifest.artifacts.visibleText = ref;
      manifest.contentHashes.visibleText = ref.hash;
      manifest.totalSizeBytes += ref.sizeBytes;
    }
    
    if (artifacts.screenshotFull) {
      const ref = await this.captureScreenshot(artifacts.screenshotFull, 'full', businessId, sourceId, runId);
      manifest.artifacts.screenshotFull = ref;
      manifest.contentHashes.screenshotFull = ref.hash;
      manifest.totalSizeBytes += ref.sizeBytes;
    }
    
    if (artifacts.screenshotMenu && artifacts.screenshotMenu.length > 0) {
      manifest.artifacts.screenshotMenu = [];
      for (let i = 0; i < artifacts.screenshotMenu.length; i++) {
        const ref = await this.captureScreenshot(artifacts.screenshotMenu[i], 'menu', businessId, sourceId, runId, i);
        manifest.artifacts.screenshotMenu.push(ref);
        manifest.contentHashes[`screenshotMenu${i}`] = ref.hash;
        manifest.totalSizeBytes += ref.sizeBytes;
      }
    }
    
    if (artifacts.networkCaptures && artifacts.networkCaptures.length > 0) {
      const ref = await this.captureNetworkResponses(artifacts.networkCaptures, businessId, sourceId, runId);
      manifest.artifacts.networkCaptures = ref;
      manifest.contentHashes.networkCaptures = ref.hash;
      manifest.totalSizeBytes += ref.sizeBytes;
    }
    
    if (artifacts.sourcePdf) {
      const ref = await this.capturePDF(artifacts.sourcePdf, businessId, sourceId, runId);
      manifest.artifacts.sourcePdf = ref;
      manifest.contentHashes.sourcePdf = ref.hash;
      manifest.totalSizeBytes += ref.sizeBytes;
    }
    
    if (artifacts.diagnostics) {
      const ref = await this.captureDiagnostics(artifacts.diagnostics, businessId, sourceId, runId);
      manifest.artifacts.diagnostics = ref;
      manifest.contentHashes.diagnostics = ref.hash;
      manifest.totalSizeBytes += ref.sizeBytes;
    }
    
    return manifest;
  }
  
  /**
   * Load artifact from storage
   */
  async loadArtifact(path: string): Promise<Uint8Array> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .download(path);
    
    if (error) {
      throw new Error(`Failed to load artifact: ${error.message}`);
    }
    
    return new Uint8Array(await data.arrayBuffer());
  }
  
  /**
   * Load complete artifact manifest
   */
  async loadManifest(runId: string): Promise<ArtifactManifest | null> {
    // In a real implementation, this would be stored in the database
    // and retrieved from there. For now, return null.
    return null;
  }
  
  /**
   * Delete artifacts older than retention period
   */
  async cleanupOldArtifacts(): Promise<void> {
    const retentionMs = CONFIG.ARTIFACT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - retentionMs);
    
    // List all files
    const { data: files } = await this.supabase.storage
      .from(this.bucketName)
      .list();
    
    if (!files) return;
    
    // Delete old files
    const toDelete = files
      .filter(f => new Date(f.created_at) < cutoffDate)
      .map(f => f.name);
    
    if (toDelete.length > 0) {
      await this.supabase.storage
        .from(this.bucketName)
        .remove(toDelete);
    }
  }
  
  /**
   * Browser-compatible hash function (FNV-1a)
   */
  private hashContent(content: string): string {
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < content.length; i++) {
      hash ^= content.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16).substring(0, 16).padStart(16, '0');
  }
}
