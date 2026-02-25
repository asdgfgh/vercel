import React from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTabsState } from '../contexts/TabsStateContext';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { NextTrackIcon } from './icons/NextTrackIcon';
import { PrevTrackIcon } from './icons/PrevTrackIcon';
import { VolumeHighIcon } from './icons/VolumeHighIcon';
import { VolumeMuteIcon } from './icons/VolumeMuteIcon';
import { PlaylistIcon } from './icons/PlaylistIcon';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ShuffleIcon } from './icons/ShuffleIcon';
import { EqualizerIcon } from './icons/EqualizerIcon';

const GlobalPlayer: React.FC = () => {
    const { 
        tracks, currentTrack, isPlaying, progress, duration, volume,
        togglePlay, playNext, playPrev, handleSeek, handleVolumeChange, setVolume,
        setIsLibraryOpen, isPlayerVisible, setIsPlayerVisible, isShuffling, toggleShuffle
    } = usePlayer();
    const { t } = useLanguage();
    const { isMykhailoMode } = useTabsState();

    const formatTime = (time: number) => {
        if (isNaN(time) || time === 0) return '00:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    if (tracks.length === 0) {
        return null;
    }

    if (!isPlayerVisible) {
        return (
             <div className="fixed bottom-4 right-4 z-50 animate-slide-in-up">
                <button
                    onClick={() => setIsPlayerVisible(true)}
                    className="w-14 h-14 bg-white/90 backdrop-blur-lg rounded-full shadow-lg border border-secondary-200 flex items-center justify-center text-primary-500 hover:bg-white transition-transform transform hover:scale-105 overflow-hidden"
                    aria-label={t('openPlayer')}
                >
                    {isMykhailoMode ? (
                        <img src="/assets/1g.gif" alt="Music" className="w-full h-full object-cover" />
                    ) : (
                        <MusicNoteIcon className="w-6 h-6" />
                    )}
                </button>
            </div>
        )
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-in-up">
            <div className="bg-white/90 backdrop-blur-lg border-t border-secondary-200 shadow-2xl px-4 py-2 text-secondary-800">
                <div className="max-w-7xl mx-auto grid grid-cols-[1fr_auto_1fr] items-center gap-4">

                    {/* Track Info */}
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-secondary-100 rounded-md flex items-center justify-center text-primary-500 flex-shrink-0 overflow-hidden">
                             {isMykhailoMode ? (
                                <img src="/assets/1g.gif" alt="Music" className="w-full h-full object-cover" />
                             ) : isPlaying && currentTrack ? (
                                <EqualizerIcon className="h-5 w-5" />
                            ) : (
                                <MusicNoteIcon className="h-5 w-5" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold truncate text-sm" title={currentTrack?.name || t('nothingPlaying')}>{currentTrack?.name || t('nothingPlaying')}</p>
                            <p className="text-xs text-secondary-500 truncate">Radio 7</p>
                        </div>
                    </div>

                    {/* Player Controls & Progress */}
                    <div className="flex flex-col items-center justify-center w-full max-w-md">
                        <div className="flex items-center gap-3">
                            <button onClick={toggleShuffle} className={`p-1 rounded-full hover:bg-secondary-100 transition-colors ${isShuffling ? 'text-primary-500' : 'text-secondary-600'}`} aria-label="Shuffle">
                                <ShuffleIcon className="w-5 h-5" />
                            </button>
                            <button onClick={playPrev} className="p-1 rounded-full text-secondary-600 hover:bg-secondary-100 transition-colors" aria-label="Previous Track">
                                <PrevTrackIcon className="w-5 h-5" />
                            </button>
                            <button onClick={togglePlay} className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-primary-600 transition-transform transform hover:scale-105 mx-1" aria-label={isPlaying ? 'Pause' : 'Play'}>
                                {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                            </button>
                            <button onClick={playNext} className="p-1 rounded-full text-secondary-600 hover:bg-secondary-100 transition-colors" aria-label="Next Track">
                                <NextTrackIcon className="w-5 h-5" />
                            </button>
                            <div className="w-5 h-5 p-1"></div> {/* Placeholder for balance */}
                        </div>
                        <div className="w-full flex items-center gap-2 mt-1.5">
                             <span className="text-xs text-secondary-500 w-10 text-right font-mono">{formatTime(progress)}</span>
                             <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                value={progress}
                                onChange={handleSeek}
                                className="w-full h-1.5 bg-secondary-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                            />
                            <span className="text-xs text-secondary-500 w-10 font-mono">{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Volume & Playlist */}
                    <div className="flex items-center justify-end gap-2">
                        <div className="flex items-center gap-2 w-full max-w-[100px]">
                             <button onClick={() => setVolume(volume > 0 ? 0 : 1)} aria-label={volume > 0 ? 'Mute' : 'Unmute'}>
                                {volume === 0 ? <VolumeMuteIcon className="w-5 h-5 text-secondary-500" /> : <VolumeHighIcon className="w-5 h-5 text-secondary-500" />}
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volume}
                                onChange={handleVolumeChange}
                                className="w-full h-1.5 bg-secondary-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                            />
                        </div>
                         <button onClick={() => setIsLibraryOpen(true)} className="p-2 rounded-full hover:bg-secondary-100 transition-colors" aria-label={t('myMusicLibrary')}>
                            <PlaylistIcon className="w-5 h-5 text-secondary-500" />
                        </button>
                         <button onClick={() => setIsPlayerVisible(false)} className="p-2 rounded-full hover:bg-secondary-100 transition-colors" aria-label={t('collapsePlayer')}>
                            <ChevronDownIcon className="w-5 h-5 text-secondary-500" />
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default GlobalPlayer;