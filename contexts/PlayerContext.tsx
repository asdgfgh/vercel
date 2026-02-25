import React, { createContext, useContext, useState, useRef, useCallback, ReactNode, useEffect } from 'react';
import { addTrack, getAllTracksMeta, getTrack, deleteTrack, Track, TrackMeta } from '../db/musicDB';
import { useLanguage } from './LanguageContext';

declare const JSZip: any;

interface PlayerContextType {
    tracks: TrackMeta[];
    currentTrack: Track | null;
    currentTrackIndex: number;
    isPlaying: boolean;
    progress: number;
    duration: number;
    volume: number;
    isShuffling: boolean;
    loadTracks: () => Promise<void>;
    playTrack: (trackMeta: TrackMeta, index: number) => Promise<void>;
    togglePlay: () => void;
    playNext: () => void;
    playPrev: () => void;
    toggleShuffle: () => void;
    handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    setVolume: (volume: number) => void;
    addTracks: (files: FileList) => Promise<void>;
    deleteTrack: (id: number, e: React.MouseEvent) => Promise<void>;
    isLibraryOpen: boolean;
    setIsLibraryOpen: React.Dispatch<React.SetStateAction<boolean>>;
    processingMessage: string | null;
    isPlayerVisible: boolean;
    setIsPlayerVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { t } = useLanguage();
    const [tracks, setTracks] = useState<TrackMeta[]>([]);
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [processingMessage, setProcessingMessage] = useState<string | null>(null);
    const [isPlayerVisible, setIsPlayerVisible] = useState(true);
    const [isShuffling, setIsShuffling] = useState(false);

    const audioRef = useRef<HTMLAudioElement>(null);
    const playerStateRef = useRef({ tracks, currentTrackIndex, isShuffling });
    useEffect(() => {
        playerStateRef.current = { tracks, currentTrackIndex, isShuffling };
    }, [tracks, currentTrackIndex, isShuffling]);

    const loadTracks = useCallback(async () => {
        try {
            const tracksMeta = await getAllTracksMeta();
            setTracks(tracksMeta);
        } catch (e) {
            console.error("Failed to load tracks:", e);
        }
    }, []);

    useEffect(() => {
        loadTracks();
    }, [loadTracks]);

    useEffect(() => {
        let objectUrl: string | null = null;
        if (currentTrack?.file && audioRef.current) {
            objectUrl = URL.createObjectURL(currentTrack.file);
            audioRef.current.src = objectUrl;
            audioRef.current.play().catch(e => {
                console.error("Audio play failed:", e);
                setIsPlaying(false);
            });
        } else if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            setIsPlaying(false);
            setProgress(0);
            setDuration(0);
        }

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [currentTrack]);
    
