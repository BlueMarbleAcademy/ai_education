// VoiceNotes.jsx — tags instead of folders, now with Pause/Resume while recording
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useMsal } from '@azure/msal-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mic, Save, Trash2, Download, Share2, Tag as TagIcon, AudioWaveform as Waveform, PauseCircle, PlayCircle } from 'lucide-react';
import { recordStudyToolUse, callProtectedApi, getStudyPlanVoiceContext } from '../../api/apiService';

const API_URL = "http://localhost:8000";

const getSupportedMimeType = () => {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
};

const getExtensionForMime = (mime) => {
  if (mime.includes('mp4')) return '.m4a';
  if (mime.includes('ogg')) return '.ogg';
  return '.webm';
};

const VoiceNotes = () => {
  // Get folderId from URL query params if present
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get('folderId');

  const noteId = searchParams.get("noteId");
  const studyPlanId = searchParams.get('studyPlanId');
  const activityId = searchParams.get('activityId');
  const fromPlanner = Boolean(studyPlanId || activityId);
  const [studyContext, setStudyContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(fromPlanner);
  const [contextError, setContextError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const { instance, accounts, inProgress } = useMsal();
  const navigate = useNavigate();
  
  // Get user ID from logged-in account (account-based, not device-based)
  const account = useMemo(
    () => instance.getActiveAccount() || accounts?.[0] || {},
    [instance, accounts]
  );
  const claims = account?.idTokenClaims || {};
  const userId = account?.localAccountId || claims?.oid || claims?.sub || null;

  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (!accounts?.length || !userId) {
      navigate("/signin");
      return;
    }
    if (!instance.getActiveAccount() && accounts?.length) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [instance, accounts, navigate, userId]);

  // Set user ID in axios headers whenever it changes
  useEffect(() => {
    if (userId) {
      axios.defaults.headers.common['X-User-Id'] = userId;
    }
  }, [userId]);
  const [notes, setNotes] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [showSaveAnimation, setShowSaveAnimation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [privacySettings, setPrivacySettings] = useState({});
  const [tagInput, setTagInput] = useState('');
  const [pendingTags, setPendingTags] = useState([]); // tags for the note being created
  const [micPermissionError, setMicPermissionError] = useState('');

  const mediaRecorderRef = useRef(null);
  const recordingAttemptRef = useRef(0);
  const timerRef = useRef(null);
  const mimeTypeRef = useRef('audio/webm');
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);

  const { transcript, resetTranscript } = useSpeechRecognition();

  useEffect(() => {
    if (inProgress !== 'none') return;
    let active = true;
    setStudyContext(null);
    setContextError('');
    setSaveError('');
    setNotes([]);
    setContextLoading(fromPlanner);
    if (!fromPlanner) return;
    if (!studyPlanId || !activityId) {
      setContextError('The study plan link is incomplete. Open this activity from the planner again.');
      setContextLoading(false);
      return;
    }
    getStudyPlanVoiceContext(studyPlanId, activityId)
      .then((context) => {
        if (!active) return;
        setStudyContext(context);
        setNoteTitle(context.topic);
      })
      .catch((error) => { if (active) setContextError(error.message || 'Could not open this study activity.'); })
      .finally(() => { if (active) setContextLoading(false); });
    return () => { active = false; };
  }, [studyPlanId, activityId, fromPlanner, inProgress]);

  useEffect(() => () => {
    recordingAttemptRef.current += 1;
    mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    clearInterval(timerRef.current);
    cancelAnimationFrame(animationRef.current);
    audioContextRef.current?.close().catch(() => {});
    SpeechRecognition.stopListening();
  }, []);

  const fetchNotes = useCallback(async () => {
    if (!userId) return; // Don't fetch if not logged in
    if (fromPlanner && (!studyPlanId || !activityId || !studyContext)) return;
    try {
      const params = new URLSearchParams();
      if (selectedTagFilter) params.append('tag', selectedTagFilter);
      if (fromPlanner) {
        params.set('study_plan_id', studyPlanId);
        params.set('study_activity_id', activityId);
      }
      const items = (fromPlanner
        ? await callProtectedApi(`${API_URL}/voice-notes?${params}`)
        : (await axios.get(`${API_URL}/voice-notes?${params}`)).data) || [];
      setNotes(items);
      const tags = new Set();
      items.forEach(n => (n.tags || []).forEach(t => tags.add(t)));
      setAllTags(Array.from(tags));
    } catch (err) {
      console.error("Error fetching notes:", err);
    }
  }, [userId, fromPlanner, studyPlanId, activityId, studyContext, selectedTagFilter]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

    // If we navigated here with ?noteId=..., move that note to the top so it's visible immediately
    useEffect(() => {
        if (!noteId || notes.length === 0) return;

        const idx = notes.findIndex((n) => n.id === noteId);
        if (idx === -1) return;

        const selected = notes[idx];
        const remaining = notes.filter((n) => n.id !== noteId);
        setNotes([selected, ...remaining]);
    }, [noteId, notes.length]);

  // Refresh notes when page becomes visible after being hidden (handles browser back button)
  // Only refresh if page was hidden for more than 1 second
  useEffect(() => {
    let hiddenTime = null;
    let refreshTimeout = null;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenTime = Date.now();
      } else if (document.visibilityState === 'visible' && userId && hiddenTime) {
        const timeHidden = Date.now() - hiddenTime;
        if (timeHidden > 1000) {
          clearTimeout(refreshTimeout);
          refreshTimeout = setTimeout(() => {
            fetchNotes();
          }, 500);
        }
        hiddenTime = null;
      }
    };
    
    // Handle browser back/forward navigation
    const handlePageshow = (e) => {
      // If page was loaded from cache (back button), refresh notes
      if (e.persisted && userId) {
        setTimeout(() => fetchNotes(), 300);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageshow);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageshow);
      clearTimeout(refreshTimeout);
    };
  }, [userId, fetchNotes]);

  // canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    analyser.fftSize = 2048;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = isPaused ? '#a3a3a3' : '#7c3aed';
      ctx.beginPath();
      const width = canvas.width;
      const height = canvas.height;
      const sliceWidth = width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (isPaused) {
        // overlay "Paused"
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Paused', canvas.width / 2, canvas.height / 2);
      }
    };
    draw();
  };

  const startRecording = async () => {
    if (isStarting || isRecording) return;
    if (fromPlanner && (!studyContext || contextLoading || contextError)) return;
    setMicPermissionError('');
    setIsStarting(true);
    const attempt = ++recordingAttemptRef.current;
    let permissionTimer;
    let stream;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Recording is not supported in this browser. Open this page in Chrome or Edge to record.');
      }
      resetTranscript();
      const permission = navigator.mediaDevices.getUserMedia({ audio: true });
      permission.then((pendingStream) => {
        if (recordingAttemptRef.current !== attempt) pendingStream.getTracks().forEach((track) => track.stop());
      }, () => {});
      stream = await Promise.race([
        permission,
        new Promise((_, reject) => {
          permissionTimer = setTimeout(() => reject(new Error('Microphone access is still waiting. Allow microphone access in your browser, or open this page in Chrome and try again.')), 20000);
        }),
      ]);
      if (recordingAttemptRef.current !== attempt) return;
      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType || 'audio/webm';
      mediaRecorderRef.current = new MediaRecorder(stream,
        mimeType ? { mimeType } : undefined
      );
      const localChunks = [];

      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) localChunks.push(e.data); };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(localChunks, { type: mimeTypeRef.current });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setChunks(localChunks);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration((prev) => prev + 1), 1000);
      // Waveform and transcription are optional; neither should block audio recording.
      try {
        const AudioEngine = window.AudioContext || window.webkitAudioContext;
        if (AudioEngine) {
          audioContextRef.current = new AudioEngine();
          audioContextRef.current.resume().catch(() => {});
          analyserRef.current = audioContextRef.current.createAnalyser();
          sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
          sourceRef.current.connect(analyserRef.current);
          drawWaveform();
        }
      } catch (error) {
        console.warn('Waveform is unavailable:', error.name);
      }
      try {
        Promise.resolve(SpeechRecognition.startListening({ continuous: true, language: 'en-US' })).catch(() => {});
      } catch {
        // Recording still works when browser speech recognition is unavailable.
      }
    } catch (error) {
      if (recordingAttemptRef.current !== attempt) return;
      recordingAttemptRef.current += 1;
      stream?.getTracks().forEach((track) => track.stop());
      console.log('Microphone access denied or error:', error.name);
      const messages = {
        NotAllowedError: 'Microphone access was blocked. Allow it in this browser and in macOS microphone privacy settings, then try again.',
        NotFoundError: 'No microphone was found. Connect a microphone and try again.',
        NotReadableError: 'The microphone is unavailable. Close other apps using it and try again.',
      };
      setMicPermissionError(messages[error.name] || error.message || 'Could not start recording. Try this page in Chrome.');
      try {
        SpeechRecognition.stopListening();
      } catch (e) {
        // Ignore if speech recognition wasn't started
      }
    } finally {
      clearTimeout(permissionTimer);
      setIsStarting(false);
    }
  };

  const pauseRecording = () => {
    if (!isRecording || isPaused) return;
    try {
      if (mediaRecorderRef.current && typeof mediaRecorderRef.current.pause === 'function') {
        mediaRecorderRef.current.pause();
      }
    } catch (e) {
      console.warn('MediaRecorder.pause not supported, ignoring.');
    }
    clearInterval(timerRef.current);
    setIsPaused(true);
    SpeechRecognition.stopListening();
  };

  const resumeRecording = () => {
    if (!isRecording || !isPaused) return;
    try {
      if (mediaRecorderRef.current && typeof mediaRecorderRef.current.resume === 'function') {
        mediaRecorderRef.current.resume();
      }
    } catch (e) {
      console.warn('MediaRecorder.resume not supported, ignoring.');
    }
    setIsPaused(false);
    timerRef.current = setInterval(() => setRecordingDuration((prev) => prev + 1), 1000);
    SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
  };

  const stopRecording = () => {
    SpeechRecognition.stopListening();
    try {
      mediaRecorderRef.current?.stop();
    } catch (e) {
      // ignore
    }
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    clearInterval(timerRef.current);
    cancelAnimationFrame(animationRef.current);
    audioContextRef.current?.close();
    setIsRecording(false);
    setIsPaused(false);
  };

  const toggleRecording = () => (isRecording ? stopRecording() : startRecording());
  const togglePause = () => (isPaused ? resumeRecording() : pauseRecording());

  // Optional: spacebar to pause/resume while recording
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && isRecording) {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isRecording, isPaused]);

  const addPendingTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!pendingTags.map(x => x.toLowerCase()).includes(t.toLowerCase())) {
      setPendingTags(prev => [...prev, t]);
    }
    setTagInput('');
  };
  const removePendingTag = (t) => setPendingTags(prev => prev.filter(x => x !== t));

  const saveNoteToBackend = async () => {
    if (saving || !chunks.length || isRecording || (fromPlanner && !studyContext)) return;
    const blob = new Blob(chunks, { type: mimeTypeRef.current });
    if (!blob || !noteTitle.trim()) return;

    const formData = new FormData();
    const ext = getExtensionForMime(mimeTypeRef.current);
    formData.append('audio', blob, `note_${Date.now()}${ext}`);
    formData.append('title', noteTitle.trim());
    formData.append('text', transcript || '');
    formData.append('duration', recordingDuration || 0);
    formData.append('visibility', privacySettings['temp'] || 'Private');
    formData.append('tags', pendingTags.join(', '));
    if (fromPlanner) {
      formData.append('study_plan_id', studyPlanId);
      formData.append('study_activity_id', activityId);
    }
    
    // Add folderId if provided
    if (folderId) {
      formData.append('folder_id', folderId);
    }

    try {
      setSaving(true);
      setSaveError('');
      const newNote = fromPlanner
        ? await callProtectedApi(`${API_URL}/voice-notes`, { method: 'POST', body: formData })
        : (await axios.post(`${API_URL}/voice-notes`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
      setNotes(prev => [newNote, ...prev]);

      await recordStudyToolUse("voice_note", "save_voice_note");

      // refresh tag universe
      const tags = new Set(allTags);
      (newNote.tags || []).forEach(t => tags.add(t));
      setAllTags(Array.from(tags));

      setShowSaveAnimation(true);
      setTimeout(() => {
        resetTranscript();
        setAudioUrl(null);
        setChunks([]);
        setNoteTitle(studyContext?.topic || '');
        setPendingTags([]);
        setShowSaveAnimation(false);
      }, 400);
    } catch (err) {
      console.error("Error saving voice note:", err);
      setSaveError(err.message || "Failed to save note. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (id) => {
    const confirmed = window.confirm('Are you sure you want to delete this note?');
    if (!confirmed) {
      return;
    }
    try {
      await axios.delete(`${API_URL}/voice-notes/${id}`);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      // If note is already deleted (404), silently remove it from UI
      // This handles browser back button cache issues
      if (err.response?.status === 404) {
        setNotes(prev => prev.filter(n => n.id !== id));
        return;
      }
      console.error("Error deleting note:", err);
      alert('Failed to delete note. Please try again.');
    }
  };

  const handlePrivacyChange = async (id, value) => {
    try {
      await axios.put(`${API_URL}/voice-notes/${id}`, { visibility: value });
      setNotes(prev => prev.map(n => n.id === id ? { ...n, visibility: value } : n));
    } catch (err) {
      console.error("Error updating privacy:", err);
    }
  };

  const handleShare = async (note) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: note.title || 'Voice Note', text: note.text, url: note.audio_url });
      } catch (err) {
        alert('Share canceled or failed: ' + err.message);
      }
    } else {
      try {
        const shareText = `Check out this voice note:\n\nTitle: ${note.title}\nTranscript: ${note.text}\nAudio: ${note.audio_url}`;
        await navigator.clipboard.writeText(shareText);
        alert('Share link copied to clipboard!');
      } catch (err) {
        alert('Clipboard copy failed: ' + err.message);
      }
    }
  };

  const formatDuration = (s) => `${Math.floor((s || 0) / 60)}:${((s || 0) % 60).toString().padStart(2, '0')}`;

  const filtered = notes.filter((n) => {
    const q = (searchQuery || '').toLowerCase();
    const matchesQ = (n.title || '').toLowerCase().includes(q) || (n.text || '').toLowerCase().includes(q);
    const matchesTag = !selectedTagFilter || (n.tags || []).map(x => x.toLowerCase()).includes(selectedTagFilter.toLowerCase());
    return matchesQ && matchesTag;
  });

  // Don't render until user is authenticated
  if (!userId) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-purple-50 p-2.5 rounded-xl">
          <Waveform className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Voice Notes</h1>
          <p className="text-sm text-gray-500">Record, transcribe and organize your spoken notes</p>
        </div>
      </div>

      {fromPlanner && (
        <section className="mb-6 border-l-4 border-blue-500 pl-4 text-sm text-gray-700" aria-label="Assigned study activity">
          {contextLoading && <p role="status">Loading your assigned topic and materials...</p>}
          {contextError && <p role="alert" className="text-red-600">{contextError}</p>}
          {studyContext && <>
            <h2 className="font-semibold break-words">Study plan topic: {studyContext.topic}</h2>
            <p className="mt-2">{studyContext.prompt}</p>
            <p className="mt-2">{studyContext.materials.length} linked study material{studyContext.materials.length === 1 ? '' : 's'}</p>
            {studyContext.materials.map((material) => (
              <details key={material.id} className="mt-2">
                <summary className="cursor-pointer break-words font-medium">{material.name}</summary>
                <p className="mt-2 whitespace-pre-wrap break-words">{material.text}</p>
                {material.truncated && <p className="mt-1 text-xs">Preview of the first 6,000 characters.</p>}
              </details>
            ))}
          </>}
          <button type="button" className="mt-3 text-blue-600 underline" disabled={isRecording || saving} onClick={() => navigate(`/tools/study-planner?planId=${encodeURIComponent(studyPlanId || '')}`)}>Back to study plan</button>
        </section>
      )}
      {saveError && <p role="alert" className="mb-4 text-sm text-red-600">{saveError}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="p-2 border border-gray-300 rounded w-full"
        />
        <select
          className="p-2 border border-gray-300 rounded w-full"
          value={selectedTagFilter}
          onChange={(e) => setSelectedTagFilter(e.target.value)}
        >
          <option value="">All tags</option>
          {allTags.map((t) => (<option key={t} value={t}>{t}</option>))}
        </select>
        <button
          onClick={() => fetchNotes()}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
        >
          Refresh
        </button>
      </div>

      {/* Title */}
      <div className="mb-4">
        <input
          type="text"
          aria-label="Voice note title"
          placeholder="Enter a title for this note"
          value={noteTitle}
          onChange={(e) => setNoteTitle(e.target.value)}
          className="p-2 border border-gray-300 rounded w-full"
        />
      </div>

      {/* Tag input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add a tag (press Enter)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addPendingTag(); }}
            className="p-2 border border-gray-300 rounded w-full"
          />
          <button onClick={addPendingTag} className="px-4 py-2 bg-gray-200 rounded">Add</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {pendingTags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-purple-100 text-purple-700 rounded-full">
              <TagIcon size={14} /> {t}
              <button onClick={() => removePendingTag(t)} className="ml-1 text-purple-700 hover:text-purple-900">×</button>
            </span>
          ))}
        </div>
      </div>

      <div className="min-w-0 bg-white p-4 sm:p-8 rounded-xl shadow-lg mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <button
              onClick={() => (isRecording ? stopRecording() : startRecording())}
              disabled={isStarting || saving || (fromPlanner && (!studyContext || contextLoading || Boolean(contextError)))}
              className={`shrink-0 p-4 rounded-full transition ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'}`}
              title={isRecording ? 'Stop' : 'Start recording'}
            >
              <Mic className="h-6 w-6" />
            </button>

            {isRecording && (
              <button
                onClick={togglePause}
                className={`p-4 rounded-full transition ${isPaused ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}`}
                title={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
              >
                {isPaused ? <PlayCircle className="h-6 w-6" /> : <PauseCircle className="h-6 w-6" />}
              </button>
            )}

            <div>
              <p className="text-sm text-gray-700">
                {isStarting ? 'Waiting for microphone access...' : isRecording ? (isPaused ? 'Paused' : 'Recording...') : 'Ready to record'}
              </p>
              {isRecording && <p className={`text-xs ${isPaused ? 'text-gray-500' : 'text-red-600'}`}>{formatDuration(recordingDuration)}</p>}
            </div>
          </div>

          {(isRecording || audioUrl) && (
            <>
              <select
                className="mr-4 p-2 rounded border border-gray-300"
                value={privacySettings['temp'] || 'Private'}
                onChange={(e) => setPrivacySettings((prev) => ({ ...prev, temp: e.target.value }))}
              >
                <option>Private</option>
                <option>Public</option>
              </select>
              <button
                onClick={saveNoteToBackend}
                disabled={saving || isRecording || !noteTitle.trim() || !chunks.length || (fromPlanner && !studyContext)}
                className={`flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition ${showSaveAnimation ? 'scale-95 opacity-0' : 'scale-100 opacity-100'} ${(!noteTitle.trim() || !chunks.length) && 'opacity-50 cursor-not-allowed'}`}
              >
                <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Note'}
              </button>
            </>
          )}
        </div>

        {micPermissionError && (
          <div className="bg-red-100 border-2 border-red-400 p-4 rounded-lg mt-4">
            <p role="alert" className="text-red-700 font-medium">{micPermissionError}</p>
          </div>
        )}

        <canvas ref={canvasRef} className="mt-4 w-full h-24 rounded bg-gray-100" />

        {isRecording && (
          <div className={`mt-6 p-4 rounded-lg border ${isPaused ? 'bg-gray-100 border-gray-200' : 'bg-gray-50 border-gray-100'}`}>
            <p className="text-gray-700 min-h-[3rem]">{isPaused ? '— Paused —' : (transcript || 'Listening...')}</p>
          </div>
        )}

        {audioUrl && !isRecording && (
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <audio controls src={audioUrl} className="min-w-0 w-full flex-1 basis-56" />
            <a href={audioUrl} download={`voice_note_${Date.now()}${getExtensionForMime(mimeTypeRef.current)}`} className="flex items-center gap-2 text-purple-600 hover:text-purple-700">
              <Download className="h-4 w-4" /> Download
            </a>
          </div>
        )}
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-6">{fromPlanner ? 'Saved memos for this activity' : 'Saved Notes'}</h2>
      {Array.isArray(filtered) && filtered.length > 0 ? (
        filtered.map((note) => (
          <div key={note.id} className="min-w-0 bg-white p-4 sm:p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow mb-4 flex flex-col md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <h4 className="text-lg font-semibold text-gray-900 mb-1">{note.title || 'Untitled'}</h4>
              {note.sourceTopic && <p className="mb-2 break-words text-sm text-blue-700">Study topic: {note.sourceTopic}</p>}
              <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-gray-500">
                <span>{note.timestamp}</span>
                <span className="text-gray-400">({formatDuration(note.duration)})</span>
                <span className="ml-4 font-medium text-gray-600">Privacy: {note.visibility || 'Private'}</span>
                <div className="flex flex-wrap gap-2 ml-4">
                  {(note.tags || []).map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                      <TagIcon size={12} /> {t}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-gray-900 mb-4 whitespace-pre-wrap">{note.text}</p>
              {note.audio_url && (<audio controls src={note.audio_url} className="min-w-0 w-full" />)}
            </div>

            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <select
                value={note.visibility || 'Private'}
                onChange={(e) => handlePrivacyChange(note.id, e.target.value)}
                className="p-2 border border-gray-300 rounded"
              >
                <option>Private</option>
                <option>Public</option>
              </select>

              <button onClick={() => handleShare(note)} className="text-purple-600 hover:text-purple-800">
                <Share2 className="h-6 w-6" />
              </button>

              {note.audio_url && (
                <a href={note.audio_url} download={`voice_note_${note.id}${note.audio_filename ? note.audio_filename.substring(note.audio_filename.lastIndexOf('.')) : '.webm'}`} className="text-purple-600 hover:text-purple-800">
                  <Download className="h-6 w-6" />
                </a>
              )}

              <button onClick={() => deleteNote(note.id)} className="text-red-600 hover:text-red-800">
                <Trash2 className="h-6 w-6" />
              </button>
            </div>
          </div>
        ))
      ) : (
        <p className="text-gray-500">No voice notes found.</p>
      )}
    </div>
  );
};

export default VoiceNotes;
