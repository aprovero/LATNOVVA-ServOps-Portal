import { useState, useRef } from 'react';
import { Image as ImageIcon, UploadCloud, X } from 'lucide-react';

interface MediaItem {
    id: string;
    url: string;
    caption: string;
}

interface MediaGridProps {
    media: MediaItem[];
    onChange: (media: MediaItem[]) => void;
    readOnly: boolean;
}

export default function MediaGrid({ media, onChange, readOnly }: MediaGridProps) {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

        // Mock reading files as data URLs
        const newMediaPromises = imageFiles.map(file => {
            return new Promise<MediaItem>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    resolve({
                        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        url: e.target?.result as string,
                        caption: ''
                    });
                };
                reader.readAsDataURL(file);
            });
        });

        Promise.all(newMediaPromises).then(newItems => {
            onChange([...media, ...newItems]);
        });
    };

    const handleCaptionChange = (id: string, caption: string) => {
        onChange(media.map(m => m.id === id ? { ...m, caption } : m));
    };

    const handleRemove = (id: string) => {
        onChange(media.filter(m => m.id !== id));
    };

    return (
        <div className="card-container">
            <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2 mb-6">
                <ImageIcon className="text-brand-teal" size={20} /> Media Grid
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
                    <p className="font-bold text-accent-greyDark text-sm">Click or Drag & Drop site photos here</p>
                    <p className="text-xs text-gray-500 mt-1">Supports JPG, PNG (Max 5MB)</p>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {media.map(item => (
                        <div key={item.id} className="relative group rounded-2xl overflow-hidden border border-gray-100 bg-white">
                            <div className="aspect-square bg-gray-100">
                                <img src={item.url} alt="Site attachment" className="w-full h-full object-cover" />
                            </div>
                            {!readOnly && (
                                <button
                                    onClick={() => handleRemove(item.id)}
                                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <X size={16} />
                                </button>
                            )}
                            <div className="p-3">
                                <input
                                    type="text"
                                    value={item.caption}
                                    onChange={(e) => handleCaptionChange(item.id, e.target.value)}
                                    disabled={readOnly}
                                    placeholder="Add caption..."
                                    className="w-full text-sm bg-transparent border-none outline-none focus:ring-0 px-0 text-accent-grey disabled:bg-transparent disabled:text-gray-500"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {media.length === 0 && readOnly && (
                <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-sm">No photos attached to this report.</p>
                </div>
            )}
        </div>
    );
}
