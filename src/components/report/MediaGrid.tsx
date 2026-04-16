import { useState, useRef } from 'react';
import { Image as ImageIcon, UploadCloud, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useStore, Report } from '../../store/useStore';
import { uploadToDrive, getFileThumbnail } from '../../lib/microsoftGraph';

interface MediaItem {
    id: string;
    url: string;
    caption: string;
    storageType?: 'local' | 'sharepoint';
    sharepointId?: string;
    description?: string; // New field for semantic naming
}

interface MediaGridProps {
    media: MediaItem[];
    onChange: (media: MediaItem[]) => void;
    readOnly: boolean;
    report: Report;
}

export default function MediaGrid({ media, onChange, readOnly, report }: MediaGridProps) {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);

    const [uploadingIds, setUploadingIds] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { sharepointConfig, microsoftAuth } = useStore();

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (readOnly) return;

        const files = Array.from(e.dataTransfer.files);
        processFiles(files);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && !readOnly) {
            processFiles(Array.from(e.target.files));
        }
    };

    const processFiles = (files: File[]) => {
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) return;

        const newMediaPromises = imageFiles.map(file => {
            return new Promise<MediaItem>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    resolve({
                        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        url: e.target?.result as string,
                        caption: '',
                        storageType: 'local',
                        description: '' // Force empty so user must fill it
                    });
                };
                reader.readAsDataURL(file);
            });
        });

        Promise.all(newMediaPromises).then(newItems => {
            onChange([...media, ...newItems]);
        });
    };

    const handleUploadToSharePoint = async (item: MediaItem) => {
        if (!microsoftAuth.isAuthenticated || !sharepointConfig.siteId || !sharepointConfig.driveId) {
            alert(t('reports.media_section.sharepoint_config_error'));
            return;
        }


        if (!item.description?.trim()) {
            alert(t('reports.media_section.desc_required'));
            return;
        }


        setUploadingIds(prev => [...prev, item.id]);

        try {
            // Convert data URL back to Blob for upload
            const response = await fetch(item.url);
            const blob = await response.blob();
            
            // Generate semantic filename: Project_Date_Description_ID.jpg
            const descriptionString = item.description || 'photo';
            const sanitizedDesc = descriptionString.replace(/[^a-z0-9]/gi, '_');
            const reportIdShort = report.id.substring(0, 8);
            const projectIdSlug = report.projectId.replace(/[^a-z0-9]/gi, '_');
            
            // ISO Filename: [ProjectID]_[Date]_[ReportID]_[Description]_[Seq].jpg
            const filename = `${projectIdSlug}_${report.date}_${reportIdShort}_${sanitizedDesc}_${item.id.slice(-6)}.jpg`;
            
            // ISO Structure: ROOT/[ProjectID]/[Date]/[ReportID]/[Filename]
            const folderPath = sharepointConfig.folderPath 
                ? `${sharepointConfig.folderPath}/${projectIdSlug}/${report.date}/${reportIdShort}`
                : `${projectIdSlug}/${report.date}/${reportIdShort}`;
            
            const uploadResult = await uploadToDrive(
                sharepointConfig.driveId,
                folderPath,
                filename,
                blob,
                sharepointConfig.siteId || undefined
            );

            // Fetch thumbnail
            const thumbUrl = await getFileThumbnail(
                sharepointConfig.driveId,
                uploadResult.id,
                sharepointConfig.siteId || undefined
            );

            // Update item with SharePoint info and clear local storage
            const updatedItems = media.map(m => m.id === item.id ? {
                ...m,
                storageType: 'sharepoint' as const,
                sharepointId: uploadResult.id,
                url: thumbUrl || uploadResult.webUrl, // Prefer thumbnail for display
                caption: item.description // Use description as initial caption
            } : m);

            onChange(updatedItems as MediaItem[]);
            // In a real app, we'd also clear the local IndexedDB record here
        } catch (error: any) {
            console.error('SharePoint Upload Error:', error);
            alert(t('reports.media_section.upload_failed', { error: error.message }));
        } finally {

            setUploadingIds(prev => prev.filter((id: string) => id !== item.id));
        }
    };

    const handleCaptionChange = (id: string, caption: string) => {
        onChange(media.map(m => m.id === id ? { ...m, caption } : m));
    };

    const handleDescriptionChange = (id: string, description: string) => {
        onChange(media.map(m => m.id === id ? { ...m, description } : m));
    };

    const handleRemove = (id: string) => {
        onChange(media.filter(m => m.id !== id));
    };

    return (
        <div className="card-container">
            <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2 mb-6">
                <ImageIcon className="text-brand-teal" size={20} /> {t('reports.media_section.title')}
            </h2>


            {!readOnly && (
                <div
                    className={`mb-6 p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors
                        ${isDragging ? 'border-brand-teal bg-brand-teal/5' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <UploadCloud size={40} className="text-gray-400 mb-3" />
                    <p className="font-bold text-accent-greyDark text-sm">{t('reports.media_section.upload_help')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('reports.media_section.supports')}</p>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        multiple
                        className="hidden"
                    />
                </div>
            )}

            {media.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {media.map(item => {
                        const isUploading = uploadingIds.includes(item.id);
                        const isLocal = item.storageType === 'local';

                        return (
                            <div key={item.id} className={`relative group rounded-3xl overflow-hidden border transition-all ${isLocal ? 'border-orange-200 bg-orange-50/30' : 'border-gray-100 bg-white shadow-sm'}`}>
                                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                                    <img src={item.url} alt="Site attachment" className={`w-full h-full object-cover transition-all ${isUploading ? 'opacity-30 scale-95' : ''}`} />
                                    {isUploading && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                            <div className="w-10 h-10 border-4 border-brand-teal border-t-transparent rounded-full animate-spin" />
                                            <p className="text-[10px] font-bold text-brand-teal uppercase tracking-widest">{t('reports.media_section.uploading')}</p>
                                        </div>

                                    )}
                                    {isLocal && !isUploading && (
                                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-orange-500 text-white text-[9px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                                            {t('reports.media_section.local_memo')}
                                        </div>

                                    )}
                                </div>
                                {!readOnly && !isUploading && (
                                    <button
                                        onClick={() => handleRemove(item.id)}
                                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full transition-colors opacity-0 group-hover:opacity-100 z-10"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                                <div className="p-4 space-y-3">
                                    {isLocal ? (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">{t('reports.media_section.photo_desc')}</label>
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={(e) => handleDescriptionChange(item.id, e.target.value)}
                                                disabled={readOnly || isUploading}
                                                placeholder={t('reports.media_section.photo_desc_placeholder')}
                                                className="w-full text-sm bg-white border border-orange-100 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
                                            />
                                            <button 
                                                onClick={() => handleUploadToSharePoint(item)}
                                                disabled={!item.description?.trim()}
                                                className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                                            >
                                                {t('reports.media_section.sync_sharepoint')}
                                            </button>
                                        </div>

                                    ) : (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block flex items-center gap-1">
                                                <div className="w-1 h-1 bg-emerald-500 rounded-full" /> {t('reports.media_section.sharepoint_secured')}
                                            </label>

                                            <input
                                                type="text"
                                                value={item.caption}
                                                onChange={(e) => handleCaptionChange(item.id, e.target.value)}
                                                disabled={readOnly}
                                                placeholder={t('reports.media_section.add_caption')}
                                                className="w-full text-sm font-medium bg-transparent border-none outline-none focus:ring-0 px-0 text-accent-greyDark"
                                            />

                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {media.length === 0 && readOnly && (
                <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                    <ImageIcon size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-medium">{t('reports.media_section.no_photos')}</p>
                </div>

            )}
        </div>
    );
}
