import { BaseDirectory, mkdir, readFile, writeFile, exists, remove } from '@tauri-apps/plugin-fs';
import type { Attachment, AttachmentType } from '../types';

export class FileStorageService {
  private baseDir = 'attachments';
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    try {
      // Create directory structure
      await this.ensureDir(this.baseDir);
      await this.ensureDir(`${this.baseDir}/images`);
      await this.ensureDir(`${this.baseDir}/videos`);
      await this.ensureDir(`${this.baseDir}/files`);
      await this.ensureDir(`${this.baseDir}/screenshots`);

      this.initialized = true;
      console.log('✅ File storage initialized');
    } catch (error) {
      console.error('Failed to initialize file storage:', error);
      throw error;
    }
  }

  private async ensureDir(path: string) {
    try {
      const pathExists = await exists(path, { baseDir: BaseDirectory.AppData });
      if (!pathExists) {
        await mkdir(path, { baseDir: BaseDirectory.AppData, recursive: true });
      }
    } catch (error) {
      console.error(`Failed to create directory ${path}:`, error);
      throw error;
    }
  }

  async saveAttachment(attachment: Attachment, fileData: Uint8Array): Promise<string> {
    await this.initialize();

    const subDir = this.getSubDir(attachment.type);
    const extension = this.getExtensionFromMimeType(attachment.mimeType);
    const fileName = `${attachment.id}.${extension}`;
    const path = `${this.baseDir}/${subDir}/${fileName}`;

    try {
      await writeFile(path, fileData, { baseDir: BaseDirectory.AppData });
      console.log(`✅ Saved attachment to ${path}`);
      return path;
    } catch (error) {
      console.error('Failed to save attachment:', error);
      throw error;
    }
  }

  async readAttachment(path: string): Promise<Uint8Array> {
    try {
      return await readFile(path, { baseDir: BaseDirectory.AppData });
    } catch (error) {
      console.error('Failed to read attachment:', error);
      throw error;
    }
  }

  async deleteAttachment(path: string): Promise<void> {
    try {
      const fileExists = await exists(path, { baseDir: BaseDirectory.AppData });
      if (fileExists) {
        await remove(path, { baseDir: BaseDirectory.AppData });
        console.log(`✅ Deleted attachment at ${path}`);
      }
    } catch (error) {
      console.error('Failed to delete attachment:', error);
      throw error;
    }
  }

  async attachmentExists(path: string): Promise<boolean> {
    try {
      return await exists(path, { baseDir: BaseDirectory.AppData });
    } catch (error) {
      return false;
    }
  }

  // Helper to convert File object to Uint8Array
  async fileToUint8Array(file: File): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        resolve(new Uint8Array(arrayBuffer));
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // Helper to convert base64 to Uint8Array
  base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Helper to convert Uint8Array to base64
  uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private getSubDir(type: AttachmentType): string {
    switch (type) {
      case 'image':
        return 'images';
      case 'screenshot':
        return 'screenshots';
      case 'video':
        return 'videos';
      case 'file':
      case 'link':
      default:
        return 'files';
    }
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/webm': 'webm',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'application/json': 'json',
    };

    return mimeMap[mimeType] || 'bin';
  }

  // Generate a thumbnail for an image
  async generateThumbnail(file: File, maxSize: number = 200): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Calculate thumbnail dimensions
        if (width > height) {
          if (width > maxSize) {
            height = (height / width) * maxSize;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };

      img.onerror = reject;
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Get file dimensions
  async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = reject;
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

// Export singleton instance
export const fileStorage = new FileStorageService();
