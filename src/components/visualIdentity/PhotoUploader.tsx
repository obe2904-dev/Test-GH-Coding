import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

interface PhotoUploaderProps {
  businessId: string;
  onUploadComplete: (paths: string[]) => void;
}

export function PhotoUploader({ businessId, onUploadComplete }: PhotoUploaderProps) {
  const { t } = useTranslation('visual');
  const [uploading, setUploading] = useState(false);
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const paths: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${businessId}/${Date.now()}-${i}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('visual-identity')
          .upload(fileName, file);

        if (error) {
          console.error('Upload error:', error);
          continue;
        }

        if (data) {
          paths.push(data.path);
        }
      }

      const allPaths = [...uploadedPaths, ...paths];
      setUploadedPaths(allPaths);
      onUploadComplete(allPaths);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload mislykkedes. Prøv igen.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">{t('identity.uploadPhotos')}</span>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </label>

      <p className="text-sm text-gray-600">
        {t('identity.uploadHint')}
      </p>

      {uploadedPaths.length > 0 && (
        <div className="text-sm text-green-600">
          ✓ {t('identity.photosUploaded', { count: uploadedPaths.length })}
        </div>
      )}

      {uploading && (
        <div className="text-sm text-blue-600">
          Uploader...
        </div>
      )}
    </div>
  );
}
