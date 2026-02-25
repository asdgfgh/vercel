import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { usePlayer } from '../contexts/PlayerContext';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';

const RadioTab: React.FC = () => {
    const { t } = useLanguage();
    const { tracks, currentTrack, playTrack, deleteTrack, setIsLibraryOpen } = usePlayer();

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-secondary-800">{t('myMusicLibrary')}</h2>
                <button 
                    onClick={() => { logEvent('open_music_library', { module: 'radio' }); setIsLibraryOpen(true); }} 
                    className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                    <PlusIcon className="w-5 h-5"/> {t('addTracks')}
                </button>
            </div>

            <div className="bg-white rounded-xl border border-secondary-200 shadow-sm">
                {tracks.length === 0 ? (
                    <div className="p-16 text-center text-secondary-400">
                        <MusicNoteIcon className="w-16 h-16 mx-auto mb-4"/>
                        <p>{t('noTracksInLibrary')}</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-secondary-100">
                        {tracks.map((track, index) => (
                            <li 
                                key={track.id} 
                                onClick={() => { logEvent('play_track', { module: 'radio', track_name: track.name }); playTrack(track, index); }} 
                                className={`flex items-center justify-between p-4 transition-colors cursor-pointer group ${currentTrack?.id === track.id ? 'bg-primary-50' : 'hover:bg-secondary-50'}`}
                            >
                                <div className="flex items-center gap-4 text-left flex-1 truncate">
                                    <div className="w-8 text-center text-secondary-400 font-mono text-sm">{index + 1}</div>
                                    <div className="truncate">
                                        <p className={`font-semibold ${currentTrack?.id === track.id ? 'text-primary-600' : 'text-secondary-800'}`}>{track.name}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={(e) => { logEvent('delete_track', { module: 'radio', track_name: track.name }); deleteTrack(track.id, e); }} 
                                    className="p-2 text-secondary-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                                    aria-label={t('deleteTrack')}
                                >
                                    <TrashIcon className="w-5 h-5"/>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default RadioTab;