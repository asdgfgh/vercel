
import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { usePlayer } from '../contexts/PlayerContext';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { UploadIcon } from './icons/UploadIcon';
import Loader from './Loader';
import { CloseIcon } from './icons/CloseIcon';
import { logEvent } from '../services/analyticsService';

const MusicLibraryModal: React.FC = () => {
    const { t } = useLanguage();
    const {
        tracks, currentTrack, playTrack, addTracks, deleteTrack,
        isLibraryOpen, setIsLibraryOpen, processingMessage,
    } = usePlayer();

    const fileInputRef = useRef<HTMLInputElement>(null);
        const [isDragging, setIsDragging] = useState(false);
    
    const handleAddFiles = (files: FileList | null) => {
        if (files) {
            logEvent('add_tracks', { module: 'music_library', count: files.length });
            addTracks(files);
        }
    };
    
    const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addTracks(e.dataTransfer.files);
        }
    };

    if (!isLibraryOpen) {
        return null;
    }

    return ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-75 z-[60] flex items-center justify-center animate-slide-in-up p-4" onClick={() => setIsLibraryOpen(false)}>
            <div className="relative" onClick={e => e.stopPropagation()}>
                <div className="w-full max-w-lg bg-white text-secondary-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
                    <input type="file" multiple accept="audio/*,.zip" ref={fileInputRef} onChange={(e) => handleAddFiles(e.target.files)} className="hidden" />
                    <header className="p-4 border-b border-secondary-200 flex justify-between items-center">
                        <h2 className="text-xl font-bold">{t('myMusicLibrary')}</h2>
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                            <PlusIcon className="w-5 h-5"/> {t('addTracks')}
                        </button>
                    </header>
                    <div 
                        className="flex-1 overflow-y-auto relative"
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        {processingMessage && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                                <Loader className="text-primary-400" />
                                <p className="font-bold text-lg mt-4">{processingMessage}</p>
                            </div>
                        )}
                        {isDragging && (
                            <div className="absolute inset-0 bg-primary-500/50 flex flex-col items-center justify-center z-10 m-1 rounded-lg border-2 border-dashed border-primary-300">
                                <UploadIcon className="text-white"/>
                                <p className="font-bold text-lg text-white">{t('dropFilesHere')}</p>
                            </div>
                        )}
                        {tracks.length === 0 && !processingMessage ? (
                            <div className="p-16 text-center text-secondary-400">
                                <MusicNoteIcon className="w-16 h-16 mx-auto mb-4"/>
                                <p>{t('noTracksInLibrary')}</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-secondary-100">
                                {tracks.map((track, index) => (
                                    <li key={track.id} onClick={() => { logEvent('play_track', { module: 'music_library', track_name: track.name }); playTrack(track, index); }} className={`flex items-center justify-between p-3 transition-colors cursor-pointer group ${currentTrack?.id === track.id ? 'bg-primary-50' : 'hover:bg-secondary-50'}`}>
                                        <div className="flex items-center gap-3 text-left flex-1 truncate">
                                            <div className="w-8 text-center text-secondary-400 font-mono text-sm">{index + 1}</div>
                                            <div className="truncate">
                                                <p className={`font-semibold ${currentTrack?.id === track.id ? 'text-primary-600' : 'text-secondary-800'}`}>{track.name}</p>
                                            </div>
                                        </div>
                                        <button onClick={(e) => { logEvent('delete_track', { module: 'music_library', track_name: track.name }); deleteTrack(track.id, e); }} className="p-2 text-secondary-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" aria-label={t('deleteTrack')}>
                                            <TrashIcon className="w-5 h-5"/>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
                 <button
                    onClick={() => setIsLibraryOpen(false)}
                    className="absolute -top-2 -right-2 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-lg border border-secondary-200 text-secondary-600 hover:bg-secondary-100 hover:scale-110 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ring-offset-black/20 focus:ring-primary-400 z-10"
                    aria-label={t('closeModal', { defaultValue: 'Close' })}
                >
                    <CloseIcon className="w-5 h-5" />
                </button>
            </div>
        </div>,
        document.body
    );
};

export default MusicLibraryModal;