    const playTrack = useCallback(async (trackMeta: TrackMeta, index: number) => {
        const fullTrack = await getTrack(trackMeta.id);
        if (fullTrack) {
            setCurrentTrack(fullTrack);
            setCurrentTrackIndex(index);
        }
    }, []);
    
    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            if (currentTrack) {
                audioRef.current.play().catch(e => console.error("Audio play failed:", e));
            } else if (tracks.length > 0) {
                playTrack(tracks[0], 0);
            }
        }
    };
    
    const toggleShuffle = () => {
        setIsShuffling(prev => !prev);
    };

    const playNext = useCallback(() => {
        const { tracks, currentTrackIndex, isShuffling } = playerStateRef.current;
        if (tracks.length === 0) return;

        if (isShuffling) {
            if (tracks.length <= 1) {
                 if (tracks[0]) playTrack(tracks[0], 0);
                 return;
            }
            let nextIndex;
            do {
                nextIndex = Math.floor(Math.random() * tracks.length);
            } while (nextIndex === currentTrackIndex);

            if (tracks[nextIndex]) {
                playTrack(tracks[nextIndex], nextIndex);
            }
        } else {
            const nextIndex = (currentTrackIndex + 1) % tracks.length;
            if (tracks[nextIndex]) {
                playTrack(tracks[nextIndex], nextIndex);
            }
        }
    }, [playTrack]);

    const playPrev = useCallback(() => {
        const { tracks, currentTrackIndex, isShuffling } = playerStateRef.current;
        if (tracks.length === 0) return;

        if (isShuffling) {
            if (tracks.length <= 1) {
                if (tracks[0]) playTrack(tracks[0], 0);
                return;
            }
            let prevIndex;
            do {
                prevIndex = Math.floor(Math.random() * tracks.length);
            } while (prevIndex === currentTrackIndex);

            if (tracks[prevIndex]) {
                playTrack(tracks[prevIndex], prevIndex);
            }
        } else {
            const prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
            if (tracks[prevIndex]) {
                playTrack(tracks[prevIndex], prevIndex);
            }
        }
    }, [playTrack]);

    const handleTimeUpdate = () => setProgress(audioRef.current?.currentTime || 0);
    const handleLoadedMetadata = () => setDuration(audioRef.current?.duration || 0);

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (audioRef.current) {
            audioRef.current.currentTime = Number(e.target.value);
            setProgress(Number(e.target.value));
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = Number(e.target.value);
        if (audioRef.current) audioRef.current.volume = newVolume;
        setVolume(newVolume);
    };

    const addTracks = async (files: FileList) => {
        setProcessingMessage(t('addingTracks'));
        try {
            const fileList = Array.from(files);
            const processingPromises: Promise<void>[] = [];

            for (const file of fileList) {
                const fileName = file.name.toLowerCase();
                
                if (fileName.endsWith('.zip')) {
                    setProcessingMessage(t('unzippingArchive'));
                    const zip = await JSZip.loadAsync(file);
                    zip.forEach((relativePath: string, zipEntry: any) => {
                        if (!zipEntry.dir && /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(zipEntry.name)) {
                            processingPromises.push(
                                (async () => {
                                    try {
                                        const blob = await zipEntry.async('blob');
                                        const cleanFilename = zipEntry.name.split('/').pop() || zipEntry.name;
                                        const audioFile = new File([blob], cleanFilename, { type: blob.type || 'audio/mpeg' });
                                        await addTrack(audioFile);
                                    } catch (zipErr) {
                                        console.error(`ERROR processing file from ZIP "${zipEntry.name}": ${zipErr}`);
                                    }
                                })()
                            );
                        }
                    });
                } else if (/\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(fileName) || file.type.startsWith('audio/')) {
                    processingPromises.push((async () => { 
                        try {
                            await addTrack(file);
                        } catch (audioErr) {
                             console.error(`ERROR adding direct audio file "${file.name}": ${audioErr}`);
                        }
                    })());
                }
            }
            
            await Promise.all(processingPromises);

        } catch (e: any) {
            console.error("Error adding tracks:", e);
        } finally {
            await loadTracks();
            setProcessingMessage(null);
        }
    };

    const deleteTrackDB = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        
        const trackIndexToDelete = tracks.findIndex(t => t.id === id);
        const wasCurrentTrackDeleted = currentTrack?.id === id;

        await deleteTrack(id);
        const newTracks = tracks.filter(t => t.id !== id);
        
        if (wasCurrentTrackDeleted) {
            if (newTracks.length > 0) {
                const nextIndex = trackIndexToDelete % newTracks.length;
                playTrack(newTracks[nextIndex], nextIndex);
            } else {
                setCurrentTrack(null);
                setCurrentTrackIndex(-1);
            }
        } else {
            if (currentTrack) {
                const newCurrentIndex = newTracks.findIndex(t => t.id === currentTrack.id);
                setCurrentTrackIndex(newCurrentIndex);
            }
        }
        
        setTracks(newTracks);
    };


    const value = {
        tracks, currentTrack, currentTrackIndex, isPlaying, progress, duration, volume, isShuffling,
        loadTracks, playTrack, togglePlay, playNext, playPrev, toggleShuffle, handleSeek, handleVolumeChange, setVolume,
        addTracks, deleteTrack: deleteTrackDB, isLibraryOpen, setIsLibraryOpen, processingMessage,
        isPlayerVisible, setIsPlayerVisible,
    };

    return (
        <PlayerContext.Provider value={value}>
            {children}
            <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={playNext}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
            />
        </PlayerContext.Provider>
    );
};

export const usePlayer = (): PlayerContextType => {
    const context = useContext(PlayerContext);
    if (!context) {
        throw new Error('usePlayer must be used within a PlayerProvider');
    }
    return context;
};
